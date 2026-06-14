import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

// AES-256-GCM authenticated encryption with scrypt key derivation.
//
// GCM verifies an authentication tag on every decrypt, so a wrong password or a
// single altered byte makes decryption throw rather than silently return
// corrupt data. That is the core guarantee against silent data loss.
//
// Envelope layout (raw bytes, then base64-encoded for storage):
//   key-based:      [0x01][iv:12][tag:16][ciphertext]
//   password-based: [0x02][salt:16][iv:12][tag:16][ciphertext]
// The salt and IV are not secret and are stored next to the ciphertext; the
// password is the only secret. The leading byte identifies the layout so the
// scheme can evolve later without breaking data already on disk.

const KEY_FORMAT = 0x01;
const PASSWORD_FORMAT = 0x02;

const SALT_BYTES = 16;
const IV_BYTES = 12; // GCM standard nonce length
const TAG_BYTES = 16;
const KEY_BYTES = 32; // AES-256

// scrypt cost: higher N means slower derivation, which throttles brute-force
// guessing of the master password. maxmem is set above 128*N*r so Node accepts it.
const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// A fixed known value encrypted by createVerifier; being able to decrypt it back
// proves the password is correct without unlocking any real data.
const VERIFIER_PLAINTEXT = "one-finance::master-password::v1";

export function generateSalt(): Buffer {
  return randomBytes(SALT_BYTES);
}

export function deriveKey(password: string, salt: Buffer): Buffer {
  if (typeof password !== "string") {
    throw new TypeError("password must be a string");
  }
  if (!Buffer.isBuffer(salt) || salt.length !== SALT_BYTES) {
    throw new Error(`salt must be a ${SALT_BYTES}-byte Buffer`);
  }
  return scryptSync(password, salt, KEY_BYTES, SCRYPT_PARAMS);
}

function assertKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new Error(`key must be a ${KEY_BYTES}-byte Buffer`);
  }
}

// A fresh random IV is generated here on every call. Reusing an IV with the same
// key would break GCM, so callers never get to supply one.
function aesGcmEncrypt(
  plaintext: string,
  key: Buffer
): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext };
}

function aesGcmDecrypt(iv: Buffer, tag: Buffer, ciphertext: Buffer, key: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  // final() throws if the tag does not verify (wrong key or tampered bytes).
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function encryptWithKey(plaintext: string, key: Buffer): string {
  assertKey(key);
  const { iv, tag, ciphertext } = aesGcmEncrypt(plaintext, key);
  return Buffer.concat([Buffer.from([KEY_FORMAT]), iv, tag, ciphertext]).toString("base64");
}

export function decryptWithKey(envelope: string, key: Buffer): string {
  assertKey(key);
  const buf = Buffer.from(envelope, "base64");
  if (buf.length < 1 + IV_BYTES + TAG_BYTES || buf[0] !== KEY_FORMAT) {
    throw new Error("Invalid or unsupported encryption envelope");
  }
  let offset = 1;
  const iv = buf.subarray(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const tag = buf.subarray(offset, offset + TAG_BYTES);
  offset += TAG_BYTES;
  const ciphertext = buf.subarray(offset);
  return aesGcmDecrypt(iv, tag, ciphertext, key);
}

export function encryptString(plaintext: string, password: string): string {
  const salt = generateSalt();
  const key = deriveKey(password, salt);
  const { iv, tag, ciphertext } = aesGcmEncrypt(plaintext, key);
  return Buffer.concat([Buffer.from([PASSWORD_FORMAT]), salt, iv, tag, ciphertext]).toString(
    "base64"
  );
}

export function decryptString(envelope: string, password: string): string {
  const buf = Buffer.from(envelope, "base64");
  if (buf.length < 1 + SALT_BYTES + IV_BYTES + TAG_BYTES || buf[0] !== PASSWORD_FORMAT) {
    throw new Error("Invalid or unsupported encryption envelope");
  }
  let offset = 1;
  const salt = buf.subarray(offset, offset + SALT_BYTES);
  offset += SALT_BYTES;
  const iv = buf.subarray(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const tag = buf.subarray(offset, offset + TAG_BYTES);
  offset += TAG_BYTES;
  const ciphertext = buf.subarray(offset);
  const key = deriveKey(password, salt);
  return aesGcmDecrypt(iv, tag, ciphertext, key);
}

export function createVerifier(password: string): string {
  return encryptString(VERIFIER_PLAINTEXT, password);
}

export function verifyPassword(verifier: string, password: string): boolean {
  try {
    return decryptString(verifier, password) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
