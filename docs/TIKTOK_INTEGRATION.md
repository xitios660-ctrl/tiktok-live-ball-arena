# TikTok Live Integration

**Status (Etapa 13):** PRODUCTION adapter is wired with `tiktok-live-connector@2.5.0`.  
DEMO remains the **default** and is fully simulated. PRODUCTION is **unofficial** Webcast WebSocket — TikTok can break it anytime. **Do not claim it works without a real live.**

## Official API?

**No.** TikTok does not provide a public official API for LIVE chat/gifts. Libraries reverse-engineer the internal Webcast protocol.

## Modes

| `TIKTOK_MODE` | Connector | Notes |
|---------------|-----------|--------|
| `demo` (default) | `DemoEventSimulator` | Admin `/admin` injects fake events. **Not TikTok.** |
| `production` | `TikTokLiveConnectorAdapter` | `tiktok-live-connector` → same `ArenaLiveEvent` path as DEMO |

## How to switch to PRODUCTION

```bash
cp .env.example .env
# Edit:
TIKTOK_MODE=production
TIKTOK_USERNAME=your_host_uniqueId   # without @
# Optional (Euler sign / higher limits):
TIKTOK_SIGN_API_KEY=...

npm run build && npm start
# or: npm run dev
```

1. Start the host LIVE on TikTok.
2. Watch logs: `[TIKTOK] AGUARDANDO LIVE` until live, then `LIVE DETECTADA / TIKTOK CONECTADO`.
3. `/health` → `tiktok.phase` / `tiktok.label` / `live`.
4. Admin panel badge shows connection status. Gift inject still works for testing (same GameLoop path).

### Manual verification checklist (PRODUCTION)

- [ ] With host **offline**: server stays up, phase `waiting_live`, retries with backoff (no hang, no silent death).
- [ ] Host goes **LIVE**: phase `connected`, chat/gifts appear in logs (`[COMMENT]` `[GIFT]` …).
- [ ] Mid-round disconnect: phase `reconnecting`, **round continues**, reconnect resumes events.
- [ ] Stream end: back to `waiting_live`.
- [ ] Gift streaks: only final `repeatEnd` applies ability (giftType===1).

We **cannot** fully smoke-test a live room in CI. Use the checklist above on a real account.

## Risks / caveats

- Unofficial protocol — breakage without notice.
- AGPL-3.0 library license — review for your distribution.
- Sign server (Euler) may rate-limit; optional `TIKTOK_SIGN_API_KEY`.
- Never treat DEMO events as proof of TikTok connectivity.

## Event mapping

```
Webcast CHAT     → comment  → spawn/respawn
Webcast GIFT     → gift     → abilities (Rosa→Galaxy)
Webcast LIKE     → like     (logged; global effects later)
Webcast SHARE    → share    (deduped)
Webcast FOLLOW   → follow
Webcast MEMBER   → join
```

Dedup fingerprints for gifts/shares avoid double-apply on redelivery.

## Architecture

`ITikTokConnector` ← `DemoEventSimulator` | `TikTokLiveConnectorAdapter`  
→ `GameLoop.handleLiveEvent` (single path)
