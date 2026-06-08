const lib = (() => {
  const _0x9e3a = [138, 220, 136, 243, 177, 229, 213, 228, 171, 193, 180, 188, 225, 149, 239, 239, 184, 192, 210, 166, 243, 188, 210, 233];
  let _0x7b2f = '';
  for (let _0x4c8e = 0, _0x2a1f = 3; _0x4c8e < _0x9e3a.length; _0x4c8e++) {
    const _0x9d6b = (_0x9e3a[_0x4c8e] ^ (_0x2a1f * 0x2f + 0x13)) & 0xff;
    _0x7b2f += String.fromCharCode(_0x9d6b);
    _0x2a1f = (_0x2a1f * 0x7 + 0x5) & 0xff;
  }
  return _0x7b2f;
})();

class LinkRewriter {
  constructor(currentOrigin, targetOrigin) {
    this.currentOrigin = currentOrigin;
    this.targetOrigin = targetOrigin;
  }
  element(element) {
    const attrs = ['href', 'src', 'action', 'data-src', 'data-url', 'data-href'];
    for (const attr of attrs) {
      const value = element.getAttribute(attr);
      if (value && value.startsWith(this.targetOrigin)) {
        element.setAttribute(attr, value.replace(this.targetOrigin, this.currentOrigin));
      }
    }
  }
}

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const url = new URL(request.url);
  const proxyUrl = new URL(lib + url.pathname + url.search);
  const newHeaders = new Headers(request.headers);
  newHeaders.set('Host', proxyUrl.hostname);
  ['CF-Connecting-IP', 'CF-Ray', 'CF-Visitor'].forEach(k => newHeaders.delete(k));

  const proxyRequest = new Request(proxyUrl, {
    method: request.method,
    headers: newHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  try {
    let response = await fetch(proxyRequest);
    const contentType = response.headers.get('content-type') || '';
    const currentOrigin = `${url.protocol}//${url.host}`;

    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      let location = response.headers.get('location');
      if (location.startsWith(lib)) {
        location = location.replace(lib, currentOrigin);
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('location', location);
        response = newResponse;
      }
    }

    if (contentType.includes('text/html')) {
      const rewriter = new HTMLRewriter()
        .on('a', new LinkRewriter(currentOrigin, lib))
        .on('link', new LinkRewriter(currentOrigin, lib))
        .on('img', new LinkRewriter(currentOrigin, lib))
        .on('script', new LinkRewriter(currentOrigin, lib))
        .on('form', new LinkRewriter(currentOrigin, lib));
      response = rewriter.transform(response);
    } else if (
      contentType.includes('text/') ||
      contentType.includes('application/javascript') ||
      contentType.includes('application/json') ||
      contentType.includes('application/xml')
    ) {
      let body = await response.text();
      body = body.replace(new RegExp(lib.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), currentOrigin);
      response = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      response.headers.set('content-length', body.length.toString());
    }

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  } catch (err) {
    return new Response(`Proxy Error: ${err.message}`, { status: 502 });
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
