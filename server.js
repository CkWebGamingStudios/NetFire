const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files (index.html, apps.json, images)
app.use(express.static(path.join(__dirname, 'public')));

// Proxy route logic handling structural modifications
app.use('/proxy', (req, res, next) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Missing target URL parameters.');
    }

    try {
        const parsedUrl = new URL(targetUrl);
        const targetOrigin = parsedUrl.origin;

        createProxyMiddleware({
            target: targetOrigin,
            changeOrigin: true,
            followRedirects: true,
            pathRewrite: (pathStr, reqContext) => {
                // Strip down /proxy prefix and forward raw pathing parameters cleanly
                const urlParam = new URL(reqContext.url, `http://${reqContext.headers.host}`).searchParams.get('url');
                const destination = new URL(urlParam);
                return destination.pathname + destination.search;
            },
            onProxyReq: (proxyReq, reqInstance) => {
                // Inject typical browser identity headers to bypass firewalls
                proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                proxyReq.setHeader('Origin', targetOrigin);
                proxyReq.setHeader('Referer', targetOrigin);
            },
            onProxyRes: (proxyRes) => {
                // Delete security rules that intentionally break frames
                delete proxyRes.headers['x-frame-options'];
                delete proxyRes.headers['content-security-policy'];

                // Relax frame security explicitly if needed
                proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            },
            onError: (err, proxyReq, proxyResponse) => {
                console.error('Proxy routing exception:', err);
                proxyResponse.status(500).send('Proxy Connection Faulted.');
            }
        })(req, res, next);

    } catch (err) {
        return res.status(400).send('Invalid target URL formatting.');
    }
});

app.listen(PORT, () => {
    console.log(`Application reverse proxy backend available online at http://localhost:${PORT}`);
});