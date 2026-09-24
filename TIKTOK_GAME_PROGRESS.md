# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Etapas 16–20 concluídas** (gifts Rosa→Galaxy com efeitos reais)

Data: 2026-09-24 (America/Sao_Paulo)

## Decisões (Etapas 16–20)

1. **Beneficia só o SENDER** — gift spawna o sender se ainda não tiver bola.
2. **abilityKey** do `gifts/gift-config.json` dirige a lógica; giftId resolve via `resolveAbilityKey`.
3. **repeatCount** aplica a habilidade N vezes (Rosa = N heals; timed buffs estendem duração; escudo soma com cap).
4. **Buffs coexistentes** com caps (atributos dino/titan não re-multiplicam; titan restack = +20s +25 HP).
5. **Galaxy** imortal só até o fim da rodada atual — `clearAllGalaxy` + `clearAllBuffs` em `enterResults` / wipe.
6. **Server authoritative** — client só VFX a partir de `buffs`, `shieldHp`, `isGalaxy`, `sizeScale`, flashes.
7. **Admin:** select de alvo vivo + repeat; fallback = último spawn / 1ª bola.

## Fórmulas / caps

| Gift | Key | Efeito |
|------|-----|--------|
| 🌹 Rosa | `heal_pulse` | +2 HP/unidade, soft max **150** |
| 🦖 Dino | `dino_rage` | 10s: str×1.25, speed×1.15, colisão×1.20; stack = +10s |
| 🍩 Donut | `donut_overdrive` | +20 HP; escudo +100 (max **300**); 12s speed×1.2 + resist 25%; break → SUGAR BURST (push, 8 dmg, speed×1.25 / 3s) |
| 🦫 Capivara | `capybara_titan` | 20s: size×1.6 mass×2 str×1.75 resist 40% col×1.35 speed×1.2; +50 HP; regen +2/s; stomp; Ultra Calma KB×0.5; restack +20s +25 HP |
| 🌌 Galaxy | `galaxy_god` | até 00:00: ∞ HP, str×4, speed×2, size×1.5, mass×4; impact; **limpa no results** |

## Arquivos

- `gifts/gift-config.json` — abilityKeys novos
- `packages/shared` — BuffKey, BallState buff fields, gift constants, resolveAbilityKey
- `packages/server/src/game/PhysicsWorld.ts` — shield/resist/buffs/stomp/galaxy
- `packages/server/src/game/GiftAbilities.ts` — applyGiftAbility
- `packages/server/src/game/GameLoop.ts` — handleGift, sugar burst, clear on results
- `adminApi` + `admin.html` — alvo + repeat
- `packages/client/.../ArenaScene.ts` — auras / donut ring / ∞ / hearts

## Como testar cada gift (DEMO)

```bash
# Admin http://localhost:3000/admin
# 1) Spawn bots · Auto OFF
# 2) Escolher Alvo no select
# 3) 🌹 Rosa x5 → HP sobe (~110)
# 4) 🦖 Dino → aura verde + buff dino_rage
# 5) 🍩 Donut → shield 100; x3 → shield 300
# 6) 🦫 Capivara → sizeScale 1.6; 2º gift = restack
# 7) 🌌 Galaxy → isGalaxy, kill não mata; ⏱ 15s → results limpa galaxy
```

## Next: **polish simulator + Etapa 13 connector PRODUCTION** (flag, default demo)
