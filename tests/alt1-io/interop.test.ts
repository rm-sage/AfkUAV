import { describe, expect, it } from "vitest";
import { interopDefault } from "~/alt1-io/interop";

class Example {
  hello = "world";
}

describe("interopDefault", () => {
  it("returns a bare function unchanged", () => {
    expect(interopDefault(Example)).toBe(Example);
  });

  it("unwraps a single default layer", () => {
    expect(interopDefault({ default: Example })).toBe(Example);
  });

  // This is the real shape of alt1's webpack UMD bundles under Vite: the class is
  // two layers down, so `import X from "alt1/chatbox"` binds to an object and
  // `new X()` throws "default is not a constructor" at runtime, on load.
  it("unwraps the nested default alt1's UMD bundles produce", () => {
    const mod = { chatbox: {}, default: { default: Example, defaultcolors: [] } };
    const Ctor = interopDefault<typeof Example>(mod);
    expect(Ctor).toBe(Example);
    expect(new Ctor().hello).toBe("world");
  });

  it("stops at a non-object rather than looping", () => {
    expect(interopDefault({ default: 42 })).toBe(42);
  });

  it("returns the object when there is no default at all", () => {
    const mod = { notDefault: Example };
    expect(interopDefault(mod)).toBe(mod);
  });

  it("gives up after the depth limit instead of recursing forever", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.default = cyclic;
    expect(() => interopDefault(cyclic)).not.toThrow();
  });
});
