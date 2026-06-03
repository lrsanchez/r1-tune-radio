# R1 Radio — Tuning Dial

An internet radio player built as a **Rabbit R1 Creation**. Browse live stations by spinning a tuner dial, search by name, and stream directly from station CDNs. Styled after Teenage Engineering's dark industrial aesthetic.

![mock](r1-radio-mock.html)

---

## How it works

```
R1 Creation ──(control: JSON)──► radio.lsz.wtf ──► Node proxy ──► opml.radiotime.com
R1 Creation ──(audio: bytes)────────────────────────────────────► station CDN (direct)
```

The proxy wraps TuneIn's unofficial OPML API and exposes a clean JSON contract. Audio streams directly from the station's CDN — no audio bytes pass through the VPS.

---

## Features

- **Tuning dial** — horizontal filmstrip of station chips, orange needle, smooth scroll
- **Scroll wheel** — R1 hardware scroll navigates the dial; push PTT to play
- **Playing screen** — station logo with pulse animation, VU meter, marquee now-playing
- **Search** — live search via TuneIn, scroll through results with the wheel
- **Recently played** — persisted in `localStorage`, shown at the front of the dial and in search
- **PIN lock** — 6-digit numpad on launch, configurable via environment variable
- **HLS support** — lazy-loads `hls.js` for `.m3u8` streams; native audio for mp3/aac

---

## Stack

- **Client** — Vanilla TypeScript + Vite, no UI framework
- **Server** — Node.js + Express, wraps TuneIn's OPML API
- **Fonts** — IBM Plex Mono
- **Deployment** — Docker, single container serves both static client and proxy API

---

## Local development

### Prerequisites

- Node 20+
- ngrok (to expose to the R1 over the internet)

### Setup

```bash
git clone git@github.com:lrsanchez/r1-tune-radio.git
cd r1-tune-radio
npm install
cp .env.example .env.local
# edit .env.local — set VITE_TOKEN and VITE_PIN
```

### Run

```bash
npm run dev
```

Starts both the Vite dev server (port 15000) and the TuneIn proxy (port 3001) concurrently.

### Install on R1

1. Start ngrok: `ngrok http 15000`
2. Open `https://<ngrok-url>/qr.html` in your browser
3. Scan the QR code with your R1 to install the Creation

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `VITE_TOKEN` | build-time | API token baked into the client — must match `TOKEN` |
| `VITE_PIN` | build-time | 6-digit PIN baked into the client lock screen |
| `TOKEN` | runtime | Secret the proxy checks on every API request |
| `PORT` | runtime | Server port (default `15000`) |

---

## Production deployment (VPS)

```bash
git clone git@github.com:lrsanchez/r1-tune-radio.git
cd r1-tune-radio
cp .env.production.example .env
# edit .env with real values
docker compose up -d --build
```

Then proxy via nginx:

```nginx
server {
    server_name radio.lsz.wtf;

    location / {
        proxy_pass http://localhost:15000;
        proxy_set_header Host $host;
    }
}
```

The container serves the built client and the proxy API on the same port.

---

## R1 input map

| Input | Browse | Playing | Search |
|---|---|---|---|
| Scroll wheel | move needle | back to browse | scroll results |
| Tap screen | — | back to browse | — |
| PTT short press | play selected | play / pause | back to browse |
| PTT long press | open search | open search | — |
| Search button | open search | open search | — |

---

## Project structure

```
r1-tune-radio/
  src/
    api.ts        — proxy client (all fetch calls)
    state.ts      — single AppState object
    audio.ts      — <audio> element, WebAudio, HLS.js
    render.ts     — DOM render functions
    lock.ts       — PIN lock screen
    main.ts       — input handling, boot sequence
    style.css     — dark industrial theme
  server/
    index.js      — Express server: TuneIn proxy + static file serving
  public/
    qr.html       — QR code installer page for R1
  Dockerfile
  docker-compose.yml
  r1-radio-mock.html  — static UI reference mock
```

---

## License

MIT
