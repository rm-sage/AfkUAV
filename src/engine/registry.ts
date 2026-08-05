import type { AlerterModule } from "~/engine/types";
import { inactiveAlerter } from "~/alerters/inactive";
import { chatAlerter } from "~/alerters/chat";

/**
 * Alerter modules that are implemented and wired up.
 *
 * `KNOWN_ALERTER_TYPES` lists all 16 types AfkWarden ships; this map lists the
 * subset AfkUAV can currently run. The gap is deliberate and visible: importing a
 * preset that uses a not-yet-implemented type keeps the alerter and flags it,
 * rather than dropping it silently.
 */
const MODULES: ReadonlyArray<AlerterModule<never>> = [
  inactiveAlerter as unknown as AlerterModule<never>,
  chatAlerter as unknown as AlerterModule<never>,
];

const BY_TYPE = new Map<string, AlerterModule<never>>(MODULES.map((m) => [m.type, m]));

export function getAlerterModule(type: string): AlerterModule<never> | undefined {
  return BY_TYPE.get(type);
}

export function implementedTypes(): string[] {
  return [...BY_TYPE.keys()];
}

export function isImplemented(type: string): boolean {
  return BY_TYPE.has(type);
}
