import { Router } from 'express';
import { query } from '../db.js';
import { analyze } from '../analyze.js';

export function chatsRouter() {
  const r = Router();

  r.get('/', async (req, res) => {
    try {
      let sql = 'SELECT id, filename, person_id, area_id, analysis, created_at FROM chats WHERE 1=1';
      const params: unknown[] = [];
      if (req.query.person_id) {
        params.push(req.query.person_id);
        sql += ` AND person_id = $${params.length}`;
      }
      if (req.query.area_id) {
        params.push(req.query.area_id);
        sql += ` AND area_id = $${params.length}`;
      }
      sql += ' ORDER BY created_at DESC';
      const { rows } = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /* ---- análisis conjunto (bulk) ---- */

  r.get('/bulk', async (req, res) => {
    try {
      let sql = 'SELECT * FROM bulk_analyses WHERE 1=1';
      const params: unknown[] = [];
      if (req.query.person_id) {
        params.push(req.query.person_id);
        sql += ` AND person_id = $${params.length}`;
      }
      sql += ' ORDER BY created_at DESC';
      const { rows } = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/bulk-analyze', async (req, res) => {
    const ids: number[] = Array.isArray(req.body?.chat_ids) ? req.body.chat_ids.map(Number) : [];
    const label = (req.body?.label ?? '').toString().trim();
    if (ids.length < 2) return res.status(400).json({ error: 'selecciona al menos 2 chats' });
    try {
      const { rows: chats } = await query(
        'SELECT id, filename, raw_text, person_id, area_id FROM chats WHERE id = ANY($1) ORDER BY created_at',
        [ids],
      );
      if (chats.length < 2) return res.status(404).json({ error: 'chats no encontrados' });
      const combined = chats
        .map((c: any) => `## Chat: ${c.filename}\n${c.raw_text}`)
        .join('\n\n----------------\n\n');
      const analysis = await analyze(combined);
      const { rows } = await query(
        'INSERT INTO bulk_analyses (person_id, area_id, chat_ids, label, analysis) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [chats[0].person_id, chats[0].area_id, ids, label || `Conjunto (${chats.length} chats)`, analysis],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      console.error('bulk-analyze error:', e.message);
      res.status(502).json({ error: e.message });
    }
  });

  r.patch('/bulk/:id', async (req, res) => {
    const label = (req.body?.label ?? '').toString().trim();
    if (!label) return res.status(400).json({ error: 'label requerido' });
    try {
      const { rows } = await query('UPDATE bulk_analyses SET label = $1 WHERE id = $2 RETURNING *', [label, req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'no encontrado' });
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.delete('/bulk/:id', async (req, res) => {
    try {
      await query('DELETE FROM bulk_analyses WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.get('/:id', async (req, res) => {
    try {
      const { rows } = await query('SELECT * FROM chats WHERE id = $1', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'chat no encontrado' });
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/', async (req, res) => {
    const { filename, text, person_id, area_id } = req.body ?? {};
    if (!text || !person_id || !area_id || !filename) {
      return res.status(400).json({ error: 'filename, text, person_id y area_id son requeridos' });
    }
    try {
      const { rows } = await query(
        'INSERT INTO chats (filename, raw_text, person_id, area_id) VALUES ($1, $2, $3, $4) RETURNING id, filename, person_id, area_id, created_at',
        [filename, String(text), person_id, area_id],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/:id/analyze', async (req, res) => {
    try {
      const { rows } = await query('SELECT id, raw_text FROM chats WHERE id = $1', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'chat no encontrado' });
      const chat = rows[0];
      const analysis = await analyze(chat.raw_text);
      await query('UPDATE chats SET analysis = $1 WHERE id = $2', [analysis, chat.id]);
      res.json({ analysis });
    } catch (e: any) {
      console.error('analyze error:', e.message);
      res.status(502).json({ error: e.message });
    }
  });

  r.patch('/:id', async (req, res) => {
    const filename = (req.body?.filename ?? '').toString().trim();
    if (!filename) return res.status(400).json({ error: 'filename requerido' });
    try {
      const { rows } = await query(
        'UPDATE chats SET filename = $1 WHERE id = $2 RETURNING id, filename',
        [filename, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'chat no encontrado' });
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.delete('/:id', async (req, res) => {
    try {
      await query('DELETE FROM chats WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return r;
}
