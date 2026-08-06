export type LoginState = {
  /** Alt1's reported world, or -1 for "not logged in or in the lobby". */
  world: number;
  /** False when the Gamestate permission is missing, making `world` meaningless. */
  hasGameState: boolean;
};

export type GateResult = { held: true; reason: string } | { held: false };

/**
 * Whether alerts should be held because the player is not actually in game.
 *
 * AfkWarden solves this by image-matching the home teleport icon beside the
 * minimap. `alt1.currentWorld` answers the same question directly — it is
 * documented to return -1 "when the player is not logged in or in the lobby" —
 * with no pixel matching, so it cannot be broken by moving or hiding the minimap.
 *
 * FAILS OPEN by design. Alt1 documents that currentWorld can also read -1 on some
 * proxied worlds, and the permission may be absent entirely. Both are cases where
 * we do not know, and a wrong "logged out" would silence every alert — the exact
 * failure this app exists to prevent. When in doubt, let alerts fire; the UI
 * surfaces the held state so a genuine misread is visible rather than silent.
 */
export function loginGate(state: LoginState, enabled: boolean): GateResult {
  if (!enabled) return { held: false };
  if (!state.hasGameState) return { held: false };
  if (state.world === -1) {
    return { held: true, reason: "You appear to be logged out or in the lobby" };
  }
  return { held: false };
}
