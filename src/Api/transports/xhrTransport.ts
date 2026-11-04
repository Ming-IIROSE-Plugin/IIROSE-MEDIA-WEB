// src/Api/transports/xhrTransport.ts
// SendFetch 的 XHR 传输：宿站需要真实 XHR 的路径（不带 Origin 头）与它的连通性探测。
// 门面留在 `Api/index.ts`，这里不读 this。

export async function sendGetXHR(
  url: string,
  params: URLSearchParams,
  headers: Headers,
) {
  const fullUrl = `${url}?${params.toString()}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    headers.forEach((value, key) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.open("GET", fullUrl, true);
    xhr.setRequestHeader("Origin", ""); // 设置 Origin 为空
    xhr.onreadystatechange = function () {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          // 请求成功，将响应返回
          resolve(xhr.responseText);
        } else {
          // 请求失败，返回错误信息
          reject(new Error(`Request failed with status: ${xhr.status}`));
        }
      }
    };
    xhr.send();
  });
}

export async function tryGetWhithXhr(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("HEAD", url, true); // 使用 HEAD 请求方法
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(true); // 请求成功，返回 true
      } else {
        resolve(false); // 请求失败，返回 false
      }
    };
    xhr.onerror = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(true); // 请求成功，返回 true
      }
      resolve(false); // 请求出错，返回 false
    };
    xhr.send(); // 发送请求
  });
}
