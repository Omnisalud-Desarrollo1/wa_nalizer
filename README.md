# wa_nalizer

Analiza un historial de chat (.txt) completo con IA vía OpenRouter y muestra insights.

- **frontend/** — SPA Angular de una vista (Vercel).
- **backend/** — API Express + TypeScript, map-reduce por chunks (Render).

## Local

Backend:
```bash
cd backend
cp .env.example .env      # pon tu OPENROUTER_API_KEY
npm install
npm run selfcheck         # test de la lógica de chunking
npm start                 # http://localhost:3000
```

Frontend:
```bash
cd frontend
npm install
npm start                 # http://localhost:4200
```
`src/environments/environment.ts` -> `backendUrl` ya apunta a localhost:3000.

## Deploy backend (Render)

Nuevo **Web Service** desde el repo, root `backend/`:
- Build: `npm install`
- Start: `npm start`
- Env vars: `OPENROUTER_API_KEY` (y opcional `OPENROUTER_MODEL`, `OPENROUTER_REASONING_EFFORT`), `APP_USERNAME`/`APP_PASSWORD` (admin), `ROOT_USERNAME`/`ROOT_PASSWORD` (root: configura propósito y prompts de los grupos), `AUTH_SECRET`, `DB_*` + `DB_SCHEMA` (default `wa_nalizer`), `ALLOWED_ORIGIN` con tu dominio de Vercel, `CHUNK_CHARS`, `MAX_CHUNKS`.
- Base de datos: ejecutar en orden los `.sql` de `backend/migrations/` en el SQL Editor de Supabase (`004` mueve las tablas al schema `wa_nalizer`, `005` crea los grupos empresariales).
- En OpenRouter, el guardrail "Sensitive Info" del workspace debe estar desactivado: si redacta nombres y teléfonos, la IA no puede saber quién escribe cada mensaje.

## Deploy frontend (Vercel)

1. Edita `frontend/src/environments/environment.ts` -> `backendUrl` con la URL de Render.
2. Proyecto en Vercel, root `frontend/`. Detecta Angular solo:
   - Build: `npm run build`
   - Output: `dist/frontend/browser`
