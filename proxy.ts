// proxy.ts

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // 根路径返回一个简单的提示页面
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return new Response('<h1>API Proxy is Running on New Deno Deploy!</h1>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // 构造目标 URL（修复：补充了 url.search 以保留查询参数，如 ?id=1）
  const targetUrl = `https://${url.pathname.substring(1)}${url.search}`; 
  console.log(`Proxying request to: ${targetUrl}`);

  try {
    // 构建传递给目标 API 的头部
    const headers = new Headers();
    const allowedHeaders = ['accept', 'content-type', 'authorization', 'user-agent'];

    // 只传递需要的头部
    for (const [key, value] of request.headers.entries()) {
      if (allowedHeaders.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }

    // 处理原始请求的方法和主体
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
    };

    // 向目标 API 发送请求
    const response = await fetch(targetUrl, fetchOptions);

    // 复制目标响应的头部，并添加自己的自定义头部
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Proxy-Server', 'Deno New Deploy Proxy');
    responseHeaders.set('Referrer-Policy', 'no-referrer');

    // 返回响应，保持状态码和主体
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('Failed to fetch target API:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// 推荐的新平台写法：直接导出 fetch 处理函数
// Deno Deploy 会自动接管它并分配正确的端口和运行环境
export default {
  fetch: handleRequest
};
