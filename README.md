# AfkUAV

A modern replacement for the RuneScape 3 [Alt1 Toolkit](https://runeapps.org/alt1) plugin
**AfkWarden** — full feature parity, rebuilt UI, multi-chatbox monitoring, and fixes for two
reliability defects that make the original intermittently unusable.

> **Status:** early. The runtime works and installs — inactivity and chat alerts fire, and
> AfkWarden presets import. 14 of the 16 alerter types are not implemented yet; importing a preset
> that uses one keeps the alert and flags it rather than dropping it silently.

## Install

Open this URL **inside the Alt1 browser** — an **Add App** button appears in the toolbar:

```
https://rm-sage.github.io/AfkUAV/
```

Then open it, hit **Import from AfkWarden**, and paste a preset exported from AfkWarden's save-icon
dialog (the whole `afkscape_presets` blob works too).

Needs the *pixel*, *gamestate* and *overlay* permissions. Inactivity alerts depend on gamestate; an
alert that cannot see what it needs shows a **no data** badge rather than failing quietly.

## Why

AfkWarden works well until it doesn't. Buff icons and chat messages get tracked correctly
sometimes and silently missed other times. Investigation found two independent structural causes —
neither of which is the capture method that most people blame:

1. **Reader positions are cached for the entire session.** Every reader locates the chatbox or buff
   bar exactly once and never re-validates. Any window resize or UI-scale change afterwards leaves
   every dependent alert permanently reading the wrong region, with no error and no recovery until
   the app is restarted.

2. **Buff templates erode toward a hard cutoff.** Matching requires 50 matching pixels, and every
   successful match re-masks the stored template — a ratchet that only ever removes pixels. Real
   templates measured in the wild sit as low as 53 opaque pixels: three above the floor.

AfkUAV fixes both at the architecture level. See
[`docs/superpowers/specs/2026-08-05-afkuav-design.md`](docs/superpowers/specs/2026-08-05-afkuav-design.md)
for the full analysis.

## What's different

- **Self-healing readers** — positions are invalidated on resize, UI-scale change, `rslinked`, and
  after consecutive failed reads. Reader health is visible per-alert rather than buried.
- **All chatboxes monitored** — the underlying library already detects every open chatbox but only
  ever reads one. AfkUAV reads them all, at the cost of a single screen capture per tick.
- **Immutable buff templates** with relative-coverage scoring, so sparse templates aren't
  structurally disadvantaged and can't decay.
- **No backend.** Custom sounds and text-to-speech run locally; nothing calls out to a server.
- **Real alert grouping**, replacing the widespread workaround of using empty alerts as section
  headers.

## Feature parity

Target is all 16 shipping AfkWarden alerter types — plus preset management, per-alert pause, global
settings, and quick-add premades.

| Type | Status |
| --- | --- |
| `inactive` | ✅ |
| `chat` | ✅ |
| `actionbar` | ✅ |
| `buffs` | ✅ |
| `xpcounter`, `bigxp`, `craftmenu`, `drops`, `sheathe`, `castlewars`, `dialogtextsimple`, `fightkiln`, `targetdeath`, `summoning`, `clockbased`, `necroritual` | not yet |

Ordered by how much they actually get used: the four above cover 102 of the 108 alerts in the config
this was developed against. Chat alone is 67%.

Alerts of a type that isn't implemented yet still import — they show an error badge rather than
disappearing.

Existing AfkWarden presets import directly.

**Not included:** toilet mode (phone streaming), arbitrary screen-region OCR.

## Stack

TypeScript · Preact · zod · Vite · [`alt1`](https://github.com/skillbert/alt1) 0.1.3

Targets Chromium 108, which is what Alt1 1.6.0 embeds.

## Development

```sh
npm install
npm run dev
```

Most of the reader layer can be developed in an ordinary browser: `alt1/base` exports `PasteInput`,
so screenshots can be pasted in and replayed without running inside Alt1.

## Credit

AfkWarden is by [Skillbert](https://runeapps.org), who also wrote Alt1 itself and the `alt1`
library this project depends on. AfkUAV is an independent reimplementation built against the
documented API — it contains no AfkWarden source.

## Licence

Undecided.
