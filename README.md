# TikTok Live Ball Arena

Jogo interativo para TikTok Live (overlay OBS **1080×1920**). Presentes da live spawnam bolas e habilidades na arena.

> **Etapa 1:** estrutura + stubs + simulador DEMO. Física completa = Etapa 2+.

## DEMO vs PRODUCTION

| Modo | `TIKTOK_MODE` | O que acontece |
|------|---------------|----------------|
| **DEMO** (padrão) | `demo` | Eventos **simulados** no servidor. Painel `/admin` dispara comentários, gifts, likes, bots, etc. **Não é TikTok real.** |
| **PRODUCTION** | `production` | Conector real (adapter stub nesta etapa). Ver `docs/TIKTOK_INTEGRATION.md`. |

## Como rodar (DEMO)

```bash
cd tiktok-live-ball-arena
cp .env.example .env          # TIKTOK_MODE=demo já vem setado
npm install
npm run dev                   # sobe server (:3000) + client Vite (:5173)
```

- **Health:** http://localhost:3000/health  
- **Admin DEMO:** http://localhost:3000/admin — botões para Rosa / Mini Dino / Rosquinha / Capivara / Galaxia, likes, shares, spawn N bots, disconnect/reconnect  
- **Overlay (Vite):** http://localhost:5173 — use no OBS Browser Source (1080×1920)  
- **Overlay (server):** http://localhost:3000/overlay (placeholder até `npm run build` no client)

No painel admin: clique **▶ Iniciar** para começar a rodada de 5 min e veja eventos no overlay.

## Scripts

- `npm run dev` — server + client em paralelo (DEMO)
- `npm run build` — build shared + server + client
- `npm start` — sobe só o server (após build)

## Estrutura

```
packages/shared   tipos, constantes, gift types
packages/server   Express + Socket.IO + game loop stub + TikTok connector (interface) + DEMO sim
packages/client   Phaser 3 overlay 1080×1920
gifts/            gift-config.json (hierarquia Rosa → Galaxia)
docs/             pesquisa de integração TikTok
```

## Presentes (hierarquia)

| Gift | Coins (aprox.) | Ability |
|------|----------------|---------|
| Rosa | 1 | spawn_small_ball |
| Mini Dino | 5 | spawn_medium_ball |
| Rosquinha | 30 | boost_speed |
| Capivara | 99 | spawn_heavy_ball |
| Galaxia | 1000 | ultimate_chaos |

Detalhes em `gifts/gift-config.json`.

## Honestidade TikTok

Eventos do modo DEMO são **falsos / simulados**. Não há conexão TikTok até o adapter PRODUCTION ser ligado. Veja `docs/TIKTOK_INTEGRATION.md`.
