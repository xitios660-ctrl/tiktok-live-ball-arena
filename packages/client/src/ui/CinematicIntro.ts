export interface CinematicIntroOptions {
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
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/b1ef44e6-ffad-4955-b177-674a346f2f85.webp'
).trim();

const TRANSITION_MOBILE_SPRITE = (
  import.meta.env.VITE_CINEMATIC_TRANSITION_MOBILE_SPRITE ||
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3ExHvVfp1S2A6CycImN7kDdmbsV/598deecc-d145-4f4e-9ba7-033b355aa212.webp'
).trim();

const HOME_FRAMES = 36;
const HOME_COLS = 6;
const HOME_ROWS = 6;
const TRANSITION_FRAMES = 48;
const TRANSITION_COLS = 8;
const TRANSITION_ROWS = 6;

type HotspotKey = 'play' | 'connect' | 'rank' | 'how';

type HotspotRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const DESKTOP_HOTSPOTS: Record<HotspotKey, HotspotRect> = {
  play: { x: 0.5, y: 0.765, w: 0.255, h: 0.115 },
  connect: { x: 0.36, y: 0.88, w: 0.185, h: 0.09 },
  rank: { x: 0.5, y: 0.88, w: 0.155, h: 0.09 },
  how: { x: 0.64, y: 0.88, w: 0.18, h: 0.09 },
};

/**
 * Mobile artwork is a real 9:16 frame. The 16:9 arena art is enlarged inside
 * it (620x349 at x=-57/y=190 in a 506x900 canvas), so these normalized boxes
 * land directly on the buttons that are visibly baked into the frame.
 */
const MOBILE_HOTSPOTS: Record<HotspotKey, HotspotRect> = {
  play: { x: 0.5, y: 0.508, w: 0.31, h: 0.058 },
  connect: { x: 0.328, y: 0.553, w: 0.225, h: 0.047 },
  rank: { x: 0.5, y: 0.553, w: 0.19, h: 0.047 },
  how: { x: 0.672, y: 0.553, w: 0.215, h: 0.047 },
};

function makeButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
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

function portrait(): boolean {
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

  const close = makeButton('Fechar', 'cinematic-modal-close');
  close.textContent = '×';

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

    const stage = document.createElement('div');
    stage.className = 'cinematic-stage';

    const homeFrame = document.createElement('div');
    homeFrame.className = 'cinematic-frame cinematic-home-frame';

    // A second copy of the same sprite is cross-faded against the first one.
    // This visually interpolates the 36 source frames at 60 fps instead of
    // "stepping" from one still to the next.
    const homeFrameBlend = document.createElement('div');
    homeFrameBlend.className =
      'cinematic-frame cinematic-home-frame cinematic-home-frame-blend';

    const fx = document.createElement('div');
    fx.className = 'cinematic-fx';

    const glow = document.createElement('div');
    glow.className = 'cinematic-hotspot-glow';

    const hotspots = document.createElement('div');
    hotspots.className = 'cinematic-hotspots';

    const play = makeButton('Jogar', 'cinematic-hotspot cinematic-hotspot-play');
    const connect = makeButton(
      'Conectar TikTok Live',
      'cinematic-hotspot cinematic-hotspot-connect'
    );
    const rank = makeButton('Ranking', 'cinematic-hotspot cinematic-hotspot-rank');
    const how = makeButton('Como jogar', 'cinematic-hotspot cinematic-hotspot-how');
    hotspots.append(play, connect, rank, how);

    stage.append(homeFrame, homeFrameBlend, fx, glow, hotspots);

    const transition = document.createElement('div');
    transition.className = 'cinematic-transition';
    transition.setAttribute('aria-hidden', 'true');

    const transitionStage = document.createElement('div');
    transitionStage.className = 'cinematic-stage cinematic-transition-stage';

    const transitionFrame = document.createElement('div');
    transitionFrame.className = 'cinematic-frame cinematic-transition-frame';

    const transitionFlash = document.createElement('div');
    transitionFlash.className = 'cinematic-transition-flash';

    transitionStage.append(transitionFrame, transitionFlash);
    transition.append(transitionStage);

    const modal = makeModal();

    const style = document.createElement('style');
    style.textContent = [
      '#cinematic-home{position:fixed;inset:0;z-index:99990;overflow:hidden;background:#020307;color:#fff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;touch-action:none;-webkit-tap-highlight-color:transparent;isolation:isolate;}',
      '#cinematic-home *{box-sizing:border-box;}',
      '.cinematic-stage{position:absolute;left:50%;top:50%;width:max(100vw,calc(100vh * 16 / 9));height:max(100vh,calc(100vw * 9 / 16));transform:translate(-50%,-50%);overflow:hidden;will-change:transform,filter;background:#020307;}',
      '.cinematic-frame{position:absolute;inset:0;background-repeat:no-repeat;background-color:#020307;will-change:background-position,transform,filter;}',
      '.cinematic-home-frame{background-size:600% 600%;filter:contrast(1.045) saturate(1.04);}',
      '.cinematic-home-frame-blend{opacity:0;}',
      '.cinematic-fx{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 44%,transparent 42%,rgba(0,0,0,.18) 100%),linear-gradient(180deg,rgba(0,0,0,.05),transparent 55%,rgba(0,0,0,.12));mix-blend-mode:multiply;}',
      '.cinematic-hotspots{position:absolute;inset:0;z-index:8;pointer-events:none;}',
      '.cinematic-hotspot{position:absolute;pointer-events:auto;border:0!important;outline:0!important;background:transparent!important;color:transparent!important;font-size:0!important;border-radius:18px;appearance:none;-webkit-appearance:none;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:none!important;padding:0;margin:0;transform:translate(-50%,-50%);}',
      '.cinematic-hotspot:focus-visible{outline:2px solid rgba(255,214,103,.64)!important;outline-offset:-2px!important;}',
      '.cinematic-hotspot-glow{position:absolute;z-index:7;left:50%;top:50%;width:1px;height:1px;border-radius:999px;pointer-events:none;opacity:0;transform:translate(-50%,-50%) scale(.7);background:radial-gradient(circle,rgba(255,236,174,.78) 0 8%,rgba(255,142,37,.34) 28%,rgba(78,189,255,.14) 48%,transparent 72%);mix-blend-mode:screen;filter:blur(1px);transition:opacity 100ms ease,transform 130ms cubic-bezier(.2,.8,.2,1);}',
      '#cinematic-home.hotspot-active .cinematic-hotspot-glow{opacity:.82;transform:translate(-50%,-50%) scale(1);}',
      '#cinematic-home.hotspot-pressed .cinematic-hotspot-glow{opacity:1;transform:translate(-50%,-50%) scale(1.28);filter:blur(.2px);}',
      '#cinematic-home.play-press .cinematic-stage:not(.cinematic-transition-stage){animation:cinematicPress 150ms cubic-bezier(.2,.8,.2,1) both;}',
      '@keyframes cinematicPress{0%{transform:translate(-50%,-50%) scale(1)}45%{transform:translate(-50%,-50%) scale(.992)}100%{transform:translate(-50%,-50%) scale(1.006)}}',
      '.cinematic-transition{position:absolute;z-index:30;inset:0;opacity:0;visibility:hidden;background:#020307;pointer-events:none;transition:opacity 110ms ease,visibility 0s linear 110ms;}',
      '.cinematic-transition.show{opacity:1;visibility:visible;transition:opacity 110ms ease;}',
      '.cinematic-transition-frame{background-size:800% 600%;filter:contrast(1.055) saturate(1.055);}',
      '.cinematic-transition-flash{position:absolute;inset:0;opacity:0;pointer-events:none;background:radial-gradient(circle at 50% 52%,rgba(255,232,167,.78),rgba(255,95,10,.20) 24%,transparent 58%);mix-blend-mode:screen;}',
      '.cinematic-transition.show .cinematic-transition-flash{animation:cinematicFlash .50s ease-out 1;}',
      '@keyframes cinematicFlash{0%{opacity:.92}32%{opacity:.34}100%{opacity:0}}',
      '.cinematic-modal{position:absolute;z-index:60;inset:0;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(2,4,9,.78);backdrop-filter:blur(14px);}',
      '.cinematic-modal.open{display:flex;}',
      '.cinematic-modal-card{position:relative;width:min(540px,94vw);max-height:min(74vh,620px);overflow:auto;border-radius:20px;padding:28px;background:linear-gradient(160deg,rgba(17,28,45,.99),rgba(5,9,16,.99));border:1px solid rgba(255,167,52,.42);box-shadow:0 26px 90px rgba(0,0,0,.68),0 0 36px rgba(255,120,24,.14);}',
      '.cinematic-modal-title{margin:0 44px 16px 0;color:#ffc261;font-size:22px;}.cinematic-modal-body{color:#e7eef9;font-size:13px;line-height:1.58;}.cinematic-modal-body p{margin:0 0 10px;}.cinematic-modal-close{position:absolute;right:13px;top:12px;width:42px;height:42px;border:0;border-radius:11px;background:rgba(255,255,255,.08);color:#fff;font-size:27px;cursor:pointer;}.cinematic-modal-action{display:inline-flex;margin-top:12px;min-height:44px;align-items:center;justify-content:center;padding:0 18px;border-radius:11px;text-decoration:none;background:linear-gradient(90deg,#ff8e1b,#ae4604);color:#fff;font-weight:850;}',
      '@media(orientation:portrait){.cinematic-stage{width:max(100vw,calc(100vh * 506 / 900));height:max(100vh,calc(100vw * 900 / 506));}.cinematic-home-frame{background-image:var(--home-mobile)!important;background-size:600% 600%;}.cinematic-transition-frame{background-image:var(--transition-mobile)!important;background-size:800% 600%;}}',
      '@media(prefers-reduced-motion:reduce){.cinematic-stage{animation:none!important}.cinematic-hotspot-glow{transition:none!important}}'
    ].join('\n');

    root.style.setProperty('--home-mobile', 'url("' + HOME_MOBILE_SPRITE + '")');
    root.style.setProperty(
      '--transition-mobile',
      'url("' + TRANSITION_MOBILE_SPRITE + '")'
    );

    root.append(stage, transition, modal.root, style);
    document.body.appendChild(root);

    let disposed = false;
    let launching = false;
    let dragging = false;
    let firstGestureDone = false;
    let homeFrameFloat = (HOME_FRAMES - 1) / 2;
    let autoPhase = 0;
    let animationRaf = 0;
    let lastAnimationAt = performance.now();
    let dragStartX = 0;
    let dragStartFrame = homeFrameFloat;
    let dragLastFrame = homeFrameFloat;
    let dragLastAt = performance.now();
    let inertiaVelocity = 0;
    let inertiaUntil = 0;
    let transitionTimer = 0;

    const hotspotMap: Record<HotspotKey, HTMLButtonElement> = {
      play,
      connect,
      rank,
      how,
    };

    const currentRects = () => (portrait() ? MOBILE_HOTSPOTS : DESKTOP_HOTSPOTS);

    const placeHotspots = () => {
      const rects = currentRects();
      (Object.keys(hotspotMap) as HotspotKey[]).forEach((key) => {
        const el = hotspotMap[key];
        const r = rects[key];
        el.style.left = r.x * 100 + '%';
        el.style.top = r.y * 100 + '%';
        el.style.width = r.w * 100 + '%';
        el.style.height = r.h * 100 + '%';
      });
    };

    const renderHomeFrame = () => {
      const clamped = Math.max(0, Math.min(HOME_FRAMES - 1, homeFrameFloat));
      const lower = Math.floor(clamped);
      const upper = Math.min(HOME_FRAMES - 1, lower + 1);
      const mix = clamped - lower;

      setSpriteFrame(homeFrame, lower, HOME_FRAMES, HOME_COLS, HOME_ROWS);
      setSpriteFrame(homeFrameBlend, upper, HOME_FRAMES, HOME_COLS, HOME_ROWS);
      homeFrameBlend.style.opacity = mix.toFixed(3);
      homeFrame.dataset.frameFloat = clamped.toFixed(3);
    };

    const syncAutoPhaseToCurrent = (direction: number) => {
      const center = (HOME_FRAMES - 1) / 2;
      const amplitude = center;
      const normalized = Math.max(
        -1,
        Math.min(1, (homeFrameFloat - center) / amplitude)
      );
      const a = Math.asin(normalized);
      autoPhase = direction >= 0 ? a : Math.PI - a;
    };

    const applyHomeAsset = () => {
      const url = portrait() ? HOME_MOBILE_SPRITE : HOME_DESKTOP_SPRITE;
      homeFrame.style.backgroundImage = 'url("' + url + '")';
      homeFrameBlend.style.backgroundImage = 'url("' + url + '")';
      renderHomeFrame();
      placeHotspots();
    };

    const applyTransitionAsset = () => {
      transitionFrame.style.backgroundImage =
        'url("' +
        (portrait() ? TRANSITION_MOBILE_SPRITE : TRANSITION_DESKTOP_SPRITE) +
        '")';
      setSpriteFrame(
        transitionFrame,
        0,
        TRANSITION_FRAMES,
        TRANSITION_COLS,
        TRANSITION_ROWS
      );
    };

    const firstGesture = async () => {
      if (firstGestureDone) return;
      firstGestureDone = true;
      try {
        await options.onPlayGesture?.();
      } catch {
        // A rejected fullscreen/audio request must never break navigation.
      }
    };

    const setGlowFor = (key: HotspotKey) => {
      const r = currentRects()[key];
      glow.style.left = r.x * 100 + '%';
      glow.style.top = r.y * 100 + '%';
      glow.style.width = Math.max(r.w, r.h) * 145 + '%';
      glow.style.height = Math.max(r.w, r.h) * 145 + '%';
    };

    const bindHotspotFx = (key: HotspotKey) => {
      const el = hotspotMap[key];
      el.addEventListener('pointerenter', () => {
        setGlowFor(key);
        root.classList.add('hotspot-active');
      });
      el.addEventListener('pointerleave', () => {
        root.classList.remove('hotspot-active', 'hotspot-pressed');
      });
      el.addEventListener('pointerdown', () => {
        setGlowFor(key);
        root.classList.add('hotspot-active', 'hotspot-pressed');
        window.setTimeout(() => root.classList.remove('hotspot-pressed'), 145);
      });
    };

    (Object.keys(hotspotMap) as HotspotKey[]).forEach(bindHotspotFx);

    const onStageDown = (ev: PointerEvent) => {
      if ((ev.target as HTMLElement | null)?.closest('.cinematic-hotspot')) return;
      dragging = true;
      inertiaVelocity = 0;
      inertiaUntil = 0;
      dragStartX = ev.clientX;
      dragStartFrame = homeFrameFloat;
      dragLastFrame = homeFrameFloat;
      dragLastAt = performance.now();
      void firstGesture();
      try {
        stage.setPointerCapture(ev.pointerId);
      } catch {
        // ignored
      }
    };

    const onStageMove = (ev: PointerEvent) => {
      if (!dragging) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 1) return;

      // Relative dragging feels much more like "grabbing" the cinematic shot
      // than mapping the finger to a fixed absolute point on screen.
      const deltaX = ev.clientX - dragStartX;
      const travel = (deltaX / rect.width) * (HOME_FRAMES - 1) * 1.12;
      const next = Math.max(
        0,
        Math.min(HOME_FRAMES - 1, dragStartFrame + travel)
      );

      const now = performance.now();
      const dt = Math.max(8, now - dragLastAt) / 1000;
      const instantVelocity = (next - dragLastFrame) / dt;
      inertiaVelocity = inertiaVelocity * 0.62 + instantVelocity * 0.38;

      homeFrameFloat = next;
      dragLastFrame = next;
      dragLastAt = now;
      renderHomeFrame();
    };

    const onStageUp = (ev: PointerEvent) => {
      if (!dragging) return;
      dragging = false;

      // Let the scene coast for a fraction of a second after the finger is
      // released, then blend seamlessly back into autonomous movement.
      inertiaVelocity = Math.max(-18, Math.min(18, inertiaVelocity));
      inertiaUntil = performance.now() + 720;
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

    connect.addEventListener('click', () => {
      void firstGesture();
      openModal(
        'CONECTAR TIKTOK LIVE',
        [
          'A conexão da live continua usando o sistema atual do Bolla Arena.',
          'Para testes, conexão e controles administrativos, use o painel.'
        ],
        'ABRIR PAINEL',
        '/admin'
      );
    });

    rank.addEventListener('click', () => {
      void firstGesture();
      openModal('RANKING', [
        'O TOP 5 continua integrado ao jogo e se atualiza durante a partida.',
        'Kills, desempenho e posição seguem usando a lógica atual do Bolla Arena.'
      ]);
    });

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
      window.cancelAnimationFrame(animationRaf);
      window.clearInterval(transitionTimer);
      stage.removeEventListener('pointerdown', onStageDown);
      stage.removeEventListener('pointermove', onStageMove);
      stage.removeEventListener('pointerup', onStageUp);
      stage.removeEventListener('pointercancel', onStageUp);
      window.removeEventListener('resize', applyHomeAsset);
    };

    const finish = () => {
      cleanup();
      root.style.transition = 'opacity 210ms ease';
      root.style.opacity = '0';
      window.setTimeout(() => {
        root.remove();
        resolve();
      }, 220);
    };

    const launch = async () => {
      if (launching) return;
      launching = true;
      closeModal();
      root.classList.add('play-press');
      await firstGesture();

      [play, connect, rank, how].forEach((button) => {
        button.disabled = true;
      });

      window.setTimeout(() => {
        applyTransitionAsset();
        transition.classList.add('show');
        transition.setAttribute('aria-hidden', 'false');

        const reduced =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const stepMs = reduced ? 30 : 56;
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

          if (clamped >= TRANSITION_FRAMES - 1) {
            window.clearInterval(transitionTimer);
            transitionTimer = 0;
            window.setTimeout(finish, reduced ? 70 : 140);
          }
        }, stepMs);
      }, 120);
    };

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

    const restartLayout = () => {
      window.setTimeout(() => {
        applyHomeAsset();
        applyTransitionAsset();
      }, 120);
    };

    window.addEventListener('orientationchange', restartLayout);
    window.addEventListener('resize', applyHomeAsset);

    applyHomeAsset();
    applyTransitionAsset();

    const animateHome = (now: number) => {
      if (disposed) return;

      const dt = Math.min(0.05, Math.max(0, (now - lastAnimationAt) / 1000));
      lastAnimationAt = now;

      if (!launching && !dragging) {
        if (now < inertiaUntil && Math.abs(inertiaVelocity) > 0.08) {
          homeFrameFloat += inertiaVelocity * dt;

          if (homeFrameFloat <= 0) {
            homeFrameFloat = 0;
            inertiaVelocity = Math.abs(inertiaVelocity) * 0.34;
          } else if (homeFrameFloat >= HOME_FRAMES - 1) {
            homeFrameFloat = HOME_FRAMES - 1;
            inertiaVelocity = -Math.abs(inertiaVelocity) * 0.34;
          }

          // Smooth exponential friction, independent of device refresh rate.
          inertiaVelocity *= Math.exp(-4.8 * dt);
          renderHomeFrame();
        } else {
          if (inertiaUntil !== 0) {
            syncAutoPhaseToCurrent(inertiaVelocity >= 0 ? 1 : -1);
            inertiaUntil = 0;
            inertiaVelocity = 0;
          }

          // About 14 seconds for a complete there-and-back cycle. The sine
          // motion naturally eases at both ends instead of snapping direction.
          const reduced =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const cycleSeconds = reduced ? 28 : 14;
          autoPhase += (Math.PI * 2 * dt) / cycleSeconds;

          const center = (HOME_FRAMES - 1) / 2;
          const amplitude = center;
          homeFrameFloat = center + Math.sin(autoPhase) * amplitude;
          renderHomeFrame();
        }
      }

      animationRaf = window.requestAnimationFrame(animateHome);
    };

    animationRaf = window.requestAnimationFrame((now) => {
      lastAnimationAt = now;
      animateHome(now);
    });
  });
}
