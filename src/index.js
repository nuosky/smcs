const TARGET_URL = 'https://www.smcs.workers.dev';
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
'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cookie',
'Access-Control-Allow-Credentials': 'true',
'Access-Control-Max-Age': '86400',
},
});
}
const url = new URL(request.url);
const proxyUrl = new URL(TARGET_URL + url.pathname + url.search);
const newHeaders = new Headers(request.headers);
newHeaders.set('Host', proxyUrl.hostname);
['CF-Connecting-IP', 'CF-Ray', 'CF-Visitor'].forEach(k => newHeaders.delete(k));
let bodyBuffer = null;
if (request.method !== 'GET' && request.method !== 'HEAD') {
bodyBuffer = await request.arrayBuffer();
}
const proxyRequest = new Request(proxyUrl, {
method: request.method,
headers: newHeaders,
body: bodyBuffer,
redirect: 'manual',
});
try {
let response = await fetch(proxyRequest);
let finalResponse = response;
const currentOrigin = `${url.protocol}//${url.host}`;
if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
let location = response.headers.get('location');
if (location.startsWith(TARGET_URL)) {
location = location.replace(TARGET_URL, currentOrigin);
const newResponse = new Response(response.body, response);
newResponse.headers.set('location', location);
finalResponse = newResponse;
}
}
const contentType = finalResponse.headers.get('content-type') || '';
if (contentType.includes('text/html')) {
const rewriter = new HTMLRewriter()
.on('a', new LinkRewriter(currentOrigin, TARGET_URL))
.on('link', new LinkRewriter(currentOrigin, TARGET_URL))
.on('img', new LinkRewriter(currentOrigin, TARGET_URL))
.on('script', new LinkRewriter(currentOrigin, TARGET_URL))
.on('form', new LinkRewriter(currentOrigin, TARGET_URL));
finalResponse = rewriter.transform(finalResponse);
}
finalResponse.headers.set('Access-Control-Allow-Origin', '*');
finalResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
finalResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
finalResponse.headers.set('Access-Control-Allow-Credentials', 'true');
return finalResponse;
} catch (err) {
return new Response(`Proxy Error: ${err.message}`, { status: 502 });
}
}
addEventListener('fetch', event => {
event.respondWith(handleRequest(event.request));
});
