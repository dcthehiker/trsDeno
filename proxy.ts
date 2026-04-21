export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 根路径返回简单的提示页面
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(
        '<h1>API Proxy is Running!</h1><p>Usage: https://your-proxy.deno.dev/https://api.example.com/data</p>', 
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    // 核心修改：直接从原始 request.url 中裁切掉代理服务器的域名和第一个斜杠
    // 这样能完美保留目标 URL 中的 "://" 以及任何查询参数
    const targetUrl = request.url.substring(url.origin.length + 1);

    // 简单的安全性/规范性校验，防止被滥用或解析错误
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return new Response('Bad Request: Target URL must start with http:// or https://', { status: 400 });
    }

    console.log(`Proxying request to: ${targetUrl}`);

    try {
      // 构建传递给目标 API 的头部
      const headers = new Headers();
      const allowedHeaders = ['accept', 'content-type', 'authorization', 'user-agent'];

      for (const [key, value] of request.headers.entries()) {
        if (allowedHeaders.includes(key.toLowerCase())) {
          headers.set(key, value);
        }
      }

      const fetchOptions: RequestInit = {
        method: request.method,
        headers: headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
      };

      // 发送请求到真正的目标 URL
      const response = await fetch(targetUrl, fetchOptions);

      // 复制响应头并添加跨域支持和自定义标识
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('X-Proxy-Server', 'Deno New Deploy Proxy');
      responseHeaders.set('Referrer-Policy', 'no-referrer');
      
      // 新增：自动允许跨域请求 (CORS)，方便前端直接调用
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });
    } catch (error) {
      console.error('Failed to fetch target API:', error);
      return new Response('Internal Server Error: Could not reach the target URL', { status: 500 });
    }
  }
};
