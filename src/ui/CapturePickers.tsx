import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { probeBuffs } from "~/alt1-io/readers";
import { probeChatLines } from "~/alt1-io/host";
import { needleToBase64, needleToDataUrl } from "~/ui/needle-image";
import { coverage, isLowCoverage } from "~/readers/buff-match";
import type { BuffSlot } from "~/readers/bundle";
import type { ChatLine, RGB } from "~/engine/types";

function rgbCss(c: RGB): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/* ============================== buff picker ============================== */

export type BuffPickerProps = {
  open: boolean;
  isDebuff: boolean;
  onPick(imgstr: string): void;
  onClose(): void;
};

type BuffShot = { slot: BuffSlot; url: string | null };

/**
 * Pick a buff to watch by capturing the bar and showing what is actually on it.
 *
 * Capturing beats asking the user to describe a buff: the icon stored is the
 * same pixels the matcher will compare against later, so what you select is
 * literally what gets matched.
 */
export function BuffPicker({ open, isDebuff, onPick, onClose }: BuffPickerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shots, setShots] = useState<BuffShot[] | null>(null);
  const [failed, setFailed] = useState(false);

  const capture = useCallback(() => {
    const slots = probeBuffs(isDebuff);
    if (slots === null) {
      setFailed(true);
      setShots(null);
      return;
    }
    setFailed(false);
    setShots(slots.map((slot) => ({ slot, url: needleToDataUrl(slot.icon) })));
  }, [isDebuff]);

  useEffect(() => {
    const d = ref.current;
    if (d === null) return;
    if (open && !d.open) {
      d.showModal();
      capture();
    }
    if (!open && d.open) d.close();
  }, [open, capture]);

  return (
    <dialog ref={ref} onCancel={onClose}>
      <h2>Pick a {isDebuff ? "debuff" : "buff"}</h2>
      <p class="fld__help">
        Make sure the {isDebuff ? "debuff" : "buff"} is showing in game, then capture. The icon
        stored is exactly what gets matched later.
      </p>

      {failed ? (
        <p class="fld__help fld__help--warn">
          Could not find the {isDebuff ? "debuff" : "buff"} bar. Check it is on screen and that
          RuneScape is not covered by another window.
        </p>
      ) : null}

      {shots !== null && shots.length === 0 ? (
        <p class="fld__help fld__help--warn">
          The bar was found but is empty — nothing to pick yet.
        </p>
      ) : null}

      {shots !== null && shots.length > 0 ? (
        <div class="buffgrid">
          {shots.map((s, i) => {
            const sparse = isLowCoverage(s.slot.icon);
            return (
              <button
                key={i}
                class={`buffpick${sparse ? " buffpick--sparse" : ""}`}
                title={
                  sparse
                    ? `Only ${coverage(s.slot.icon)} distinctive pixels — this icon may match unreliably.`
                    : "Watch this buff"
                }
                onClick={() => {
                  const b64 = needleToBase64(s.slot.icon);
                  if (b64 !== null) onPick(b64);
                }}
              >
                {s.url !== null ? <img src={s.url} alt="" /> : <span>?</span>}
                {s.slot.timeLeft !== null ? (
                  <span class="buffpick__time">{s.slot.timeLeft}s</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div class="dlg__actions">
        <button class="btn btn--ghost" onClick={capture}>
          Recapture
        </button>
        <button class="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}

/* =========================== chat line picker ============================ */

export type ChatPickerProps = {
  open: boolean;
  /** Text already configured, so lines can be shown as already chosen. */
  chosen: string[];
  onPick(text: string, colors: RGB[]): void;
  onClose(): void;
};

/**
 * Pick trigger text by capturing the chatbox and clicking real lines.
 *
 * Typing trigger text by hand means guessing at the game's exact wording and
 * punctuation, and a near miss fails silently. Clicking a line that already
 * happened cannot be misspelled, and its colours come along automatically.
 */
export function ChatPicker({ open, chosen, onPick, onClose }: ChatPickerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<{ lines: ChatLine[]; boxes: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const capture = useCallback(() => {
    const probe = probeChatLines();
    if (probe === null) {
      setFailed(true);
      setResult(null);
      return;
    }
    setFailed(false);
    setResult(probe);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (d === null) return;
    if (open && !d.open) {
      d.showModal();
      capture();
    }
    if (!open && d.open) d.close();
  }, [open, capture]);

  return (
    <dialog ref={ref} class="dlg--wide" onCancel={onClose}>
      <h2>Pick chat lines</h2>
      <p class="fld__help">
        Everything currently in your chatbox is listed below. Click a line to use it as trigger
        text — its colours are added to the filter for you.
      </p>

      {failed ? (
        <p class="fld__help fld__help--warn">
          Could not find a chatbox. Open one in game, then capture again.
        </p>
      ) : null}

      {result !== null && result.lines.length === 0 ? (
        <p class="fld__help fld__help--warn">
          Found {result.boxes} chatbox{result.boxes === 1 ? "" : "es"} but no readable text. Say
          something in game, then capture again.
        </p>
      ) : null}

      {result !== null && result.lines.length > 0 ? (
        <ul class="chatlines">
          {result.lines.map((line, i) => {
            const already = chosen.includes(line.text);
            return (
              <li key={i}>
                <button
                  class={`chatline${already ? " chatline--chosen" : ""}`}
                  title={already ? "Already used by this alert" : "Use this line as trigger text"}
                  onClick={() => onPick(line.text, line.colors)}
                >
                  <span
                    class="chatline__text"
                    style={{ color: rgbCss(line.colors[0] ?? [255, 255, 255]) }}
                  >
                    {line.text}
                  </span>
                  <span class="chatline__dots">
                    {line.colors.map((c, n) => (
                      <span key={n} class="chatline__dot" style={{ background: rgbCss(c) }} />
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div class="dlg__actions">
        <button class="btn btn--ghost" onClick={capture}>
          Recapture
        </button>
        <button class="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}
