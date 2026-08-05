/**
 * Unwrap a constructor/function from a UMD module's interop layers.
 *
 * The `alt1` package ships webpack UMD bundles. Under Vite/Rollup's CommonJS
 * interop, `import ChatBoxReader from "alt1/chatbox"` binds to the module.exports
 * OBJECT rather than the class, so the class actually lives at `.default.default`.
 * Calling `new` on the wrapper fails with "default is not a constructor" -- at
 * runtime, on load, in a way a type-level or `typeof` check will not catch.
 *
 * Walk down `.default` until something callable appears.
 */
export function interopDefault<T>(mod: unknown, depth = 4): T {
  let current: unknown = mod;
  for (let i = 0; i <= depth; i++) {
    if (typeof current === "function") return current as T;
    if (current === null || typeof current !== "object") break;
    if (!("default" in (current as Record<string, unknown>))) break;
    current = (current as Record<string, unknown>).default;
  }
  return current as T;
}
