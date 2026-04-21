export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. 定义全局跨域 (CORS) 头信息
    // 动态获取浏览器请求的 Headers，如果没获取到，就默认允许所有常用的头
    const requestedHeaders = request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization, x-api-key, x-goog-api-key";
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // 允许任何前端域名访问
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': requestedHeaders,
      'Access-Control-Max-Age': '86400', // 缓存预检结果 24 小时，减少 OPTIONS 请求次数，提升性能
    };

    // 2. 【核心修复】拦截并立刻响应 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204, // 204 No Content，告诉浏览器预检通过
        headers: corsHeaders 
      });
    }

    // 3. 根路径返回简单的提示页面
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(
        '<h1>API Proxy is Running!</h1><p>Usage: https://your-proxy.deno.dev/https://api.example.com/data</p>', 
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // 4. 构造目标 URL（裁切掉代理服务器自己的域名部分）
    const targetUrl = request.url.substring(url.origin.length + 1);

    // 安全性校验
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return new Response('Bad Request: Target URL must start with http:// or https://', { 
        status: 400,
        headers: corsHeaders // 报错时也带上跨域头，防止前端拿不到报错信息
      });
    }

    console.log(`Proxying request to: ${targetUrl}`);

    try {
      // 5. 组装发给真实 API 的请求
      const headers = new Headers();
      // 这里可以不限制，直接透传前端发来的大部分请求头
      for (const [key, value] of request.headers.entries()) {
        // 过滤掉 host 头，防止目标服务器解析错误
        if (key.toLowerCase() !== 'host') {
          headers.set(key, value);
        }
      }

      const fetchOptions: RequestInit = {
        method: request.method,
        headers: headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
      };

      // 6. 发送真实请求
      const response = await fetch(targetUrl, fetchOptions);

      // 7. 处理真实响应，并将 CORS 头部合并进去返回给前端
      const responseHeaders = new Headers(response.headers);
      
      // 注入跨域头（必须项，否则前端依然报错）
      for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value);
      }
      
      // 添加自定义标识
      responseHeaders.set('X-Proxy-Server', 'Deno Modern Proxy');

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (error) {
      console.error('Failed to fetch target API:', error);
      return new Response('Internal Server Error: Could not reach the target URL', { 
        status: 500,
        headers: corsHeaders 
      });
    }
  }
};
