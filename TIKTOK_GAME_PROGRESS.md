# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Etapas 2 + 3 concluídas** (arena + física autoritativa)

Data: 2026-09-24 (America/Sao_Paulo)

## Decisões

1. **DEMO-first:** `TIKTOK_MODE=demo` padrão; playtest via `/admin`.
2. **Conector isolado:** `ITikTokConnector` — demo/production swappable.
3. **PRODUCTION (futuro):** `tiktok-live-connector` v2.5.x — ver `docs/TIKTOK_INTEGRATION.md`.
4. **Client:** Phaser 3 + Vite, canvas **1080×1920** (OBS Browser Source).
5. **Server autoritativo:** Express + Socket.IO; **física 100% no server**.
6. **Tick rate:** **`PHYSICS_TICK_HZ = 30`** — integrate + broadcast `game:snapshot` a 30 Hz.
7. **Spawn:** comentário ou join (bots) → 1 bola por `userId` (nudge se já existe). Auto-inicia rodada no DEMO se `waiting`.
8. **Colisão:** paredes + bola-bola (impulso ~elástico); em **toda** colisão parede/jogador multiplica velocidade por **`1.015`**; cap `MAX_BALL_SPEED=900`; clamp NaN; push-out de paredes.
9. **HP:** stub visual 100 (dano/morte = Etapa 4–5).
10. **Gifts/abilities:** ainda stub (Etapa futura).

## Arquivos principais (Etapa 2–3)

- `packages/shared/src/index.ts` — `BallState`, `GameSnapshot`, constantes de física
- `packages/server/src/game/PhysicsWorld.ts` — círculos, paredes, colisões
- `packages/server/src/game/GameLoop.ts` — spawn + tick 30 Hz + snapshots
- `packages/client/src/scenes/ArenaScene.ts` — render de bolas (label, iniciais/avatar, HP bar)
- `packages/client/src/socket.ts` — escuta `game:snapshot`

## Como testar DEMO

```bash
npm run dev   # ou server já em :3000 + overlay build
# Admin http://localhost:3000/admin
# 1) Spawn bots (5) OU Comentário
# 2) Overlay http://localhost:3000/overlay ou :5173
# Bolas devem aparecer, quicar nas paredes e entre si, acelerando aos poucos
```

## Next: **Etapa 4–5 — HP / dano / morte**

- Dano em colisão bola-bola (escalar com velocidade relativa)
- Morte / remoção / revenge stub
- Ranking / placar
- (Depois) gifts → abilityKey (tamanhos, boosts)
