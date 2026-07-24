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
- Env vars: `OPENROUTER_API_KEY` (y opcional `OPENROUTER_MODEL`, `ALLOWED_ORIGIN` con tu dominio de Vercel, `CHUNK_CHARS`, `MAX_CHUNKS`).

## Deploy frontend (Vercel)

1. Edita `frontend/src/environments/environment.ts` -> `backendUrl` con la URL de Render.
2. Proyecto en Vercel, root `frontend/`. Detecta Angular solo:
   - Build: `npm run build`
   - Output: `dist/frontend/browser`
