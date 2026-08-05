// Spike 0: prove Vite resolves every `alt1` subpath AfkUAV needs, including a
// prebuilt font module. Deleted once the real entrypoint exists.
import * as a1lib from "alt1/base";
import ChatBoxReader from "alt1/chatbox";
import BuffReader from "alt1/buffs";
import { ActionbarReader } from "alt1/ability";
import TargetMobReader from "alt1/targetmob";
import DropsMenuReader from "alt1/dropsmenu";
import XpcounterReader from "alt1/xpcounter";
import * as OCR from "alt1/ocr";
import chatfont from "alt1/fonts/chatbox/12pt.js";

const probe = {
  mixColor: typeof a1lib.mixColor,
  captureHoldFullRs: typeof a1lib.captureHoldFullRs,
  ChatBoxReader: typeof ChatBoxReader,
  BuffReader: typeof BuffReader,
  ActionbarReader: typeof ActionbarReader,
  TargetMobReader: typeof TargetMobReader,
  DropsMenuReader: typeof DropsMenuReader,
  XpcounterReader: typeof XpcounterReader,
  findReadLine: typeof OCR.findReadLine,
  chatfontChars: chatfont && typeof chatfont === "object" ? Object.keys(chatfont).length : -1,
};

// eslint-disable-next-line no-console
console.log("alt1 resolution probe", probe);

export default probe;
