# Unlock On Song

**Your walk-on anthem, generated from your vibe.**

Take a webcam photo → AI analyzes your vibe → generates a personalized walk-on song.

## Quick Start

```bash
# Install deps
npm install

# Start the Zero proxy server (terminal 1)
npx tsx server.ts

# Start the Vite dev server (terminal 2)
npm run dev
```

Open http://localhost:5173, allow camera access, and click "Generate My Walk-On Song."

## Architecture

```
Webcam → Photo → Zero (Image Analysis) → Prompt Builder → Zero (Music Gen) → Audio Player
```

All external API calls go through [Zero](https://zero.xyz) -- no separate API keys needed.

## Team

| Person | Files | Role |
|--------|-------|------|
| Erica  | `src/camera.ts`, `src/ui.ts`, `style.css` | Webcam capture + UI |
| Sam    | `src/analyze.ts`, `src/prompt.ts` | Image analysis + prompt engineering |
| Dave   | `src/generate.ts`, `src/player.ts`, `src/main.ts`, `server.ts` | Music gen + orchestration |

## Zero Setup

```bash
npm i -g @zeroxyz/cli
zero init              # generates wallet
zero wallet fund       # add USDC (Base)
zero wallet balance    # confirm funds
```

## Timeline

- **8:05-8:10** -- Scaffold & push to GitHub
- **8:10-8:40** -- Parallel work (Erica 30 min, Sam+Dave 30 min)
- **8:40-8:45** -- Merge branches
- **8:45-8:55** -- Integration testing & debug
- **8:55-9:00** -- Deploy via Zero

## Deploy

```bash
npm run build          # produces dist/
zero search "deploy static site"
zero get 1 --formatted
# Follow the deploy capability instructions
```
