import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

// Login mínimo: un único usuario/contraseña por env. El token es "<expiración>.<HMAC>", sin estado en DB.
const { APP_USERNAME, APP_PASSWORD, AUTH_SECRET } = process.env;

if (!APP_USERNAME || !APP_PASSWORD || !AUTH_SECRET) {
  console.error('Falta APP_USERNAME, APP_PASSWORD o AUTH_SECRET en .env');
  process.exit(1);
}

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sign = (exp: string) => createHmac('sha256', AUTH_SECRET).update(exp).digest('base64url');

const safeEqual = (a: string, b: string) => {
  const ha = createHmac('sha256', AUTH_SECRET).update(a).digest();
  const hb = createHmac('sha256', AUTH_SECRET).update(b).digest();
  return timingSafeEqual(ha, hb);
};

export const login: RequestHandler = (req, res) => {
  const { username, password } = req.body ?? {};
  const userOk = safeEqual(String(username ?? ''), APP_USERNAME);
  const passOk = safeEqual(String(password ?? ''), APP_PASSWORD);
  if (!userOk || !passOk) return void res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const exp = String(Date.now() + TOKEN_TTL_MS);
  res.json({ token: `${exp}.${sign(exp)}` });
};

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
  const [exp, sig] = token.split('.');
  if (exp && sig && safeEqual(sig, sign(exp)) && Number(exp) > Date.now()) return next();
  res.status(401).json({ error: 'Sesión expirada, vuelve a iniciar sesión' });
};
