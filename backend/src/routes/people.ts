import { Router } from 'express';
import { query } from '../db.js';

export function peopleRouter() {
  const r = Router({ mergeParams: true });

  r.get('/', async (req, res) => {
    try {
      const { rows } = await query('SELECT * FROM people WHERE area_id = $1 ORDER BY name', [req.params.areaId]);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/', async (req, res) => {
    const name = (req.body?.name ?? '').toString().trim();
    if (!name) return res.status(400).json({ error: 'name requerido' });
    try {
      const { rows } = await query(
        'INSERT INTO people (name, area_id) VALUES ($1, $2) RETURNING *',
        [name, req.params.areaId],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.delete('/:id', async (req, res) => {
    try {
      await query('DELETE FROM people WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return r;
}
