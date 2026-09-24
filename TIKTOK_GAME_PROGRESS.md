# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Design polish + Kill → Força**

Data: 2026-09-24 (America/Sao_Paulo)

## Part A — Visual

- Arena: vignette/gradient (skipped if `?transparent=1`), glass TOP 5 card with crown on #1, dramatic timer + glow, punchier kill feed rows, celebratory winner panel.
- Balls: outer ring, clearer HP (green/yellow/red), stronger labels, buff auras, `💪×mult` when kills ≥ 3.
- WaitingScene: TikTok-colored backdrop + pulsing CTA “COMENTE PARA JOGAR”.
- Performance: no heavy filters; adaptive particles unchanged.

## Part B — Kills → strength + ranking

**Ranking (unchanged primary):** `kills → damageDealt → fewer deaths → highestSpeed` (`compareRanking`). King / TOP5 / winner all use this.

**Strength formula (round-permanent until next round):**
```
strengthMult = 1 + min(kills * 0.08, 1.0)
```
- +8% collision damage power per kill; soft cap **+100%** (2.0×) at **12+** kills.
- Applied in `PhysicsWorld.activeStrength` **before** gift mults (Dino/Titan/Galaxy still stack on top).
- `DAMAGE_MAX` raised 28 → 36 so late-game strength can express.
- Announce `💪 FORÇA +N%` every 3 kills (`strength_up`) — not per kill.
- Survives death/respawn (`setKills` on respawn/spawn).


## Add-on: Mild attraction + new powers

**Attraction:** `MILD_ATTRACTION_ACCEL=55`, radius `420`, cap `90` px/s²; soft falloff `(1-dist/R)`; disabled while spawn-protected. Clusters fights without gluing.

**New gifts (admin DEMO):**
| id | ability | effect |
|----|---------|--------|
| raio | lightning_zap | nearest foe: dmg 8 + slow ~2.2s |
| ima | magnet_pulse | short strong pull toward caster |
| gelo | freeze_aura | 8s aura slows nearby |
| foguete | dash_burst | impulse + 2.5s speed |
| espelho | reflect_shield | 5s, ~55% dmg bounce |

Still: design polish + kill→strength (`1+min(kills*0.08,1)`) + ranking kills-first.

## Como testar

```bash
TIKTOK_MODE=demo npm run build && npm start
# Overlay: polish HUD; Admin: spawn bots, force kills
# After 3 kills on same player → toast FORÇA +24% + 💪×1.24 on ball
# TOP 5 / crown track kills; winner = most kills
# Mobile: https://tiktok-live-ball-arena.onrender.com/overlay
```

## Arquivos

- `packages/shared/src/index.ts` — `killStrengthMult`, constants, BallState fields
- `packages/server/src/game/PhysicsWorld.ts` — `kills` + `setKills` + strength
- `packages/server/src/game/GameLoop.ts` — sync kills, strength_up announce
- `packages/client/src/scenes/ArenaScene.ts`, `WaitingScene.ts`
- `packages/server/public/admin.html` (status fields via adminApi)

## Public

- Render auto-deploy: https://tiktok-live-ball-arena.onrender.com

## Anterior (Mobile)

## Mobile

1. **Overlay:** viewport `device-width` + `viewport-fit=cover`; `#game-container` 100% / 100dvh flex center; black letterbox (transparent if `?transparent=1`).
2. **Phaser:** logical size stays **1080×1920**; `Scale.FIT` + `CENTER_BOTH`; refresh on resize/orientation/visualViewport.
3. **Audio:** `audio.unlock()` on first touch/pointer/keydown (iOS/Android autoplay).
4. **Admin:** sticky topbar with quick actions; stacked grid on narrow screens; min tap ~44px; `font-size:16px` inputs (no iOS zoom); no horizontal overflow; safe-area insets.

## Como testar (mobile)

```bash
TIKTOK_MODE=demo npm run build && npm start
# No telefone (mesma rede ou Render):
#   https://tiktok-live-ball-arena.onrender.com/overlay
#   https://tiktok-live-ball-arena.onrender.com/admin
# Rotacionar landscape/portrait → canvas re-FIT; toque → áudio desbloqueia.
```

## Public

- Render: https://tiktok-live-ball-arena.onrender.com (auto-deploy on push master)

## Anterior (OBS polish)

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
