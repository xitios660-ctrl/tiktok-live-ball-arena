export interface CinematicIntroOptions {
  /** Called from a real user gesture so iOS can unlock AudioContext/fullscreen. */
  onPlayGesture?: () => void | Promise<void>;
}

interface IntroOverlayOptions {
  transparent: boolean;
  phoneLite: boolean;
}

const HOME_SPRITE = (
  import.meta.env.VITE_CINEMATIC_HOME_SPRITE ||
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/87e60a59-161b-41fc-b833-90c7cdd6d96c.webp'
).trim();

const TRANSITION_SPRITE = (
  import.meta.env.VITE_CINEMATIC_TRANSITION_SPRITE ||
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/06794415-77b0-41a1-be41-2b34502438eb.webp'
).trim();

const TRANSITION_AUDIO = (
  import.meta.env.VITE_CINEMATIC_TRANSITION_AUDIO ||
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/8ca55b3c-a2ff-45a9-9fee-4dedd7e6f09f.mp3'
).trim();

const LOGO = '/assets/ball-arena/logos/ball-arena-logo.svg';
const FRAME_COUNT = 24;
const FRAME_COLS = 6;
const FRAME_ROWS = 4;
const IDLE_FRAME = Math.floor((FRAME_COUNT - 1) / 2);

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function makeButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function setSpriteFrame(el: HTMLElement, rawIndex: number): void {
  const index = clamp(Math.round(rawIndex), 0, FRAME_COUNT - 1);
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

  const close = makeButton('×', 'cinematic-modal-close');
  close.setAttribute('aria-label', 'Fechar');

  const title = document.createElement('h2');
  title.className = 'cinematic-modal-title';

  const body = document.createElement('div');
  body.className = 'cinematic-modal-body';

  const action = document.createElement('a');
  action.className = 'cinematic-modal-action';
  action.style.display = 'none';

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

    const blurredFrame = document.createElement('div');
    blurredFrame.className = 'cinematic-frame cinematic-blurred-frame';
    blurredFrame.style.backgroundImage = 'url("' + HOME_SPRITE + '")';
    setSpriteFrame(blurredFrame, IDLE_FRAME);

    const stage = document.createElement('div');
    stage.className = 'cinematic-stage';

    const homeFrame = document.createElement('div');
    homeFrame.className = 'cinematic-frame cinematic-home-frame';
    homeFrame.style.backgroundImage = 'url("' + HOME_SPRITE + '")';
    setSpriteFrame(homeFrame, IDLE_FRAME);

    const stageLight = document.createElement('div');
    stageLight.className = 'cinematic-stage-light';

    stage.append(homeFrame, stageLight);

    const brand = document.createElement('div');
    brand.className = 'cinematic-brand';
    const logo = document.createElement('img');
    logo.src = LOGO;
    logo.alt = 'Bolla Arena';
    brand.append(logo);

    const live = document.createElement('div');
    live.className = 'cinematic-live';
    live.innerHTML = '<span class="cinematic-live-dot"></span><strong>AO VIVO</strong><span>TikTok Live</span>';

    const controls = document.createElement('div');
    controls.className = 'cinematic-controls';

    const play = makeButton('', 'cinematic-play');
    play.setAttribute('aria-label', 'Jogar');
    const playIcon = document.createElement('span');
    playIcon.className = 'cinematic-play-icon';
    playIcon.textContent = '▶';
    const playLabel = document.createElement('span');
    playLabel.className = 'cinematic-play-label';
    playLabel.textContent = 'JOGAR';
    const playShine = document.createElement('span');
    playShine.className = 'cinematic-play-shine';
    play.append(playIcon, playLabel, playShine);

    const secondary = document.createElement('div');
    secondary.className = 'cinematic-secondary-row';

    const connect = makeButton('', 'cinematic-secondary cinematic-connect');
    connect.innerHTML = '<span class="cinematic-secondary-icon">♪</span><span>CONECTAR<br>TIKTOK LIVE</span><b>›</b>';

    const rank = makeButton('', 'cinematic-secondary');
    rank.innerHTML = '<span class="cinematic-secondary-icon">♛</span><span>RANKING</span><b>›</b>';

    const how = makeButton('', 'cinematic-secondary');
    how.innerHTML = '<span class="cinematic-secondary-icon">🎮</span><span>COMO JOGAR</span><b>›</b>';

    secondary.append(connect, rank, how);

    const hint = document.createElement('div');
    hint.className = 'cinematic-hint';
    hint.innerHTML = '<span>↔</span> ARRASTE O DEDO OU MOVA O MOUSE';

    controls.append(play, secondary, hint);

    const pointerGlow = document.createElement('div');
    pointerGlow.className = 'cinematic-pointer-glow';

    const particles = document.createElement('div');
    particles.className = 'cinematic-particles';

    const tapBurst = document.createElement('div');
    tapBurst.className = 'cinematic-tap-burst';
    tapBurst.setAttribute('aria-hidden', 'true');

    const transition = document.createElement('div');
    transition.className = 'cinematic-transition';
    transition.setAttribute('aria-hidden', 'true');

    const transitionBlur = document.createElement('div');
    transitionBlur.className = 'cinematic-frame cinematic-transition-blur';
    transitionBlur.style.backgroundImage = 'url("' + TRANSITION_SPRITE + '")';
    setSpriteFrame(transitionBlur, 0);

    const transitionStage = document.createElement('div');
    transitionStage.className = 'cinematic-transition-stage';

    const transitionFrame = document.createElement('div');
    transitionFrame.className = 'cinematic-frame cinematic-transition-frame';
    transitionFrame.style.backgroundImage = 'url("' + TRANSITION_SPRITE + '")';
    setSpriteFrame(transitionFrame, 0);

    const transitionVignette = document.createElement('div');
    transitionVignette.className = 'cinematic-transition-vignette';
    transitionStage.append(transitionFrame, transitionVignette);

    const transitionFlash = document.createElement('div');
    transitionFlash.className = 'cinematic-transition-flash';

    transition.append(transitionBlur, transitionStage, transitionFlash);

    const modal = makeModal();

    const style = document.createElement('style');
    style.textContent = [
      '#cinematic-home{position:fixed;inset:0;z-index:99990;overflow:hidden;background:#03050a;color:#f7fbff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;isolation:isolate;touch-action:none;-webkit-tap-highlight-color:transparent;}',
      '#cinematic-home *{box-sizing:border-box;}',
      '.cinematic-ambient{position:absolute;inset:0;background:radial-gradient(circle at 50% 36%,rgba(255,93,20,.20),transparent 32%),radial-gradient(circle at 12% 34%,rgba(23,132,255,.14),transparent 34%),radial-gradient(circle at 88% 38%,rgba(177,47,255,.12),transparent 34%),linear-gradient(180deg,#06101d 0%,#04060b 62%,#020307 100%);}',
      '.cinematic-frame{background-repeat:no-repeat;background-size:600% 400%;background-color:#05070b;will-change:background-position,transform,filter;}',
      '.cinematic-blurred-frame{position:absolute;inset:-9%;filter:blur(28px) saturate(1.28) brightness(.48);transform:scale(1.15);opacity:.88;background-size:600% 400%;}',
      '.cinematic-stage{position:absolute;z-index:3;inset:0;overflow:hidden;background:#05070b;}',
      '.cinematic-home-frame{position:absolute;inset:0;filter:contrast(1.055) saturate(1.08) brightness(.98);transform:scale(1.012);}',
      '.cinematic-stage-light{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 49%,transparent 0 28%,rgba(0,0,0,.05) 56%,rgba(1,3,8,.54) 100%),linear-gradient(180deg,rgba(1,3,8,.06) 0 51%,rgba(1,3,8,.22) 70%,rgba(1,3,8,.72) 100%);}',
      '.cinematic-particles{position:absolute;z-index:4;inset:0;pointer-events:none;opacity:.58;background-image:radial-gradient(circle at 8% 86%,rgba(255,116,33,.95) 0 2px,transparent 3px),radial-gradient(circle at 83% 15%,rgba(255,187,74,.85) 0 1px,transparent 2px),radial-gradient(circle at 22% 28%,rgba(56,183,255,.72) 0 1px,transparent 2px),radial-gradient(circle at 72% 76%,rgba(255,69,20,.75) 0 2px,transparent 3px);background-size:190px 190px,260px 260px,230px 230px,310px 310px;animation:cinematicEmbers 11s linear infinite;}',
      '@keyframes cinematicEmbers{from{background-position:0 0,0 0,0 0,0 0}to{background-position:38px -210px,-28px -260px,20px -185px,-45px -240px}}',
      '.cinematic-brand{position:absolute;z-index:7;left:50%;top:50%;transform:translate(-50%,-48%);width:clamp(310px,39vw,690px);pointer-events:none;filter:drop-shadow(0 24px 35px rgba(0,0,0,.65));}',
      '.cinematic-brand img{display:block;width:100%;height:auto;filter:drop-shadow(0 0 22px rgba(32,160,255,.24)) drop-shadow(0 0 26px rgba(255,98,21,.20));}',
      '.cinematic-live{position:absolute;z-index:8;left:max(24px,env(safe-area-inset-left));top:max(20px,env(safe-area-inset-top));display:flex;align-items:center;gap:9px;padding:9px 14px;border-radius:999px;background:rgba(4,10,20,.66);border:1px solid rgba(62,177,255,.34);box-shadow:0 12px 28px rgba(0,0,0,.30),inset 0 1px rgba(255,255,255,.05);backdrop-filter:blur(14px);font-size:11px;letter-spacing:.04em;}',
      '.cinematic-live strong{font-size:12px}.cinematic-live span:last-child{color:#a7bad5;font-weight:650}.cinematic-live-dot{width:9px;height:9px;border-radius:50%;background:#ff244f;box-shadow:0 0 0 4px rgba(255,36,79,.16),0 0 13px rgba(255,36,79,.8);animation:livePulse 1.2s ease-in-out infinite;}',
      '@keyframes livePulse{50%{transform:scale(.76);opacity:.72}}',
      '.cinematic-controls{position:absolute;z-index:9;left:50%;bottom:max(28px,env(safe-area-inset-bottom));width:min(1040px,calc(100vw - 44px));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:14px;transition:opacity .2s ease,transform .2s ease;}',
      '.cinematic-play,.cinematic-secondary{appearance:none;-webkit-appearance:none;border:0;color:#fff;font:inherit;cursor:pointer;outline:none;user-select:none;-webkit-tap-highlight-color:transparent;}',
      '.cinematic-play{position:relative;overflow:hidden;width:min(470px,48vw);min-height:86px;border-radius:19px;display:flex;align-items:center;justify-content:center;gap:20px;background:linear-gradient(180deg,#ffb026 0%,#c96008 54%,#8d3303 100%);border:2px solid rgba(255,225,126,.98);box-shadow:0 0 0 4px rgba(255,126,21,.12),0 12px 42px rgba(255,76,6,.44),inset 0 2px rgba(255,255,255,.28),inset 0 -8px 18px rgba(87,20,0,.34);transition:transform 115ms cubic-bezier(.2,.8,.2,1),filter 115ms ease,box-shadow 115ms ease;}',
      '.cinematic-play::before{content:"";position:absolute;inset:6px;border-radius:13px;border:1px solid rgba(255,239,181,.34);pointer-events:none;}',
      '.cinematic-play-shine{position:absolute;top:-40%;bottom:-40%;left:-34%;width:28%;transform:skewX(-18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.48),transparent);opacity:.0;pointer-events:none;}',
      '@media(hover:hover) and (pointer:fine){.cinematic-play:hover{transform:translateY(-2px) scale(1.025);filter:brightness(1.09);box-shadow:0 0 0 4px rgba(255,152,35,.18),0 16px 58px rgba(255,78,7,.58),inset 0 2px rgba(255,255,255,.3)}.cinematic-play:hover .cinematic-play-shine{opacity:1;animation:buttonShine .7s ease forwards}.cinematic-secondary:hover{transform:translateY(-2px);border-color:rgba(97,209,255,.95);background:linear-gradient(180deg,rgba(13,31,54,.97),rgba(5,12,23,.99));box-shadow:0 12px 30px rgba(0,0,0,.30),0 0 26px rgba(38,168,255,.24)}}',
      '@keyframes buttonShine{to{left:112%}}',
      '.cinematic-play:active,.cinematic-play.is-pressed{transform:translateY(4px) scale(.958);filter:brightness(1.16);box-shadow:0 0 0 4px rgba(255,187,69,.12),0 5px 20px rgba(255,70,5,.36),inset 0 5px 15px rgba(89,23,0,.46);}',
      '.cinematic-play-icon{font-size:34px;line-height:1;color:#fff8dd;filter:drop-shadow(0 3px 9px rgba(0,0,0,.34));}',
      '.cinematic-play-label{font-size:32px;line-height:1;font-weight:950;letter-spacing:.035em;text-shadow:0 3px 10px rgba(68,16,0,.42);}',
      '.cinematic-secondary-row{width:100%;display:flex;align-items:stretch;justify-content:center;gap:14px;}',
      '.cinematic-secondary{min-width:0;width:250px;min-height:62px;padding:0 18px;border-radius:15px;display:flex;align-items:center;justify-content:center;gap:12px;background:linear-gradient(180deg,rgba(8,22,40,.94),rgba(4,10,21,.98));border:1.5px solid rgba(38,171,255,.68);box-shadow:0 9px 24px rgba(0,0,0,.32),0 0 20px rgba(26,147,255,.13),inset 0 1px rgba(255,255,255,.06);font-size:12px;font-weight:850;letter-spacing:.035em;transition:transform 105ms ease,border-color 105ms ease,background 105ms ease,box-shadow 105ms ease;}',
      '.cinematic-secondary b{margin-left:auto;color:#d9efff;font-size:23px;font-weight:500;opacity:.82}.cinematic-secondary-icon{font-size:22px;line-height:1;filter:drop-shadow(0 0 8px rgba(64,193,255,.35));}',
      '.cinematic-secondary:active,.cinematic-secondary.is-pressed{transform:translateY(3px) scale(.97);border-color:rgba(255,180,64,.84);background:linear-gradient(180deg,rgba(32,27,22,.96),rgba(14,11,11,.98));}',
      '.cinematic-hint{margin-top:1px;padding:7px 12px;border-radius:999px;background:rgba(2,6,12,.45);border:1px solid rgba(255,255,255,.10);color:rgba(225,235,250,.67);font-size:9px;font-weight:760;letter-spacing:.11em;backdrop-filter:blur(9px);pointer-events:none}.cinematic-hint span{color:#5bc9ff;font-size:13px;margin-right:5px;}',
      '.cinematic-pointer-glow{position:absolute;z-index:5;width:36vmax;height:36vmax;left:var(--px,50%);top:var(--py,50%);transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(255,158,57,.13),rgba(49,172,255,.045) 37%,transparent 69%);filter:blur(7px);}',
      '.cinematic-tap-burst{position:absolute;z-index:12;width:90px;height:90px;margin:-45px 0 0 -45px;left:0;top:0;border-radius:50%;pointer-events:none;opacity:0;transform:translate3d(var(--tap-x,-200px),var(--tap-y,-200px),0) scale(.2);background:radial-gradient(circle,rgba(255,247,205,.94) 0 5%,rgba(255,164,50,.58) 17%,rgba(55,188,255,.18) 40%,transparent 69%);}',
      '.cinematic-tap-burst.fire{animation:tapBurst .46s cubic-bezier(.2,.8,.2,1) both}@keyframes tapBurst{0%{opacity:.92;transform:translate3d(var(--tap-x),var(--tap-y),0) scale(.2)}62%{opacity:.48;transform:translate3d(var(--tap-x),var(--tap-y),0) scale(1)}100%{opacity:0;transform:translate3d(var(--tap-x),var(--tap-y),0) scale(1.55)}}',
      '#cinematic-home.is-launching .cinematic-controls{opacity:0;transform:translateX(-50%) translateY(22px);pointer-events:none}#cinematic-home.is-launching .cinematic-brand{opacity:0;transform:translate(-50%,-48%) scale(1.08);transition:opacity .24s ease,transform .34s ease}#cinematic-home.is-launching .cinematic-live{opacity:0;transition:opacity .18s ease}',
      '.cinematic-transition{position:absolute;z-index:30;inset:0;opacity:0;visibility:hidden;background:#020307;pointer-events:none;transition:opacity .14s ease,visibility 0s linear .14s;overflow:hidden}.cinematic-transition.show{opacity:1;visibility:visible;transition:opacity .11s ease}',
      '.cinematic-transition-blur{position:absolute;inset:-9%;filter:blur(28px) saturate(1.3) brightness(.44);transform:scale(1.16);background-size:600% 400%;}',
      '.cinematic-transition-stage{position:absolute;inset:0;overflow:hidden}.cinematic-transition-frame{position:absolute;inset:0;filter:contrast(1.06) saturate(1.08);transform:scale(1.012)}',
      '.cinematic-transition-vignette{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,transparent 0 36%,rgba(0,0,0,.12) 65%,rgba(0,0,0,.52) 100%)}',
      '.cinematic-transition-flash{position:absolute;inset:-10%;opacity:0;background:radial-gradient(circle at 50% 52%,rgba(255,246,202,.98),rgba(255,124,27,.58) 18%,transparent 48%);mix-blend-mode:screen;pointer-events:none}.cinematic-transition.impact .cinematic-transition-flash{animation:transitionFlash .38s ease-out both}@keyframes transitionFlash{0%{opacity:0;transform:scale(.55)}25%{opacity:.9}100%{opacity:0;transform:scale(1.18)}}',
      '.cinematic-modal{position:absolute;z-index:50;inset:0;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(2,4,9,.74);backdrop-filter:blur(13px)}.cinematic-modal.open{display:flex}.cinematic-modal-card{position:relative;width:min(540px,94vw);max-height:min(72vh,620px);overflow:auto;border-radius:22px;padding:29px;background:linear-gradient(160deg,rgba(18,28,44,.98),rgba(5,9,16,.99));border:1px solid rgba(62,184,255,.28);box-shadow:0 28px 90px rgba(0,0,0,.68),0 0 40px rgba(255,112,25,.12)}.cinematic-modal-title{margin:0 42px 17px 0;font-size:23px;color:#ffc466}.cinematic-modal-body{font-size:13px;line-height:1.6;color:#e8eff8}.cinematic-modal-body p{margin:0 0 10px}.cinematic-modal-close{position:absolute;right:13px;top:12px;width:42px;height:42px;border:0;border-radius:12px;background:rgba(255,255,255,.07);color:#fff;font-size:27px;cursor:pointer}.cinematic-modal-action{display:inline-flex;margin-top:12px;min-height:44px;align-items:center;justify-content:center;padding:0 18px;border-radius:11px;text-decoration:none;background:linear-gradient(90deg,#ff941d,#a74304);color:#fff;font-weight:850}',
      '@media(orientation:portrait){.cinematic-blurred-frame{inset:-18%;filter:blur(30px) saturate(1.25) brightness(.42);transform:scale(1.22)}.cinematic-stage{left:50%;right:auto;top:12.5%;bottom:auto;width:100vw;height:auto;aspect-ratio:16/9;transform:translateX(-50%);background:transparent;overflow:hidden;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 7%,#000 88%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 7%,#000 88%,transparent 100%)}.cinematic-home-frame{transform:scale(1.005)}.cinematic-stage-light{background:linear-gradient(180deg,rgba(2,4,8,.12),transparent 24%,transparent 72%,rgba(3,5,10,.68) 100%)}.cinematic-brand{top:36%;width:min(82vw,430px);transform:translate(-50%,-50%)}.cinematic-live{left:16px;top:max(15px,env(safe-area-inset-top));padding:8px 12px}.cinematic-live span:last-child{display:none}.cinematic-controls{left:20px;right:20px;bottom:max(24px,calc(env(safe-area-inset-bottom) + 8px));width:auto;transform:none;gap:12px}.cinematic-play{width:100%;min-height:76px}.cinematic-play-label{font-size:29px}.cinematic-secondary-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cinematic-secondary{width:100%;min-height:58px;padding:0 13px;font-size:11px}.cinematic-connect{grid-column:1 / -1}.cinematic-hint{align-self:center;margin-top:3px;font-size:8px}.cinematic-pointer-glow{display:none}#cinematic-home.is-launching .cinematic-controls{transform:translateY(18px)}#cinematic-home.is-launching .cinematic-brand{transform:translate(-50%,-50%) scale(1.08)}.cinematic-transition-stage{left:50%;right:auto;top:50%;bottom:auto;width:100vw;height:auto;aspect-ratio:16/9;transform:translate(-50%,-50%);-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 7%,#000 92%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 7%,#000 92%,transparent 100%)}.cinematic-transition-blur{inset:-18%;filter:blur(32px) saturate(1.25) brightness(.44);transform:scale(1.24)}}',
      '@media(orientation:portrait) and (max-height:720px){.cinematic-stage{top:8%}.cinematic-brand{top:31%;width:min(70vw,360px)}.cinematic-controls{gap:8px;bottom:max(12px,env(safe-area-inset-bottom))}.cinematic-play{min-height:62px}.cinematic-play-label{font-size:25px}.cinematic-secondary{min-height:48px}.cinematic-hint{display:none}}',
      '@media(prefers-reduced-motion:reduce){.cinematic-particles,.cinematic-live-dot{animation:none}.cinematic-play,.cinematic-secondary{transition:none}.cinematic-pointer-glow{display:none}}'
    ].join('\n');

    root.append(
      ambient,
      blurredFrame,
      stage,
      particles,
      brand,
      live,
      controls,
      pointerGlow,
      tapBurst,
      transition,
      modal.root,
      style
    );
    document.body.appendChild(root);

    const transitionAudio = new Audio(TRANSITION_AUDIO);
    transitionAudio.preload = 'auto';
    transitionAudio.volume = 0.92;

    let disposed = false;
    let launching = false;
    let dragging = false;
    let currentFrame = IDLE_FRAME;
    let targetFrame = IDLE_FRAME;
    let raf = 0;
    let settleTimer = 0;
    let transitionRaf = 0;
    let firstGestureDone = false;

    const renderFrame = () => {
      currentFrame += (targetFrame - currentFrame) * 0.18;
      if (Math.abs(targetFrame - currentFrame) < 0.02) currentFrame = targetFrame;
      setSpriteFrame(homeFrame, currentFrame);
      setSpriteFrame(blurredFrame, currentFrame);
      if (!disposed && !launching) raf = window.requestAnimationFrame(renderFrame);
    };

    const setPointer = (clientX: number, clientY: number) => {
      root.style.setProperty('--px', clientX + 'px');
      root.style.setProperty('--py', clientY + 'px');
    };

    const scrubFromPointer = (ev: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
      targetFrame = ratio * (FRAME_COUNT - 1);
    };

    const scheduleCenter = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (!dragging && !launching) targetFrame = IDLE_FRAME;
      }, 380);
    };

    const onPointerDown = (ev: PointerEvent) => {
      dragging = true;
      setPointer(ev.clientX, ev.clientY);
      scrubFromPointer(ev);
      try {
        stage.setPointerCapture(ev.pointerId);
      } catch {
        // WebViews may not implement capture.
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      setPointer(ev.clientX, ev.clientY);
      const fine =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(hover:hover) and (pointer:fine)').matches;
      if (dragging || fine) scrubFromPointer(ev);
    };

    const onPointerUp = (ev: PointerEvent) => {
      dragging = false;
      try {
        stage.releasePointerCapture(ev.pointerId);
      } catch {
        // ignored
      }
      scheduleCenter();
    };

    const fireBurst = (x: number, y: number) => {
      tapBurst.classList.remove('fire');
      root.style.setProperty('--tap-x', x + 'px');
      root.style.setProperty('--tap-y', y + 'px');
      void tapBurst.offsetWidth;
      tapBurst.classList.add('fire');
    };

    const press = (button: HTMLButtonElement, ev?: PointerEvent) => {
      button.classList.add('is-pressed');
      if (ev) fireBurst(ev.clientX, ev.clientY);
      window.setTimeout(() => button.classList.remove('is-pressed'), 160);
    };

    const firstGesture = async () => {
      if (firstGestureDone) return;
      firstGestureDone = true;
      try {
        await options.onPlayGesture?.();
      } catch {
        // The rest of the intro remains functional even if iOS rejects one API.
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

    connect.addEventListener('pointerdown', (ev) => press(connect, ev));
    connect.addEventListener('click', () => {
      void firstGesture();
      openModal(
        'CONECTAR TIKTOK LIVE',
        [
          'A conexão continua usando o sistema TikTok já integrado ao Bolla Arena.',
          'Para testes e controles do modo DEMO, use o painel administrativo.'
        ],
        'ABRIR PAINEL',
        '/admin'
      );
    });

    rank.addEventListener('pointerdown', (ev) => press(rank, ev));
    rank.addEventListener('click', () => {
      void firstGesture();
      openModal('RANKING', [
        'O TOP 5 acompanha a rodada e atualiza eliminações, posição e desempenho dos jogadores.',
        'Durante a partida ele continua integrado ao HUD da arena.'
      ]);
    });

    how.addEventListener('pointerdown', (ev) => press(how, ev));
    how.addEventListener('click', () => {
      void firstGesture();
      openModal('COMO JOGAR', [
        'Comente na live para entrar na arena com sua própria bola.',
        'Likes recuperam vida e aumentam poder conforme as metas configuradas.',
        'Presentes ativam habilidades e vantagens especiais da rodada.'
      ]);
    });

    modal.close.addEventListener('click', closeModal);
    modal.root.addEventListener('pointerdown', (ev) => {
      if (ev.target === modal.root) closeModal();
    });

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(raf);
      window.cancelAnimationFrame(transitionRaf);
      window.clearTimeout(settleTimer);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
      stage.removeEventListener('pointerleave', scheduleCenter);
      root.removeEventListener('pointermove', onPointerMove);
      try {
        transitionAudio.pause();
      } catch {
        // ignored
      }
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

    const launch = async (ev?: PointerEvent) => {
      if (launching) return;
      launching = true;
      closeModal();
      press(play, ev);
      await firstGesture();

      root.classList.add('is-launching');
      play.disabled = true;
      connect.disabled = true;
      rank.disabled = true;
      how.disabled = true;

      transition.classList.add('show');
      transition.setAttribute('aria-hidden', 'false');
      setSpriteFrame(transitionFrame, 0);
      setSpriteFrame(transitionBlur, 0);

      try {
        transitionAudio.currentTime = 0;
        await transitionAudio.play();
      } catch {
        // Visual transition still runs if browser rejects audio.
      }

      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = reduced ? 950 : 4000;
      const started = performance.now();
      let impacted = false;

      const tick = (now: number) => {
        const progress = clamp((now - started) / duration, 0, 1);
        const frameIndex = progress * (FRAME_COUNT - 1);
        setSpriteFrame(transitionFrame, frameIndex);
        setSpriteFrame(transitionBlur, frameIndex);

        if (!impacted && progress > 0.58) {
          impacted = true;
          transition.classList.add('impact');
        }

        if (progress >= 1) {
          transitionAudio.pause();
          window.setTimeout(finish, reduced ? 80 : 130);
          return;
        }
        transitionRaf = window.requestAnimationFrame(tick);
      };
      transitionRaf = window.requestAnimationFrame(tick);
    };

    play.addEventListener('pointerdown', (ev) => press(play, ev));
    play.addEventListener('click', (ev) => void launch(ev as PointerEvent));

    root.addEventListener(
      'pointerdown',
      () => {
        void firstGesture();
      },
      { passive: true, once: true }
    );
    root.addEventListener('pointermove', onPointerMove, { passive: true });
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('pointerleave', scheduleCenter);

    raf = window.requestAnimationFrame(renderFrame);
  });
}
