# CLAUDE.md — R1 Radio ("Tuning Dial")

## What this is
An internet-radio player that runs as a **rabbit R1 Creation** (on-device web app).
Browse a station directory like turning a tuner, then stream live radio. A companion
**Node proxy** on a VPS wraps TuneIn's unofficial `opml.radiotime.com` API so the
device only ever sees a clean, stable JSON contract.

This repo is the **client (the Creation)**. The proxy lives in a sibling repo
(`tunein-r1-proxy`) and is treated as an external service.

## Hardware reality (drives every UI decision)
- Screen: ~2.9", portrait, small. Big touch targets, one thing on screen at a time.
- **Scroll wheel**: the primary input. This is a radio → the wheel is the tuner.
- **Push-to-talk (PTT) side button**: short press = play/pause/back; hold = voice search.
- Audio out: speaker / Bluetooth. One `<audio>` element only.

## Architecture (two planes — do not conflate)
```
R1 Creation ──(control plane: JSON)──► radio.lsz.wtf (nginx+TLS) ──► Node proxy ──► opml.radiotime.com
R1 Creation ──(data plane: audio bytes)────────────────────────────────────────► station CDN (direct)
```
- **Control plane**: browse/search/tune metadata goes through the proxy.
- **Data plane**: the proxy returns a stream URL; the device plays it **directly**
  from the station's CDN. NEVER proxy audio bytes through the VPS.
- The proxy is an anti-corruption layer: all TuneIn ugliness (drifting fields,
  `.pls`/`.m3u` playlists, missing CORS) is quarantined there.

## Proxy contract (the only API the client knows)
Base: `https://radio.lsz.wtf` — every request carries `?token=<STATIC_TOKEN>`.
- `GET /browse?id=<id>` → `{ links:[{id,title}], stations:[Station] }` (root if no id)
- `GET /search?q=<term>` → `{ stations:[Station] }`  ← used by BOTH text and voice search
- `GET /tune?id=<id>` → `{ stream, codec, bitrate }`  ← direct playable URL
- (v2) `GET/PUT /favorites` → persisted station list (single user, JSON-backed)

```ts
type Station = { id: string; name: string; logo: string|null; nowPlaying: string|null };
```

## Stack & conventions
- **Vanilla TypeScript + Vite**, no UI framework. Keep the bundle tiny and the DOM cheap.
- No localStorage assumptions — the R1 webview may wipe it. Favorites persist via the proxy.
- Single source of truth state object; render functions are pure-ish (state → DOM).
- All network in one `api.ts` client; UI never touches `fetch` directly.
- Theme tokens in CSS variables (see below). Font: **IBM Plex Mono**.

## UI — the Tuning Dial
**Theme:** dark industrial / Teenage Engineering. `--bg:#0b0c10` `--ink:#F0EDE8`
`--accent:#FF4500` `--line:#23262f`, Plex Mono, subtle CRT grain overlay.
A working visual reference ships as `r1-radio-mock.html` — match its look & interactions.

### Screen states
1. **BROWSE (dial)** — horizontal filmstrip of station chips sliding under a fixed
   orange needle. Centered chip is the selection (scaled + glowing). Below: station
   name + category. Bottom hint: "push to play".
2. **PLAYING** — big logo/monogram, station name, live VU meter, marquee-scrolling
   now-playing line, play/pause state.
3. **SEARCH** — always-available via a status-bar button. Text field at top
   (on-screen keyboard), live-filtered results list below. Same screen also receives
   voice transcripts (PTT hold). Selecting a result tunes it.

### Input map (implement exactly this — keep it learnable)
| Input | BROWSE | PLAYING | SEARCH |
|---|---|---|---|
| Scroll wheel | move needle / tune | back to dial + tune | scroll results |
| Tap screen | play highlighted | play/pause | select result |
| PTT short | play highlighted | play/pause | back |
| PTT hold | voice search | voice search | dictate query |
| Search btn | open search | open search | — |

### The one rule that makes the dial feel right
Spinning the wheel only moves the highlight **locally and instantly**. Do NOT call
`/tune` on every detent. **Debounce ~500ms**: when the wheel goes idle, *then* call
`/tune` and start playback. A fast spin must not fire 20 requests or thrash `<audio>`.

## Audio
- One persistent `<audio>`. On tune: `audio.src = stream; audio.play()`.
- Prefer `mp3`/`aac` (proxy already picks these). If `codec === "hls"` (`.m3u8`),
  load `hls.js` lazily and attach; otherwise native `<audio>` handles it.
- VU meter: WebAudio `AudioContext` → `MediaElementSource(audio)` → `AnalyserNode`,
  read `getByteFrequencyData` each `requestAnimationFrame`. Create the context on first
  user gesture (autoplay policy).
- Buffering = analog-static / pulsing state, not a spinner. Handle `waiting`/`playing`
  /`error` events; on error, surface "off air" and let the user pick another station.

## Build order (ship vertical slices, validate on device early)
1. **Smoke test first.** A throwaway Creation that plays ONE hardcoded stream URL in
   `<audio>`. Confirm the R1 webview (a) allows external `fetch` to the proxy and
   (b) keeps audio alive. These are unverified assumptions — prove them before building UI.
2. `api.ts` + BROWSE dial wired to `/browse` (wheel + needle + debounce).
3. `/tune` + PLAYING state + VU meter + buffering/error handling.
4. **Text search** (status-bar field → `/search`).
5. Voice search (PTT hold → transcript → `/search`).
6. (v2) Favorites pads backed by proxy `/favorites`.

## Open questions to resolve on real hardware
- Does the Creation sandbox permit `fetch` to arbitrary HTTPS hosts? (→ smoke test)
- Does audio keep playing when the card is swiped away / screen-off?
- Is the on-screen keyboard available for the text field, or is voice the only practical entry?
Document findings here as you learn them.

## Non-goals
- No accounts/auth in the client (proxy token only).
- No on-demand/track seeking (radio = continuous live stream; that's the Tidal project, not this).
- No audio transcoding on the VPS.
