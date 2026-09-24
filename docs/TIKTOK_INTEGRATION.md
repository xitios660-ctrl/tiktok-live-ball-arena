# TikTok Live Integration Research (2026-09)

**Status:** research only. PRODUCTION adapter is a **stub**. DEMO events are **simulated**, not TikTok.

## Is there an official TikTok LIVE events API?

**No.** TikTok does not provide a public official API for reading livestream chat/gifts/likes for third-party games. Anything that works today is unofficial reverse-engineering of the Webcast WebSocket, or an intermediary product wrapping that.

## What we need

| Field / event | Needed |
|---------------|--------|
| comments | yes |
| gifts + gift streak (`repeatCount` / `repeatEnd`) | yes |
| likes | yes |
| shares | yes |
| joins (member) | yes |
| follows | yes |
| userId, username (uniqueId), avatar | yes |
| giftId, giftName, coinValue (diamonds) | yes |

## Candidates (verified ~2026-09)

### 1. `tiktok-live-connector` (Node.js) — **RECOMMENDED for PRODUCTION**

- **Type:** unofficial library → connects to TikTok’s **internal Webcast WebSocket**
- **npm:** `tiktok-live-connector` **v2.5.0** (updated 2026-09-16), ~39k weekly downloads
- **Repos:** https://github.com/zerodytrash/TikTok-Live-Connector
- **Maintainers lineage:** Zerody + Isaac Kogan / Euler Stream ecosystem
- **Signing:** WebSocket URL signing via **Euler Stream** sign server (`signApiKey` optional; free community limits, paid for higher)
- **Events:** `chat`, `gift` (streak-aware), `like`, `member`, `follow`, `share`, `roomUser`, `streamEnd`, …
- **Payload fields:** `user.userId`, `user.uniqueId`, `user.nickname`, avatar URLs, `giftId`, `giftDetails.giftName`, `repeatCount`, `repeatEnd`, diamond/coin via extended gift info
- **License:** AGPL-3.0-only (check compliance for your distribution)
- **Caveats:** reverse-engineered; TikTok can break protocol anytime; authors themselves say use managed Euler WebSocket API for guaranteed uptime

### 2. Euler Stream managed WebSocket API

- **Type:** intermediary / SaaS sign + optional managed stream
- **Site:** https://www.eulerstream.com
- Same ecosystem as above; better for production SLAs if budget allows

### 3. TikFinity

- **Type:** intermediary desktop app + Event API / WebSocket for overlays & games
- Requires **TikFinity Desktop** running locally while live
- Good for creators who already use TikFinity alerts; less ideal as sole server-side dependency on a remote VPS without the desktop app

### 4. `PirateTok/live-js`

- **Type:** unofficial JS Webcast connector claiming **no signing server / no API keys**
- Newer / smaller community than tiktok-live-connector
- Worth watching as a swap-in behind `ITikTokConnector` if Euler dependency becomes a problem

### 5. StreamElements

- Does **not** natively ingest TikTok LIVE the way it does Twitch/YT. Typical path: TikFinity (or similar) → Streamer.bot / webhooks → overlays. Not a primary connector for this project.

## Recommendation (this project)

1. **Ship DEMO** with `DemoEventSimulator` + `/admin` (current Etapa 1).
2. **PRODUCTION:** implement `TikTokLiveConnectorAdapter` wrapping **`tiktok-live-connector`**, mapping events into our normalized `ArenaLiveEvent` types in `@arena/shared`.
3. Keep **`ITikTokConnector`** so we can swap to Euler managed API or `live-js` without rewriting the game loop.
4. Enable `enableExtendedGiftInfo` (or equivalent) to resolve gift names / diamond counts for mapping into `gifts/gift-config.json`.
5. Handle gift streaks: only apply game effect when `repeatEnd === true` (or non-streakable gift).

## Mapping plan (future)

```
TikTok giftName / giftId  →  gift-config.json  →  abilityKey  →  GameLoop
```

Never treat DEMO simulator output as proof of TikTok connectivity.
