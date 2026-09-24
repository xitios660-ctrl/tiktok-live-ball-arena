# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Etapa 1 concluída** (estrutura + research + DEMO playtest)

Data: 2026-09-24 (America/Sao_Paulo)

## Decisões

1. **DEMO-first:** `TIKTOK_MODE=demo` é o padrão. Playtest sem live TikTok via `/admin`.
2. **Conector isolado:** interface `ITikTokConnector` — demo e production são swappable.
3. **Biblioteca PRODUCTION recomendada:** `tiktok-live-connector` v2.5.x (não oficial; Webcast WS + Euler Stream signing). Ver `docs/TIKTOK_INTEGRATION.md`.
4. **Client:** Phaser 3 + Vite, canvas 1080×1920 para OBS Browser Source.
5. **Server autoritativo:** Express + Socket.IO; física ainda stub.
6. **Rodada:** 5 minutos (`ROUND_DURATION_SEC=300`).
7. **Admin DEMO:** REST + UI HTML com gifts Rosa/Dino/Rosquinha/Capivara/Galaxia, comment, like, share, join, follow, spawn N bots, disconnect/reconnect, auto on/off.

## Arquivos criados

- `README.md`, `TIKTOK_GAME_PROGRESS.md`, `.env.example`, `.gitignore`, `package.json` (workspaces)
- `gifts/gift-config.json`
- `docs/TIKTOK_INTEGRATION.md`
- `packages/shared/` — tipos Arena events, RoundState, constants
- `packages/server/` — Express, Socket.IO, GameLoop stub, DemoEventSimulator (inject API), TikTokLiveConnectorAdapter stub, `/health`, `/admin`, `/overlay`
- `packages/client/` — Phaser WaitingScene (“AGUARDANDO A LIVE COMEÇAR”) + ArenaScene stub + Socket.IO

## Next: **Etapa 2 — Arena**

- Física Matter/Arcade: bolas, paredes, spawn por gift → abilityKey
- Mapear gift-config → spawn sizes / impulsos
- HUD timer + placar por usuário
- (Opcional) ligar adapter `tiktok-live-connector` atrás da interface quando for testar live real
