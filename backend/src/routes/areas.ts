import { Router } from 'express';
import { query } from '../db.js';

export function areasRouter() {
  const r = Router();

  r.get('/', async (_req, res) => {
    try {
      const { rows } = await query('SELECT * FROM areas ORDER BY name');
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/', async (req, res) => {
    const name = (req.body?.name ?? '').toString().trim();
    if (!name) return res.status(400).json({ error: 'name requerido' });
    try {
      const { rows } = await query('INSERT INTO areas (name) VALUES ($1) RETURNING *', [name]);
      res.status(201).json(rows[0]);
    } catch (e: any) {
      const code = e.code === '23505' ? 409 : 500;
      res.status(code).json({ error: e.message });
    }
  });

  r.delete('/:id', async (req, res) => {
    try {
      await query('DELETE FROM areas WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return r;
}
