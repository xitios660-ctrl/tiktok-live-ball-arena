# TikTok Live Ball Arena — Progress Log

## Etapa atual: **OBS polish** (DEMO overlay 1080×1920)

Data: 2026-09-24 (America/Sao_Paulo)

## Decisões

1. **Transparent OBS:** `?transparent=1` ou `?bg=transparent` → Phaser `transparent` + CSS `.obs-transparent` (html/body/#game-container). Fundo sólido escuro continua o default para preview local.
2. **Safe margins (TikTok chrome):** top ~140px, bottom ~320px, side ~36px. TOP 5 upper-left; kill feed empilha perto da base (acima da barra de comments); title/timer/vivos/likes dentro da safe area.
3. **Clean vs debug:** FPS + guias de safe area só com `?debug=1`; mute menor/menos proeminente no clean. Badge `DEMO` só se `?demo=1` (sem acoplar TIKTOK_MODE no client).
4. Docs: `docs/OBS.md` (PT-BR) com setup Browser Source.

## Como testar

```bash
TIKTOK_MODE=demo npm run build && npm start
# Overlay Vite:  http://localhost:5173/?transparent=1
# Debug guides:  http://localhost:5173/?transparent=1&debug=1
# Demo badge:    http://localhost:5173/?transparent=1&demo=1
# Admin:         http://localhost:3000/admin
# Health:        http://localhost:3000/health
# Guia OBS:      docs/OBS.md
```

## Arquivos

- `packages/client/src/overlayConfig.ts` — query params + SAFE insets
- `packages/client/src/main.ts`, `index.html` — transparent Phaser/CSS
- `packages/client/src/scenes/ArenaScene.ts`, `WaitingScene.ts` — HUD safe zones
- `docs/OBS.md`

## Anterior (likes/áudio/load test)

- Likes threshold, shares, random events, Web Audio beeps, load test 50/100 bots — commit a91b0f4 era.

## Next

- Bank/historical **Postgres** (opcional)
- VFX polish fino (partículas/abilities) se quiser
- Production TikTok connector **só quando** o usuário pedir (flag; DEMO first)
