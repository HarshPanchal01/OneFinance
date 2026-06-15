import { describe, it, expect } from "vitest";
import { wrapExport, readImport } from "../electron/secureExport";

const PASSWORD = "correct horse battery staple";

describe("encrypted export round-trip", () => {
  it("wraps then reads back the original JSON", () => {
    const payload = JSON.stringify({ databaseVersion: 2, accounts: [{ id: 1, name: "Checking" }] });
    const file = wrapExport(payload, PASSWORD);
    expect(readImport(file, PASSWORD)).toEqual(JSON.parse(payload));
  });

  it("keeps a readable header but encrypts the payload", () => {
    const file = wrapExport(JSON.stringify({ note: "balance 9000" }), PASSWORD);
    const parsed = JSON.parse(file);
    expect(parsed.onefinance).toBe(true);
    expect(parsed.encrypted).toBe(true);
    expect(parsed.formatVersion).toBe(1);
    expect(typeof parsed.data).toBe("string");
    // The sensitive content must not appear in the file text.
    expect(file).not.toContain("balance 9000");
    expect(file).not.toContain("note");
  });
});

describe("wrong password", () => {
  it("throws when reading an encrypted export with the wrong password", () => {
    const file = wrapExport(JSON.stringify({ a: 1 }), PASSWORD);
    expect(() => readImport(file, "nope")).toThrow();
  });
});

describe("legacy plaintext exports (pre-encryption back-compat)", () => {
  it("passes a bare JSON export through unchanged", () => {
    const legacy = JSON.stringify({ databaseVersion: 2, accounts: [], transactions: [] });
    expect(readImport(legacy, PASSWORD)).toEqual(JSON.parse(legacy));
  });

  it("reads a legacy export regardless of the password (it isn't encrypted)", () => {
    const legacy = JSON.stringify({ databaseVersion: 2, accounts: [] });
    expect(readImport(legacy, "any password at all")).toEqual({ databaseVersion: 2, accounts: [] });
  });
});

describe("tampering", () => {
  it("throws if the encrypted payload is altered", () => {
    const parsed = JSON.parse(wrapExport(JSON.stringify({ a: 1 }), PASSWORD));
    const chars = parsed.data.split("");
    const i = Math.floor(chars.length / 2);
    chars[i] = chars[i] === "A" ? "B" : "A";
    parsed.data = chars.join("");
    expect(() => readImport(JSON.stringify(parsed), PASSWORD)).toThrow();
  });
});

describe("invalid input", () => {
  it("throws on text that isn't JSON", () => {
    expect(() => readImport("not json at all", PASSWORD)).toThrow();
  });
});
