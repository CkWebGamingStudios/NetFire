export async function onRequest(context) {
  const { request } = context;
  const urlObj = new URL(request.url);
  
  // Extract the target parameter from /proxy?url=...
  const targetUrl = urlObj.searchParams.get("url");
  
  if (!targetUrl) {
    return new Response("Missing target URL parameter.", { status: 400 });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    
    // Construct a clean request object to forward to the target site
    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      redirect: "follow"
    });

    // Spoof headers to prevent target site firewalls from blocking the request
    modifiedRequest.headers.set("Origin", parsedTarget.origin);
    modifiedRequest.headers.set("Referer", parsedTarget.origin);
    modifiedRequest.headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Fetch the external target webpage asset data
    const response = await fetch(modifiedRequest);

    // Create a mutable copy of the target response headers
    const newHeaders = new Headers(response.headers);

    // CRITICAL: Wipe out frame limitations to allow rendering inside your launcher's iframe
    newHeaders.delete("x-frame-options");
    newHeaders.delete("content-security-policy");
    
    // Add relaxed CORS access controls explicitly 
    newHeaders.set("Access-Control-Allow-Origin", "*");

    // Return the altered page directly back to your local iframe
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });

  } catch (error) {
    return new Response(`Proxy Error: ${error.message}`, { status: 500 });
  }
}
