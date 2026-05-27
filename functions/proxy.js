export async function onRequest(context) {
  const { request } = context;
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get("url");
  
  if (!targetUrl) {
    return new Response("Missing target URL parameter.", { status: 400 });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    
    // 1. Gather all authentic visitor headers sent by the user's actual browser
    const forwardHeaders = new Headers();
    
    // List of standard headers we want to pass through cleanly
    const headersToCopy = [
      "user-agent",
      "accept",
      "accept-language",
      "accept-encoding",
      "cache-control",
      "pragma"
    ];

    for (const headerName of headersToCopy) {
      const value = request.headers.get(headerName);
      if (value) {
        forwardHeaders.set(headerName, value);
      }
    }

    // 2. Extract the user's real IP and network metadata provided by Cloudflare
    const visitorIP = request.headers.get("CF-Connecting-IP") || "";
    const visitorCountry = request.headers.get("CF-IPCountry") || "";

    // 3. Inject explicit forwarding headers used by proxies
    if (visitorIP) {
      forwardHeaders.set("X-Forwarded-For", visitorIP);
      forwardHeaders.set("X-Real-IP", visitorIP);
    }
    if (visitorCountry) {
      forwardHeaders.set("CF-IPCountry", visitorCountry);
    }

    // 4. Force host matching to avoid instant data-center routing rejections
    forwardHeaders.set("Host", parsedTarget.host);
    forwardHeaders.set("Origin", parsedTarget.origin);
    forwardHeaders.set("Referer", parsedTarget.origin);

    // Create the modified outgoing request configuration
    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
      redirect: "follow"
    });

    const response = await fetch(modifiedRequest);
    const contentType = response.headers.get("content-type") || "";

    // Build mutable response headers to clear frame barriers
    const newHeaders = new Headers(response.headers);
    newHeaders.delete("x-frame-options");
    newHeaders.delete("content-security-policy");
    newHeaders.set("Access-Control-Allow-Origin", "*");

    // Handle relative pathway DOM manipulation via <base> tag injection
    if (contentType.includes("text/html")) {
      let htmlText = await response.text();
      const baseOrigin = targetUrl.endsWith('/') ? targetUrl : targetUrl + '/';
      const baseTag = `<head><base href="${baseOrigin}">`;
      
      if (htmlText.includes("<head>")) {
        htmlText = htmlText.replace("<head>", baseTag);
      } else if (htmlText.includes("<HEAD>")) {
        htmlText = htmlText.replace("<HEAD>", baseTag);
      } else {
        htmlText = `<base href="${baseOrigin}">` + htmlText;
      }

      return new Response(htmlText, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    // Pass through binary data (images, scripts, styles) smoothly
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });

  } catch (error) {
    return new Response(`Proxy Error: ${error.message}`, { status: 500 });
  }
}