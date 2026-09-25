/**
 * Optional site password gate (SITE_ACCESS_PASSWORD).
 * When unset/empty, all routes pass through (local demo).
 * Cookie arena_access=1 after unlock; ?access_token= also unlocks (OBS-friendly).
 * /health stays open for Render checks. Passwords are never logged.
 */
import path from 'path';
import fs from 'fs';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export const ACCESS_COOKIE = 'arena_access';
export const WHATSAPP_ACCESS_URL =
  'https://wa.me/5511970731504?text=' +
  encodeURIComponent('Olá, quero obter acesso ao Ball Arena.');

export function getAccessPassword(): string {
  return (process.env.SITE_ACCESS_PASSWORD || '').trim();
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function setAccessCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  const parts = [
    `${ACCESS_COOKIE}=1`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function hasAccessFromCookieHeader(cookieHeader: string): boolean {
  const cookies = parseCookies(cookieHeader);
  return cookies[ACCESS_COOKIE] === '1';
}

export function hasAccessCookie(req: Request): boolean {
  return hasAccessFromCookieHeader(req.headers.cookie || '');
}

function tokenMatches(req: Request, pwd: string): boolean {
  const q = req.query?.access_token;
  if (typeof q === 'string' && q === pwd) return true;
  return false;
}

function isExempt(req: Request): boolean {
  const p = req.path || '';
  if (p === '/health') return true;
  if (p === '/access' || p === '/api/auth/access') return true;
  if (p === '/shop' || p.startsWith('/api/shop')) return true;
  if (p.startsWith('/socket.io')) return true;
  // Gate page brand art (bg + logo) must load before unlock
  if (p.startsWith('/assets/ball-arena/')) return true;
  // BGM / SFX under client public (safe to serve without cookie)
  if (p.startsWith('/assets/sfx/')) return true;
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeNext(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return '/overlay';
  if (raw.includes('://')) return '/overlay';
  return raw.slice(0, 500) || '/overlay';
}

/** Prefer webp, then png under client dist or server public. */
function bgUrlCandidates(): string[] {
  return [
    '/assets/ball-arena/backgrounds/access-arena.webp',
    '/assets/ball-arena/backgrounds/access-arena.jpg',
    '/assets/ball-arena/backgrounds/access-arena.png',
  ];
}

/** Cinematic 9:16 access gate — matches brand mock. */
export function gateHtml(nextPath: string): string {
  const nextAttr = escapeHtml(nextPath || '/overlay');
  const wa = WHATSAPP_ACCESS_URL;
  const bgList = bgUrlCandidates()
    .map((u) => `url('${u}')`)
    .join(', ');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<meta name="theme-color" content="#0B0B0F"/>
<title>Ball Arena — Acesso Restrito</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Bevan&family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  :root {
    --arena-red: #FF4E45;
    --ember: #FF8A3D;
    --gold: #FFD166;
    --cyan: #22D3EE;
    --dark: #0B0B0F;
    --stone: #1E1A16;
    --steel: #2E3440;
    --light: #F2EBD7;
    --wa: #25D366;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; min-height: 100%;
    width: 100%;
    width: 100dvw;
    background: var(--dark);
    color: var(--light);
    font-family: Inter, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }
  body {
    min-height: 100%;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: stretch;
    overflow-x: hidden;
  }
  .stage {
    position: relative;
    width: 100%;
    max-width: min(480px, 100dvw);
    min-height: 100%;
    min-height: 100dvh;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 18px 18px 28px;
    background:
      linear-gradient(180deg, rgba(11,11,15,0.35) 0%, rgba(11,11,15,0.55) 40%, rgba(11,11,15,0.72) 100%),
      ${bgList},
      radial-gradient(ellipse at 30% 40%, #4a1018 0%, transparent 50%),
      radial-gradient(ellipse at 70% 40%, #0a2040 0%, transparent 50%),
      radial-gradient(ellipse at 50% 100%, #3a2208 0%, var(--dark) 55%);
    background-size: cover, cover, cover, cover, cover;
    background-position: center, center, center, center, center;
    background-repeat: no-repeat;
    box-shadow: 0 0 80px rgba(0,0,0,0.6);
  }
  .logo-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
    padding-top: 8px;
    margin-bottom: 8px;
    flex-shrink: 0;
  }
  .logo-wrap img {
    width: min(72vw, 280px);
    height: auto;
    filter: drop-shadow(0 0 18px rgba(255,209,102,0.45)) drop-shadow(0 8px 24px rgba(0,0,0,0.55));
  }
  .logo-fallback {
    display: none;
    text-align: center;
    filter: drop-shadow(0 0 16px rgba(255,78,69,0.5));
  }
  .logo-fallback .crown { font-size: 1.6rem; color: var(--gold); }
  .logo-fallback .word {
    font-family: Bevan, Georgia, serif;
    font-size: clamp(1.8rem, 7vw, 2.4rem);
    background: linear-gradient(135deg, var(--gold), var(--arena-red), var(--ember));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    letter-spacing: 0.04em;
    line-height: 1.05;
  }
  .logo-fallback .sub {
    font-family: "Bebas Neue", sans-serif;
    font-size: 1.5rem;
    letter-spacing: 0.28em;
    color: var(--light);
    margin-top: -2px;
  }
  .spacer { flex: 1 1 auto; min-height: 12px; }
  .panel {
    width: 100%;
    max-width: 380px;
    padding: 28px 22px 22px;
    border-radius: 18px;
    position: relative;
    background:
      linear-gradient(160deg, rgba(30,26,22,0.88), rgba(11,11,15,0.92));
    border: 1.5px solid rgba(255,78,69,0.55);
    box-shadow:
      0 0 0 1px rgba(255,78,69,0.2),
      0 0 28px rgba(255,78,69,0.45),
      0 0 60px rgba(255,78,69,0.18),
      inset 0 1px 0 rgba(255,255,255,0.08),
      0 24px 48px rgba(0,0,0,0.55);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    text-align: center;
  }
  .panel::before {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: 18px;
    pointer-events: none;
    background: linear-gradient(135deg, rgba(255,78,69,0.5), transparent 40%, transparent 60%, rgba(34,211,238,0.25));
    mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    mask-composite: exclude;
    -webkit-mask-composite: xor;
    padding: 1px;
    opacity: 0.7;
  }
  .lock-badge {
    width: 56px; height: 56px;
    margin: -8px auto 14px;
    border-radius: 50%;
    display: grid; place-items: center;
    background: radial-gradient(circle at 40% 35%, #ff6b63, var(--arena-red) 60%, #b51f1a);
    border: 2px solid rgba(255,209,102,0.55);
    box-shadow:
      0 0 0 4px rgba(255,78,69,0.2),
      0 0 24px rgba(255,78,69,0.65),
      inset 0 2px 6px rgba(255,255,255,0.25);
    color: #fff;
  }
  .lock-badge svg { width: 26px; height: 26px; }
  h1 {
    margin: 0 0 6px;
    font-family: "Bebas Neue", Bevan, sans-serif;
    font-size: clamp(1.85rem, 7vw, 2.35rem);
    letter-spacing: 0.08em;
    font-weight: 400;
    color: #fff;
    text-shadow: 0 0 20px rgba(255,78,69,0.35), 0 2px 8px rgba(0,0,0,0.6);
  }
  .subtitle {
    margin: 0 0 20px;
    font-family: Inter, sans-serif;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    color: rgba(242,235,215,0.78);
    text-transform: uppercase;
  }
  .field {
    position: relative;
    margin-bottom: 14px;
  }
  .field .icon-left {
    position: absolute;
    left: 14px; top: 50%;
    transform: translateY(-50%);
    width: 18px; height: 18px;
    opacity: 0.7;
    pointer-events: none;
    color: var(--gold);
  }
  .field input {
    width: 100%;
    padding: 15px 48px 15px 44px;
    border-radius: 12px;
    border: 1.5px solid rgba(255,138,61,0.4);
    background: rgba(11,11,15,0.85);
    color: var(--light);
    font-size: 1rem;
    font-family: Inter, sans-serif;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .field input::placeholder { color: rgba(242,235,215,0.4); }
  .field input:focus {
    border-color: var(--arena-red);
    box-shadow: 0 0 0 3px rgba(255,78,69,0.25), 0 0 18px rgba(255,78,69,0.2);
  }
  .toggle-eye {
    position: absolute;
    right: 8px; top: 50%;
    transform: translateY(-50%);
    width: 40px; height: 40px;
    border: none; background: transparent;
    color: rgba(242,235,215,0.65);
    cursor: pointer;
    border-radius: 8px;
    display: grid; place-items: center;
  }
  .toggle-eye:hover { color: var(--gold); background: rgba(255,209,102,0.08); }
  .toggle-eye:active { transform: translateY(-50%) scale(0.94); }
  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 15px 18px;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-family: "Bebas Neue", sans-serif;
    font-size: 1.45rem;
    letter-spacing: 0.12em;
    text-decoration: none;
    color: #fff;
    transition: transform 0.12s, filter 0.12s, box-shadow 0.12s;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .btn:active { transform: scale(0.97); }
  .btn-enter {
    background: linear-gradient(180deg, #ff6b63 0%, var(--arena-red) 45%, #d9362e 100%);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.12) inset,
      0 8px 0 #9e1c16,
      0 12px 28px rgba(255,78,69,0.45),
      0 0 32px rgba(255,78,69,0.4);
    margin-bottom: 16px;
  }
  .btn-enter:hover { filter: brightness(1.08); }
  .btn-enter:active {
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.1) inset,
      0 3px 0 #9e1c16,
      0 6px 16px rgba(255,78,69,0.4);
    transform: translateY(4px) scale(0.99);
  }
  .btn-enter[disabled] { opacity: 0.65; cursor: wait; }
  .help {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    text-align: left;
    margin: 0 0 12px;
    font-size: 0.82rem;
    line-height: 1.4;
    color: rgba(242,235,215,0.78);
  }
  .help .warn {
    flex-shrink: 0;
    width: 20px; height: 20px;
    margin-top: 1px;
    border-radius: 50%;
    background: var(--gold);
    color: #1a1208;
    font-weight: 800;
    font-size: 0.75rem;
    display: grid; place-items: center;
    box-shadow: 0 0 10px rgba(255,209,102,0.5);
  }
  .btn-wa {
    background: linear-gradient(180deg, #3ce57a 0%, var(--wa) 50%, #1da851 100%);
    color: #fff;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.15) inset,
      0 8px 0 #148a42,
      0 12px 28px rgba(37,211,102,0.4),
      0 0 28px rgba(37,211,102,0.35);
    font-size: 1.25rem;
  }
  .btn-wa:hover { filter: brightness(1.07); }
  .btn-wa:active {
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.1) inset,
      0 3px 0 #148a42,
      0 6px 16px rgba(37,211,102,0.35);
    transform: translateY(4px) scale(0.99);
  }
  .btn-wa svg { width: 22px; height: 22px; }
  .err {
    display: none;
    margin: 0 0 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255,78,69,0.15);
    border: 1px solid rgba(255,78,69,0.45);
    color: #ffb4ae;
    font-size: 0.88rem;
  }
  .err.show { display: block; }
  .footer {
    margin-top: auto;
    padding-top: 22px;
    flex-shrink: 0;
    font-family: Inter, sans-serif;
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(242,235,215,0.7);
    text-shadow: 0 1px 6px rgba(0,0,0,0.8);
  }
  .footer .heart { color: var(--arena-red); }
  @media (min-height: 800px) {
    .logo-wrap { padding-top: 28px; margin-bottom: 16px; }
    .panel { padding: 32px 26px 26px; }
  }
</style>
</head>
<body>
  <div class="stage">
    <div class="logo-wrap">
      <img id="logoImg" src="/assets/ball-arena/logos/ball-arena-logo.png" alt="Ball Arena"
        onerror="this.onerror=null;this.src='/assets/ball-arena/logos/ball-arena-logo.svg';this.addEventListener('error',function(){this.style.display='none';document.getElementById('logoFb').style.display='block';},{once:true})"/>
      <div class="logo-fallback" id="logoFb">
        <div class="crown">👑</div>
        <div class="word">BALL</div>
        <div class="sub">ARENA</div>
      </div>
    </div>

    <div class="spacer"></div>

    <div class="panel" role="dialog" aria-labelledby="gateTitle">
      <div class="lock-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="11" width="16" height="11" rx="2"/>
          <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
        </svg>
      </div>
      <h1 id="gateTitle">ACESSO RESTRITO</h1>
      <p class="subtitle">Digite a senha para entrar</p>

      <div id="err" class="err" role="alert">Senha incorreta. Peça acesso no WhatsApp se precisar.</div>

      <form id="gateForm" autocomplete="current-password">
        <div class="field">
          <svg class="icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
          <input id="password" name="password" type="password" required autofocus
            placeholder="Digite a senha..." aria-label="Senha"/>
          <button type="button" class="toggle-eye" id="toggleEye" aria-label="Mostrar senha" title="Mostrar / ocultar">
            <svg id="eyeOpen" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg id="eyeOff" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
          </button>
        </div>
        <input type="hidden" id="next" name="next" value="${nextAttr}"/>
        <button class="btn btn-enter" type="submit" id="btnEnter">
          ENTRAR
          <span aria-hidden="true">›</span>
        </button>
      </form>

      <p class="help">
        <span class="warn">!</span>
        <span>Para obter o acesso, entre em contato pelo WhatsApp.</span>
      </p>

      <a class="btn btn-wa" id="btnWa" href="${wa}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.65a11.86 11.86 0 0 0 5.74 1.46h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.43-8.43zM12.06 21.75h-.01a9.84 9.84 0 0 1-5.02-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.44 4.43-9.87 9.88-9.87a9.82 9.82 0 0 1 9.87 9.87c0 5.44-4.43 9.87-9.87 9.87zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"/>
        </svg>
        ENTRAR EM CONTATO
      </a>
    </div>

    <div class="spacer"></div>
    <div class="footer">✧ JOGOS INDIE COM ALMA <span class="heart">♡</span> ✧</div>
  </div>

<script>
(function () {
  var form = document.getElementById('gateForm');
  var err = document.getElementById('err');
  var btn = document.getElementById('btnEnter');
  var input = document.getElementById('password');
  var toggle = document.getElementById('toggleEye');
  var eyeOpen = document.getElementById('eyeOpen');
  var eyeOff = document.getElementById('eyeOff');

  toggle.addEventListener('click', function () {
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    eyeOpen.style.display = show ? 'none' : 'block';
    eyeOff.style.display = show ? 'block' : 'none';
    toggle.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.classList.remove('show');
    btn.disabled = true;
    var password = input.value;
    var next = document.getElementById('next').value || '/overlay';
    fetch('/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: password, next: next })
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      if (res.ok && res.j && res.j.redirect) {
        window.location.href = res.j.redirect;
        return;
      }
      err.classList.add('show');
      btn.disabled = false;
    }).catch(function () {
      err.classList.add('show');
      btn.disabled = false;
    });
  });
})();
</script>
</body>
</html>`;
}

function handleAccessPost(req: Request, res: Response): void {
  const pwd = getAccessPassword();
  const body = (req.body || {}) as { password?: string; next?: string };
  if (!pwd) {
    setAccessCookie(res);
    res.json({ ok: true, redirect: safeNext(body.next) });
    return;
  }
  if (typeof body.password === 'string' && body.password === pwd) {
    setAccessCookie(res);
    res.json({ ok: true, redirect: safeNext(body.next) });
    return;
  }
  res.status(401).json({ ok: false, error: 'invalid' });
}

function handleAccessGet(req: Request, res: Response): void {
  const nextPath = safeNext(req.query.next);
  res.type('html').send(gateHtml(nextPath));
}

export function createAccessRouter(): RequestHandler {
  const handler: RequestHandler = (req, res, next) => {
    const p = req.path || '';
    const isAccess = p === '/access' || p === '/api/auth/access';
    if (!isAccess) return next();

    if (req.method === 'GET' && p === '/access') {
      handleAccessGet(req, res);
      return;
    }
    if (req.method === 'POST' && (p === '/access' || p === '/api/auth/access')) {
      handleAccessPost(req, res);
      return;
    }
    next();
  };
  return handler;
}

/**
 * Middleware: when SITE_ACCESS_PASSWORD is set, require cookie or access_token.
 */
export function accessGateMiddleware(req: Request, res: Response, next: NextFunction): void {
  const pwd = getAccessPassword();
  const isAdmin = req.path === '/admin' || req.path.startsWith('/admin/');
  if (!pwd) {
    if (isAdmin) {
      res.status(503).type('text/plain').send('Admin indisponível: configure SITE_ACCESS_PASSWORD no serviço.');
      return;
    }
    return next();
  }
  if (isExempt(req)) return next();

  if (tokenMatches(req, pwd)) {
    setAccessCookie(res);
    try {
      const u = new URL(req.originalUrl || req.url, 'http://local');
      u.searchParams.delete('access_token');
      const dest = u.pathname + (u.search || '');
      res.redirect(dest || '/overlay');
    } catch {
      res.redirect('/overlay');
    }
    return;
  }

  if (hasAccessCookie(req)) return next();

  const wantsJson =
    req.path.startsWith('/api') ||
    (typeof req.headers.accept === 'string' && req.headers.accept.includes('application/json'));
  if (wantsJson) {
    res.status(401).json({ error: 'locked', unlock: '/access' });
    return;
  }

  const nextUrl = encodeURIComponent(req.originalUrl || '/overlay');
  res.redirect(`/access?next=${nextUrl}`);
}
