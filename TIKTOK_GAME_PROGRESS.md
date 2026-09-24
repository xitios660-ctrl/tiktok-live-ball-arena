# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Likes/Shares + áudio + load test** (pós Etapa 13)

Data: 2026-09-24 (America/Sao_Paulo)

## Decisões

1. **Likes:** acumulador global; a cada `LIKE_THRESHOLD` (default 100) dispara `LIKE_REWARD` (`heal_rain` | `speed_storm`). Não dispara por like individual.
2. **Shares:** SHARE BOOST no sharer — +20 HP + 5s speed (`sugar` buff); cooldown 30s/user.
3. **Random events:** a cada ~45s, 35% chance de HEAL RAIN / SPEED STORM / DOUBLE DAMAGE; admin ON/OFF + force.
4. **Áudio:** Web Audio beeps (sem assets); mute no overlay; arquivos opcionais depois. Missing file = silent.
5. **Load test:** admin 50/100 bots (cap 150); gift spam opcional; client adaptive particles se FPS cair.
6. Physics continua server-authoritative.

## Performance (spawn 100 — local 2026-09-24)

- `/admin/sim/loadtest` 50 bots → 53 players ~0.00s; 100 bots → 153 players ~0.01s — **sem crash**.
- Physics 30 Hz server-side OK neste box com 150 bolas.
- Client: FPS meter + `particleBudget` (sparks ↓ se FPS < 40 / < 28). Overlay mute 🔊.
- Áudio: Web Audio beeps (sem arquivos); ver `packages/client/src/audio/AudioManager.ts`.

## Como testar

```bash
TIKTOK_MODE=demo npm run build && npm start
# Admin http://localhost:3000/admin
# ❤️ +100 likes → HEAL RAIN toast
# 📢 Share → +HP no alvo
# 🧪 50 / 100 bots
# Overlay: 🔊 mute, ❤️ meter, fps
```

## Arquivos

- `packages/server/src/game/GlobalArenaEvents.ts`
- `GameLoop.ts`, `PhysicsWorld.ts` (global damage)
- `adminApi.ts`, `admin.html`, `DemoEventSimulator.ts` (bot cap 150)
- `packages/client/src/audio/AudioManager.ts`, `ArenaScene.ts`
- `packages/shared` — constants + announce kinds + `global` no snapshot

## Next: bank/historical Postgres opcional **ou** OBS polish
