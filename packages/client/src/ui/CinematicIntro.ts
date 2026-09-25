export interface CinematicIntroOptions {
  /**
   * Called on the first real user gesture so iOS can unlock fullscreen/audio.
   * The visual experience does not depend on this succeeding.
   */
  onPlayGesture?: () => void | Promise<void>;
}

interface IntroOverlayOptions {
  transparent: boolean;
  phoneLite: boolean;
}

const HOME_DESKTOP_SPRITE = (
  import.meta.env.VITE_CINEMATIC_HOME_SPRITE ||
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/135252ea-a067-431e-b011-3effeef30a45.webp'
).trim();

const TRANSITION_DESKTOP_SPRITE = (
  import.meta.env.VITE_CINEMATIC_TRANSITION_SPRITE ||
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/b15cb76c-2934-42c1-a268-d5d145bd6d80.webp'
).trim();

const HOME_MOBILE_SPRITE = (
  import.meta.env.VITE_CINEMATIC_HOME_MOBILE_SPRITE ||
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/cd673b13-701c-41c2-8414-2f7ee0e72b1d.webp'
).trim();

const TRANSITION_MOBILE_SPRITE = (
  import.meta.env.VITE_CINEMATIC_TRANSITION_MOBILE_SPRITE ||
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/4d8216fc-0aed-437c-8b71-8c1876801fdd.webp'
).trim();

const HOME_FRAMES = 36;
const HOME_COLS = 6;
const HOME_ROWS = 6;

const TRANSITION_FRAMES = 48;
const TRANSITION_COLS = 8;
const TRANSITION_ROWS = 6;

function makeButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function setSpriteFrame(
  el: HTMLElement,
  rawIndex: number,
  count: number,
  cols: number,
  rows: number
): void {
  const index = Math.max(0, Math.min(count - 1, Math.round(rawIndex)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = cols <= 1 ? 0 : (col / (cols - 1)) * 100;
  const y = rows <= 1 ? 0 : (row / (rows - 1)) * 100;
  el.style.backgroundPosition = x.toFixed(3) + '% ' + y.toFixed(3) + '%';
  el.dataset.frame = String(index);
}

function preload(url: string): void {
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  } catch {
    // Visual preload only.
  }
}

function isPortrait(): boolean {
  return window.matchMedia('(orientation: portrait)').matches;
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

  [
    HOME_DESKTOP_SPRITE,
    TRANSITION_DESKTOP_SPRITE,
    HOME_MOBILE_SPRITE,
    TRANSITION_MOBILE_SPRITE,
  ].forEach(preload);

  return new Promise<void>((resolve) => {
    const root = document.createElement('section');
    root.id = 'cinematic-home';
    root.setAttribute('aria-label', 'Bolla Arena');

    const ambience = document.createElement('div');
    ambience.className = 'cinematic-ambience';

    const stage = document.createElement('div');
    stage.className = 'cinematic-stage';

    const frame = document.createElement('div');
    frame.className = 'cinematic-frame cinematic-home-frame';

    const vignette = document.createElement('div');
    vignette.className = 'cinematic-vignette';

    const liveBadge = document.createElement('div');
    liveBadge.className = 'cinematic-live';
    liveBadge.innerHTML = '<span class="cinematic-live-dot"></span><strong>AO VIVO</strong><small>TikTok Live</small>';

    const dragHint = document.createElement('div');
    dragHint.className = 'cinematic-drag-hint';
    dragHint.innerHTML = '<span>↔</span> ARRASTE O DEDO OU MOVA O MOUSE';

    stage.append(frame, vignette, liveBadge, dragHint);

    const controls = document.createElement('div');
    controls.className = 'cinematic-controls';

    const play = makeButton('', 'cinematic-play');
    play.setAttribute('aria-label', 'Jogar');
    const playGlow = document.createElement('span');
    playGlow.className = 'cinematic-play-glow';
    const playIcon = document.createElement('span');
    playIcon.className = 'cinematic-play-icon';
    playIcon.textContent = '▶';
    const playLabel = document.createElement('span');
    playLabel.className = 'cinematic-play-label';
    playLabel.textContent = 'JOGAR';
    play.append(playGlow, playIcon, playLabel);

    const secondary = document.createElement('div');
    secondary.className = 'cinematic-secondary-wrap';

    const connect = makeButton('', 'cinematic-secondary cinematic-connect');
    connect.innerHTML =
      '<span class="cinematic-secondary-icon">♪</span><span>CONECTAR<br>TIKTOK LIVE</span><b>›</b>';

    const rank = makeButton('', 'cinematic-secondary');
    rank.innerHTML =
      '<span class="cinematic-secondary-icon">♛</span><span>RANKING</span><b>›</b>';

    const how = makeButton('', 'cinematic-secondary');
    how.innerHTML =
      '<span class="cinematic-secondary-icon">🎮</span><span>COMO JOGAR</span><b>›</b>';

    secondary.append(connect, rank, how);
    controls.append(play, secondary);

    const transition = document.createElement('div');
    transition.className = 'cinematic-transition';
    transition.setAttribute('aria-hidden', 'true');

    const transitionFrame = document.createElement('div');
    transitionFrame.className = 'cinematic-frame cinematic-transition-frame';

    const transitionFlash = document.createElement('div');
    transitionFlash.className = 'cinematic-transition-flash';

    const transitionLabel = document.createElement('div');
    transitionLabel.className = 'cinematic-transition-label';
    transitionLabel.textContent = 'ENTRANDO NA ARENA';

    const transitionBar = document.createElement('div');
    transitionBar.className = 'cinematic-transition-bar';
    const transitionFill = document.createElement('span');
    transitionBar.append(transitionFill);

    transition.append(transitionFrame, transitionFlash, transitionLabel, transitionBar);

    const modal = makeModal();

    const style = document.createElement('style');
    style.textContent = [
      '#cinematic-home{position:fixed;inset:0;z-index:99990;overflow:hidden;background:#020409;color:#f7f9ff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;isolation:isolate;touch-action:none;-webkit-tap-highlight-color:transparent;}',
      '#cinematic-home *{box-sizing:border-box;}',
      '.cinematic-ambience{position:absolute;inset:-8%;background:radial-gradient(circle at 50% 42%,rgba(255,100,20,.20),transparent 30%),radial-gradient(circle at 12% 38%,rgba(0,137,255,.16),transparent 34%),radial-gradient(circle at 88% 38%,rgba(183,42,255,.15),transparent 34%),linear-gradient(180deg,#07111f 0%,#05070c 52%,#020307 100%);filter:saturate(1.08);}',
      '.cinematic-ambience::before{content:"";position:absolute;inset:0;opacity:.42;background-image:radial-gradient(circle at 15% 18%,rgba(255,166,77,.9) 0 1px,transparent 2px),radial-gradient(circle at 83% 14%,rgba(55,187,255,.78) 0 1px,transparent 2px),radial-gradient(circle at 63% 68%,rgba(255,92,28,.65) 0 1px,transparent 2px);background-size:145px 145px,190px 190px,235px 235px;animation:cinematicParticles 10s linear infinite;}',
      '@keyframes cinematicParticles{from{background-position:0 0,0 0,0 0}to{background-position:26px -150px,-24px -180px,18px -215px}}',
      '.cinematic-stage{position:absolute;z-index:2;left:50%;top:50%;width:min(100vw,177.7778vh);aspect-ratio:16/9;transform:translate(-50%,-50%);overflow:hidden;background:#03050a;box-shadow:0 30px 110px rgba(0,0,0,.62);}',
      '.cinematic-frame{position:absolute;inset:0;background-repeat:no-repeat;background-color:#04060a;will-change:background-position,filter,transform;}',
      '.cinematic-home-frame{background-size:600% 600%;filter:contrast(1.055) saturate(1.06);transform:scale(1.004);}',
      '.cinematic-vignette{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(1,3,7,.08),transparent 38%,rgba(1,3,7,.14) 62%,rgba(1,3,7,.62) 100%),radial-gradient(circle at 50% 42%,transparent 42%,rgba(0,0,0,.23) 100%);}',
      '.cinematic-live{position:absolute;right:24px;top:22px;display:grid;grid-template-columns:auto auto;column-gap:8px;align-items:center;padding:9px 13px;border-radius:14px;background:rgba(4,8,15,.72);border:1px solid rgba(92,194,255,.35);box-shadow:0 10px 28px rgba(0,0,0,.34);backdrop-filter:blur(12px);font-size:11px;letter-spacing:.04em;}',
      '.cinematic-live small{grid-column:2;color:#a8bad1;font-size:9px;margin-top:1px;}.cinematic-live-dot{grid-row:1/3;width:9px;height:9px;border-radius:50%;background:#ff173d;box-shadow:0 0 14px rgba(255,23,61,.9);}',
      '.cinematic-drag-hint{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);padding:7px 12px;border-radius:999px;background:rgba(2,5,10,.48);border:1px solid rgba(255,255,255,.10);color:rgba(235,242,255,.72);font-size:9px;font-weight:750;letter-spacing:.12em;backdrop-filter:blur(9px);white-space:nowrap;pointer-events:none;}',
      '.cinematic-drag-hint span{color:#7bd9ff;font-size:14px;margin-right:6px;}',
      '.cinematic-controls{position:absolute;z-index:8;left:50%;bottom:max(42px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:13px;width:min(820px,calc(100vw - 34px));}',
      '.cinematic-play,.cinematic-secondary{appearance:none;-webkit-appearance:none;border:0;font:inherit;color:#fff;cursor:pointer;outline:none;user-select:none;-webkit-user-select:none;}',
      '.cinematic-play{position:relative;isolation:isolate;width:min(410px,67vw);height:78px;border-radius:17px;display:flex;align-items:center;justify-content:center;gap:18px;overflow:hidden;background:linear-gradient(180deg,#d98816 0%,#a94e04 52%,#713006 100%);border:2px solid rgba(255,214,100,.96);box-shadow:0 12px 38px rgba(255,86,5,.40),0 0 0 2px rgba(255,157,26,.18),inset 0 1px 0 rgba(255,255,255,.30),inset 0 -9px 20px rgba(77,17,0,.28);transition:transform 115ms cubic-bezier(.2,.8,.2,1),filter 115ms ease,box-shadow 115ms ease;}',
      '.cinematic-play::after{content:"";position:absolute;inset:5px;border-radius:12px;border:1px solid rgba(255,240,188,.22);pointer-events:none;}',
      '.cinematic-play-glow{position:absolute;z-index:-1;left:-18%;top:-80%;width:40%;height:260%;transform:rotate(18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.34),transparent);filter:blur(4px);opacity:.72;animation:playSweep 3.2s ease-in-out infinite;}',
      '@keyframes playSweep{0%,52%{left:-38%;opacity:0}68%{opacity:.78}100%{left:118%;opacity:0}}',
      '.cinematic-play:hover,.cinematic-play:focus-visible{filter:brightness(1.10) saturate(1.07);box-shadow:0 15px 46px rgba(255,91,6,.55),0 0 0 3px rgba(255,194,65,.12),inset 0 1px rgba(255,255,255,.35);}',
      '.cinematic-play.is-pressed,.cinematic-play:active{transform:translateY(4px) scale(.955);filter:brightness(1.15);box-shadow:0 5px 18px rgba(255,77,5,.35),0 0 0 3px rgba(255,205,90,.20),inset 0 5px 14px rgba(77,18,0,.36);}',
      '.cinematic-play-icon{font-size:29px;line-height:1;filter:drop-shadow(0 2px 7px rgba(0,0,0,.38));}.cinematic-play-label{font-size:27px;font-weight:950;letter-spacing:.035em;text-shadow:0 2px 8px rgba(0,0,0,.34);}',
      '.cinematic-secondary-wrap{display:grid;grid-template-columns:1.2fr .9fr .9fr;gap:12px;width:min(760px,100%);}',
      '.cinematic-secondary{min-height:58px;padding:0 17px;border-radius:13px;display:flex;align-items:center;justify-content:center;gap:11px;background:linear-gradient(180deg,rgba(8,22,40,.97),rgba(4,10,20,.98));border:1.5px solid rgba(51,175,255,.72);box-shadow:0 8px 24px rgba(0,0,0,.33),0 0 21px rgba(31,155,255,.13),inset 0 1px rgba(255,255,255,.05);font-size:12px;font-weight:850;letter-spacing:.025em;line-height:1.08;transition:transform 105ms ease,border-color 105ms ease,box-shadow 105ms ease,background 105ms ease;}',
      '.cinematic-secondary b{margin-left:auto;color:#9fdfff;font-size:24px;line-height:1;font-weight:500;}.cinematic-secondary-icon{font-size:22px;filter:drop-shadow(0 0 9px rgba(63,183,255,.45));}',
      '.cinematic-secondary:hover,.cinematic-secondary:focus-visible{border-color:rgba(111,216,255,.94);background:linear-gradient(180deg,rgba(11,34,59,.99),rgba(5,16,29,.99));box-shadow:0 10px 29px rgba(0,0,0,.35),0 0 28px rgba(35,170,255,.30);}',
      '.cinematic-secondary.is-pressed,.cinematic-secondary:active{transform:translateY(3px) scale(.965);border-color:rgba(255,187,70,.88);box-shadow:0 5px 16px rgba(0,0,0,.34),0 0 22px rgba(255,122,25,.22);}',
      '#cinematic-home.is-launching .cinematic-controls{opacity:0;transform:translateX(-50%) translateY(18px) scale(.98);pointer-events:none;transition:opacity 180ms ease,transform 180ms ease;}',
      '#cinematic-home.is-launching .cinematic-live,#cinematic-home.is-launching .cinematic-drag-hint{opacity:0;transition:opacity 140ms ease;}',
      '.cinematic-transition{position:absolute;z-index:30;inset:0;opacity:0;visibility:hidden;background:#020307;pointer-events:none;transition:opacity 120ms ease,visibility 0s linear 120ms;}',
      '.cinematic-transition.show{opacity:1;visibility:visible;transition:opacity 120ms ease;}',
      '.cinematic-transition-frame{background-size:800% 600%;filter:contrast(1.06) saturate(1.06);}',
      '.cinematic-transition-flash{position:absolute;inset:0;opacity:0;background:radial-gradient(circle at 50% 52%,rgba(255,224,137,.74),rgba(255,88,10,.18) 25%,transparent 58%);mix-blend-mode:screen;pointer-events:none;}',
      '.cinematic-transition.show .cinematic-transition-flash{animation:transitionFlash .52s ease-out 1;}',
      '@keyframes transitionFlash{0%{opacity:.95}30%{opacity:.38}100%{opacity:0}}',
      '.cinematic-transition-label{position:absolute;left:50%;bottom:max(38px,env(safe-area-inset-bottom));transform:translateX(-50%);color:rgba(243,248,255,.78);font-size:10px;font-weight:850;letter-spacing:.20em;text-shadow:0 2px 10px rgba(0,0,0,.8);white-space:nowrap;}',
      '.cinematic-transition-bar{position:absolute;left:50%;bottom:max(22px,calc(env(safe-area-inset-bottom) + 7px));transform:translateX(-50%);width:min(270px,58vw);height:3px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden;}',
      '.cinematic-transition-bar span{display:block;height:100%;width:0%;border-radius:inherit;background:linear-gradient(90deg,#ff7a18,#ffd86c,#47cfff);box-shadow:0 0 14px rgba(255,127,25,.7);}',
      '.cinematic-modal{position:absolute;z-index:50;inset:0;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(2,4,9,.76);backdrop-filter:blur(13px);}',
      '.cinematic-modal.open{display:flex;}.cinematic-modal-card{position:relative;width:min(540px,94vw);max-height:min(74vh,620px);overflow:auto;border-radius:20px;padding:28px;background:linear-gradient(160deg,rgba(17,28,45,.99),rgba(5,9,16,.99));border:1px solid rgba(255,167,52,.42);box-shadow:0 26px 90px rgba(0,0,0,.68),0 0 36px rgba(255,120,24,.14);}',
      '.cinematic-modal-title{margin:0 44px 16px 0;color:#ffc261;font-size:22px;}.cinematic-modal-body{color:#e7eef9;font-size:13px;line-height:1.58;}.cinematic-modal-body p{margin:0 0 10px;}.cinematic-modal-close{position:absolute;right:13px;top:12px;width:42px;height:42px;border:0;border-radius:11px;background:rgba(255,255,255,.08);color:#fff;font-size:27px;cursor:pointer;}.cinematic-modal-action{display:inline-flex;margin-top:12px;min-height:44px;align-items:center;justify-content:center;padding:0 18px;border-radius:11px;text-decoration:none;background:linear-gradient(90deg,#ff8e1b,#ae4604);color:#fff;font-weight:850;}',
      '@media(orientation:portrait){.cinematic-stage{left:50%;top:0;width:100vw;height:auto;aspect-ratio:506/900;transform:translateX(-50%);box-shadow:none;}.cinematic-home-frame{background-image:var(--home-mobile)!important;background-size:600% 600%;}.cinematic-vignette{background:linear-gradient(180deg,rgba(1,3,7,.02) 0 34%,rgba(2,4,8,.08) 54%,rgba(2,4,8,.50) 78%,#020409 100%);}.cinematic-live{right:14px;top:max(14px,env(safe-area-inset-top));padding:8px 11px;}.cinematic-drag-hint{bottom:12px;font-size:8px;letter-spacing:.08em;}.cinematic-controls{left:18px;right:18px;bottom:max(24px,env(safe-area-inset-bottom));width:auto;transform:none;gap:11px;}.cinematic-play{width:100%;height:72px;}.cinematic-play-label{font-size:25px;}.cinematic-secondary-wrap{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;}.cinematic-connect{grid-column:1/3;}.cinematic-secondary{min-height:56px;padding:0 14px;font-size:11px;}.cinematic-secondary b{font-size:22px;}#cinematic-home.is-launching .cinematic-controls{transform:translateY(16px) scale(.985);}.cinematic-transition-frame{background-image:var(--transition-mobile)!important;background-size:800% 600%;}.cinematic-transition-label{bottom:max(48px,calc(env(safe-area-inset-bottom) + 24px));}.cinematic-transition-bar{bottom:max(30px,calc(env(safe-area-inset-bottom) + 9px));width:min(240px,62vw);}}',
      '@media(orientation:portrait) and (max-height:740px){.cinematic-controls{bottom:max(12px,env(safe-area-inset-bottom));gap:8px;}.cinematic-play{height:62px;}.cinematic-secondary{min-height:49px;}.cinematic-drag-hint{display:none;}}',
      '@media(prefers-reduced-motion:reduce){.cinematic-ambience::before,.cinematic-play-glow{animation:none}.cinematic-play,.cinematic-secondary{transition:none}}'
    ].join('\n');

    root.style.setProperty('--home-mobile', 'url("' + HOME_MOBILE_SPRITE + '")');
    root.style.setProperty('--transition-mobile', 'url("' + TRANSITION_MOBILE_SPRITE + '")');

    root.append(ambience, stage, controls, transition, modal.root, style);
    document.body.appendChild(root);

    let disposed = false;
    let launching = false;
    let dragging = false;
    let homeFrameIndex = Math.floor((HOME_FRAMES - 1) / 2);
    let idleDirection = 1;
    let lastInteraction = performance.now();
    let firstGestureDone = false;
    let idleTimer = 0;
    let transitionTimer = 0;

    const applyHomeAsset = () => {
      frame.style.backgroundImage =
        'url("' + (isPortrait() ? HOME_MOBILE_SPRITE : HOME_DESKTOP_SPRITE) + '")';
      setSpriteFrame(frame, homeFrameIndex, HOME_FRAMES, HOME_COLS, HOME_ROWS);
    };

    const applyTransitionAsset = () => {
      transitionFrame.style.backgroundImage =
        'url("' +
        (isPortrait() ? TRANSITION_MOBILE_SPRITE : TRANSITION_DESKTOP_SPRITE) +
        '")';
      setSpriteFrame(
        transitionFrame,
        0,
        TRANSITION_FRAMES,
        TRANSITION_COLS,
        TRANSITION_ROWS
      );
    };

    applyHomeAsset();
    applyTransitionAsset();

    const pulse = (button: HTMLButtonElement) => {
      button.classList.remove('is-pressed');
      void button.offsetWidth;
      button.classList.add('is-pressed');
      window.setTimeout(() => button.classList.remove('is-pressed'), 160);
    };

    const firstGesture = async () => {
      if (firstGestureDone) return;
      firstGestureDone = true;
      try {
        await options.onPlayGesture?.();
      } catch {
        // Fullscreen/audio can be rejected by the browser without breaking UI.
      }
    };

    const scrubFromPointer = (ev: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 1) return;
      const ratio = Math.max(
        0,
        Math.min(1, (ev.clientX - rect.left) / rect.width)
      );
      homeFrameIndex = Math.round(ratio * (HOME_FRAMES - 1));
      setSpriteFrame(frame, homeFrameIndex, HOME_FRAMES, HOME_COLS, HOME_ROWS);
      lastInteraction = performance.now();

      const dx = ratio - 0.5;
      frame.style.transform =
        'translate3d(' + (-dx * 5).toFixed(2) + 'px,0,0) scale(1.008)';
    };

    const onStageDown = (ev: PointerEvent) => {
      dragging = true;
      void firstGesture();
      try {
        stage.setPointerCapture(ev.pointerId);
      } catch {
        // Some embedded browsers do not expose pointer capture.
      }
      scrubFromPointer(ev);
    };

    const onStageMove = (ev: PointerEvent) => {
      const fine =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(hover:hover) and (pointer:fine)').matches;
      if (dragging || fine) scrubFromPointer(ev);
    };

    const onStageUp = (ev: PointerEvent) => {
      dragging = false;
      lastInteraction = performance.now();
      try {
        stage.releasePointerCapture(ev.pointerId);
      } catch {
        // ignored
      }
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
      paragraphs.forEach((value) => {
        const p = document.createElement('p');
        p.textContent = value;
        modal.body.appendChild(p);
      });
      if (actionText && actionHref) {
        modal.action.textContent = actionText;
        modal.action.href = actionHref;
        modal.action.style.display = 'inline-flex';
      } else {
        modal.action.style.display = 'none';
        modal.action.removeAttribute('href');
      }
      modal.root.classList.add('open');
      modal.root.setAttribute('aria-hidden', 'false');
      modal.close.focus();
    };

    connect.addEventListener('pointerdown', () => pulse(connect));
    connect.addEventListener('click', () => {
      void firstGesture();
      openModal(
        'CONECTAR TIKTOK LIVE',
        [
          'A conexão da live continua usando o sistema existente do Bolla Arena.',
          'Para testes, conexão e controles administrativos, use o painel.'
        ],
        'ABRIR PAINEL',
        '/admin'
      );
    });

    rank.addEventListener('pointerdown', () => pulse(rank));
    rank.addEventListener('click', () => {
      void firstGesture();
      openModal('RANKING', [
        'O TOP 5 continua integrado ao jogo e se atualiza durante a partida.',
        'Kills, desempenho e posição seguem usando a lógica atual do Bolla Arena.'
      ]);
    });

    how.addEventListener('pointerdown', () => pulse(how));
    how.addEventListener('click', () => {
      void firstGesture();
      openModal('COMO JOGAR', [
        'Comente na live para entrar na arena com sua bola.',
        'Likes recuperam vida e aumentam poder conforme as metas da partida.',
        'Presentes ativam as habilidades especiais configuradas no jogo.'
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
      window.removeEventListener('orientationchange', applyHomeAsset);
      window.removeEventListener('resize', applyHomeAsset);
      stage.removeEventListener('pointerdown', onStageDown);
      stage.removeEventListener('pointermove', onStageMove);
      stage.removeEventListener('pointerup', onStageUp);
      stage.removeEventListener('pointercancel', onStageUp);
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
      [play, connect, rank, how].forEach((button) => {
        button.disabled = true;
      });

      applyTransitionAsset();
      transition.classList.add('show');
      transition.setAttribute('aria-hidden', 'false');
      transitionFill.style.width = '0%';

      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const stepMs = reduced ? 32 : 58;
      let index = 0;

      transitionTimer = window.setInterval(() => {
        index += 1;
        const clamped = Math.min(TRANSITION_FRAMES - 1, index);
        setSpriteFrame(
          transitionFrame,
          clamped,
          TRANSITION_FRAMES,
          TRANSITION_COLS,
          TRANSITION_ROWS
        );
        transitionFill.style.width =
          ((clamped / (TRANSITION_FRAMES - 1)) * 100).toFixed(1) + '%';

        if (clamped >= TRANSITION_FRAMES - 1) {
          window.clearInterval(transitionTimer);
          transitionTimer = 0;
          window.setTimeout(finish, reduced ? 80 : 150);
        }
      }, stepMs);
    };

    play.addEventListener('pointerdown', () => pulse(play));
    play.addEventListener('click', () => void launch());

    root.addEventListener(
      'pointerdown',
      () => {
        void firstGesture();
      },
      { passive: true, once: true }
    );

    stage.addEventListener('pointerdown', onStageDown);
    stage.addEventListener('pointermove', onStageMove);
    stage.addEventListener('pointerup', onStageUp);
    stage.addEventListener('pointercancel', onStageUp);

    const startIdle = () => {
      idleTimer = window.setInterval(() => {
        if (disposed || launching || dragging) return;
        if (performance.now() - lastInteraction < 1800) return;

        homeFrameIndex += idleDirection;
        if (homeFrameIndex >= HOME_FRAMES - 1) {
          homeFrameIndex = HOME_FRAMES - 1;
          idleDirection = -1;
        } else if (homeFrameIndex <= 0) {
          homeFrameIndex = 0;
          idleDirection = 1;
        }

        setSpriteFrame(
          frame,
          homeFrameIndex,
          HOME_FRAMES,
          HOME_COLS,
          HOME_ROWS
        );
      }, 125);
    };

    window.addEventListener('orientationchange', () => {
      window.setTimeout(() => {
        applyHomeAsset();
        applyTransitionAsset();
      }, 120);
    });
    window.addEventListener('resize', applyHomeAsset);

    startIdle();
  });
}
