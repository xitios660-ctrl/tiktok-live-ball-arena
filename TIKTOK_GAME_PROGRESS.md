# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Etapas 10–11 concluídas** (TOP 5 + rodada 5 min + vencedor + auto next)

Data: 2026-09-24 (America/Sao_Paulo)

## Decisões (Etapa 10–11)

1. **Ranking sort:** kills → damageDealt → fewer deaths → highestSpeed (`compareRanking`).
2. **TOP 5 permanente** no overlay durante a rodada; ☠ kills | 💀 deaths.
3. **Rei da Arena:** `isKing` + 👑 na bola #1; anúncio `NOVO REI DA ARENA` com throttle (`KING_ANNOUNCE_COOLDOWN_MS`).
4. **Timer:** exatamente `durationSec` (300) countdown `05:00…`; em 01:00 → `ÚLTIMO MINUTO!`; client intensity ≤30s; big countdown 10…1; em 00:00 → freeze physics + fase `results`.
5. **Winner:** melhor do ranking; painel com username, kills, deaths, damage, highestSpeed + ranking final.
6. **Intervalo ~10s** (`RESULTS_DURATION_SEC`); depois **wipe** bolas + clear records da rodada; mantém **historical** in-memory (wins/kills/deaths/damage/rounds).
7. **Auto next:** `phase=running`, timer 5:00 de novo; **jogadores re-entram via comentário** (arena limpa — escolha documentada: mais limpo que manter vivos com stats reset).
8. **Admin:** `POST /admin/round/set-time` (ex. 15s), `force-end`, `next`; botões no `/admin`.

## Arquivos (desta entrega)

- `packages/shared` — `results` phase, `WinnerInfo`, `HistoricalStats`, `top5`, `isKing`, `RESULTS_DURATION_SEC`, announce kinds
- `packages/server/src/game/GameLoop.ts` — ranking, king, timer announces, results, wipe+next, historical, admin timers
- `packages/server/src/routes/adminApi.ts` + `public/admin.html`
- `packages/client/src/scenes/ArenaScene.ts` + `socket.ts` — TOP5, 👑, winner panel, intensity, countdown

## Como testar rápido (DEMO)

```bash
# Server :3000 — Admin http://localhost:3000/admin
# 1) Spawn bots (ou comment)
# 2) ⏱ 15s  →  aguardar fim (ou Force end)
# 3) Winner panel ~10s → wipe → "NOVA RODADA! Comentem…"
# 4) Overlay: TOP 5 + 👑 no #1 durante a rodada
```

## Next: **Etapas 16–20 — gifts Rosa→Galaxy em DEMO**

Gifts importam para diversão antes do TikTok real (`gifts/gift-config.json`).
