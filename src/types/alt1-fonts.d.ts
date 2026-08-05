// The `alt1` package ships its 14 bundled fonts as prebuilt UMD modules under
// dist/fonts/ with no accompanying .d.ts. They are plain JSON-shaped font
// definitions consumed by alt1/ocr, so a module declaration is all that's needed.
//
// This is the whole of the "font loader" problem people warn about: no webpack
// loader is required to *use* the packaged fonts. alt1/font-loader is only needed
// under the `alt1-source` export condition or when generating a new font.
declare module "alt1/fonts/*" {
  import type { FontDefinition } from "alt1/ocr";
  const font: FontDefinition;
  export default font;
}
