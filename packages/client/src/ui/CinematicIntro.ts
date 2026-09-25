export interface CinematicIntroOptions {
  /**
   * Called on the first real user gesture. The app uses it to unlock browser
   * audio/fullscreen before iOS autoplay rules can block them.
   */
  onPlayGesture?: () => void | Promise<void>;
}

interface IntroOverlayOptions {
  transparent: boolean;
  phoneLite: boolean;
}

const HOME_SPRITE = (
  import.meta.env.VITE_CINEMATIC_HOME_SPRITE ||
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/ecf95f37-8eb6-40d3-8ee0-44eac82cce7d.webp'
).trim();

const TRANSITION_SPRITE = (
  import.meta.env.VITE_CINEMATIC_TRANSITION_SPRITE ||
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/dad81e56-85c0-467f-b505-657816482657.webp'
).trim();

const FRAME_COUNT = 24;
const FRAME_COLS = 6;
const FRAME_ROWS = 4;

function makeButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function setSpriteFrame(el: HTMLElement, rawIndex: number): void {
  const index = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(rawIndex)));
  const col = index % FRAME_COLS;
  const row = Math.floor(index / FRAME_COLS);
  const x = FRAME_COLS <= 1 ? 0 : (col / (FRAME_COLS - 1)) * 100;
  const y = FRAME_ROWS <= 1 ? 0 : (row / (FRAME_ROWS - 1)) * 100;
  el.style.backgroundPosition = x.toFixed(3) + '% ' + y.toFixed(3) + '%';
  el.dataset.frame = String(index);
}

function preload(url: string): void {
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  } catch {
    // Decorative preload only.
  }
}

function makeModal(): {
  root: HTMLDivElement;
  title: HTMLHeadingElement;
  body: HTMLDivElement;
  action: HTMLAnchorElement;
  close: HTMLButtonElement;
} {
  const root = document.createElement('div');
  root.className = 'cinematic-modal';
  root.setAttribute('aria-hidden', 'true');

  const card = document.createElement('div');
  card.className = 'cinematic-modal-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  const title = document.createElement('h2');
  title.className = 'cinematic-modal-title';

  const body = document.createElement('div');
  body.className = 'cinematic-modal-body';

  const action = document.createElement('a');
  action.className = 'cinematic-modal-action';
  action.style.display = 'none';

  const close = makeButton('×', 'cinematic-modal-close');
  close.setAttribute('aria-label', 'Fechar');

  card.append(close, title, body, action);
  root.append(card);
  return { root, title, body, action, close };
}

export function shouldShowCinematicIntro(opts: IntroOverlayOptions): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('intro') === '0' || params.get('skipIntro') === '1') return false;
  if (opts.transparent) return false;
  return opts.phoneLite || params.get('intro') === '1';
}

export async function runCinematicIntro(
  options: CinematicIntroOptions = {}
): Promise<void> {
  if (typeof document === 'undefined' || !document.body) return;
  if (document.getElementById('cinematic-home')) return;

  preload(HOME_SPRITE);
  preload(TRANSITION_SPRITE);

  return new Promise<void>((resolve) => {
    const root = document.createElement('section');
    root.id = 'cinematic-home';
    root.setAttribute('aria-label', 'Bolla Arena');

    const ambient = document.createElement('div');
    ambient.className = 'cinematic-ambient';

    const pointerGlow = document.createElement('div');
    pointerGlow.className = 'cinematic-pointer-glow';

    const stage = document.createElement('div');
    stage.className = 'cinematic-stage';

    const homeFrame = document.createElement('div');
    homeFrame.className = 'cinematic-frame cinematic-home-frame';
    homeFrame.style.backgroundImage = 'url("' + HOME_SPRITE + '")';
    setSpriteFrame(homeFrame, 0);

    const stageShade = document.createElement('div');
    stageShade.className = 'cinematic-stage-shade';

    const badge = document.createElement('div');
    badge.className = 'cinematic-live-badge';
    badge.textContent = '●  TIKTOK LIVE';

    stage.append(homeFrame, stageShade, badge);

    const controls = document.createElement('div');
    controls.className = 'cinematic-controls';

    const copy = document.createElement('div');
    copy.className = 'cinematic-copy';

    const title = document.createElement('h1');
    title.textContent = 'ENTRE NA ARENA';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Arraste o dedo no cenário para mudar os frames.';

    copy.append(title, subtitle);

    const play = makeButton('', 'cinematic-play');
    play.setAttribute('aria-label', 'Jogar');
    const playIcon = document.createElement('span');
    playIcon.className = 'cinematic-play-icon';
    playIcon.textContent = '▶';
    const playLabel = document.createElement('span');
    playLabel.className = 'cinematic-play-label';
    playLabel.textContent = 'JOGAR';
    play.append(playIcon, playLabel);

    const connect = makeButton('CONECTAR TIKTOK LIVE', 'cinematic-secondary cinematic-connect');
    const secondaryRow = document.createElement('div');
    secondaryRow.className = 'cinematic-secondary-row';
    const rank = makeButton('RANKING', 'cinematic-secondary');
    const how = makeButton('COMO JOGAR', 'cinematic-secondary');
    secondaryRow.append(rank, how);

    const hint = document.createElement('div');
    hint.className = 'cinematic-hint';
    hint.textContent = 'MOVA O MOUSE OU ARRASTE O DEDO';

    controls.append(copy, play, connect, secondaryRow, hint);

    const transition = document.createElement('div');
    transition.className = 'cinematic-transition';
    transition.setAttribute('aria-hidden', 'true');

    const transitionStage = document.createElement('div');
    transitionStage.className = 'cinematic-transition-stage';

    const transitionFrame = document.createElement('div');
    transitionFrame.className = 'cinematic-frame cinematic-transition-frame';
    transitionFrame.style.backgroundImage = 'url("' + TRANSITION_SPRITE + '")';
    setSpriteFrame(transitionFrame, 0);

    const transitionShade = document.createElement('div');
    transitionShade.className = 'cinematic-transition-shade';

    const transitionCaption = document.createElement('div');
    transitionCaption.className = 'cinematic-transition-caption';
    transitionCaption.textContent = 'ENTRANDO NA ARENA';

    const transitionProgress = document.createElement('div');
    transitionProgress.className = 'cinematic-transition-progress';
    const transitionProgressFill = document.createElement('span');
    transitionProgress.append(transitionProgressFill);

    transitionStage.append(transitionFrame, transitionShade);
    transition.append(transitionStage, transitionCaption, transitionProgress);

    const modal = makeModal();

    const style = document.createElement('style');
    style.textContent = [
      '#cinematic-home{position:fixed;inset:0;z-index:99990;overflow:hidden;background:#05060a;color:#f5f7ff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;isolation:isolate;touch-action:none;-webkit-tap-highlight-color:transparent;}',
      '#cinematic-home *{box-sizing:border-box;}',
      '.cinematic-ambient{position:absolute;inset:0;background:radial-gradient(circle at 50% 32%,rgba(255,92,22,.16),transparent 34%),radial-gradient(circle at 8% 32%,rgba(24,122,255,.13),transparent 36%),radial-gradient(circle at 92% 34%,rgba(142,52,255,.12),transparent 34%),linear-gradient(180deg,#08111d 0%,#05060a 58%,#030407 100%);}',
      '.cinematic-ambient::before{content:"";position:absolute;inset:0;opacity:.34;background-image:radial-gradient(circle at 18% 20%,rgba(255,164,74,.8) 0 1px,transparent 2px),radial-gradient(circle at 78% 14%,rgba(52,190,255,.65) 0 1px,transparent 2px),radial-gradient(circle at 66% 70%,rgba(255,111,40,.55) 0 1px,transparent 2px);background-size:170px 170px,220px 220px,260px 260px;animation:cinematicDust 10s linear infinite;}',
      '@keyframes cinematicDust{from{background-position:0 0,0 0,0 0}to{background-position:20px -150px,-30px -190px,24px -220px}}',
      '.cinematic-pointer-glow{position:absolute;z-index:2;width:42vmax;height:42vmax;border-radius:999px;left:var(--pointer-x,50%);top:var(--pointer-y,44%);transform:translate(-50%,-50%);pointer-events:none;background:radial-gradient(circle,rgba(255,164,70,.13),rgba(37,162,255,.05) 36%,transparent 69%);filter:blur(8px);transition:left 90ms linear,top 90ms linear;}',
      '.cinematic-stage{position:absolute;z-index:3;left:50%;top:50%;width:min(100vw,177.7778vh);aspect-ratio:16/9;transform:translate(-50%,-50%);overflow:hidden;background:#07080c;box-shadow:0 32px 100px rgba(0,0,0,.52);}',
      '.cinematic-frame{position:absolute;inset:0;background-repeat:no-repeat;background-size:600% 400%;background-color:#07080c;will-change:background-position,transform,filter;}',
      '.cinematic-home-frame{filter:contrast(1.04) saturate(1.04);transform:scale(1.002);}',
      '.cinematic-stage-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(2,4,8,.02) 0 49%,rgba(3,5,9,.22) 66%,rgba(3,5,9,.88) 100%),radial-gradient(circle at 50% 40%,transparent 34%,rgba(2,4,8,.18) 82%);}',
      '.cinematic-live-badge{position:absolute;left:20px;top:18px;padding:8px 14px;border-radius:999px;background:rgba(8,13,22,.72);border:1px solid rgba(31,168,240,.38);color:#d4edff;font-size:10px;font-weight:800;letter-spacing:.08em;backdrop-filter:blur(10px);box-shadow:0 8px 22px rgba(0,0,0,.24);}',
      '.cinematic-controls{position:absolute;z-index:6;left:50%;bottom:max(30px,env(safe-area-inset-bottom));width:min(760px,calc(100vw - 32px));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:12px;}',
      '.cinematic-copy{display:none;text-align:left;width:100%;}',
      '.cinematic-copy h1{margin:0;color:#f5f7ff;font-size:18px;line-height:1.15;font-weight:900;letter-spacing:.02em;}',
      '.cinematic-copy p{margin:8px 0 0;color:#9eb0cc;font-size:12px;line-height:1.4;font-weight:600;}',
      '.cinematic-play,.cinematic-secondary{appearance:none;-webkit-appearance:none;border:0;font:inherit;color:#fff;cursor:pointer;user-select:none;outline:none;transform:translateZ(0);}',
      '.cinematic-play{position:relative;width:min(360px,64vw);min-height:72px;border-radius:18px;display:flex;align-items:center;justify-content:center;gap:18px;background:linear-gradient(90deg,#ff9e1f 0%,#c66508 58%,#a14005 100%);border:2px solid rgba(255,204,89,.95);box-shadow:0 12px 34px rgba(255,77,8,.34),inset 0 1px rgba(255,255,255,.25);transition:transform 110ms ease,filter 110ms ease,box-shadow 110ms ease;}',
      '.cinematic-play::before{content:"";position:absolute;inset:5px;border-radius:13px;border:1px solid rgba(255,235,181,.20);pointer-events:none;}',
      '.cinematic-play:hover,.cinematic-play:focus-visible{filter:brightness(1.09);box-shadow:0 14px 44px rgba(255,88,13,.50),0 0 0 3px rgba(255,189,65,.12),inset 0 1px rgba(255,255,255,.30);}',
      '.cinematic-play:active,.cinematic-play.is-pressed{transform:translateY(3px) scale(.965);filter:brightness(1.13);box-shadow:0 6px 20px rgba(255,77,8,.32),inset 0 2px 8px rgba(73,21,0,.32);}',
      '.cinematic-play-icon{font-size:26px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,.34));}',
      '.cinematic-play-label{font-size:24px;font-weight:900;letter-spacing:.035em;}',
      '.cinematic-connect{width:min(334px,70vw);}',
      '.cinematic-secondary-row{display:flex;justify-content:center;gap:12px;width:100%;}',
      '.cinematic-secondary{min-width:160px;min-height:54px;padding:0 22px;border-radius:14px;background:linear-gradient(180deg,rgba(9,18,32,.96),rgba(6,10,18,.97));border:1.5px solid rgba(31,168,240,.58);color:#f5f7ff;font-size:12px;font-weight:850;letter-spacing:.04em;box-shadow:0 8px 22px rgba(0,0,0,.28),0 0 20px rgba(30,141,239,.11);transition:transform 105ms ease,border-color 105ms ease,background 105ms ease,box-shadow 105ms ease;}',
      '.cinematic-secondary:hover,.cinematic-secondary:focus-visible{border-color:rgba(91,205,255,.90);background:linear-gradient(180deg,rgba(12,28,48,.98),rgba(7,15,27,.98));box-shadow:0 10px 28px rgba(0,0,0,.30),0 0 28px rgba(29,159,255,.26);}',
      '.cinematic-secondary:active,.cinematic-secondary.is-pressed{transform:translateY(2px) scale(.97);border-color:rgba(255,182,65,.78);}',
      '.cinematic-hint{margin-top:2px;padding:7px 11px;border-radius:999px;background:rgba(4,7,12,.54);border:1px solid rgba(255,255,255,.10);color:rgba(224,234,250,.70);font-size:9px;font-weight:750;letter-spacing:.10em;backdrop-filter:blur(8px);pointer-events:none;}',
      '.cinematic-transition{position:absolute;z-index:20;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 42%,rgba(255,97,20,.13),transparent 32%),#030407;opacity:0;visibility:hidden;pointer-events:none;transition:opacity 140ms ease,visibility 0s linear 140ms;}',
      '.cinematic-transition.show{opacity:1;visibility:visible;transition:opacity 120ms ease;}',
      '.cinematic-transition-stage{position:absolute;left:50%;top:50%;width:min(100vw,177.7778vh);aspect-ratio:16/9;transform:translate(-50%,-50%);overflow:hidden;background:#05060a;box-shadow:0 0 90px rgba(255,77,8,.15);}',
      '.cinematic-transition-frame{transform:scale(1.01);filter:contrast(1.05) saturate(1.05);}',
      '.cinematic-transition-shade{position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,transparent 36%,rgba(2,3,6,.16) 100%);pointer-events:none;}',
      '.cinematic-transition-caption{position:absolute;left:50%;bottom:max(42px,env(safe-area-inset-bottom));transform:translateX(-50%);color:rgba(242,247,255,.78);font-size:10px;font-weight:850;letter-spacing:.18em;white-space:nowrap;text-shadow:0 2px 10px rgba(0,0,0,.8);}',
      '.cinematic-transition-progress{position:absolute;left:50%;bottom:max(24px,calc(env(safe-area-inset-bottom) + 10px));transform:translateX(-50%);width:min(260px,56vw);height:3px;border-radius:99px;background:rgba(255,255,255,.10);overflow:hidden;}',
      '.cinematic-transition-progress span{display:block;width:0%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ff8a1d,#ffd56b,#3ac6ff);box-shadow:0 0 14px rgba(255,139,29,.65);}',
      '#cinematic-home.is-launching .cinematic-controls{opacity:0;transform:translateX(-50%) translateY(16px);pointer-events:none;transition:opacity 180ms ease,transform 180ms ease;}',
      '#cinematic-home.is-launching .cinematic-live-badge{opacity:0;transition:opacity 140ms ease;}',
      '.cinematic-modal{position:absolute;z-index:40;inset:0;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(2,4,9,.72);backdrop-filter:blur(12px);}',
      '.cinematic-modal.open{display:flex;}',
      '.cinematic-modal-card{position:relative;width:min(540px,94vw);max-height:min(72vh,620px);overflow:auto;border-radius:20px;padding:28px;background:linear-gradient(160deg,rgba(20,28,43,.98),rgba(6,9,15,.99));border:1px solid rgba(255,174,57,.42);box-shadow:0 24px 80px rgba(0,0,0,.66),0 0 34px rgba(255,120,24,.13);}',
      '.cinematic-modal-title{margin:0 42px 16px 0;font-size:22px;color:#ffc466;}',
      '.cinematic-modal-body{font-size:13px;line-height:1.58;color:#e8eff8;}',
      '.cinematic-modal-body p{margin:0 0 10px;}',
      '.cinematic-modal-close{position:absolute;right:13px;top:12px;width:42px;height:42px;border:0;border-radius:12px;background:rgba(255,255,255,.07);color:#fff;font-size:27px;cursor:pointer;}',
      '.cinematic-modal-action{display:inline-flex;margin-top:12px;min-height:44px;align-items:center;justify-content:center;padding:0 18px;border-radius:11px;text-decoration:none;background:linear-gradient(90deg,#ff8e1b,#b34b05);color:#fff;font-weight:850;}',
      '@media(orientation:portrait){.cinematic-stage{left:0;top:0;width:100vw;aspect-ratio:16/9;transform:none;box-shadow:none;border-radius:0 0 26px 26px;}.cinematic-stage-shade{background:linear-gradient(180deg,rgba(2,4,8,.02) 0 46%,rgba(4,6,10,.48) 70%,#05060a 100%);}.cinematic-live-badge{left:18px;top:max(16px,env(safe-area-inset-top));}.cinematic-controls{left:24px;right:24px;top:calc(56.25vw + 26px);bottom:auto;width:auto;transform:none;align-items:stretch;gap:14px;}.cinematic-copy{display:block;}.cinematic-play{width:100%;min-height:72px;}.cinematic-connect{width:100%;min-height:60px;}.cinematic-secondary-row{gap:14px;}.cinematic-secondary-row .cinematic-secondary{flex:1;min-width:0;min-height:58px;padding:0 10px;}.cinematic-hint{align-self:center;margin-top:8px;}.cinematic-transition{background:radial-gradient(circle at 50% 28%,rgba(255,96,17,.14),transparent 36%),linear-gradient(180deg,#05070d,#030407);}.cinematic-transition-stage{width:100vw;top:30%;transform:translate(-50%,-50%);box-shadow:0 20px 80px rgba(0,0,0,.52);}.cinematic-transition-caption{bottom:max(92px,calc(env(safe-area-inset-bottom) + 74px));}.cinematic-transition-progress{bottom:max(72px,calc(env(safe-area-inset-bottom) + 54px));}#cinematic-home.is-launching .cinematic-controls{transform:translateY(16px);}}',
      '@media(orientation:portrait) and (max-height:720px){.cinematic-controls{top:calc(56.25vw + 14px);gap:9px;}.cinematic-copy p{display:none;}.cinematic-play{min-height:62px;}.cinematic-connect{min-height:50px;}.cinematic-secondary-row .cinematic-secondary{min-height:48px;}.cinematic-hint{display:none;}}',
      '@media(prefers-reduced-motion:reduce){.cinematic-ambient::before{animation:none}.cinematic-play,.cinematic-secondary{transition:none}.cinematic-pointer-glow{display:none}}'
    ].join('\n');

    root.append(
      ambient,
      pointerGlow,
      stage,
      controls,
      transition,
      modal.root,
      style
    );
    document.body.appendChild(root);

    let disposed = false;
    let launching = false;
    let dragging = false;
    let frame = 0;
    let idleDirection = 1;
    let lastInteraction = performance.now();
    let firstGestureDone = false;
    let idleTimer = 0;
    let transitionTimer = 0;

    const pulse = (button: HTMLButtonElement) => {
      button.classList.add('is-pressed');
      window.setTimeout(() => button.classList.remove('is-pressed'), 150);
    };

    const firstGesture = async () => {
      if (firstGestureDone) return;
      firstGestureDone = true;
      try {
        await options.onPlayGesture?.();
      } catch {
        // Browser may reject fullscreen/audio. Gameplay still works.
      }
    };

    const updatePointer = (ev: PointerEvent) => {
      root.style.setProperty('--pointer-x', ev.clientX + 'px');
      root.style.setProperty('--pointer-y', ev.clientY + 'px');
    };

    const updateFrameFromPointer = (ev: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      frame = Math.round(ratio * (FRAME_COUNT - 1));
      setSpriteFrame(homeFrame, frame);
      lastInteraction = performance.now();
    };

    const onStagePointerDown = (ev: PointerEvent) => {
      dragging = true;
      lastInteraction = performance.now();
      try {
        stage.setPointerCapture(ev.pointerId);
      } catch {
        // Not supported in every WebView.
      }
      void firstGesture();
      updatePointer(ev);
      updateFrameFromPointer(ev);
    };

    const onStagePointerMove = (ev: PointerEvent) => {
      updatePointer(ev);
      const isFinePointer =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(hover:hover) and (pointer:fine)').matches;
      if (dragging || isFinePointer) updateFrameFromPointer(ev);
    };

    const onStagePointerUp = (ev: PointerEvent) => {
      dragging = false;
      lastInteraction = performance.now();
      try {
        stage.releasePointerCapture(ev.pointerId);
      } catch {
        // ignored
      }
    };

    const startIdle = () => {
      idleTimer = window.setInterval(() => {
        if (disposed || launching || dragging) return;
        if (performance.now() - lastInteraction < 2300) return;
        frame += idleDirection;
        if (frame >= FRAME_COUNT - 1) {
          frame = FRAME_COUNT - 1;
          idleDirection = -1;
        } else if (frame <= 0) {
          frame = 0;
          idleDirection = 1;
        }
        setSpriteFrame(homeFrame, frame);
      }, 140);
    };

    const closeModal = () => {
      modal.root.classList.remove('open');
      modal.root.setAttribute('aria-hidden', 'true');
    };

    const openModal = (
      heading: string,
      paragraphs: string[],
      actionText?: string,
      actionHref?: string
    ) => {
      modal.title.textContent = heading;
      modal.body.replaceChildren();
      for (const value of paragraphs) {
        const p = document.createElement('p');
        p.textContent = value;
        modal.body.appendChild(p);
      }
      if (actionText && actionHref) {
        modal.action.textContent = actionText;
        modal.action.href = actionHref;
        modal.action.style.display = 'inline-flex';
      } else {
        modal.action.removeAttribute('href');
        modal.action.style.display = 'none';
      }
      modal.root.classList.add('open');
      modal.root.setAttribute('aria-hidden', 'false');
      modal.close.focus();
    };

    connect.addEventListener('click', () => {
      pulse(connect);
      void firstGesture();
      openModal(
        'CONECTAR TIKTOK LIVE',
        [
          'A conexão da live continua usando o sistema existente do Bolla Arena.',
          'Para testar o modo DEMO e os controles administrativos, abra o painel.'
        ],
        'ABRIR PAINEL',
        '/admin'
      );
    });

    rank.addEventListener('click', () => {
      pulse(rank);
      void firstGesture();
      openModal('RANKING', [
        'O TOP 5 é atualizado durante a rodada conforme eliminações e desempenho dos jogadores.',
        'O ranking continua integrado ao HUD da arena.'
      ]);
    });

    how.addEventListener('click', () => {
      pulse(how);
      void firstGesture();
      openModal('COMO JOGAR', [
        'Comente na live para entrar na arena. Sua foto aparece dentro da sua bola.',
        'Likes recuperam vida e aumentam poder conforme as metas configuradas.',
        'Presentes ativam habilidades especiais e vantagens da rodada.'
      ]);
    });

    modal.close.addEventListener('click', closeModal);
    modal.root.addEventListener('pointerdown', (ev) => {
      if (ev.target === modal.root) closeModal();
    });

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      window.clearInterval(idleTimer);
      window.clearInterval(transitionTimer);
      stage.removeEventListener('pointerdown', onStagePointerDown);
      stage.removeEventListener('pointermove', onStagePointerMove);
      stage.removeEventListener('pointerup', onStagePointerUp);
      stage.removeEventListener('pointercancel', onStagePointerUp);
      root.removeEventListener('pointermove', updatePointer);
    };

    const finish = () => {
      cleanup();
      root.style.transition = 'opacity 220ms ease';
      root.style.opacity = '0';
      window.setTimeout(() => {
        root.remove();
        resolve();
      }, 230);
    };

    const launch = async () => {
      if (launching) return;
      launching = true;
      closeModal();
      pulse(play);
      await firstGesture();
      root.classList.add('is-launching');
      play.disabled = true;
      connect.disabled = true;
      rank.disabled = true;
      how.disabled = true;

      transition.classList.add('show');
      transition.setAttribute('aria-hidden', 'false');
      setSpriteFrame(transitionFrame, 0);
      transitionProgressFill.style.width = '0%';

      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const stepMs = reduced ? 38 : 95;
      let transitionIndex = 0;

      transitionTimer = window.setInterval(() => {
        transitionIndex += 1;
        const clamped = Math.min(FRAME_COUNT - 1, transitionIndex);
        setSpriteFrame(transitionFrame, clamped);
        transitionProgressFill.style.width =
          ((clamped / (FRAME_COUNT - 1)) * 100).toFixed(1) + '%';

        if (clamped >= FRAME_COUNT - 1) {
          window.clearInterval(transitionTimer);
          transitionTimer = 0;
          window.setTimeout(finish, reduced ? 80 : 190);
        }
      }, stepMs);
    };

    play.addEventListener('pointerdown', () => pulse(play));
    play.addEventListener('click', () => void launch());

    root.addEventListener('pointerdown', () => void firstGesture(), {
      passive: true,
      once: true
    });
    root.addEventListener('pointermove', updatePointer, { passive: true });
    stage.addEventListener('pointerdown', onStagePointerDown);
    stage.addEventListener('pointermove', onStagePointerMove);
    stage.addEventListener('pointerup', onStagePointerUp);
    stage.addEventListener('pointercancel', onStagePointerUp);

    startIdle();
  });
}
