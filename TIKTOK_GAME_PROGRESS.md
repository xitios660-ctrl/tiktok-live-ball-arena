# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Balance + cinematic overlay + gabarito**

Data: 2026-09-24 (America/Sao_Paulo)

### Balance

1. **Donut shield TTL** — `DONUT_SHIELD_DURATION_MS = 15_000`. Shield HP expires by time (`shieldUntil`); Sugar Burst only on damage-break, not on fade. Feed: `🛡 Escudo expirou @name`.
2. **Cosmic Duel** — 1ª Galáxia = God Mode immortal até fim da rodada. 2ª Galáxia de outro player inicia **Duelo Cósmico**: gods se machucam via `cosmicHp` (250), dano ×`COSMIC_DUEL_DAMAGE_MULT` (0.4). Mortais não derrubam gods. Cosmic HP → 0 = perde God Mode, volta mortal full HP. 3ª+ entra no duelo.

### Overlay

3. **Cinematic HUD** — título BALL ARENA (Nunito 800, ★ + gold accent), phase labels (RODADA / FINAL / RESULTADOS).
4. **Gabarito de presentes** — painel direito compacto com efeitos em PT-BR + “Comente para entrar / respawnar”.

### Como testar (DEMO admin)

```bash
TIKTOK_MODE=demo npm run build && npm start
# Overlay: http://localhost:PORT/overlay
# Admin: spawn 2 bots → send galaxia on both → expect DUELO CÓSMICO + lavender HP bars
# Send rosquinha → wait ~15s → “Escudo expirou” (no Sugar Burst); break shield by hits → Sugar Burst
```

### Constantes

| Key | Value |
|-----|-------|
| DONUT_SHIELD_DURATION_MS | 15000 |
| COSMIC_DUEL_HP | 250 |
| COSMIC_DUEL_DAMAGE_MULT | 0.4 |

### Arquivos

- `packages/shared/src/index.ts` — constants + `cosmic_duel` / `shield_expire` kinds
- `packages/server/src/game/PhysicsWorld.ts` — shieldUntil, enableGalaxy duel, cosmic damage
- `packages/server/src/game/GiftAbilities.ts` — shield refresh + duel announces
- `packages/server/src/game/GameLoop.ts` — feed for expire / lost God Mode
- `packages/client/src/ui/CinematicHud.ts` — title / phase chrome
- `packages/client/src/ui/GiftLegend.ts` — gift cheat sheet
- `packages/client/src/scenes/ArenaScene.ts` — wire HUD + duel HP bar

### Public

- Render: https://tiktok-live-ball-arena.onrender.com/overlay

## Anterior (VFX polish)

Lightweight ability FX on overlay. Server emits `ability_fx`; client draws bolts/rings/trails.
