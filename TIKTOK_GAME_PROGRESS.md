# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Etapas 4–5 + 7-lite concluídas** (HP, dano, morte, kill feed)

Data: 2026-09-24 (America/Sao_Paulo)

## Decisões

1. **DEMO-first** + conector isolado + Phaser 1080×1920 (mantidos).
2. **Física 30 Hz** server-authoritative; speed × **1.015** em colisão (Etapa 6 leve já ativa).
3. **HP:** start **100**, `maxHp` 100 (cap soft `MAX_BALL_HP=150` para heals futuros).
4. **Dano (mútuo, mass-weighted):**
   - Só em colisões **aproximando** (`velAlongNormal < 0`) com closing speed ≥ `DAMAGE_IMPACT_THRESHOLD` (40).
   - `impact = −velAlongNormal`
   - `damage_to_victim = clamp(round(impact × 0.085 × (attackerMass/totalMass) × strength), 2, 28)`
   - Ambos levam dano; quem acerta mais forte (mais massa) causa mais.
   - `lastHitter` = o outro na última aplicação de dano → crédito do kill.
5. **Morte:** HP ≤ 0 → remove da física, `deaths++`, killer `kills++`, emit `combat:event` kill `"@attacker eliminou @victim"`.
6. **Respawn:** **não** nesta etapa. Mortos ficam em `stats` (`alive:false`); comentário de morto é ignorado (hook Etapa 8).
7. **Admin:** `/admin/combat/damage`, `/admin/combat/kill` + painel com K/D.

## Arquivos (desta entrega)

- `packages/shared/src/index.ts` — dano constants, `PlayerStats`, `HitEvent`/`KillEvent`, `COMBAT_EVENT`
- `packages/server/src/game/PhysicsWorld.ts` — dano em bola-bola
- `packages/server/src/game/GameLoop.ts` — stats, morte, adminDamage/Kill, anti-respawn morto
- `packages/server/src/routes/adminApi.ts` + `public/admin.html`
- `packages/client/src/scenes/ArenaScene.ts` — HP bars, kill feed, sparks/death flash
- `packages/client/src/socket.ts` — `combat:event`

## Como testar DEMO

```bash
# server :3000
# Admin → Spawn bots (8–12) → esperar colisões (HP cai) OU
#   "Dano 25/50" / "Kill (1ª bola)"
# Overlay: kill feed à direita, K/D no canto, bolas somem ao morrer
```

## Next: **Etapa 8 — respawn por comentário + revenge**

- Morto comenta → respawna (talvez HP reduzido / revenge mark no killer)
- Ranking / top killers overlay
- Gifts → abilityKey (tamanhos, heal até 150, boosts)
