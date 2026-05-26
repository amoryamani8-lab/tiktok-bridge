// Pulse TikTok Live Bridge
// ------------------------
// A tiny multi-tenant relay that the Pulse frontend connects to.
//
// Frontend opens:  ws://<host>:<port>/?username=@someone
// Bridge:          opens a TikTokLive connection for that username and
//                  forwards normalized events back as JSON messages.
//
// Message format (matches `TikTokConnector.handleRaw` on the frontend):
//   { kind: "comment", username, comment, viewerCount? }
//   { kind: "gift",    username, giftName, giftValue }
//   { kind: "like",    username, likeCount }
//   { kind: "member",  username, viewerCount? }
//   { kind: "roomUser", viewerCount }
//
// Deploy on Railway / Render / Fly in ~2 min. Free tier is fine for testing.
// Later: set EULER_API_KEY in env to switch to EulerStream and scale.

import { WebSocketServer } from "ws";
import { WebcastPushConnection } from "tiktok-live-connector";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8765;
const EULER_API_KEY = process.env.EULER_API_KEY || undefined;

const wss = new WebSocketServer({ port: PORT });
console.log(`[bridge] listening on :${PORT} ${EULER_API_KEY ? "(EulerStream)" : "(direct mode)"}`);

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", "http://x");
  const username = (url.searchParams.get("username") || "").replace(/^@/, "").trim();

  if (!username) {
    ws.send(JSON.stringify({ kind: "error", message: "Missing ?username=@handle" }));
    ws.close();
    return;
  }

  console.log(`[bridge] client connected for @${username}`);

  const tt = new WebcastPushConnection(username, {
    enableExtendedGiftInfo: true,
    processInitialData: false,
    ...(EULER_API_KEY ? { signProviderOptions: { apiKey: EULER_API_KEY } } : {}),
  });

  let viewerCount = 0;

  const send = (payload) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
  };

  tt.connect()
    .then((state) => {
      viewerCount = state?.roomInfo?.viewer_count ?? 0;
      send({ kind: "roomUser", viewerCount });
      console.log(`[bridge] @${username} live (${viewerCount} viewers)`);
    })
    .catch((err) => {
      console.error(`[bridge] connect error for @${username}:`, err?.message || err);
      send({ kind: "error", message: String(err?.message || err) });
      ws.close();
    });

  tt.on("chat", (d) =>
    send({ kind: "comment", username: d.uniqueId, comment: d.comment, viewerCount }),
  );
  tt.on("gift", (d) => {
    // Only emit on streak end to avoid duplicates for combo gifts
    if (d.giftType === 1 && !d.repeatEnd) return;
    send({
      kind: "gift",
      username: d.uniqueId,
      giftName: d.giftName,
      giftValue: (d.diamondCount || 0) * (d.repeatCount || 1),
    });
  });
  tt.on("like", (d) =>
    send({ kind: "like", username: d.uniqueId, likeCount: d.likeCount || 1 }),
  );
  tt.on("member", (d) =>
    send({ kind: "member", username: d.uniqueId, viewerCount }),
  );
  tt.on("roomUser", (d) => {
    viewerCount = d.viewerCount || viewerCount;
    send({ kind: "roomUser", viewerCount });
  });
  tt.on("streamEnd", () => {
    send({ kind: "error", message: "Stream ended" });
    ws.close();
  });
  tt.on("disconnected", () => {
    send({ kind: "error", message: "Disconnected from TikTok" });
    ws.close();
  });

  ws.on("close", () => {
    console.log(`[bridge] client closed for @${username}`);
    try { tt.disconnect(); } catch { /* noop */ }
  });
});
