# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Etapa 13 concluída** (PRODUCTION connector + DEMO default)

Data: 2026-09-24 (America/Sao_Paulo)

## Decisões (Etapa 13)

1. **DEMO default** (`TIKTOK_MODE=demo`) — DemoEventSimulator only; full playtest.
2. **PRODUCTION** uses `tiktok-live-connector@2.5.0` (TikTokLiveConnection, ESM via dynamic import).
3. Same `ArenaLiveEvent` → `GameLoop.handleLiveEvent` path for both modes.
4. Offline host → `waiting_live` + exponential backoff (never silent death / no boot hang).
5. Mid-round drop → `reconnecting`; **game continues**; events resume on reconnect.
6. Gift/share **dedupe** fingerprints; streak gifts apply only on `repeatEnd`.
7. Admin gift inject works in PRODUCTION too (direct GameLoop inject) for testing.
8. `/health` exposes tiktok status, live flag, players, round, uptime.
9. **No claim** PRODUCTION works without a real live — manual checklist in docs.

## Package

- `tiktok-live-connector@2.5.0`

## Arquivos

- `packages/server/src/tiktok/TikTokLiveConnectorAdapter.ts`
- `ITikTokConnector.ts`, `eventDedupe.ts`, `mapTikTokGift.ts`, `createConnector.ts`
- `routes/health.ts`, `routes/adminApi.ts`, `public/admin.html`
- `docs/TIKTOK_INTEGRATION.md`, `.env.example`

## Como testar

```bash
# DEMO regression
TIKTOK_MODE=demo npm run dev
# Admin: spawn bots, gifts, 15s round

# PRODUCTION smoke (no live — should wait, not hang)
TIKTOK_MODE=production TIKTOK_USERNAME=any_user npm start
# Expect: AGUARDANDO LIVE + reconnect logs; /health tiktok.phase=waiting_live
```

## Next: likes/shares global events, áudio, load test 50–100 bots
