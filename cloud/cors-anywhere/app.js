"use strict";
// 插件的通用 CORS 转发（广州 / 香港各部署一份，代码相同）。
//
// 改动记录（2026-11-03）：
// - 不再关闭 TLS 校验：原先 rejectUnauthorized: false 让中间人可以冒充上游。
// - 上游 set-cookie 不再原样透传：只放在 X-Proxy-Set-Cookie 里，避免往代理域名种 cookie。
// - 加上游超时：B 站慢响应会把函数挂到网关超时。
//
// 注意：B 站搜索对云函数出口 IP 有风控（v_voucher），这与本文件无关——登录态下才稳定。

var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");

const UPSTREAM_TIMEOUT_MS = 20000;

// ================= CORS =================
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "*");
}
// ================= body parser =================
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
// ================= helper =================
function buildCookie(cookieRaw) {
  if (!cookieRaw) return undefined;
  try {
    return decodeURIComponent(cookieRaw);
  } catch {
    return cookieRaw;
  }
}
// ================= main =================
async function requestHandler(req, res) {
  try {
    const { method, headers } = req;
    const urlObj = new url_1.URL(req.url || "", `http://${req.headers.host}`);
    const targetUrlRaw = urlObj.searchParams.get("url");
    const cookieRaw = urlObj.searchParams.get("cookie");
    if (!targetUrlRaw) {
      setCors(res);
      res.writeHead(400);
      res.end("Missing url param");
      return;
    }
    const parsedUrl = new url_1.URL(targetUrlRaw);
    // ================= cookie =================
    const decodedCookie = buildCookie(cookieRaw);
    // ================= body =================
    let rawBody = "";
    if (method === "POST") {
      rawBody = await parseBody(req);
    }
    // ================= query merge（关键修复）=================
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (key === "url" || key === "cookie") continue;
      parsedUrl.searchParams.set(key, value);
    }
    // ================= headers =================
    const forwardHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      if (!v) continue;
      const key = k.toLowerCase();
      if (key === "host") continue;
      if (key === "content-length") continue;
      // 必须过滤这些：由下面按目标域名重新设置
      if (key === "origin") continue;
      if (key === "referer") continue;
      forwardHeaders[k] = v;
    }
    // ================= cookie inject =================
    if (decodedCookie) {
      forwardHeaders["Cookie"] = decodedCookie;
    }
    // ================= ⭐ Origin / Referer（核心修复）=================
    const host = parsedUrl.hostname;
    const isBili = host.includes("bilibili.com");
    if (isBili) {
      forwardHeaders["Origin"] = "https://www.bilibili.com";
      forwardHeaders["Referer"] = "https://www.bilibili.com/";
    }
    forwardHeaders["Host"] = parsedUrl.host;
    if (rawBody) {
      console.log("\n--- RAW BODY ---");
      console.log(rawBody);
    }
    // ================= request =================
    const handleResponse = (proxyRes) => {
      const chunks = [];
      proxyRes.on("data", (c) => chunks.push(c));
      proxyRes.on("end", () => {
        const buffer = Buffer.concat(chunks);
        setCors(res);
        const setCookies = proxyRes.headers["set-cookie"];
        // 上游 set-cookie 不能透传：它会被种到代理自己的域名下。
        const responseHeaders = { ...proxyRes.headers };
        delete responseHeaders["set-cookie"];
        responseHeaders["Access-Control-Allow-Origin"] = "*";
        responseHeaders["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
        responseHeaders["Access-Control-Allow-Headers"] = "*";
        responseHeaders["Access-Control-Expose-Headers"] = "X-Proxy-Set-Cookie";
        if (setCookies?.length) {
          responseHeaders["X-Proxy-Set-Cookie"] = JSON.stringify(setCookies);
        }
        res.writeHead(proxyRes.statusCode || 500, responseHeaders);
        res.end(buffer);
      });
    };

    // 发一次上游请求；超时与错误都直接回给调用方。
    const fire = (headers, onResponse) => {
      const req = (
        parsedUrl.protocol === "https:" ? https_1.default : http_1.default
      ).request(parsedUrl, { method, headers }, onResponse);
      // 上游不响应时不要挂着：网关有超时，挂住只会让调用方等满。
      req.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
        req.destroy(
          new Error(`upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms`),
        );
      });
      req.on("error", (err) => {
        console.log("PROXY ERROR:", err.message);
        if (res.headersSent) return;
        setCors(res);
        res.writeHead(504);
        res.end("Proxy error: " + err.message);
      });
      if (method === "POST") req.write(rawBody);
      req.end();
      return req;
    };

    fire(forwardHeaders, (proxyRes) => {
      // B 站按 UA 分流：浏览器 UA 的请求必须带有效 buvid / cookie，否则判爬虫直接 412
      // （实测 x/web-interface/view：curl UA 200、Chrome UA 412，补齐 Sec-Fetch-* 也没用）。
      // 但搜索接口反过来——curl UA 会拿到 v_voucher。所以不统一改 UA，只在真的吃到
      // 412 时用 API 客户端 UA 重放一次：未受影响（含带 cookie）的请求保持浏览器 UA，
      // 也不会出现「登录前后 UA 跳变」的问题。
      if (proxyRes.statusCode === 412 && isBili && method === "GET") {
        proxyRes.resume();
        proxyRes.on("end", () => {
          console.log("BILIBILI 412 -> retry with curl UA");
          const retryHeaders = { ...forwardHeaders };
          delete retryHeaders["user-agent"];
          retryHeaders["User-Agent"] = "curl/8.14.1";
          fire(retryHeaders, handleResponse);
        });
        return;
      }
      handleResponse(proxyRes);
    });
  } catch (err) {
    console.log("FATAL ERROR:", err);
    if (res.headersSent) return;
    setCors(res);
    res.writeHead(500);
    res.end("Internal error");
  }
}
// ================= server =================
const server = http_1.default.createServer(requestHandler);
const PORT = 9000;
server.listen(PORT, () => {
  console.log(`CORS proxy running on http://localhost:${PORT}`);
});
