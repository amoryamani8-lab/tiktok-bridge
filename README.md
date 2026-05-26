# Pulse TikTok Live Bridge

Multi-tenant WebSocket relay that lets the Pulse app receive **real** TikTok
Live events (comments, gifts, likes, viewers) from any user's stream — no
install required on the streamer's side.

## How it works

```
Streamer's TikTok Live
        │
        ▼
tiktok-live-connector  (this bridge)
        │  normalized JSON
        ▼
   WebSocket  ws://<bridge-host>/?username=@handle
        │
        ▼
   Pulse app (browser)
```

The Pulse frontend already knows how to consume this format
(`src/lib/tiktok/connector.ts`). You just need to host this bridge once.

## Deploy in 2 minutes

### Option A — Railway (recommended, free tier works)

1. Push this folder to a new GitHub repo
2. https://railway.app → **New Project** → **Deploy from GitHub**
3. Select the repo → Railway auto-detects Node and runs `npm start`
4. Open the service → **Settings** → **Generate Domain** → copy the URL
5. In Pulse, go to **Settings → Connections** and paste:
   `wss://your-bridge.up.railway.app`

### Option B — Render

1. New **Web Service** → connect repo
2. Build: `npm install` — Start: `npm start`
3. Use the generated `wss://...onrender.com` URL

### Option C — Local test

```bash
cd tiktok-bridge
npm install
npm start
# → ws://localhost:8765
```

## Scale to production with EulerStream

When you outgrow the free direct mode (~20-50 concurrent lives), grab an
[EulerStream](https://www.eulerstream.com) API key (~$10-30/mo, unlimited
lives) and set it as an env var on Railway:

```
EULER_API_KEY=your_key_here
```

**No frontend change needed.** Restart the service and you're production-ready.

## Environment variables

| Name             | Default | Description                                  |
|------------------|---------|----------------------------------------------|
| `PORT`           | `8765`  | Port to listen on (Railway sets this)        |
| `EULER_API_KEY`  | —       | Optional. Enables EulerStream sign provider. |
