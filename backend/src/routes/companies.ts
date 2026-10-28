import { Router, type Response } from 'express';
import { query } from '../db.js';
import { analyze } from '../analyze.js';
import { detectSenders, groupPrompts, labelGroupChat, senderKey, type Contact, type Directory, type Side } from '../groups.js';
import { requireRoot } from '../auth.js';

function fail(res: Response, e: unknown) {
  const duplicate = e instanceof Error && 'code' in e && e.code === '23505';
  res.status(duplicate ? 409 : 500).json({ error: e instanceof Error ? e.message : String(e) });
}

const loadContacts = async (companyId: string | number): Promise<Contact[]> =>
  (await query('SELECT name, role, phone FROM company_contacts WHERE company_id = $1 ORDER BY name', [companyId])).rows;

async function loadDirectory(companyId: string | number, company: string): Promise<Directory> {
  const [contacts, senders] = await Promise.all([
    loadContacts(companyId),
    query('SELECT sender, side FROM company_senders WHERE company_id = $1', [companyId]),
  ]);
  const overrides: Record<string, Side> = Object.fromEntries(senders.rows.map((r) => [r.sender, r.side]));
  return { company, contacts, overrides };
}

async function loadDefaultPrompts(): Promise<{ system: string; map: string }> {
  const { rows } = await query(
    "SELECT key, value FROM settings WHERE key IN ('group_system_prompt', 'group_map_prompt')",
  );
  const get = (key: string) => rows.find((row) => row.key === key)?.value ?? '';
  return { system: get('group_system_prompt'), map: get('group_map_prompt') };
}

export function companiesRouter() {
  const r = Router();

  /* ---- prompt por defecto de grupos (tabla settings) ---- */

  r.get('/prompts', requireRoot, async (_req, res) => {
    try {
      res.json(await loadDefaultPrompts());
    } catch (e) {
      fail(res, e);
    }
  });

  r.put('/prompts', requireRoot, async (req, res) => {
    const system = String(req.body?.system ?? '').trim();
    const map = String(req.body?.map ?? '').trim();
    if (!system || !map) return res.status(400).json({ error: 'los dos prompts son requeridos' });
    try {
      await query(
        `INSERT INTO settings (key, value) VALUES ('group_system_prompt', $1), ('group_map_prompt', $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [system, map],
      );
      res.json({ system, map });
    } catch (e) {
      fail(res, e);
    }
  });

  /* ---- empresas ---- */

  r.get('/', async (_req, res) => {
    try {
      const { rows } = await query(
        `SELECT c.*,
           (SELECT COUNT(*)::int FROM company_contacts WHERE company_id = c.id) AS contact_count,
           (SELECT COUNT(*)::int FROM group_chats WHERE company_id = c.id) AS chat_count
         FROM companies c ORDER BY name`,
      );
      res.json(rows);
    } catch (e) {
      fail(res, e);
    }
  });

  r.post('/', async (req, res) => {
    const name = (req.body?.name ?? '').toString().trim();
    if (!name) return res.status(400).json({ error: 'name requerido' });
    try {
      const { rows } = await query('INSERT INTO companies (name, context) VALUES ($1, $2) RETURNING *', [
        name,
        (req.body?.context ?? '').toString().trim(),
      ]);
      res.status(201).json(rows[0]);
    } catch (e) {
      fail(res, e);
    }
  });

  // Solo root. Actualiza los campos presentes. system_prompt/map_prompt vacíos o null = volver al prompt por defecto.
  r.patch('/:id', requireRoot, async (req, res) => {
    const body = req.body ?? {};
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const field of ['name', 'context', 'system_prompt', 'map_prompt'] as const) {
      if (body[field] === undefined) continue;
      const value = body[field] === null ? '' : String(body[field]).trim();
      if (field === 'name' && !value) return res.status(400).json({ error: 'name no puede estar vacío' });
      params.push(field.endsWith('_prompt') && !value ? null : value);
      sets.push(`${field} = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'nada que actualizar' });
    params.push(req.params.id);
    try {
      const { rows } = await query(
        `UPDATE companies SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params,
      );
      if (!rows[0]) return res.status(404).json({ error: 'empresa no encontrada' });
      res.json(rows[0]);
    } catch (e) {
      fail(res, e);
    }
  });

  r.delete('/:id', async (req, res) => {
    try {
      await query('DELETE FROM companies WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (e) {
      fail(res, e);
    }
  });

  /* ---- directorio del cliente ---- */

  r.get('/:id/contacts', async (req, res) => {
    try {
      const { rows } = await query('SELECT * FROM company_contacts WHERE company_id = $1 ORDER BY name', [req.params.id]);
      res.json(rows);
    } catch (e) {
      fail(res, e);
    }
  });

  // Alta en lote (también sirve para uno). Si el teléfono ya existe en la empresa, actualiza nombre y cargo.
  r.post('/:id/contacts', async (req, res) => {
    const list: Record<string, unknown>[] = Array.isArray(req.body?.contacts) ? req.body.contacts : [];
    const contacts = list.map((c) => ({
      name: String(c?.name ?? '').trim(),
      role: String(c?.role ?? '').trim(),
      phone: String(c?.phone ?? '').replace(/\D/g, ''),
    }));
    const bad = contacts.find((c) => !c.name || c.phone.length < 7);
    if (!contacts.length || bad) {
      return res.status(400).json({ error: bad ? `contacto inválido: ${bad.name || '(sin nombre)'} ${bad.phone}` : 'contacts vacío' });
    }
    try {
      const { rows } = await query(
        `INSERT INTO company_contacts (company_id, name, role, phone)
         SELECT $1, x.name, x.role, x.phone FROM jsonb_to_recordset($2::jsonb) AS x(name text, role text, phone text)
         ON CONFLICT (company_id, phone) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
         RETURNING *`,
        [req.params.id, JSON.stringify(contacts)],
      );
      res.status(201).json(rows);
    } catch (e) {
      fail(res, e);
    }
  });

  r.patch('/:id/contacts/:contactId', async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const role = String(req.body?.role ?? '').trim();
    const phone = String(req.body?.phone ?? '').replace(/\D/g, '');
    if (!name || phone.length < 7) return res.status(400).json({ error: 'nombre y teléfono requeridos' });
    try {
      const { rows } = await query(
        'UPDATE company_contacts SET name = $1, role = $2, phone = $3 WHERE id = $4 AND company_id = $5 RETURNING *',
        [name, role, phone, req.params.contactId, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'contacto no encontrado' });
      res.json(rows[0]);
    } catch (e) {
      fail(res, e);
    }
  });

  r.delete('/:id/contacts/:contactId', async (req, res) => {
    try {
      await query('DELETE FROM company_contacts WHERE id = $1 AND company_id = $2', [req.params.contactId, req.params.id]);
      res.json({ ok: true });
    } catch (e) {
      fail(res, e);
    }
  });

  /* ---- corrección manual de remitentes ---- */

  // side 'client' | 'team' fija el lado; null lo devuelve a la clasificación automática.
  r.put('/:id/senders', async (req, res) => {
    const sender = senderKey(String(req.body?.sender ?? ''));
    const side = req.body?.side ?? null;
    if (!sender || (side !== null && side !== 'client' && side !== 'team')) {
      return res.status(400).json({ error: "sender requerido y side debe ser 'client', 'team' o null" });
    }
    try {
      if (side === null) {
        await query('DELETE FROM company_senders WHERE company_id = $1 AND sender = $2', [req.params.id, sender]);
      } else {
        await query(
          `INSERT INTO company_senders (company_id, sender, side) VALUES ($1, $2, $3)
           ON CONFLICT (company_id, sender) DO UPDATE SET side = EXCLUDED.side`,
          [req.params.id, sender, side],
        );
      }
      res.json({ ok: true });
    } catch (e) {
      fail(res, e);
    }
  });

  /* ---- chats de grupo ---- */

  r.get('/:id/chats', async (req, res) => {
    try {
      const { rows } = await query(
        `SELECT id, company_id, filename, analysis IS NOT NULL AS analyzed, created_at, LENGTH(raw_text) AS char_count
         FROM group_chats WHERE company_id = $1 ORDER BY created_at DESC`,
        [req.params.id],
      );
      res.json(rows);
    } catch (e) {
      fail(res, e);
    }
  });

  r.post('/:id/chats', async (req, res) => {
    const { filename, text } = req.body ?? {};
    if (!filename || !text) return res.status(400).json({ error: 'filename y text son requeridos' });
    try {
      const { rows } = await query(
        'INSERT INTO group_chats (company_id, filename, raw_text) VALUES ($1, $2, $3) RETURNING id, company_id, filename, created_at',
        [req.params.id, String(filename), String(text)],
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      fail(res, e);
    }
  });

  // Incluye la clasificación de remitentes (cliente/equipo) para que la UI la muestre sin duplicar la lógica.
  r.get('/:id/chats/:chatId', async (req, res) => {
    try {
      const { rows } = await query(
        `SELECT g.*, c.name AS company_name FROM group_chats g JOIN companies c ON c.id = g.company_id
         WHERE g.id = $1 AND g.company_id = $2`,
        [req.params.chatId, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'chat no encontrado' });
      const { company_name, ...chat } = rows[0];
      res.json({ ...chat, senders: detectSenders(chat.raw_text, await loadDirectory(req.params.id, company_name)) });
    } catch (e) {
      fail(res, e);
    }
  });

  r.patch('/:id/chats/:chatId', async (req, res) => {
    const filename = String(req.body?.filename ?? '').trim();
    if (!filename) return res.status(400).json({ error: 'filename requerido' });
    try {
      const { rows } = await query(
        'UPDATE group_chats SET filename = $1 WHERE id = $2 AND company_id = $3 RETURNING id, filename',
        [filename, req.params.chatId, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'chat no encontrado' });
      res.json(rows[0]);
    } catch (e) {
      fail(res, e);
    }
  });

  r.delete('/:id/chats/:chatId', async (req, res) => {
    try {
      await query('DELETE FROM group_chats WHERE id = $1 AND company_id = $2', [req.params.chatId, req.params.id]);
      res.json({ ok: true });
    } catch (e) {
      fail(res, e);
    }
  });

  r.post('/:id/chats/:chatId/analyze', async (req, res) => {
    try {
      const { rows } = await query(
        `SELECT g.id, g.raw_text, c.name, c.context, c.system_prompt, c.map_prompt
         FROM group_chats g JOIN companies c ON c.id = g.company_id
         WHERE g.id = $1 AND g.company_id = $2`,
        [req.params.chatId, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'chat no encontrado' });
      const { id, raw_text, name, context, system_prompt, map_prompt } = rows[0];
      const defaults = await loadDefaultPrompts();
      const base = { system: system_prompt ?? defaults.system, map: map_prompt ?? defaults.map };
      if (!base.system || !base.map) {
        return res.status(500).json({ error: 'Falta el prompt de grupos: configúralo en Grupos empresariales › Prompt por defecto' });
      }
      const directory = await loadDirectory(req.params.id, name);
      const prompts = groupPrompts(base, name, context, directory.contacts);
      console.log(
        `analyze group chat=${id} company=${name} contacts=${directory.contacts.length} ` +
          `overrides=${Object.keys(directory.overrides).length} ` +
          `customSystem=${system_prompt !== null} customMap=${map_prompt !== null}`,
      );
      const analysis = await analyze(labelGroupChat(raw_text, directory), prompts.system, prompts.map);
      await query('UPDATE group_chats SET analysis = $1 WHERE id = $2', [analysis, id]);
      res.json({ analysis });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('analyze group error:', message);
      res.status(502).json({ error: message });
    }
  });

  return r;
}
