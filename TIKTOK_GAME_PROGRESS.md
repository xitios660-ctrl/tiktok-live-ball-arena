# Etapa atual: **Cinematic frame-driven rebuild final**

Data: 2026-09-25 (America/Sao_Paulo)

### Implementado nesta etapa
- Home refeita no padrão do vídeo de referência: animação controlada por frames/sprite, não por vídeo esticado.
- Desktop e celular em pé usam sprites diferentes.
- Desktop: 36 frames HQ (6x6), cena 16:9.
- Mobile: 36 frames HQ (6x6) em composição 9:16 com fundo cinematográfico desfocado e cena integral centralizada.
- Mouse e toque arrastam a animação para frente/para trás; idle suave quando ninguém interage.
- JOGAR virou botão HTML real com estados normal/hover/pressionado, glow, sweep e feedback tátil visual.
- Clique em JOGAR dispara sequência cinematográfica separada de 48 frames (8x6) e revela a arena real já carregada.
- Mobile tem transição própria 9:16, sem crop gigante do boss.
- Conectar TikTok Live, Ranking e Como Jogar são botões reais, sem hotspots invisíveis.
- Um único tema musical é usado em home -> transição -> gameplay após o primeiro gesto permitido pelo navegador.
- Assets HQ publicados via CDN e configurados no Render por variáveis VITE.
- Figma atualizado com seção FINAL contendo desktop, mobile 9:16, estados de JOGAR, transições e entrada no gameplay.

### Commits principais
- b9fc8fdd61395f321230b2e369c0dd09acd59688 — Rebuild cinematic intro with responsive frame-driven UI
- 0ccc7a738f9c008a09c2b7e575d3a9285387b7d0 — Use one soundtrack across cinematic intro and gameplay

### Testes
- Build/deploy do Render concluído com status LIVE.
- Site protegido por SITE_ACCESS_PASSWORD impede QA visual automatizado sem sessão autorizada.
- Figma final foi renderizado e revisado em desktop/mobile.

---
# Etapa atual: **Cinematic V4 — frame scrub + responsive portrait**

Data: 2026-09-25 (America/Sao_Paulo)

### Implementado
- Home reconstruída com o mesmo método do vídeo de referência: frames extraídos e consolidados em sprites.
- Sprite HOME novo: trecho limpo do vídeo Omni do Bolla Arena, 24 frames, 960x540 por frame, sem botões/menus baked-in.
- Scrub por mouse e toque com interpolação suave; ao sair/soltar volta para o frame central.
- Layout desktop full-screen cinematográfico.
- Layout portrait dedicado: fundo desfocado + frame 16:9 nítido preservado, sem esticar/cortar o BOSS de forma agressiva.
- Logo e botões agora são elementos DOM reais, não hotspots invisíveis sobre a arte.
- Estados hover/pressed, brilho, shimmer e burst visual no toque.
- JOGAR reproduz sequência de frames de transição + áudio do próprio vídeo e então revela o jogo já carregado.
- Música do jogo fica bloqueada durante HOME/transição e inicia somente quando a rodada está em `running`.
- Waiting/results param BGM; transição e BGM não tocam juntas.
- BGM V4 usa somente áudio derivado do vídeo original do Bolla Arena, sem mixar duas músicas.
- Figma atualizado com frames FINAL V4 desktop e portrait.

### Assets V4
- HOME sprite: 3.2 MB WebP
- Transition sprite: 3.3 MB WebP
- Transition audio: 96 KB MP3
- Game theme: 707 KB MP3

### Deploy
- Render build aprovado e versão atual publicada.
- Assets externos validados via HTTP 200.

---

# Etapa atual: **Cinematic V3 — frame-based reference-style UI**

Data: 2026-09-25 (America/Sao_Paulo)

### Mudança de direção
- Removido o conceito de vídeo 16:9 esticado/cortado como página inteira.
- Home reconstruída com sequência de frames interativa inspirada no site de referência enviado pelo usuário.
- Desktop: hero central cinematográfico, copy editorial à esquerda, cards de informação à direita, cursor/retículo e botões reais.
- Portrait: sprite dedicado para tela em pé, hero próprio, texto e controles abaixo sem distorção.
- Mouse move os frames no desktop; arrastar o dedo faz o mesmo no mobile; idle anima sozinho quando não há interação.
- JOGAR usa estado pressionado real e sequência de frames para entrar na arena.
- Nenhum botão usa hotspot invisível maior que o elemento visível.

### Áudio
- Apenas uma trilha principal por vez.
- A trilha configurada agora reutiliza o áudio do vídeo principal do Bolla Arena para combinar com toda a identidade.
- Camada de ambient/drone removida para impedir duas músicas sobrepostas.
- Waiting e fases da arena não param/reiniciam a trilha; ela continua pelo fluxo.

### Assets
- Home desktop 36 frames: `7bed6250-8f35-41c5-820e-2becc2dd02ee.webp`
- Home portrait 36 frames: `d5b8f7ff-aa18-4c85-8910-8adc6531b7e6.webp`
- Transition sprite: sequência de frames já existente, sem vídeo esticado.

### Figma
- Arquivo: `Bolla Arena — Responsive Interactive UI`
- Frames novos: `Cinematic V3 / Desktop` e `Cinematic V3 / Portrait`

### Commits principais
- `a0745769` — Rebuild cinematic intro around interactive frames
- `e3699276` — Remove ambient layer from soundtrack

---

# Etapa atual: **Frame-based responsive cinematic UI (Figma V2)**\n\nData: 2026-09-24/25 (America/Sao_Paulo)\n\n### Redesign\n- Home cinematográfica migrada de vídeo esticado para sprite de 24 frames controlado por mouse/toque.\n- Mobile portrait passa a usar hero 16:9 próprio + botões reais abaixo, sem crop gigante.\n- Desktop/landscape mantém palco 16:9 central com controles reais.\n- JOGAR usa botão visível com estado pressionado e transição por 24 frames.\n- Botões Conectar, Ranking e Como Jogar não dependem mais de hotspots transparentes.\n\n### Áudio\n- Trilha configurada como canal único contínuo; sprites não possuem áudio concorrente.\n- Ambient drone é desativado quando VITE_CONTINUOUS_BGM=1.\n- Stop de BGM solicitado por cenas é ignorado enquanto o modo contínuo estiver ativo.\n\n### Design\n- Figma: Bolla Arena — Responsive Interactive UI.\n- Mobile V2: frame 390x844 inspirado no node 4:10.\n\n---\n# Etapa atual: **Cinematic interactive home + animated JOGAR transition**

Data: 2026-09-24 (America/Sao_Paulo)

### Home interativa
- Nova camada cinematográfica em `packages/client/src/ui/CinematicIntro.ts`.
- Ativa automaticamente em `?phone=1` ou `?intro=1`; `?intro=0` desliga.
- Mouse e toque controlam parallax, perspectiva e glow.
- Mantém `/overlay` normal para OBS/uso direto e ignora intro em modo transparente.
- Botões JOGAR, Conectar TikTok, Ranking e Como Jogar têm hotspots/ações reais.

### JOGAR
- O Phaser inicia por trás da home para o socket já estar quente.
- Clique em JOGAR tenta usar `/assets/ball-arena/cinematic/play-transition.mp4`.
- Se o vídeo ainda não estiver publicado, usa fallback de zoom cinematográfico sem quebrar o jogo.
- `/assets/ball-arena/cinematic/home-loop.mp4` é usado automaticamente como home quando existir; sem ele usa `access-arena.jpg`.
- O clique também tenta liberar áudio/fullscreen no mesmo gesto; se falhar, o gate de áudio normal continua disponível.

### Arquivos
- `packages/client/src/ui/CinematicIntro.ts` (novo)
- `packages/client/src/main.ts`

### Próximo asset esperado
- `packages/client/public/assets/ball-arena/cinematic/home-loop.mp4`
- `packages/client/public/assets/ball-arena/cinematic/play-transition.mp4`

---
# TikTok Live Ball Arena — Progress Log

## Etapa atual: **Premium TOP 5 + overlay graphics polish**

Data: 2026-09-24 (America/Sao_Paulo)

### Premium TOP 5
Glass dark card (`PremiumTop5.ts`) com header ouro/creme “◆ TOP 5” + coroa; 5 rows medalha (🥇🥈🥉 + muted); colunas rank | nome | kills | HP pip; flash/slide ao mudar rank; neon pulse + bob.

### Polish
Vignette + grid diagonal; bola #1 rim light / anel ouro mais grosso; HP bar inset; winner frame ouro em camadas; feed card glass alinhado ao TOP5.

### Arquivos
- `packages/client/src/ui/PremiumTop5.ts` (novo)
- `packages/client/src/scenes/ArenaScene.ts`
- `packages/client/src/ui/CinematicHud.ts` (winner typography tweak)

### Public
- Render: https://tiktok-live-ball-arena.onrender.com/overlay

## Anterior: **Kill size/strength (cap) + gift stacking (Capivara x3)**

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

## 2026-09-25 — Comments, round likes and readable mobile guide
- Fixed EventDedupe TTL lookup: repeated messages no longer stay blocked until opportunistic garbage collection.
- Preserve TikTok comment message IDs across both receivers; new messages with the same text can respawn a dead viewer immediately.
- Normalize nested PirateTok chat/like users; never attribute room-global like deltas to a viewer.
- Likes accumulate per viewer for the round, with intermediate 50-like healing tiers (including 150), and existing 100/200/500/1000 strength/Capybara rewards. Like healing is capped at max HP.
- Automatic bots default to 2 every 30s; configured batch has minimum 2, existing population safety cap retained.
- Larger multiline mobile/portrait footer, clearer gift guide, leaderboard HP/eliminated state.
- Repaired lockfile missing production TikTok connector dependencies.
- Verification: shared/server/client compile; production selftests including connector duplicate→death→new repeated comment; local disposable HTTP→GameLoop→Socket.IO smoke passes entry/death/respawn, 50/100/150/1000 tiers. Actual 30-second bot cadence checked in disposable server.
- Live limitation: public health reports repeated primary receiver reconnections; live viewer comment/like delivery still requires post-deploy observation. Do not equate local simulated events with a real TikTok live test.
- Previous deployed commit: 96fc6fa. Next: publish tested change and verify live overlay and receiver status.


## 2026-09-25 — Like combo reset + complete guides + premium mobile TOP 5
- Personal like rewards now run in repeatable streaks: 10 seconds without a like starts a fresh combo.
- New combo can earn 50/100/150/200/500/1000 rewards again; round kills/deaths/strength remain intact.
- Main gift/power gabarito now shows every implemented gift and floor power instead of hiding the icon grid.
- Phone landscape now reuses the same PremiumTop5 component as the main overlay.
- Phone guide lists Rosa, Dino, Rosquinha, Capivara, Galáxia, Raio, Ímã, Gelo, Foguete, Espelho, Cura and comment/respawn.
- Server selftest updated to verify idle like-combo reset.
