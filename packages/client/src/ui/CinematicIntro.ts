export interface CinematicIntroOptions {
  onPlayGesture?: () => void | Promise<void>;
}

interface IntroOverlayOptions {
  transparent: boolean;
  phoneLite: boolean;
}

type SpriteSpec = {
  url: string;
  frames: number;
  cols: number;
  rows: number;
};

const HOME_DESKTOP: SpriteSpec = {
  url: (
    import.meta.env.VITE_CINEMATIC_HOME_DESKTOP_SPRITE ||
    'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/7bed6250-8f35-41c5-820e-2becc2dd02ee.webp'
  ).trim(),
  frames: 36,
  cols: 6,
  rows: 6,
};

const HOME_MOBILE: SpriteSpec = {
  url: (
    import.meta.env.VITE_CINEMATIC_HOME_MOBILE_SPRITE ||
    'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/d5b8f7ff-aa18-4c85-8910-8adc6531b7e6.webp'
  ).trim(),
  frames: 36,
  cols: 6,
  rows: 6,
};

const TRANSITION: SpriteSpec = {
  url: (
    import.meta.env.VITE_CINEMATIC_TRANSITION_SPRITE ||
    'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/dad81e56-85c0-467f-b505-657816482657.webp'
  ).trim(),
  frames: 24,
  cols: 6,
  rows: 4,
};

function makeButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function setSprite(el: HTMLElement, spec: SpriteSpec): void {
  el.style.backgroundImage = 'url("' + spec.url + '")';
  el.style.backgroundSize = spec.cols * 100 + '% ' + spec.rows * 100 + '%';
}

function setSpriteFrame(el: HTMLElement, rawIndex: number, spec: SpriteSpec): number {
  const index = Math.max(0, Math.min(spec.frames - 1, Math.round(rawIndex)));
  const col = index % spec.cols;
  const row = Math.floor(index / spec.cols);
  const x = spec.cols <= 1 ? 0 : (col / (spec.cols - 1)) * 100;
  const y = spec.rows <= 1 ? 0 : (row / (spec.rows - 1)) * 100;
  el.style.backgroundPosition = x.toFixed(3) + '% ' + y.toFixed(3) + '%';
  el.dataset.frame = String(index);
  return index;
}

function preload(url: string): void {
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  } catch {
    // Best effort only.
  }
}

function isPortrait(): boolean {
  return window.matchMedia?.('(orientation: portrait)').matches ?? innerHeight > innerWidth;
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

  preload(HOME_DESKTOP.url);
  preload(HOME_MOBILE.url);
  preload(TRANSITION.url);

  return new Promise<void>((resolve) => {
    const root = document.createElement('section');
    root.id = 'cinematic-home';
    root.setAttribute('aria-label', 'Bolla Arena');

    const ambient = document.createElement('div');
    ambient.className = 'cinematic-ambient';

    const filmGrain = document.createElement('div');
    filmGrain.className = 'cinematic-film-grain';

    const reticle = document.createElement('div');
    reticle.className = 'cinematic-reticle';
    reticle.innerHTML = '<span></span>';

    const shell = document.createElement('div');
    shell.className = 'cinematic-shell';

    const topbar = document.createElement('div');
    topbar.className = 'cinematic-topbar';
    topbar.innerHTML =
      '<strong>BOLLA ARENA</strong>' +
      '<span class="cinematic-live-pill">● LIVE INTERATIVO</span>' +
      '<span class="cinematic-top-note">TIKTOK LIVE GAME</span>';

    const stageWrap = document.createElement('div');
    stageWrap.className = 'cinematic-stage-wrap';

    const stage = document.createElement('div');
    stage.className = 'cinematic-stage';

    const homeFrame = document.createElement('div');
    homeFrame.className = 'cinematic-frame cinematic-home-frame';

    const frameGlow = document.createElement('div');
    frameGlow.className = 'cinematic-frame-glow';

    const stageVignette = document.createElement('div');
    stageVignette.className = 'cinematic-stage-vignette';

    const stageHint = document.createElement('div');
    stageHint.className = 'cinematic-stage-hint';
    stageHint.innerHTML = '<i></i><span>ARRASTE / MOVA</span>';

    stage.append(homeFrame, frameGlow, stageVignette, stageHint);
    stageWrap.append(stage);

    const heroCopy = document.createElement('div');
    heroCopy.className = 'cinematic-hero-copy';
    heroCopy.innerHTML =
      '<div class="cinematic-kicker">ARENA AO VIVO</div>' +
      '<h1>SEU COMENTÁRIO<br><em>ENTRA NO JOGO.</em></h1>' +
      '<p>Comente para ganhar uma bola. Likes recuperam vida. Presentes viram poder dentro da rodada.</p>';

    const infoRail = document.createElement('div');
    infoRail.className = 'cinematic-info-rail';
    infoRail.innerHTML =
      '<article><b>01</b><div><strong>BOSS</strong><span>O chefe domina o centro da arena.</span></div></article>' +
      '<article><b>02</b><div><strong>POWER-UPS</strong><span>Presentes ativam habilidades e força.</span></div></article>' +
      '<article><b>03</b><div><strong>RANKING</strong><span>Top 5 atualizado durante a batalha.</span></div></article>';

    const controls = document.createElement('div');
    controls.className = 'cinematic-controls';

    const play = makeButton('', 'cinematic-play');
    play.setAttribute('aria-label', 'Jogar');
    play.innerHTML =
      '<span class="cinematic-play-orb">▶</span>' +
      '<span class="cinematic-play-copy"><b>JOGAR</b><small>ENTRAR NA ARENA</small></span>' +
      '<span class="cinematic-play-arrow">→</span>';

    const nav = document.createElement('div');
    nav.className = 'cinematic-nav';

    const connect = makeButton('CONECTAR TIKTOK LIVE', 'cinematic-nav-button');
    const rank = makeButton('RANKING', 'cinematic-nav-button');
    const how = makeButton('COMO JOGAR', 'cinematic-nav-button');
    nav.append(connect, rank, how);
    controls.append(play, nav);

    shell.append(topbar, stageWrap, heroCopy, infoRail, controls);

    const transition = document.createElement('div');
    transition.className = 'cinematic-transition';
    transition.setAttribute('aria-hidden', 'true');

    const transitionGlow = document.createElement('div');
    transitionGlow.className = 'cinematic-transition-glow';

    const transitionStage = document.createElement('div');
    transitionStage.className = 'cinematic-transition-stage';

    const transitionFrame = document.createElement('div');
    transitionFrame.className = 'cinematic-frame cinematic-transition-frame';
    setSprite(transitionFrame, TRANSITION);
    setSpriteFrame(transitionFrame, 0, TRANSITION);

    const transitionVignette = document.createElement('div');
    transitionVignette.className = 'cinematic-transition-vignette';
    transitionStage.append(transitionFrame, transitionVignette);

    const transitionHud = document.createElement('div');
    transitionHud.className = 'cinematic-transition-hud';
    transitionHud.innerHTML =
      '<span>ENTRANDO NA ARENA</span><div><i></i></div><b>00</b>';

    transition.append(transitionGlow, transitionStage, transitionHud);

    const modal = makeModal();

    const style = document.createElement('style');
    style.textContent = [
      '#cinematic-home{position:fixed;inset:0;z-index:99990;overflow:hidden;background:#030509;color:#f5f8ff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;isolation:isolate;touch-action:none;-webkit-tap-highlight-color:transparent;}',
      '#cinematic-home *{box-sizing:border-box;}',
      '.cinematic-ambient{position:absolute;inset:-10%;background:radial-gradient(circle at 50% 42%,rgba(255,82,17,.22),transparent 28%),radial-gradient(circle at 16% 36%,rgba(20,136,255,.15),transparent 30%),radial-gradient(circle at 84% 36%,rgba(148,46,255,.14),transparent 30%),linear-gradient(180deg,#08111d 0%,#06070c 52%,#020305 100%);filter:saturate(1.08);}',
      '.cinematic-ambient::before{content:"";position:absolute;inset:0;opacity:.46;background-image:radial-gradient(circle at 14% 22%,rgba(255,144,49,.95) 0 1px,transparent 2px),radial-gradient(circle at 72% 16%,rgba(48,190,255,.8) 0 1px,transparent 2px),radial-gradient(circle at 62% 68%,rgba(255,93,27,.75) 0 1px,transparent 2px);background-size:160px 160px,220px 220px,270px 270px;animation:cinematicDust 11s linear infinite;}',
      '@keyframes cinematicDust{from{background-position:0 0,0 0,0 0}to{background-position:26px -180px,-38px -220px,31px -260px}}',
      '.cinematic-film-grain{position:absolute;inset:0;pointer-events:none;z-index:30;opacity:.055;background-image:url("data:image/svg+xml,%3Csvg viewBox=%270 0 180 180%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%27.9%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%27.8%27/%3E%3C/svg%3E");mix-blend-mode:soft-light;}',
      '.cinematic-shell{position:absolute;inset:0;z-index:3;}',
      '.cinematic-topbar{position:absolute;left:4.5vw;right:4.5vw;top:max(24px,env(safe-area-inset-top));height:44px;display:flex;align-items:center;gap:18px;z-index:8;font-size:11px;letter-spacing:.12em;color:#dbe8f8;}',
      '.cinematic-topbar strong{font-size:13px;color:#fff;letter-spacing:.14em;}',
      '.cinematic-live-pill{padding:7px 11px;border-radius:999px;border:1px solid rgba(52,190,255,.34);background:rgba(3,10,18,.54);color:#bfeaff;backdrop-filter:blur(10px);}',
      '.cinematic-live-pill::first-letter{color:#ff5d31;}',
      '.cinematic-top-note{margin-left:auto;color:#8092aa;}',
      '.cinematic-stage-wrap{position:absolute;left:50%;top:48%;width:min(91vw,1400px);transform:translate(-50%,-50%);z-index:3;}',
      '.cinematic-stage{position:relative;width:100%;aspect-ratio:2.466/1;overflow:hidden;border-radius:30px;background:#07080d;border:1px solid rgba(255,255,255,.08);box-shadow:0 50px 120px rgba(0,0,0,.55),0 0 90px rgba(255,70,10,.10);transform:perspective(1300px) rotateX(var(--tilt-x,0deg)) rotateY(var(--tilt-y,0deg)) translate3d(var(--stage-x,0px),var(--stage-y,0px),0);transition:transform 110ms cubic-bezier(.2,.8,.2,1),box-shadow 180ms ease;}',
      '.cinematic-frame{position:absolute;inset:0;background-repeat:no-repeat;background-color:#08090d;will-change:background-position,filter,transform;}',
      '.cinematic-home-frame{filter:contrast(1.055) saturate(1.08) brightness(.98);transform:scale(1.004);}',
      '.cinematic-frame-glow{position:absolute;inset:0;background:radial-gradient(circle at var(--glow-x,50%) var(--glow-y,45%),rgba(255,179,72,.14),transparent 26%);mix-blend-mode:screen;pointer-events:none;}',
      '.cinematic-stage-vignette{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,4,8,.58),transparent 19%,transparent 81%,rgba(2,4,8,.60)),linear-gradient(180deg,rgba(2,4,8,.05),transparent 53%,rgba(2,4,8,.52));pointer-events:none;}',
      '.cinematic-stage-hint{position:absolute;right:22px;bottom:18px;display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:999px;background:rgba(5,8,13,.56);border:1px solid rgba(255,255,255,.09);color:#b9c5d7;font-size:9px;font-weight:800;letter-spacing:.12em;backdrop-filter:blur(8px);}',
      '.cinematic-stage-hint i{width:10px;height:10px;border:1px solid rgba(90,203,255,.9);border-radius:50%;box-shadow:0 0 14px rgba(34,175,255,.55);}',
      '.cinematic-hero-copy{position:absolute;z-index:7;left:5.2vw;top:22%;width:min(320px,24vw);text-shadow:0 3px 22px rgba(0,0,0,.72);}',
      '.cinematic-kicker{font-size:10px;font-weight:900;letter-spacing:.2em;color:#ffc46a;margin-bottom:13px;}',
      '.cinematic-hero-copy h1{margin:0;font-size:clamp(34px,4vw,66px);line-height:.91;letter-spacing:-.045em;font-weight:950;color:#f6f8fc;}',
      '.cinematic-hero-copy h1 em{font-style:normal;color:#ff9b2c;text-shadow:0 0 28px rgba(255,108,22,.23);}',
      '.cinematic-hero-copy p{margin:18px 0 0;max-width:285px;font-size:12px;line-height:1.6;color:#b4c0d0;font-weight:550;}',
      '.cinematic-info-rail{position:absolute;z-index:7;right:5.2vw;top:22%;width:min(260px,20vw);display:grid;gap:10px;}',
      '.cinematic-info-rail article{display:grid;grid-template-columns:36px 1fr;gap:10px;padding:13px 14px;border-radius:16px;background:linear-gradient(145deg,rgba(8,15,26,.72),rgba(5,8,14,.58));border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(12px);box-shadow:0 12px 32px rgba(0,0,0,.24);}',
      '.cinematic-info-rail b{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;border:1px solid rgba(76,193,255,.34);color:#8edcff;font-size:9px;letter-spacing:.08em;}',
      '.cinematic-info-rail strong{display:block;font-size:11px;letter-spacing:.08em;color:#fff;margin:1px 0 4px;}',
      '.cinematic-info-rail span{display:block;font-size:9px;line-height:1.45;color:#8fa0b6;}',
      '.cinematic-controls{position:absolute;z-index:9;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:14px;width:min(860px,90vw);justify-content:center;}',
      '.cinematic-play,.cinematic-nav-button{appearance:none;-webkit-appearance:none;border:0;color:#fff;font:inherit;cursor:pointer;outline:none;user-select:none;-webkit-tap-highlight-color:transparent;}',
      '.cinematic-play{position:relative;width:330px;min-height:76px;border-radius:20px;display:grid;grid-template-columns:52px 1fr 34px;align-items:center;gap:12px;padding:0 18px;background:linear-gradient(100deg,#ff9d1b 0%,#ce5b08 56%,#8f3106 100%);border:2px solid rgba(255,215,121,.92);box-shadow:0 12px 34px rgba(255,70,8,.34),0 0 0 1px rgba(255,151,29,.20),inset 0 1px rgba(255,255,255,.28);transition:transform 110ms ease,filter 110ms ease,box-shadow 110ms ease;}',
      '.cinematic-play::after{content:"";position:absolute;inset:5px;border-radius:14px;border:1px solid rgba(255,238,192,.16);pointer-events:none;}',
      '.cinematic-play:hover,.cinematic-play:focus-visible{filter:brightness(1.1);box-shadow:0 16px 44px rgba(255,74,8,.48),0 0 34px rgba(255,179,52,.20),inset 0 1px rgba(255,255,255,.34);transform:translateY(-2px);}',
      '.cinematic-play:active,.cinematic-play.is-pressed{transform:translateY(3px) scale(.975);filter:brightness(1.12);box-shadow:0 6px 18px rgba(255,70,8,.32),inset 0 3px 11px rgba(72,20,0,.32);}',
      '.cinematic-play-orb{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);font-size:18px;box-shadow:inset 0 0 18px rgba(255,255,255,.08);}',
      '.cinematic-play-copy{text-align:left;display:flex;flex-direction:column;gap:2px;}',
      '.cinematic-play-copy b{font-size:22px;letter-spacing:.05em;}',
      '.cinematic-play-copy small{font-size:8px;letter-spacing:.14em;color:#ffe4b3;}',
      '.cinematic-play-arrow{font-size:25px;font-weight:300;opacity:.82;}',
      '.cinematic-nav{display:flex;gap:9px;}',
      '.cinematic-nav-button{min-height:58px;padding:0 17px;border-radius:15px;background:linear-gradient(180deg,rgba(9,17,30,.92),rgba(5,9,16,.94));border:1px solid rgba(77,190,255,.38);color:#dfeeff;font-size:10px;font-weight:850;letter-spacing:.07em;box-shadow:0 10px 24px rgba(0,0,0,.24);transition:transform 105ms ease,border-color 105ms ease,background 105ms ease,box-shadow 105ms ease;}',
      '.cinematic-nav-button:hover,.cinematic-nav-button:focus-visible{transform:translateY(-2px);border-color:rgba(101,209,255,.82);background:linear-gradient(180deg,rgba(12,31,51,.97),rgba(7,14,25,.97));box-shadow:0 10px 28px rgba(0,0,0,.30),0 0 25px rgba(34,165,255,.17);}',
      '.cinematic-nav-button:active,.cinematic-nav-button.is-pressed{transform:translateY(2px) scale(.975);border-color:rgba(255,183,72,.74);}',
      '.cinematic-reticle{position:absolute;z-index:22;left:var(--cursor-x,50%);top:var(--cursor-y,50%);width:46px;height:46px;border:1px solid rgba(207,234,255,.72);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;opacity:.78;transition:width 120ms ease,height 120ms ease,border-color 120ms ease,opacity 120ms ease;}',
      '.cinematic-reticle::before,.cinematic-reticle::after{content:"";position:absolute;background:rgba(203,232,255,.48);}',
      '.cinematic-reticle::before{left:50%;top:-7px;width:1px;height:60px;transform:translateX(-50%);}',
      '.cinematic-reticle::after{top:50%;left:-7px;width:60px;height:1px;transform:translateY(-50%);}',
      '.cinematic-reticle span{position:absolute;inset:15px;border-radius:50%;background:rgba(255,177,74,.18);box-shadow:0 0 20px rgba(255,123,33,.22);}',
      '#cinematic-home.is-over-control .cinematic-reticle{width:58px;height:58px;border-color:#ffb45b;opacity:.95;}',
      '.cinematic-transition{position:absolute;z-index:40;inset:0;display:grid;place-items:center;background:#020305;opacity:0;visibility:hidden;pointer-events:none;transition:opacity 160ms ease,visibility 0s linear 160ms;}',
      '.cinematic-transition.show{opacity:1;visibility:visible;transition:opacity 100ms ease;}',
      '.cinematic-transition-glow{position:absolute;inset:-15%;background:radial-gradient(circle at 50% 48%,rgba(255,81,13,.22),transparent 34%),radial-gradient(circle at 50% 48%,rgba(22,130,255,.08),transparent 55%);filter:blur(6px);}',
      '.cinematic-transition-stage{position:relative;width:min(92vw,1320px);aspect-ratio:16/9;overflow:hidden;border-radius:26px;background:#05060a;box-shadow:0 42px 120px rgba(0,0,0,.72),0 0 80px rgba(255,83,12,.13);border:1px solid rgba(255,255,255,.07);}',
      '.cinematic-transition-frame{filter:contrast(1.06) saturate(1.07);}',
      '.cinematic-transition-vignette{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,transparent 40%,rgba(2,3,6,.26) 100%);pointer-events:none;}',
      '.cinematic-transition-hud{position:absolute;left:50%;bottom:5vh;transform:translateX(-50%);display:grid;grid-template-columns:auto min(260px,42vw) 30px;gap:14px;align-items:center;color:#dfe9f7;font-size:9px;font-weight:850;letter-spacing:.14em;}',
      '.cinematic-transition-hud div{height:3px;border-radius:99px;background:rgba(255,255,255,.10);overflow:hidden;}',
      '.cinematic-transition-hud i{display:block;width:0%;height:100%;background:linear-gradient(90deg,#ff861a,#ffd36b,#38bfff);box-shadow:0 0 14px rgba(255,139,24,.62);}',
      '.cinematic-transition-hud b{font-size:9px;color:#9bb3ce;font-weight:800;}',
      '#cinematic-home.is-launching .cinematic-hero-copy,#cinematic-home.is-launching .cinematic-info-rail,#cinematic-home.is-launching .cinematic-controls,#cinematic-home.is-launching .cinematic-topbar{opacity:0;transform:translateY(12px);transition:opacity 170ms ease,transform 170ms ease;pointer-events:none;}',
      '#cinematic-home.is-launching .cinematic-stage{transform:perspective(1300px) scale(1.035);box-shadow:0 70px 150px rgba(0,0,0,.72),0 0 110px rgba(255,75,10,.17);transition:transform 360ms cubic-bezier(.15,.8,.2,1),box-shadow 360ms ease;}',
      '.cinematic-modal{position:absolute;z-index:60;inset:0;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(2,4,9,.76);backdrop-filter:blur(14px);}',
      '.cinematic-modal.open{display:flex;}',
      '.cinematic-modal-card{position:relative;width:min(540px,94vw);max-height:min(72vh,620px);overflow:auto;border-radius:22px;padding:28px;background:linear-gradient(160deg,rgba(20,28,43,.98),rgba(6,9,15,.99));border:1px solid rgba(255,174,57,.38);box-shadow:0 24px 80px rgba(0,0,0,.70),0 0 38px rgba(255,120,24,.12);}',
      '.cinematic-modal-title{margin:0 42px 16px 0;font-size:22px;color:#ffc466;}',
      '.cinematic-modal-body{font-size:13px;line-height:1.58;color:#e8eff8;}',
      '.cinematic-modal-body p{margin:0 0 10px;}',
      '.cinematic-modal-close{position:absolute;right:13px;top:12px;width:42px;height:42px;border:0;border-radius:12px;background:rgba(255,255,255,.07);color:#fff;font-size:27px;cursor:pointer;}',
      '.cinematic-modal-action{display:inline-flex;margin-top:12px;min-height:44px;align-items:center;justify-content:center;padding:0 18px;border-radius:11px;text-decoration:none;background:linear-gradient(90deg,#ff8e1b,#b34b05);color:#fff;font-weight:850;}',
      '@media(orientation:portrait){.cinematic-reticle{display:none}.cinematic-topbar{left:18px;right:18px;top:max(14px,env(safe-area-inset-top));height:34px}.cinematic-top-note{display:none}.cinematic-live-pill{margin-left:auto;font-size:8px;padding:6px 9px}.cinematic-stage-wrap{left:0;top:max(58px,calc(env(safe-area-inset-top) + 48px));width:100vw;transform:none}.cinematic-stage{width:100%;aspect-ratio:1.25/1;border-radius:0 0 28px 28px;border-left:0;border-right:0;box-shadow:0 30px 70px rgba(0,0,0,.42),0 0 54px rgba(255,72,10,.08)}.cinematic-stage-vignette{background:linear-gradient(180deg,rgba(2,4,8,.02),transparent 54%,rgba(3,5,9,.60) 100%)}.cinematic-stage-hint{right:14px;bottom:14px;font-size:8px}.cinematic-hero-copy{left:22px;right:22px;top:calc(max(58px,calc(env(safe-area-inset-top) + 48px)) + 80vw + 18px);width:auto;text-align:left}.cinematic-kicker{font-size:9px;margin-bottom:8px}.cinematic-hero-copy h1{font-size:30px;line-height:.95;letter-spacing:-.035em}.cinematic-hero-copy h1 br{display:none}.cinematic-hero-copy p{font-size:11px;line-height:1.5;margin-top:10px;max-width:none}.cinematic-info-rail{display:none}.cinematic-controls{left:22px;right:22px;bottom:max(22px,env(safe-area-inset-bottom));width:auto;transform:none;display:block}.cinematic-play{width:100%;min-height:70px}.cinematic-nav{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:11px}.cinematic-nav-button{min-height:52px;padding:0 10px}.cinematic-nav-button:first-child{grid-column:1/3}.cinematic-transition-stage{width:100vw;border-radius:0;box-shadow:0 26px 80px rgba(0,0,0,.62)}.cinematic-transition-hud{bottom:max(74px,calc(env(safe-area-inset-bottom) + 58px));grid-template-columns:auto min(150px,42vw) 26px;gap:10px}.cinematic-transition-hud span{font-size:8px}.cinematic-film-grain{opacity:.035}}',
      '@media(orientation:portrait) and (max-height:760px){.cinematic-hero-copy p{display:none}.cinematic-hero-copy{top:calc(max(58px,calc(env(safe-area-inset-top) + 48px)) + 80vw + 10px)}.cinematic-hero-copy h1{font-size:27px}.cinematic-controls{bottom:max(12px,env(safe-area-inset-bottom))}.cinematic-play{min-height:62px}.cinematic-nav-button{min-height:46px}.cinematic-stage-hint{display:none}}',
      '@media(max-width:900px) and (orientation:landscape){.cinematic-hero-copy{left:4vw;width:26vw}.cinematic-info-rail{right:4vw;width:23vw}.cinematic-controls{bottom:14px}.cinematic-play{width:280px;min-height:66px}.cinematic-nav-button{min-height:50px;padding:0 12px;font-size:9px}}',
      '@media(prefers-reduced-motion:reduce){.cinematic-ambient::before{animation:none}.cinematic-reticle{display:none}.cinematic-play,.cinematic-nav-button,.cinematic-stage{transition:none}}'
    ].join('\n');

    root.append(ambient, shell, transition, reticle, filmGrain, modal.root, style);
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

    const activeHomeSpec = () => (isPortrait() ? HOME_MOBILE : HOME_DESKTOP);
    const applyHomeSpec = () => {
      const spec = activeHomeSpec();
      setSprite(homeFrame, spec);
      frame = Math.max(0, Math.min(spec.frames - 1, frame));
      setSpriteFrame(homeFrame, frame, spec);
    };
    applyHomeSpec();

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
        // Browser may reject fullscreen/audio; the UI still works.
      }
    };

    const updateCursor = (ev: PointerEvent) => {
      root.style.setProperty('--cursor-x', ev.clientX + 'px');
      root.style.setProperty('--cursor-y', ev.clientY + 'px');
      const r = stage.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const nx = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1));
        const ny = Math.max(-1, Math.min(1, ((ev.clientY - r.top) / r.height) * 2 - 1));
        root.style.setProperty('--tilt-y', (nx * 0.75).toFixed(2) + 'deg');
        root.style.setProperty('--tilt-x', (-ny * 0.45).toFixed(2) + 'deg');
        root.style.setProperty('--stage-x', (nx * -4).toFixed(2) + 'px');
        root.style.setProperty('--stage-y', (ny * -3).toFixed(2) + 'px');
        root.style.setProperty('--glow-x', (((nx + 1) / 2) * 100).toFixed(1) + '%');
        root.style.setProperty('--glow-y', (((ny + 1) / 2) * 100).toFixed(1) + '%');
      }
    };

    const scrub = (ev: PointerEvent) => {
      const spec = activeHomeSpec();
      const rect = stage.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      frame = Math.round(ratio * (spec.frames - 1));
      setSpriteFrame(homeFrame, frame, spec);
      lastInteraction = performance.now();
    };

    const onStageDown = (ev: PointerEvent) => {
      dragging = true;
      lastInteraction = performance.now();
      try {
        stage.setPointerCapture(ev.pointerId);
      } catch {}
      void firstGesture();
      updateCursor(ev);
      scrub(ev);
    };

    const onStageMove = (ev: PointerEvent) => {
      updateCursor(ev);
      const fine =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(hover:hover) and (pointer:fine)').matches;
      if (dragging || fine) scrub(ev);
    };

    const onStageUp = (ev: PointerEvent) => {
      dragging = false;
      lastInteraction = performance.now();
      try {
        stage.releasePointerCapture(ev.pointerId);
      } catch {}
    };

    const startIdle = () => {
      idleTimer = window.setInterval(() => {
        if (disposed || launching || dragging) return;
        if (performance.now() - lastInteraction < 2200) return;
        const spec = activeHomeSpec();
        frame += idleDirection;
        if (frame >= spec.frames - 1) {
          frame = spec.frames - 1;
          idleDirection = -1;
        } else if (frame <= 0) {
          frame = 0;
          idleDirection = 1;
        }
        setSpriteFrame(homeFrame, frame, spec);
      }, 115);
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

    const interactiveButtons = [play, connect, rank, how];
    interactiveButtons.forEach((button) => {
      button.addEventListener('pointerenter', () => root.classList.add('is-over-control'));
      button.addEventListener('pointerleave', () => root.classList.remove('is-over-control'));
      button.addEventListener('pointerdown', () => pulse(button));
    });

    connect.addEventListener('click', () => {
      void firstGesture();
      openModal(
        'CONECTAR TIKTOK LIVE',
        [
          'A conexão da live continua usando o sistema existente do Bolla Arena.',
          'Para testes, QR e controles administrativos, use o painel.'
        ],
        'ABRIR PAINEL',
        '/admin'
      );
    });

    rank.addEventListener('click', () => {
      void firstGesture();
      openModal('RANKING', [
        'O TOP 5 é atualizado durante a rodada conforme eliminações, vida e desempenho.',
        'A classificação continua integrada ao HUD da arena.'
      ]);
    });

    how.addEventListener('click', () => {
      void firstGesture();
      openModal('COMO JOGAR', [
        'Comente na live para entrar na arena. Sua foto aparece dentro da sua bola.',
        'Likes recuperam vida e aumentam poder nas metas configuradas.',
        'Presentes ativam habilidades especiais e vantagens durante a rodada.'
      ]);
    });

    modal.close.addEventListener('click', closeModal);
    modal.root.addEventListener('pointerdown', (ev) => {
      if (ev.target === modal.root) closeModal();
    });

    const onResize = () => {
      applyHomeSpec();
    };

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      window.clearInterval(idleTimer);
      window.clearInterval(transitionTimer);
      window.removeEventListener('resize', onResize);
      root.removeEventListener('pointermove', updateCursor);
      stage.removeEventListener('pointerdown', onStageDown);
      stage.removeEventListener('pointermove', onStageMove);
      stage.removeEventListener('pointerup', onStageUp);
      stage.removeEventListener('pointercancel', onStageUp);
    };

    const finish = () => {
      cleanup();
      root.style.transition = 'opacity 240ms ease';
      root.style.opacity = '0';
      window.setTimeout(() => {
        root.remove();
        resolve();
      }, 250);
    };

    const launch = async () => {
      if (launching) return;
      launching = true;
      closeModal();
      pulse(play);
      await firstGesture();

      root.classList.add('is-launching');
      interactiveButtons.forEach((button) => {
        button.disabled = true;
      });

      window.setTimeout(() => {
        transition.classList.add('show');
        transition.setAttribute('aria-hidden', 'false');
      }, 170);

      setSpriteFrame(transitionFrame, 0, TRANSITION);
      const progressFill = transitionHud.querySelector('i') as HTMLElement | null;
      const progressNum = transitionHud.querySelector('b') as HTMLElement | null;
      if (progressFill) progressFill.style.width = '0%';
      if (progressNum) progressNum.textContent = '00';

      let transitionIndex = 0;
      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const stepMs = reduced ? 42 : 112;

      window.setTimeout(() => {
        transitionTimer = window.setInterval(() => {
          transitionIndex += 1;
          const idx = setSpriteFrame(transitionFrame, transitionIndex, TRANSITION);
          const pct = Math.round((idx / (TRANSITION.frames - 1)) * 100);
          if (progressFill) progressFill.style.width = pct + '%';
          if (progressNum) progressNum.textContent = String(pct).padStart(2, '0');

          if (idx >= TRANSITION.frames - 1) {
            window.clearInterval(transitionTimer);
            transitionTimer = 0;
            window.setTimeout(finish, reduced ? 80 : 260);
          }
        }, stepMs);
      }, 120);
    };

    play.addEventListener('click', () => void launch());

    root.addEventListener('pointerdown', () => void firstGesture(), {
      passive: true,
      once: true
    });
    root.addEventListener('pointermove', updateCursor, { passive: true });
    stage.addEventListener('pointerdown', onStageDown);
    stage.addEventListener('pointermove', onStageMove);
    stage.addEventListener('pointerup', onStageUp);
    stage.addEventListener('pointercancel', onStageUp);
    window.addEventListener('resize', onResize, { passive: true });

    startIdle();
  });
}
