import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(__dirname, "bundle.js");

// 启动时压一次：bundle 在函数实例生命周期内不变，逐请求压缩只是白烧 CPU。
// 压缩失败（文件缺失等）退化为不压缩，请求路径本身仍能正常返回 404/明文。
const gzipped = (() => {
  try {
    return zlib.gzipSync(fs.readFileSync(bundlePath), { level: 9 });
  } catch {
    return null;
  }
})();

function sendBundle(req, res) {
  // 不读 Accept-Encoding：SCF 的函数 URL 网关会把它改写成 `identity`（实测），
  // 所以协商永远不命中。改为默认发 gzip —— 浏览器与油猴 @require 都必然支持，
  // 需要明文时用 /bundle.js?plain=1 兜底。
  const wantsPlain = req.url === "/bundle.js?plain=1";
  if (gzipped && !wantsPlain) {
    res.writeHead(200, {
      "Content-Type": "application/javascript",
      "Content-Encoding": "gzip",
      "Content-Length": gzipped.length,
      Vary: "Accept-Encoding",
    });
    res.end(gzipped);
    return;
  }

  fs.readFile(bundlePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/javascript",
      "Content-Length": data.length,
      Vary: "Accept-Encoding",
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/bundle.js") {
    sendBundle(req, res);
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(9000);
