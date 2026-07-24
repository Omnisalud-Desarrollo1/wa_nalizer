import express from 'express';
import cors from 'cors';
import { areasRouter } from './routes/areas.js';
import { peopleRouter } from './routes/people.js';
import { chatsRouter } from './routes/chats.js';

const { ALLOWED_ORIGIN = '*', PORT = '3000' } = process.env;

export const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '25mb' }));

app.get('/', (_req, res) => res.json({ ok: true }));

app.use('/api/areas', areasRouter());
app.use('/api/areas/:areaId/people', peopleRouter());
app.use('/api/chats', chatsRouter());

if (!process.env.VERCEL) {
  app.listen(Number(PORT), () => console.log(`wa_nalizer backend on :${PORT}`));
}
