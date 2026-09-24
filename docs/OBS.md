# OBS — Overlay Ball Arena (1080×1920)

Guia rápido para usar o overlay no **OBS Browser Source** sobre a live do TikTok.

## Tamanho

| Campo | Valor |
|-------|-------|
| Width | **1080** |
| Height | **1920** |
| FPS | 30 (ou 60 se a máquina aguentar) |

Formato vertical (9:16), igual ao TikTok Live.

## URLs

### Desenvolvimento (Vite)

```
http://localhost:5173/?transparent=1
```

Preview local com fundo sólido (sem OBS):

```
http://localhost:5173/
```

Debug (FPS + guias de safe area):

```
http://localhost:5173/?transparent=1&debug=1
```

Badge DEMO opcional (só se você passar o query):

```
http://localhost:5173/?transparent=1&demo=1
```

### Produção / server após `npm run build`

```
http://localhost:3000/overlay?transparent=1
```

(ou a URL pública do host, ex.: `https://seu-servico.onrender.com/overlay?transparent=1`)

Aliases aceitos para fundo transparente: `?transparent=1` **ou** `?bg=transparent`.

## Passos no OBS

1. **Sources → + → Browser**
2. URL: uma das acima com `?transparent=1`
3. Width **1080**, Height **1920**
4. Marque **Shutdown source when not visible** (opcional, economiza CPU)
5. **Control audio via OBS** — opcional; o overlay tem mute 🔊 próprio (beeps Web Audio). Se quiser só o áudio da live, mute no overlay ou desmarque e deixe o Browser Source sem áudio.
6. Posicione o Browser Source como camada **acima** da captura da live.

## CSS custom (opcional)

Se o fundo ainda aparecer preto no OBS, cole em *Custom CSS* do Browser Source:

```css
html, body, #game-container {
  background-color: rgba(0, 0, 0, 0) !important;
  background: transparent !important;
  margin: 0;
  overflow: hidden;
}
```

Com `?transparent=1` o client já aplica a classe `.obs-transparent` e o Phaser limpa o canvas com alpha 0.

## Safe margins (TikTok chrome)

O HUD evita as áreas típicas da UI do TikTok Live:

- **Topo ~140px** — username / status
- **Base ~320px** — comentários / barra de gifts
- **Laterais ~36px** — insets leves

TOP 5 fica no canto superior esquerdo (dentro da safe area); kill feed empilha perto da base (acima da barra de comentários).

Com `?debug=1` aparece um retângulo ciano da safe area + FPS.

## Celular / rotação (TikTok Live screen-share)

O mundo do jogo fica fixo em **1080×1920** (retrato). No celular:

| Modo | URL | Comportamento |
|------|-----|----------------|
| **Padrão (letterbox)** | `/overlay?phone=1` | Phaser `FIT` — em landscape o canvas fica centralizado com barras laterais (legível). |
| **Preencher landscape** | `/overlay?phone=1&spin=1` | CSS `rotate(90°)` quando o telefone está deitado — o retrato preenche a tela. |

Aliases do modo spin: `?rotate=1` ou `?fill=landscape` (mesmo efeito que `?spin=1`).

Teste rápido:
1. Retrato — canvas preenche a altura, sem corte.
2. Landscape sem spin — letterbox centralizado.
3. Landscape com `?spin=1` — canvas rotacionado preenchendo a tela.
4. Volte ao retrato — layout destrava e volta ao normal.
5. Gate de áudio / acesso continuam em tela cheia após girar.

## Admin DEMO


Painel de simulação (não é TikTok real):

```
http://localhost:3000/admin
```

Use em paralelo ao overlay para spawnar bots, gifts, likes, etc.

## Checklist

- [ ] Browser Source 1080×1920
- [ ] URL com `?transparent=1`
- [ ] Overlay acima da captura da câmera/live
- [ ] Admin DEMO em `/admin` se estiver testando
- [ ] Áudio: mute no overlay **ou** “Control audio via OBS”
