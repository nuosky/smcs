const _0x3f2a = (() => {
  const _0x1a2b = '3d3c3e3b3a3f2e3d3c3e';
  let _0x4c5d = '';
  for (let _0x6e7f = 0; _0x6e7f < _0x1a2b.length; _0x6e7f += 2) {
    _0x4c5d += String.fromCharCode(parseInt(_0x1a2b.substr(_0x6e7f, 2), 16) - 5);
  }
  const _0x8g9h = ['c', '2', '1', 'j', 'c', 'y', '5', '3', 'w', 'b', '3', 'J', 'r', 'Z', 'X', 'J', 'z', 'L', 'm', 'R', 'l', 'd', 'g', '=='];
  let _0x0i1j = '';
  for (let _0x2k3l = 0; _0x2k3l < _0x8g9h.length; _0x2k3l++) {
    _0x0i1j += _0x8g9h[_0x2k3l];
  }
  const _0x4m5n = _0x0i1j.split('').reverse().join('');
  let _0x6o7p = '';
  for (let _0x8q9r = 0; _0x8q9r < _0x4m5n.length; _0x8q9r++) {
    _0x6o7p += String.fromCharCode(_0x4m5n.charCodeAt(_0x8q9r) ^ 3);
  }
  return _0x4c5d.split('').reverse().join('') + _0x6o7p;
})();

const __LIB__ = _0x3f2a;

class ElementHandler {
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
  const proxyUrl = new URL(__LIB__ + url.pathname + url.search);
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
      if (location.startsWith(__LIB__)) {
        location = location.replace(__LIB__, currentOrigin);
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('location', location);
        response = newResponse;
      }
    }

    if (contentType.includes('text/html')) {
      const rewriter = new HTMLRewriter()
        .on('a', new ElementHandler(currentOrigin, __LIB__))
        .on('link', new ElementHandler(currentOrigin, __LIB__))
        .on('img', new ElementHandler(currentOrigin, __LIB__))
        .on('script', new ElementHandler(currentOrigin, __LIB__))
        .on('form', new ElementHandler(currentOrigin, __LIB__));
      response = rewriter.transform(response);
    } else if (
      contentType.includes('text/') ||
      contentType.includes('application/javascript') ||
      contentType.includes('application/json') ||
      contentType.includes('application/xml')
    ) {
      let body = await response.text();
      body = body.replace(new RegExp(__LIB__.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), currentOrigin);
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
