import { encryptString, decryptString } from "./crypto";

// Self-describing envelope for an encrypted OneFinance export/backup. The header
// fields stay readable so an import can recognize the file and its format version
// without the password; only `data` (the JSON payload) is encrypted.
interface EncryptedExportEnvelope {
  onefinance: true;
  encrypted: true;
  formatVersion: number;
  data: string; // encryptString() output of the JSON payload
}

const EXPORT_FORMAT_VERSION = 1;

export function wrapExport(jsonString: string, password: string): string {
  const envelope: EncryptedExportEnvelope = {
    onefinance: true,
    encrypted: true,
    formatVersion: EXPORT_FORMAT_VERSION,
    data: encryptString(jsonString, password),
  };
  return JSON.stringify(envelope, null, 2);
}

function isEncryptedEnvelope(value: unknown): value is EncryptedExportEnvelope {
  const v = value as Record<string, unknown> | null;
  return typeof v === "object" && v !== null && v.encrypted === true && typeof v.data === "string";
}

/**
 * Parse an import file's text into the data object the renderer expects.
 * - Encrypted OneFinance files are decrypted with the password (throws on a wrong
 *   password or tampering).
 * - Legacy plaintext exports (a bare JSON object with databaseVersion) pass through
 *   unchanged, so data exported before encryption still imports — this is the path
 *   used to migrate existing data into a freshly-encrypted database.
 */
export function readImport(fileText: string, password: string): unknown {
  const parsed = JSON.parse(fileText);
  if (isEncryptedEnvelope(parsed)) {
    return JSON.parse(decryptString(parsed.data, password));
  }
  return parsed;
}
