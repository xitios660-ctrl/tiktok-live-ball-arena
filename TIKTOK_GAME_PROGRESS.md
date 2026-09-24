# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Arena floor pickups + futuristic overlay**

Data: 2026-09-24 (America/Sao_Paulo)

### Pickups (powers no chão)

Powers that are **not** TikTok gifts spawn on the arena floor and activate only when a living ball rolls over them:

| Ability | Emoji | Admin giftId |
|---------|-------|--------------|
| lightning_zap | ⚡ | raio |
| magnet_pulse | 🧲 | ima |
| freeze_aura | ❄️ | gelo |
| dash_burst | 🚀 | foguete |
| reflect_shield | 🪞 | espelho |

**Still TikTok gifts:** rosa, mini_dino, rosquinha, capivara, galaxia.

Behavior:
- During `running`: keep ~3–5 pickups; spawn every 6–10s if under max; lifetime ~32s then despawn/respawn elsewhere.
- Collect when ball center within `ball.radius + pickup.radius`; immediate ability apply + feed `⚡ @name pegou Raio!`.
- Clear on round start / results / waiting.
- Galaxy gods can collect. Dead balls / results: no collect.
- Admin: `POST /admin/sim/pickup` (near center). Gift buttons for the 5 diverted to floor spawn.

### Overlay futuristic pass

- Title: dual neon glow + drifting scanline + pulsing gold accent
- Ambient star twinkles (perf-safe ~16 dots)
- TOP5 / gabarito: teal/lavender neon border pulse + soft float bob
- Pickups: orbiting rings, emoji bob, color-coded glow
- Kill feed: scale punch then settle
- Phase labels: fade+scale cinema transition
- High-speed balls: cheap ghost motion smear

### Constantes

| Key | Value |
|-----|-------|
| MAX_PICKUPS | 5 |
| PICKUP_RADIUS | 32 |
| PICKUP_SPAWN_INTERVAL | 6–10s |
| PICKUP_LIFETIME_MS | 32000 |
| PICKUP_EDGE_MARGIN | 120 |

### Como testar (DEMO)

```bash
TIKTOK_MODE=demo npm run build && npm start
# Overlay: /overlay · Admin: /admin.html
# 1) Spawn 5 bots → Iniciar
# 2) “Spawn pickup” → ⚡ Raio (aparece no centro)
# 3) Espere bolas passarem → feed “pegou Raio!” + FX
# 4) Ou aguarde auto-spawn (~6–10s) em posições aleatórias
```

### Arquivos

- `packages/shared/src/index.ts` — PickupState, constants, announce `pickup`
- `packages/server/src/game/PickupSystem.ts` — spawn / collect / expire
- `packages/server/src/game/GiftAbilities.ts` — `applyPickupAbility`
- `packages/server/src/game/GameLoop.ts` — tick + snapshot.pickups
- `packages/server/src/routes/adminApi.ts` + `public/admin.html`
- `packages/client/src/ui/PickupsLayer.ts`, `GiftLegend.ts`, `CinematicHud.ts`
- `packages/client/src/scenes/ArenaScene.ts`

### Public

- Render: https://tiktok-live-ball-arena.onrender.com/overlay

## Anterior (Balance + cinematic + gabarito)

Donut shield TTL, Cosmic Duel, Cinematic HUD, gift gabarito.
