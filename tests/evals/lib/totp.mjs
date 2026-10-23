// RFC 6238 TOTP (SHA-1, 6 digits, 30 s), the code an authenticator app shows. Phase 66 D-07:
// evals and scripts/eval-mfa-fixtures.mjs compute codes with Node crypto, no new dependency.
import crypto from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** @param {string} secret base32 @returns {Buffer} */
function base32(secret) {
  let bits = ''
  for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += ALPHABET.indexOf(c).toString(2).padStart(5, '0')
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

/** @param {string} secret base32 @param {number} [at] ms since epoch @returns {string} */
export function totp(secret, at = Date.now()) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)))
  const h = crypto.createHmac('sha1', base32(secret)).update(counter).digest()
  const o = h[19] & 15
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}
