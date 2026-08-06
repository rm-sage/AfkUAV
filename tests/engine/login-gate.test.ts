import { describe, expect, it } from "vitest";
import { loginGate } from "~/engine/login-gate";

describe("loginGate", () => {
  it("holds alerts when Alt1 reports no world", () => {
    const r = loginGate({ world: -1, hasGameState: true }, true);
    expect(r.held).toBe(true);
    if (r.held) expect(r.reason).toMatch(/logged out|lobby/i);
  });

  it("lets alerts through while in a world", () => {
    expect(loginGate({ world: 84, hasGameState: true }, true).held).toBe(false);
  });

  it("does nothing when the setting is off", () => {
    expect(loginGate({ world: -1, hasGameState: true }, false).held).toBe(false);
  });

  // Alt1 documents currentWorld as also reading -1 on some proxied worlds, and the
  // permission can be missing entirely. Both mean "we do not know", and a wrong
  // "logged out" would silence every alert -- the failure this app exists to
  // prevent. Not knowing must never be treated as knowing.
  it("fails open without the gamestate permission", () => {
    expect(loginGate({ world: -1, hasGameState: false }, true).held).toBe(false);
  });

  it("treats world 0 as logged in rather than falsy", () => {
    expect(loginGate({ world: 0, hasGameState: true }, true).held).toBe(false);
  });
});
