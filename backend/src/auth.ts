import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

// Login mínimo con dos usuarios por env:
// - admin: uso diario (áreas, chats, directorio de clientes).
// - root: además configura grupos empresariales (propósito, prompts, nombre).
// El token es "<expiración>.<rol>.<HMAC>", sin estado en DB.
const { APP_USERNAME, APP_PASSWORD, ROOT_USERNAME, ROOT_PASSWORD, AUTH_SECRET } = process.env;

if (!APP_USERNAME || !APP_PASSWORD || !ROOT_USERNAME || !ROOT_PASSWORD || !AUTH_SECRET) {
  console.error('Falta APP_USERNAME, APP_PASSWORD, ROOT_USERNAME, ROOT_PASSWORD o AUTH_SECRET en .env');
  process.exit(1);
}

export type Role = 'admin' | 'root';

const USERS: { username: string; password: string; role: Role }[] = [
  { username: APP_USERNAME, password: APP_PASSWORD, role: 'admin' },
  { username: ROOT_USERNAME, password: ROOT_PASSWORD, role: 'root' },
];

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sign = (payload: string) => createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');

const safeEqual = (a: string, b: string) => {
  const ha = createHmac('sha256', AUTH_SECRET).update(a).digest();
  const hb = createHmac('sha256', AUTH_SECRET).update(b).digest();
  return timingSafeEqual(ha, hb);
};

export const login: RequestHandler = (req, res) => {
  const username = String(req.body?.username ?? '');
  const password = String(req.body?.password ?? '');
  // compara contra todos los usuarios (sin cortar antes) para no filtrar por tiempo cuál existe
  const matches = USERS.filter((u) => safeEqual(username, u.username) && safeEqual(password, u.password));
  if (!matches.length) return void res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const payload = `${Date.now() + TOKEN_TTL_MS}.${matches[0].role}`;
  res.json({ token: `${payload}.${sign(payload)}`, role: matches[0].role });
};

// Deja el rol en res.locals.role para requireRoot.
export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
  const [exp, role, sig] = token.split('.');
  if (exp && role && sig && safeEqual(sig, sign(`${exp}.${role}`)) && Number(exp) > Date.now()) {
    res.locals.role = role;
    return next();
  }
  res.status(401).json({ error: 'Sesión expirada, vuelve a iniciar sesión' });
};

export const requireRoot: RequestHandler = (_req, res, next) => {
  if (res.locals.role === 'root') return next();
  res.status(403).json({ error: 'Solo el usuario root puede cambiar esta configuración' });
};
