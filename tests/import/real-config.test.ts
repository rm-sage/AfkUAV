import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importAfkWarden } from "~/import/afkwarden";

/**
 * Runs against the real AfkWarden config extracted from Alt1's CEF LevelDB.
 *
 * That file is gitignored (`fixtures/personal/`) because it is personal data and
 * the repo is public, so this suite skips when it is absent. Testing against real
 * config rather than hand-written fixtures is the point: fixtures written by the
 * same person who wrote the parser tend to agree with it.
 */
const path = fileURLToPath(
  new URL("../../fixtures/personal/afkscape_presets.json", import.meta.url),
);
const describeIfPresent = existsSync(path) ? describe : describe.skip;

describeIfPresent("real AfkWarden config", () => {
  // Read lazily: describe.skip still EXECUTES its callback to collect test names,
  // so reading at this scope would throw ENOENT on any machine without the file
  // (notably CI) despite the suite being skipped.
  const load = (): unknown => JSON.parse(readFileSync(path, "utf8"));

  it("imports every preset", () => {
    const r = importAfkWarden(load());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.presets).toHaveLength(15);
  });

  it("recognises every alerter type present", () => {
    const r = importAfkWarden(load());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const unknown = r.issues.filter((i) => i.message.includes("Unknown alerter type"));
    expect(unknown).toEqual([]);
  });

  it("promotes the header alerters in the Zuk preset to groups", () => {
    const r = importAfkWarden(load());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const zuk = r.presets.find((p) => p.name === "Zuk");
    expect(zuk).toBeDefined();
    expect(zuk!.groups.length).toBeGreaterThan(0);
  });

  it("preserves the alerter population", () => {
    const r = importAfkWarden(load());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const all = r.presets.flatMap((p) => p.alerters);
    const byType = new Map<string, number>();
    for (const a of all) byType.set(a.type, (byType.get(a.type) ?? 0) + 1);

    // 108 alerters total, of which 3 are chat alerters with no match lines used as
    // section headers. Those become groups instead (2 of them are unnamed spacers
    // carrying no information, so they simply disappear).
    expect(all).toHaveLength(105);
    expect(byType.get("chat")).toBe(71);
    expect(byType.get("inactive")).toBe(13);
    expect(byType.get("actionbar")).toBe(8);
    expect(byType.get("buffs")).toBe(7);
    expect(byType.get("xpcounter")).toBe(4);
    expect(byType.get("craftmenu")).toBe(1);
    expect(byType.get("sheathe")).toBe(1);
  });

  it("normalises every treshold occurrence", () => {
    const r = importAfkWarden(load());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const a of r.presets.flatMap((p) => p.alerters)) {
      expect(a.vars.treshold).toBeUndefined();
    }
  });
});
