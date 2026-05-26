export async function onRequest(context) {
  const { request } = context;
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get("url");
  
  if (!targetUrl) {
    return new Response("Missing target URL parameter.", { status: 400 });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    
    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      redirect: "follow"
    });

    modifiedRequest.headers.set("Origin", parsedTarget.origin);
    modifiedRequest.headers.set("Referer", parsedTarget.origin);
    modifiedRequest.headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const response = await fetch(modifiedRequest);
    const contentType = response.headers.get("content-type") || "";

    // Modify the headers to remove frame constraints
    const newHeaders = new Headers(response.headers);
    newHeaders.delete("x-frame-options");
    newHeaders.delete("content-security-policy");
    newHeaders.set("Access-Control-Allow-Origin", "*");

    // IF THE RESOURCE IS HTML: Inject the <base> tag to fix relative assets
    if (contentType.includes("text/html")) {
      let htmlText = await response.text();
      
      // Ensure the target URL ends with a trailing slash for proper relative asset resolution
      const baseOrigin = targetUrl.endsWith('/') ? targetUrl : targetUrl + '/';
      const baseTag = `<head><base href="${baseOrigin}">`;
      
      // Inject our base rules right where the head element begins
      if (htmlText.includes("<head>")) {
        htmlText = htmlText.replace("<head>", baseTag);
      } else if (htmlText.includes("<HEAD>")) {
        htmlText = htmlText.replace("<HEAD>", baseTag);
      } else {
        // Fallback if no head tag exists in the source DOM
        htmlText = `<base href="${baseOrigin}">` + htmlText;
      }

      return new Response(htmlText, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    // For images, stylesheets, or direct JS assets, pipe the raw body stream straight through
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });

  } catch (error) {
    return new Response(`Proxy Error: ${error.message}`, { status: 500 });
  }
}