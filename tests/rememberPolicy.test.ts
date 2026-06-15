import { describe, it, expect } from "vitest";
import {
  POLICY_DURATION_MS,
  computeExpiry,
  isRememberValid,
} from "../electron/rememberPolicy";

const NOW = 1_700_000_000_000; // fixed reference time so expiry math is deterministic

describe("computeExpiry", () => {
  it("returns null for the session policy (never persisted)", () => {
    expect(computeExpiry("session", NOW)).toBeNull();
  });

  it("returns now + duration for each timed policy", () => {
    expect(computeExpiry("15m", NOW)).toBe(NOW + POLICY_DURATION_MS["15m"]);
    expect(computeExpiry("1h", NOW)).toBe(NOW + 60 * 60 * 1000);
    expect(computeExpiry("8h", NOW)).toBe(NOW + 8 * 60 * 60 * 1000);
    expect(computeExpiry("1d", NOW)).toBe(NOW + 24 * 60 * 60 * 1000);
    expect(computeExpiry("1w", NOW)).toBe(NOW + 7 * 24 * 60 * 60 * 1000);
  });
});

describe("isRememberValid", () => {
  it("is false when there is no expiry (session / never remembered)", () => {
    expect(isRememberValid(null, NOW)).toBe(false);
  });

  it("is true while the window is still open", () => {
    expect(isRememberValid(NOW + 1000, NOW)).toBe(true);
  });

  it("is false once the window has passed", () => {
    expect(isRememberValid(NOW - 1000, NOW)).toBe(false);
  });

  it("is false at the exact expiry instant (window has ended)", () => {
    expect(isRememberValid(NOW, NOW)).toBe(false);
  });
});
