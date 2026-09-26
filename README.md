# TikTok Live Ball Arena

Jogo interativo para TikTok Live (overlay OBS **1080×1920**). Presentes da live spawnam bolas e habilidades na arena.

> **Etapas 1–13 + 16–20 + likes/áudio/load + OBS polish:** DEMO default. Overlay OBS: `?transparent=1` — ver `docs/OBS.md`. Next opcional: Postgres bank.

## DEMO vs PRODUCTION


## Likes / Shares / Load test

- **Likes:** acumulam; a cada 100 (`LIKE_THRESHOLD`) → HEAL RAIN ou SPEED STORM (`LIKE_REWARD`)
- **Share:** +20 HP + 5s speed no sharer (cooldown 30s)
- Admin: 🧪 50/100 bots, force HEAL/SPEED/DOUBLE, Random ON/OFF
- Overlay: ❤️ meter, 🔊 mute (beeps Web Audio); fps só com `?debug=1`; OBS transparent via query

## TikTok modes (Etapa 13)

| Mode | Env | Behavior |
|------|-----|----------|
| **DEMO** (default) | `TIKTOK_MODE=demo` | Simulated events via `/admin`. **Not TikTok.** |
| **PRODUCTION** | `TIKTOK_MODE=production` + `TIKTOK_USERNAME=host` | Unofficial Webcast WS (`tiktok-live-connector@2.5.0`). Waits for LIVE with backoff. |

See `docs/TIKTOK_INTEGRATION.md` for risks, checklist, and reconnect behavior.


### Legacy table

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
- **Overlay (Vite):** http://localhost:5173/?transparent=1 — OBS Browser Source 1080×1920 (fundo transparente)  
- **Overlay (server):** http://localhost:3000/overlay?transparent=1 (após `npm run build`)  
- **OBS setup:** ver `docs/OBS.md` (`?debug=1` = FPS + safe guides; `?demo=1` = badge DEMO)

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
docs/             OBS.md + integração TikTok
```




## Ranking & Rodadas (Etapa 10–11)

- TOP 5 no overlay; sort: kills → dano → menos mortes → highestSpeed
- 👑 Rei da Arena na bola #1; anúncio `NOVO REI DA ARENA` (throttle)
- Timer 5:00; ÚLTIMO MINUTO @1:00; intensity @0:30; countdown 10…1; freeze @0:00
- Winner panel ~10s → wipe arena → nova rodada (re-entrar por comentário)
- Admin rápido: **⏱ 15s** / Force end / Next round

## Respawn & Vingança (Etapa 8–9)

- Morto: comente de novo para voltar (join não respawna)
- Stats da rodada preservados; HP 100 + 2s proteção
- Vingança: 🎯 no killer 10s; kill especial no feed (sem kill extra)

## Combate (Etapa 5)

- HP 100; dano mútuo em colisão (velocidade × massa), clamp 2–28
- Morte remove a bola; kill feed: `@attacker eliminou @victim`
- Admin: botões Dano / Kill em `/admin`

## Física (Etapa 3)

- Server autoritativo; client só renderiza `game:snapshot`
- **30 Hz** (`PHYSICS_TICK_HZ`)
- Colisão parede/bola: velocidade × **1.015** (aceleração progressiva)
- Comentário ou join (bots) spawna bola; DEMO auto-inicia a rodada

## Presentes (hierarquia — beneficia o SENDER)

| Gift | Coins | Ability | Efeito |
|------|-------|---------|--------|
| Rosa | 1 | heal_pulse | +2 HP (soft max 150), stack |
| Mini Dino | 10 | dino_rage | 10s +25% força / +15% speed / +20% colisão |
| Rosquinha | 30 | donut_overdrive | +20 HP, escudo 100 (cap 300), 12s buff; break→SUGAR BURST |
| Capivara | 100 | capybara_titan | 20s titan; restack +20s +25 HP; stomp; Ultra Calma |
| Galaxia | 1000 | galaxy_god | Imortal até fim da rodada atual; limpa no reset |

Admin: escolha o **alvo** e clique o gift. Detalhes em `gifts/gift-config.json`.

## Honestidade TikTok

Eventos do modo DEMO são **falsos / simulados**. Não há conexão TikTok até o adapter PRODUCTION ser ligado. Veja `docs/TIKTOK_INTEGRATION.md`.

## Loja de kills
- Loja pública: `/shop` (sem senha), com @ normalizado, saldo, catálogo, compra idempotente e ledger resumido.
- O mesmo @ é a identidade canônica do saldo; o userId TikTok é mantido apenas para auditoria.
- Catálogo inicial: consulte a tabela de balanceamento abaixo; itens legados foram desativados por migração idempotente.
- Compre, entre na arena e comente `!usar <slug>` para equipar. Armas passam a auto-targetar; o vínculo é de 3 minutos fixos e, após expirar, ao morrer, cai e pode ser recolhido por outra bola.
- Produção exige `DATABASE_URL` Postgres. Sem ela, o servidor usa fallback local apenas para desenvolvimento e registra aviso; no Render free esse arquivo é efêmero.
- Admin protegido: `/admin/economy/summary`, `/admin/economy/player` e `/admin/economy/adjust` (motivo e operationKey obrigatórios).

## Economia e combate 2026-09
- A loja `/shop` recebe o **username do TikTok** (com ou sem `@`), não o nome de exibição; a normalização é a mesma do participante.
- **Vida Tripla** custa 180 kills e fica `pending_entry`: na primeira entrada do comprador em uma nova rodada consome o item e aplica 3x HP base. Não cai, não passa para outro jogador e não altera respawn/multiplicadores posteriores.
- Armas são vinculadas por 3 minutos; após expirar, a morte do portador cria drop coletável. O coletor torna-se o novo portador e a regra de 3 minutos reinicia conforme o fluxo existente. Após equipar com `!usar <slug>`, o servidor faz auto-target no inimigo mais próximo; munição, recarga, cooldown, dano, explosões e minas são autoritativos.
- O Boss dispara raio automático a cada 3,2s em alvo próximo dentro do alcance existente: 18 dano, slow de 0,9s com fator 0,45; sem stun-lock.

| Item | Preço | Dano | Alcance | Cooldown | Munição / recarga | Área | Função |
|---|---:|---:|---:|---:|---:|---:|---|
| Vida Tripla | 180 | — | — | — | 1 consumível | — | 3x HP na próxima entrada; não dropável |
| Pistola | 45 | 8 | 480px | 1,8s | 6 / 5,5s | — | precisão e baixo custo |
| Metralhadora | 95 | 4 | 600px | 0,5s | 20 / 6,5s | — | supressão |
| 12 / Escopeta | 110 | 16 | 260px | 3,5s | 2 / 7s | 80px | burst curto |
| Sniper | 180 | 35 | 1000px | 5s | 3 / 9s | — | pickoff |
| Bazuca | 220 | 28 | 620px | 7s | 1 / 10s | 110px | zona/explosão |
| Mina Terrestre | 140 | 30 | — | 2s | 2 / 8s | 90px | armadilha |
