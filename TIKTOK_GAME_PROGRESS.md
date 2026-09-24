# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Kill size/strength (cap) + gift stacking (Capivara x3)**

Data: 2026-09-24 (America/Sao_Paulo)

### Kills → tamanho + força (com limite)

| Const | Valor | Efeito |
|-------|-------|--------|
| KILL_STRENGTH_PER | 0.08 | +8% força / kill |
| KILL_STRENGTH_CAP | 2.0 | máx ~12 kills → 2× força |
| KILL_SIZE_PER | 0.05 | +5% tamanho / kill |
| KILL_SIZE_CAP | 1.75 | máx ~15 kills → +75% size |
| MAX_BALL_RADIUS | 0.35 × width (378) | clamp absoluto pós-multiplicadores |

`finalSize = base × killSize × titanSize(stacks) × donutSize(stacks) × galaxySize` → clamp radius.

F2P com muitos kills fica grande sem presentear.

### Gift stacking (true stacks)

| Gift | Stack max | Escalamento |
|------|-----------|-------------|
| 🦫 Capivara | **3** | size `1+(1.6-1)×s` → 1.6 / 2.2 / 2.8; strength linear cap 3.0; mass linear; resist×s cap 0.7; +20s + HP (50 / 25 restack) |
| 🦖 Mini Dino | 3 | strength/speed/collision linear por stack; refresh duração |
| 🍩 Rosquinha | 3 | escudo +100 (máx 300) + size +8%/stack enquanto overdrive |
| 🌹 Rosa | — | só cura (quantity) |
| 🌌 Galáxia | 1 | re-gift = refresh; sem explosão de size |

Announce Capivara x3: `🦫 CAPIVARA x3! @name GIGANTE`. Timer expire → stacks = 0.

### Como testar (DEMO)

```bash
TIKTOK_MODE=demo npm run build && npm start
# Overlay: /overlay · Admin: /admin.html
# 1) Spawn bots → Iniciar
# 2) Doar Capivara 3× no mesmo bot → size ~2.8× + announce GIGANTE
# 3) Matar spam → bola cresce (cap 1.75×) + 💪 força (cap 2.0×)
```

### Arquivos

- `packages/shared/src/index.ts` — caps, `killSizeMult`, stack helpers
- `packages/server/src/game/PhysicsWorld.ts` — stacks, recomputeGeometry, MAX_BALL_RADIUS
- `packages/server/src/game/GiftAbilities.ts` — `addGiftStack` on gift
- `packages/client/src/ui/GiftLegend.ts` — Capivara empilha até x3
- `packages/client/src/scenes/ArenaScene.ts` — buff icon `🦫×3`

### Public

- Render: https://tiktok-live-ball-arena.onrender.com/overlay

## Anterior (Arena floor pickups + futuristic overlay)

Pickups no chão (raio/ima/gelo/foguete/espelho) + overlay neon.
