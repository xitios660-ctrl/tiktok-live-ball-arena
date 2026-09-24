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
  'https://wa.me/5511970731504?text=' + encodeURIComponent('Quero acesso ao Ball Arena');

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

export function hasAccessCookie(req: Request): boolean {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[ACCESS_COOKIE] === '1';
}

function tokenMatches(req: Request, pwd: string): boolean {
  const q = req.query?.access_token;
  if (typeof q === 'string' && q === pwd) return true;
  return false;
}

function isExempt(req: Request): boolean {
  const p = req.path || '';
  if (p === '/health') return true;
  if (p === '/access') return true;
  if (p.startsWith('/socket.io')) return true;
  return false;
}

/** Inline branded gate HTML (fallback if public/access.html missing). */
export function gateHtml(nextPath: string): string {
  const nextAttr = escapeHtml(nextPath || '/overlay');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Ball Arena — Acesso</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Bevan&family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
  :root {
    --arena-red: #FF4E45;
    --ember: #FF8A3D;
    --gold: #FFD166;
    --cyan: #22D3EE;
    --dark: #0B0B0F;
    --stone: #1E1A16;
    --light: #F2EBD7;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    font-family: Inter, system-ui, sans-serif;
    background: radial-gradient(ellipse at 50% 20%, #2a1810 0%, var(--dark) 55%, #050508 100%);
    color: var(--light);
    padding: 24px;
  }
  .card {
    width: 100%; max-width: 420px;
    background: linear-gradient(160deg, rgba(30,26,22,0.95), rgba(11,11,15,0.92));
    border: 1px solid rgba(255,209,102,0.35);
    border-radius: 18px;
    padding: 28px 24px 24px;
    box-shadow: 0 0 0 1px rgba(255,78,69,0.15), 0 24px 60px rgba(0,0,0,0.55),
      0 0 40px rgba(255,138,61,0.12);
  }
  h1 {
    font-family: Bevan, Georgia, serif;
    font-size: 1.65rem; font-weight: 400; margin: 0 0 4px;
    color: var(--gold); letter-spacing: 0.02em;
    text-shadow: 0 0 24px rgba(255,209,102,0.35);
  }
  .sub {
    font-family: "Bebas Neue", sans-serif;
    font-size: 1.15rem; letter-spacing: 0.12em;
    color: var(--ember); margin: 0 0 18px;
  }
  p { margin: 0 0 16px; font-size: 0.95rem; line-height: 1.45; color: rgba(242,235,215,0.85); }
  label { display: block; font-size: 0.8rem; color: var(--cyan); margin-bottom: 6px; letter-spacing: 0.04em; }
  input[type=password] {
    width: 100%; padding: 14px 16px; border-radius: 12px;
    border: 1px solid rgba(255,138,61,0.45);
    background: rgba(11,11,15,0.85); color: var(--light);
    font-size: 1.05rem; outline: none;
  }
  input[type=password]:focus {
    border-color: var(--gold);
    box-shadow: 0 0 0 3px rgba(255,209,102,0.2);
  }
  .btn {
    display: block; width: 100%; margin-top: 14px; padding: 14px 16px;
    border: none; border-radius: 12px; cursor: pointer;
    font-family: "Bebas Neue", sans-serif; font-size: 1.35rem; letter-spacing: 0.1em;
    background: linear-gradient(135deg, var(--arena-red), var(--ember));
    color: #fff; text-decoration: none; text-align: center;
    box-shadow: 0 8px 24px rgba(255,78,69,0.35);
  }
  .btn:hover { filter: brightness(1.08); }
  .wa {
    display: block; width: 100%; margin-top: 12px; padding: 12px 16px;
    border-radius: 12px; border: 1px solid rgba(34,211,238,0.45);
    background: rgba(34,211,238,0.08); color: var(--cyan);
    font-family: Inter, sans-serif; font-weight: 600; font-size: 0.95rem;
    text-decoration: none; text-align: center;
  }
  .wa:hover { background: rgba(34,211,238,0.16); }
  .err {
    display: none; margin-top: 12px; padding: 10px 12px; border-radius: 10px;
    background: rgba(255,78,69,0.15); border: 1px solid rgba(255,78,69,0.4);
    color: #ffb4ae; font-size: 0.9rem;
  }
  .err.show { display: block; }
  .hint { margin-top: 16px; font-size: 0.78rem; color: rgba(242,235,215,0.5); }
</style>
</head>
<body>
  <div class="card">
    <h1>Ball Arena</h1>
    <p class="sub">ACESSO RESTRITO</p>
    <p>Digite a senha para abrir o overlay. Quem ainda não tem acesso, peça no WhatsApp.</p>
    <form id="gateForm" autocomplete="current-password">
      <label for="password">Senha</label>
      <input id="password" name="password" type="password" required autofocus placeholder="••••••••"/>
      <input type="hidden" id="next" name="next" value="${nextAttr}"/>
      <button class="btn" type="submit">ENTRAR</button>
    </form>
    <a class="wa" href="${WHATSAPP_ACCESS_URL}" target="_blank" rel="noopener">Pedir acesso no WhatsApp</a>
    <div id="err" class="err">Senha incorreta. Peça acesso no WhatsApp se precisar.</div>
    <p class="hint">OBS: após desbloquear uma vez, o cookie fica salvo. Use a mesma origem do Browser Source.</p>
  </div>
<script>
(function () {
  var form = document.getElementById('gateForm');
  var err = document.getElementById('err');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.classList.remove('show');
    var password = document.getElementById('password').value;
    var next = document.getElementById('next').value || '/overlay';
    fetch('/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: password, next: next })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.redirect) {
          window.location.href = res.j.redirect;
          return;
        }
        err.classList.add('show');
      }).catch(function () { err.classList.add('show'); });
  });
})();
</script>
</body>
</html>`;
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

export function createAccessRouter(): RequestHandler {
  const handler: RequestHandler = (req, res, next) => {
    if (req.path !== '/access') return next();

    if (req.method === 'GET') {
      const nextPath = safeNext(req.query.next);
      const file = path.join(__dirname, '../public/access.html');
      if (fs.existsSync(file)) {
        // Static file has placeholders; prefer inline with next baked in
        res.type('html').send(gateHtml(nextPath));
        return;
      }
      res.type('html').send(gateHtml(nextPath));
      return;
    }

    if (req.method === 'POST') {
      const pwd = getAccessPassword();
      if (!pwd) {
        setAccessCookie(res);
        res.json({ ok: true, redirect: safeNext((req.body as { next?: string })?.next) });
        return;
      }
      const body = (req.body || {}) as { password?: string; next?: string };
      if (typeof body.password === 'string' && body.password === pwd) {
        setAccessCookie(res);
        res.json({ ok: true, redirect: safeNext(body.next) });
        return;
      }
      res.status(401).json({ ok: false, error: 'invalid' });
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
  if (!pwd) return next();
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
