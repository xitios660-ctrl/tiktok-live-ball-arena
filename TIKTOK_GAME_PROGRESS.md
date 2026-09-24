# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Etapas 8–9 concluídas** (respawn por comentário + vingança)

Data: 2026-09-24 (America/Sao_Paulo)

## Decisões

1. **Respawn:** só **novo comentário** após morte (`deadAt`). Join **não** respawna.
2. **1 bola / userId** — `physics.respawn()` remove e recria.
3. **Stats preservados** na rodada: kills, deaths, damageDealt/Taken, collisions, highestSpeed, rivalry map.
4. **Spawn protection 2s:** sem dano dado/recebido, sem push bola-bola; semi-transparente no client.
5. **Revenge:** ao morrer guarda `lastKiller`; no respawn se killer válido → `"VOLTOU POR VINGANÇA!"` + 🎯 no alvo ~10s (só visual).
6. **Revenge kill:** se eliminar o alvo → `"VINGANÇA! @A se vingou de @B"`; +1 kill normal (sem bônus).
7. **Rivalidade:** contagem A→B na rodada; anúncio a partir da 2ª eliminação do mesmo alvo.
8. **Admin:** lista de mortos + “Comentar / respawn” + `/admin/combat/respawn`.

## Arquivos (desta entrega)

- `packages/shared` — `SPAWN_PROTECTION_MS`, `REVENGE_MARK_MS`, `AnnounceEvent`, flags em `BallState`/`PlayerStats`
- `packages/server/src/game/PhysicsWorld.ts` — protection, safe spawn, revenge mark
- `packages/server/src/game/GameLoop.ts` — respawn, revenge, rivalry, stats
- `packages/server/src/routes/adminApi.ts` + `public/admin.html`
- `packages/client/src/scenes/ArenaScene.ts` — alpha proteção, 🎯, toasts, feed vingança

## Como testar DEMO

```bash
# Admin http://localhost:3000/admin
# 1) Spawn bots → Kill (1ª bola)
# 2) Em Mortos: "💬 Comentar / respawn" no morto
# 3) Overlay: bola semi-transparente 2s, 🎯 no killer, toast vingança
# 4) Após 2s: Kill do alvo → feed "VINGANÇA! ..."
```

## Next: **Etapa 10–11 — ranking TOP5 + rodada 5 min + vencedor + auto next**

- Overlay TOP 5
- Fim de rodada: winner, placar, countdown próxima
