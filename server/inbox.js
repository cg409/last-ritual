// The developers' inbox address, stored encrypted (AES-256-GCM) so it is not readable in the source or on GitHub, and
// only decrypted in memory when a report is sent. (This keeps it from casual eyes; anyone who can run this server
// code can of course still decrypt it - the real protection is that it never reaches the players' browsers.)
import crypto from 'crypto';

const BLOB = 'ouSKdezcUIZSrol80gwm/XHCzNwg6x0MhtcHcNV+CXII9YwwMS0Ds+I1O2M1W6cTupRhLm60zA==';

export function inboxAddress() {
  const raw = Buffer.from(BLOB, 'base64');
  const key = crypto.scryptSync(['tlr', 'ritual', 'seal', '7'].join('~'), Buffer.from('c2FsdC10bHI=', 'base64'), 32);
  const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}
