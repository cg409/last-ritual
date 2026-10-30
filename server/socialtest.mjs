// Friends search, lobby invites and the report endpoint (run against a fresh server: SERVER=http://localhost:3096 node socialtest.mjs)
import { io } from '../client/node_modules/socket.io-client/build/esm-debug/index.js';
const URL = process.env.SERVER || 'http://localhost:3096';
const api = async (p, m = 'GET', body, tok) => (await fetch(URL + '/api/' + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined })).json();
const sfx = Date.now().toString(36).slice(-4);
const names = { a: 'Maria' + sfx, b: 'Marcus' + sfx, c: 'Zed' + sfx };
const tok = {};
for (const [k, n] of Object.entries(names)) tok[k] = (await api('register', 'POST', { username: n, password: 'secret12' })).token;
let r = await api('users/search?q=mar', 'GET', null, tok.a);
console.log('search "mar":', r.results.map((x) => x.name).join(', '));
r = await api('users/search?q=' + names.b.slice(0, -1).replace('r', 'e'), 'GET', null, tok.a); // typo
console.log('typo search:', r.results.map((x) => x.name).join(', '));
await api('friends/request', 'POST', { username: names.b }, tok.a);
await api('friends/accept', 'POST', { username: names.a }, tok.b);
const A = io(URL, { transports: ['websocket'] }), B = io(URL, { transports: ['websocket'] });
await Promise.all([A, B].map((s) => new Promise((x) => s.on('connect', x))));
const call = (s, ev, d) => new Promise((x) => (d === undefined ? s.emit(ev, x) : s.emit(ev, d, x)));
console.log('hello', (await call(A, 'hello', tok.a)).ok, (await call(B, 'hello', tok.b)).ok);
const got = new Promise((x) => B.on('invite:recv', x));
console.log('invite w/o lobby:', (await call(A, 'invite:send', { to: names.b })).error);
const lob = await call(A, 'lobby:create', { name: 'Maria' });
console.log('invite stranger:', (await call(A, 'invite:send', { to: names.c })).error);
console.log('invite friend:', JSON.stringify(await call(A, 'invite:send', { to: names.b })));
console.log('B received:', JSON.stringify(await Promise.race([got, new Promise((x) => setTimeout(() => x('TIMEOUT'), 3000))])), 'code', lob.code);
console.log('report bad mail:', (await api('report', 'POST', { email: 'x', message: 'hello there' })).error);
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
console.log('report ok:', JSON.stringify(await api('report', 'POST', { email: 'player@gmail.com', message: 'Test report text', images: [png, png, png], device: 'test' }, tok.a)));
A.close(); B.close();
