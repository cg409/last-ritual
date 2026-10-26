// Multiplayer integration test: 2 clients create/join a lobby, pick skins, start, receive snapshots.
import { io } from '../client/node_modules/socket.io-client/build/esm-debug/index.js';
const URL = process.env.SERVER || 'http://localhost:3000';
const mk = () => io(URL, { transports: ['websocket'] });
const call = (s, ev, d) => new Promise((r) => s.emit(ev, d, r));
const a = mk(), b = mk();
await Promise.all([a, b].map((s) => new Promise((r) => s.on('connect', r))));
const ca = await call(a, 'lobby:create', { name: 'Alice' });
console.log('create', ca);
const jb = await call(b, 'lobby:join', { name: 'Bob', code: ca.code });
console.log('join', jb);
let lastState;
a.on('lobby:state', (s) => (lastState = s));
b.emit('lobby:update', { skin: 'warden' }); // taken by Alice -> must be rejected
a.emit('lobby:update', { monsterPref: 'ravager' });
await new Promise((r) => setTimeout(r, 300));
console.log('members', lastState.members.map((m) => `${m.name}:${m.skin}:${m.monsterPref}`).join(' | '));
let snaps = 0, last;
b.on('snap', (s) => { snaps++; last = s; });
const started = new Promise((r) => b.on('match:start', r));
a.emit('lobby:start');
const ms = await started;
console.log('match seed', ms.seed, 'players', ms.snapshot.players.map((p) => `${p.name}(${p.role}${p.isBot ? ',bot' : ''})`).join(', '));
// Bob walks forward for 2 seconds
const t0 = Date.now();
const bob0 = ms.snapshot.players.find((p) => p.id === b.id);
while (Date.now() - t0 < 2000) { b.emit('input', { mx: 1, mz: 0, run: true, actions: [] }); await new Promise((r) => setTimeout(r, 50)); }
const bob1 = last.players.find((p) => p.id === b.id);
console.log('snaps/2s', snaps, 'bob moved', Math.hypot(bob1.x - bob0.x, bob1.z - bob0.z).toFixed(2), 'm, state', bob1.state, 'role', bob1.role);
b.disconnect();
await new Promise((r) => setTimeout(r, 300));
const res = await new Promise((r) => a.once('snap', r));
console.log('after Bob left ->', res.players.find((p) => p.name.startsWith('Bob'))?.name);
a.disconnect();
process.exit(0);
