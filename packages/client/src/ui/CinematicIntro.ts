export interface CinematicIntroOptions {
  onPlayGesture?: () => void | Promise<void>;
}

interface IntroOverlayOptions {
  transparent: boolean;
  phoneLite: boolean;
}

const HOME_VIDEO = (import.meta.env.VITE_CINEMATIC_HOME_VIDEO || '/assets/ball-arena/cinematic/home-loop.mp4').trim();
const PLAY_VIDEO = (import.meta.env.VITE_CINEMATIC_PLAY_VIDEO || '/assets/ball-arena/cinematic/play-transition.mp4').trim();
const LOGO = '/assets/ball-arena/logos/ball-arena-logo.svg';

export function shouldShowCinematicIntro(opts: IntroOverlayOptions): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('intro') === '0' || params.get('skipIntro') === '1') return false;
  if (opts.transparent) return false;
  return opts.phoneLite || params.get('intro') === '1';
}

function makeButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function makeModal(): {
  root: HTMLDivElement;
  title: HTMLHeadingElement;
  body: HTMLDivElement;
  close: HTMLButtonElement;
  action: HTMLAnchorElement;
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
  return { root, title, body, close, action };
}

function canUseVideo(video: HTMLVideoElement, timeoutMs = 1600): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onError);
      resolve(ok);
    };
    const onReady = () => finish(true);
    const onError = () => finish(false);
    const timer = window.setTimeout(() => finish(video.readyState >= 2), timeoutMs);
    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('canplay', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
    try {
      video.load();
    } catch {
      finish(false);
    }
  });
}

function placeVideoHotspot(
  el: HTMLElement,
  nx: number,
  ny: number,
  nw: number,
  nh: number
): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mediaRatio = 16 / 9;
  const viewportRatio = vw / Math.max(1, vh);
  let displayW = vw;
  let displayH = vh;
  const portrait = vh > vw * 1.18;
  // Portrait phones use a centered cinematic crop (cover) so the hero fills
  // the screen without stretching. Landscape/desktop keeps the full 16:9 frame.
  if (portrait) {
    if (viewportRatio > mediaRatio) {
      displayH = vw / mediaRatio;
    } else {
      displayW = vh * mediaRatio;
    }
  } else if (viewportRatio > mediaRatio) {
    displayW = vh * mediaRatio;
  } else {
    displayH = vw / mediaRatio;
  }
  const left = (vw - displayW) / 2;
  const top = (vh - displayH) / 2;
  el.style.left = left + (nx - nw / 2) * displayW + 'px';
  el.style.top = top + (ny - nh / 2) * displayH + 'px';
  el.style.width = nw * displayW + 'px';
  el.style.height = nh * displayH + 'px';
}

export async function runCinematicIntro(options: CinematicIntroOptions = {}): Promise<void> {
  if (typeof document === 'undefined' || !document.body) return;
  if (document.getElementById('cinematic-home')) return;

  return new Promise<void>((resolve) => {
    const root = document.createElement('section');
    root.id = 'cinematic-home';
    root.setAttribute('aria-label', 'Bolla Arena');

    const fallback = document.createElement('div');
    fallback.className = 'cinematic-fallback';

    const homeVideo = document.createElement('video');
    homeVideo.className = 'cinematic-home-video';
    homeVideo.src = HOME_VIDEO;
    homeVideo.autoplay = true;
    homeVideo.loop = true;
    homeVideo.muted = true;
    homeVideo.playsInline = true;
    homeVideo.preload = 'auto';
    homeVideo.setAttribute('aria-hidden', 'true');

    const transitionVideo = document.createElement('video');
    transitionVideo.className = 'cinematic-transition-video';
    transitionVideo.src = PLAY_VIDEO;
    transitionVideo.muted = true;
    transitionVideo.playsInline = true;
    transitionVideo.preload = 'auto';
    transitionVideo.setAttribute('aria-hidden', 'true');

    const shade = document.createElement('div');
    shade.className = 'cinematic-shade';

    const pointerGlow = document.createElement('div');
    pointerGlow.className = 'cinematic-pointer-glow';

    const fallbackUi = document.createElement('div');
    fallbackUi.className = 'cinematic-fallback-ui';

    const logo = document.createElement('img');
    logo.className = 'cinematic-logo';
    logo.src = LOGO;
    logo.alt = 'Bolla Arena';

    const playFallback = makeButton('▶  JOGAR', 'cinematic-play cinematic-play-fallback');
    const fallbackSub = document.createElement('div');
    fallbackSub.className = 'cinematic-subnav';
    const connectFallback = makeButton('CONECTAR TIKTOK LIVE', 'cinematic-sub');
    const rankFallback = makeButton('RANKING', 'cinematic-sub');
    const howFallback = makeButton('COMO JOGAR', 'cinematic-sub');
    fallbackSub.append(connectFallback, rankFallback, howFallback);
    fallbackUi.append(logo, playFallback, fallbackSub);

    const videoHits = document.createElement('div');
    videoHits.className = 'cinematic-video-hits';
    const playHit = makeButton('JOGAR', 'cinematic-hotspot cinematic-hotspot-play');
    const connectHit = makeButton('CONECTAR TIKTOK LIVE', 'cinematic-hotspot');
    const rankHit = makeButton('RANKING', 'cinematic-hotspot');
    const howHit = makeButton('COMO JOGAR', 'cinematic-hotspot');
    videoHits.append(playHit, connectHit, rankHit, howHit);

    const hint = document.createElement('div');
    hint.className = 'cinematic-hint';
    hint.textContent = 'MOVA O MOUSE OU ARRASTE O DEDO';

    const modal = makeModal();

    const style = document.createElement('style');
    style.textContent = [
      '#cinematic-home{position:fixed;inset:0;z-index:99990;overflow:hidden;background:#09090d;color:#fff;font-family:Inter,system-ui,sans-serif;touch-action:none;isolation:isolate;}',
      '#cinematic-home *{box-sizing:border-box;}',
      '.cinematic-fallback{position:absolute;inset:-4%;width:108%;height:108%;will-change:transform,opacity;transform:translate3d(var(--cin-bg-x,0px),var(--cin-bg-y,0px),0) scale(1.04);transition:transform 160ms cubic-bezier(.2,.8,.2,1);}',
      '.cinematic-home-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;will-change:transform,opacity;transform:translate3d(var(--cin-x,0px),var(--cin-y,0px),0) scale(1.006) rotateX(var(--cin-rx,0deg)) rotateY(var(--cin-ry,0deg));transform-origin:center;transition:transform 160ms cubic-bezier(.2,.8,.2,1),opacity 180ms ease;filter:contrast(1.035) saturate(1.035);}',
      '.cinematic-fallback{overflow:hidden;background:radial-gradient(ellipse at 50% 82%,rgba(255,122,32,.30),transparent 31%),radial-gradient(ellipse at 15% 42%,rgba(25,128,255,.18),transparent 38%),radial-gradient(ellipse at 85% 42%,rgba(139,60,255,.16),transparent 38%),linear-gradient(180deg,#101725 0%,#160d13 50%,#07080d 100%);}',
      '.cinematic-fallback::before{content:"";position:absolute;left:-12%;right:-12%;bottom:-4%;height:44%;background:linear-gradient(90deg,transparent 0 8%,rgba(34,211,238,.10) 8% 8.2%,transparent 8.2% 18%,rgba(255,138,61,.12) 18% 18.2%,transparent 18.2% 82%,rgba(34,211,238,.10) 82% 82.2%,transparent 82.2% 92%,rgba(255,138,61,.12) 92% 92.2%,transparent 92.2%),repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 72px);transform:perspective(520px) rotateX(67deg);transform-origin:bottom;mask-image:linear-gradient(to top,#000 12%,transparent 92%);}',
      '.cinematic-fallback::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 18% 20%,rgba(255,126,30,.52) 0 2px,transparent 3px),radial-gradient(circle at 82% 18%,rgba(34,211,238,.42) 0 2px,transparent 3px),radial-gradient(circle at 61% 59%,rgba(255,209,102,.34) 0 1px,transparent 2px),linear-gradient(90deg,rgba(255,92,24,.12),transparent 23%,transparent 77%,rgba(41,151,255,.12));background-size:150px 150px,190px 190px,230px 230px,100% 100%;animation:cinematic-embers 9s linear infinite;opacity:.72;}',
      '@keyframes cinematic-embers{from{background-position:0 0,0 0,0 0,0 0}to{background-position:36px -180px,-30px -150px,20px -200px,0 0}}',
      '.cinematic-home-video{opacity:0;z-index:2;}',
      '#cinematic-home.has-home-video .cinematic-home-video{opacity:1;}',
      '#cinematic-home.has-home-video .cinematic-fallback{opacity:.82;}',
      '.cinematic-transition-video{position:absolute;z-index:12;opacity:0;transform:none;width:100%;height:100%;inset:0;object-fit:contain;object-position:center;pointer-events:none;background:rgba(5,5,7,.76);filter:contrast(1.035) saturate(1.035);transition:opacity 140ms ease;}',
      '#cinematic-home.is-transitioning .cinematic-transition-video{opacity:1;}',
      '.cinematic-shade{position:absolute;inset:0;z-index:3;pointer-events:none;background:radial-gradient(circle at 50% 42%,transparent 0 34%,rgba(2,3,8,.1) 60%,rgba(2,3,8,.58) 100%),linear-gradient(180deg,rgba(3,5,10,.06),rgba(3,5,10,.22));}',
      '.cinematic-pointer-glow{position:absolute;z-index:4;width:42vmax;height:42vmax;border-radius:999px;left:var(--glow-x,50%);top:var(--glow-y,50%);transform:translate(-50%,-50%);pointer-events:none;background:radial-gradient(circle,rgba(255,155,55,.16),rgba(60,170,255,.06) 38%,transparent 68%);mix-blend-mode:screen;filter:blur(8px);transition:left 120ms linear,top 120ms linear;}',
      '.cinematic-fallback-ui{position:absolute;z-index:6;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:clamp(20px,4vh,48px) 16px max(28px,env(safe-area-inset-bottom));gap:16px;transition:opacity 220ms ease,transform 220ms ease;}',
      '.cinematic-logo{position:absolute;top:12%;left:50%;transform:translateX(-50%);width:min(72vw,620px);height:auto;max-height:34vh;object-fit:contain;filter:drop-shadow(0 18px 30px rgba(0,0,0,.65)) drop-shadow(0 0 34px rgba(255,112,28,.24)) drop-shadow(0 0 26px rgba(34,211,238,.18));pointer-events:none;}',
      '.cinematic-play{min-width:min(360px,72vw);min-height:64px;border-radius:14px;border:1px solid rgba(255,220,130,.92);background:linear-gradient(180deg,rgba(209,121,23,.96),rgba(129,65,8,.98));color:#fff;font:900 clamp(20px,3vw,30px) Inter,system-ui,sans-serif;letter-spacing:.06em;box-shadow:0 0 0 2px rgba(255,151,33,.18),0 0 34px rgba(255,124,22,.56),inset 0 1px rgba(255,255,255,.35);cursor:pointer;transition:transform 120ms ease,filter 120ms ease,box-shadow 120ms ease;}',
      '.cinematic-play:hover,.cinematic-play:focus-visible{filter:brightness(1.14);box-shadow:0 0 0 3px rgba(255,206,96,.26),0 0 50px rgba(255,126,30,.72),inset 0 1px rgba(255,255,255,.4);outline:none;}',
      '.cinematic-play:active{transform:scale(.97) translateY(2px);}',
      '.cinematic-subnav{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}',
      '.cinematic-sub{min-height:46px;padding:0 20px;border-radius:10px;border:1px solid rgba(77,180,255,.5);background:linear-gradient(180deg,rgba(20,27,42,.94),rgba(10,14,24,.96));color:#eef6ff;font-weight:800;font-size:12px;letter-spacing:.04em;box-shadow:0 0 18px rgba(44,154,255,.18);cursor:pointer;}',
      '.cinematic-sub:hover,.cinematic-sub:focus-visible{border-color:rgba(255,196,80,.82);box-shadow:0 0 26px rgba(62,165,255,.38),0 0 20px rgba(255,140,25,.18);outline:none;}',
      '.cinematic-video-hits{position:absolute;inset:0;z-index:7;display:none;}',
      '#cinematic-home.has-home-video .cinematic-fallback-ui{opacity:0;pointer-events:none;}',
      '#cinematic-home.has-home-video .cinematic-video-hits{display:block;}',
      '.cinematic-hotspot{position:absolute;border:1px solid transparent;border-radius:12px;background:transparent;color:transparent;font-size:0;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;transition:border-color 120ms ease,box-shadow 120ms ease,background 120ms ease,transform 120ms ease;}',
      '.cinematic-hotspot:hover,.cinematic-hotspot:focus-visible{border-color:rgba(255,198,80,.78);background:rgba(255,135,30,.08);box-shadow:0 0 30px rgba(255,130,24,.55),inset 0 0 18px rgba(255,189,62,.12);}',
      '.cinematic-hotspot:active{transform:scale(.97);}',
      '.cinematic-hint{position:absolute;z-index:8;left:50%;bottom:max(9px,env(safe-area-inset-bottom));transform:translateX(-50%);padding:6px 10px;border-radius:999px;background:rgba(5,7,12,.48);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.68);font-size:10px;font-weight:700;letter-spacing:.12em;white-space:nowrap;backdrop-filter:blur(8px);pointer-events:none;}',
      '#cinematic-home.is-launching .cinematic-hint,#cinematic-home.is-launching .cinematic-fallback-ui,#cinematic-home.is-launching .cinematic-video-hits{opacity:0;pointer-events:none;}',
      '#cinematic-home.fallback-launch .cinematic-fallback,#cinematic-home.fallback-launch .cinematic-home-video{transform:scale(1.48);filter:brightness(1.2) blur(1px);transition:transform 1000ms cubic-bezier(.18,.88,.2,1),filter 1000ms ease;}',
      '#cinematic-home.fallback-launch .cinematic-shade{background:radial-gradient(circle at 50% 50%,rgba(255,170,40,.22),rgba(2,3,8,.45) 72%);transition:background 800ms ease;}',
      '.cinematic-modal{position:absolute;inset:0;z-index:20;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(2,4,9,.68);backdrop-filter:blur(10px);}',
      '.cinematic-modal.open{display:flex;}',
      '.cinematic-modal-card{position:relative;width:min(540px,94vw);max-height:min(72vh,620px);overflow:auto;border-radius:20px;padding:28px;background:linear-gradient(160deg,rgba(26,30,42,.97),rgba(8,10,16,.98));border:1px solid rgba(255,174,57,.46);box-shadow:0 24px 80px rgba(0,0,0,.62),0 0 34px rgba(255,120,24,.2);}',
      '.cinematic-modal-title{margin:0 42px 16px 0;font-size:24px;color:#ffd166;}',
      '.cinematic-modal-body{font-size:14px;line-height:1.55;color:#eef2f7;}',
      '.cinematic-modal-body p{margin:0 0 10px;}',
      '.cinematic-modal-close{position:absolute;right:14px;top:12px;width:44px;height:44px;border:0;border-radius:12px;background:rgba(255,255,255,.07);color:#fff;font-size:28px;cursor:pointer;}',
      '.cinematic-modal-action{display:inline-flex;margin-top:14px;min-height:44px;align-items:center;justify-content:center;padding:0 18px;border-radius:10px;text-decoration:none;background:#ff7b24;color:#fff;font-weight:800;}',
      '@media(max-width:640px){.cinematic-logo{top:11%;width:min(84vw,500px);max-height:30vh}.cinematic-play{min-width:min(330px,82vw);min-height:60px}.cinematic-subnav{gap:8px;width:min(92vw,620px)}.cinematic-sub{flex:1 1 30%;min-width:0;padding:0 10px;font-size:10px}.cinematic-hint{font-size:9px;letter-spacing:.08em}}',
      '@media(orientation:portrait){.cinematic-home-video,.cinematic-transition-video{object-fit:cover;object-position:50% 50%}.cinematic-home-video{transform:translate3d(var(--cin-x,0px),var(--cin-y,0px),0) scale(1.01)}#cinematic-home.has-home-video .cinematic-fallback-ui{opacity:1;pointer-events:auto;justify-content:flex-end;padding-bottom:max(54px,env(safe-area-inset-bottom))}#cinematic-home.has-home-video .cinematic-fallback-ui .cinematic-logo,#cinematic-home.has-home-video .cinematic-play-fallback{display:none}#cinematic-home.has-home-video .cinematic-subnav{display:flex}.cinematic-video-hits .cinematic-hotspot:not(.cinematic-hotspot-play){display:none}.cinematic-hint{bottom:max(8px,env(safe-area-inset-bottom))}}',
      '@media(prefers-reduced-motion:reduce){.cinematic-fallback,.cinematic-home-video{transition:none!important;transform:scale(1.04)!important}.cinematic-pointer-glow{display:none}.cinematic-hint{display:none}}'
    ].join('\n');

    root.append(
      fallback,
      homeVideo,
      transitionVideo,
      shade,
      pointerGlow,
      fallbackUi,
      videoHits,
      hint,
      modal.root,
      style
    );
    document.body.appendChild(root);

    let disposed = false;
    let launching = false;
    let homeAudioEnabled = false;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let raf = 0;

    const enableHomeAudio = () => {
      if (disposed || launching || homeAudioEnabled) return;
      homeAudioEnabled = true;
      homeVideo.muted = false;
      homeVideo.volume = 1;
      try {
        const p = homeVideo.play();
        if (p && typeof p.catch === 'function') {
          void p.catch(() => {
            homeAudioEnabled = false;
            homeVideo.muted = true;
          });
        }
      } catch {
        homeAudioEnabled = false;
        homeVideo.muted = true;
      }
    };

    const allPlayButtons = [playFallback, playHit];
    const connectButtons = [connectFallback, connectHit];
    const rankButtons = [rankFallback, rankHit];
    const howButtons = [howFallback, howHit];

    const layoutHotspots = () => {
      placeVideoHotspot(playHit, 0.5, 0.765, 0.25, 0.11);
      placeVideoHotspot(connectHit, 0.36, 0.88, 0.18, 0.085);
      placeVideoHotspot(rankHit, 0.50, 0.88, 0.15, 0.085);
      placeVideoHotspot(howHit, 0.64, 0.88, 0.17, 0.085);
    };

    const tick = () => {
      if (disposed) return;
      currentX += (targetX - currentX) * 0.09;
      currentY += (targetY - currentY) * 0.09;
      root.style.setProperty('--cin-x', (-currentX * 6).toFixed(2) + 'px');
      root.style.setProperty('--cin-y', (-currentY * 4).toFixed(2) + 'px');
      root.style.setProperty('--cin-bg-x', (-currentX * 12).toFixed(2) + 'px');
      root.style.setProperty('--cin-bg-y', (-currentY * 8).toFixed(2) + 'px');
      root.style.setProperty('--cin-ry', (currentX * 0.6).toFixed(2) + 'deg');
      root.style.setProperty('--cin-rx', (-currentY * 0.4).toFixed(2) + 'deg');
      raf = window.requestAnimationFrame(tick);
    };

    const onPointer = (ev: PointerEvent) => {
      if (launching) return;
      const rect = root.getBoundingClientRect();
      const nx = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const ny = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
      targetX = Math.max(-1, Math.min(1, nx));
      targetY = Math.max(-1, Math.min(1, ny));
      root.style.setProperty('--glow-x', ev.clientX + 'px');
      root.style.setProperty('--glow-y', ev.clientY + 'px');
    };

    const resetPointer = () => {
      targetX = 0;
      targetY = 0;
    };

    const closeModal = () => {
      modal.root.classList.remove('open');
      modal.root.setAttribute('aria-hidden', 'true');
    };

    const openModal = (
      titleText: string,
      paragraphs: string[],
      actionText?: string,
      actionHref?: string
    ) => {
      modal.title.textContent = titleText;
      modal.body.replaceChildren();
      paragraphs.forEach((text) => {
        const p = document.createElement('p');
        p.textContent = text;
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

    connectButtons.forEach((button) => {
      button.addEventListener('click', () => {
        openModal(
          'CONECTAR TIKTOK LIVE',
          [
            'O servidor do Bolla Arena conecta automaticamente à conta TikTok configurada quando a live entra no ar.',
            'Para testes e controles do modo DEMO, use o painel administrativo.'
          ],
          'ABRIR PAINEL',
          '/admin'
        );
      });
    });

    rankButtons.forEach((button) => {
      button.addEventListener('click', () => {
        openModal('RANKING', [
          'O TOP 5 aparece ao vivo durante a partida e se atualiza conforme kills, vida e posição dos jogadores.',
          'A classificação da rodada fica integrada ao HUD da arena.'
        ]);
      });
    });

    howButtons.forEach((button) => {
      button.addEventListener('click', () => {
        openModal('COMO JOGAR', [
          'Comente na live para entrar na arena. Sua foto aparece dentro da sua bola.',
          '50 likes: recupera 10 de vida. 100 likes: +20 de vida e +1 de poder. 200 likes: +40 de vida e +2 de poder.',
          '500 likes: vida completa, +10 de poder e Capivara. 1000 likes: vida completa, +15 de poder e Capivara x3 até o fim da partida.',
          'As bolas colidem, causam dano e ficam mais fortes conforme a batalha avança.'
        ]);
      });
    });

    modal.close.addEventListener('click', closeModal);
    modal.root.addEventListener('pointerdown', (ev) => {
      if (ev.target === modal.root) closeModal();
    });

    const finish = () => {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', layoutHotspots);
      root.removeEventListener('pointerdown', enableHomeAudio);
      root.removeEventListener('pointermove', onPointer);
      root.removeEventListener('pointerleave', resetPointer);
      root.style.opacity = '0';
      root.style.transition = 'opacity 180ms ease';
      window.setTimeout(() => {
        root.remove();
        resolve();
      }, 190);
    };

    const launch = async () => {
      if (launching) return;
      launching = true;
      closeModal();
      root.classList.add('is-launching');
      allPlayButtons.forEach((button) => {
        button.disabled = true;
      });

      // Keep user activation intact for iOS video audio: invoke gesture setup
      // synchronously and start the transition video immediately.
      try {
        const gestureResult = options.onPlayGesture?.();
        if (gestureResult && typeof gestureResult.catch === 'function') {
          void gestureResult.catch(() => undefined);
        }
      } catch {
        // Keep launch independent from audio/fullscreen failures.
      }

      homeVideo.pause();
      transitionVideo.muted = false;
      transitionVideo.volume = 1;
      try {
        transitionVideo.currentTime = 0;
      } catch {
        // ignored
      }
      root.classList.add('is-transitioning');

      let fallbackTimer = 0;
      const onEnded = () => {
        window.clearTimeout(fallbackTimer);
        finish();
      };
      transitionVideo.addEventListener('ended', onEnded, { once: true });
      fallbackTimer = window.setTimeout(finish, 9000);
      try {
        const playPromise = transitionVideo.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          void playPromise.catch(() => {
            root.classList.remove('is-transitioning');
            root.classList.add('fallback-launch');
            window.setTimeout(finish, 1050);
          });
        }
      } catch {
        root.classList.remove('is-transitioning');
        root.classList.add('fallback-launch');
        window.setTimeout(finish, 1050);
      }
    };

    allPlayButtons.forEach((button) => {
      button.addEventListener('click', () => {
        void launch();
      });
    });

    root.addEventListener('pointerdown', enableHomeAudio, { passive: true });
    root.addEventListener('pointermove', onPointer, { passive: true });
    root.addEventListener('pointerleave', resetPointer);
    window.addEventListener('resize', layoutHotspots);
    layoutHotspots();
    raf = window.requestAnimationFrame(tick);

    void canUseVideo(homeVideo).then((ready) => {
      if (disposed || !ready) return;
      root.classList.add('has-home-video');
      try {
        const promise = homeVideo.play();
        if (promise && typeof promise.catch === 'function') {
          void promise.catch(() => root.classList.remove('has-home-video'));
        }
      } catch {
        root.classList.remove('has-home-video');
      }
    });
  });
}
