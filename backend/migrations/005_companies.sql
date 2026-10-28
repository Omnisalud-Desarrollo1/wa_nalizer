-- Grupos empresariales: chats de grupo de WhatsApp con un cliente empresarial.
-- El directorio (company_contacts) lista a los participantes DEL CLIENTE; cualquier otro remitente del grupo
-- se considera nuestro equipo. Ejecutar en Supabase SQL Editor.
BEGIN;
SET LOCAL search_path TO wa_nalizer;

CREATE TABLE IF NOT EXISTS companies (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  -- propósito del grupo; se inyecta en el prompt (ej. soporte postventa)
  context    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_contacts (
  id         SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL,              -- solo dígitos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, phone)
);

CREATE TABLE IF NOT EXISTS group_chats (
  id         SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  filename   TEXT NOT NULL,
  raw_text   TEXT NOT NULL,
  analysis   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS group_chats_company_idx ON group_chats (company_id);

REVOKE ALL ON companies, company_contacts, group_chats FROM anon, authenticated, public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA wa_nalizer FROM anon, authenticated, public;
ALTER TABLE companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chats      ENABLE ROW LEVEL SECURITY;

-- Primer grupo: Isimo
INSERT INTO companies (name, context) VALUES
  ('Isimo', 'Grupo de servicio postventa, soporte y servicio al cliente para la empresa Isimo.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO company_contacts (company_id, name, role, phone)
SELECT c.id, v.name, v.role, v.phone
FROM companies c, (VALUES
  ('Elder (Pointers)',  'Jefe SST',             '3144342678'),
  ('Wendy Echavarria',  'Líder',                '3142619410'),
  ('Claudia Señor',     'Costa',                '3234629160'),
  ('Mauricio Suarez',   'Bucaramanga / Líder',  '3144344279'),
  ('Brenda',            'Barranquilla Isimo',   '3017563687'),
  ('Kelly Villarraga',  'Isimo Analista',       '3143263791'),
  ('Talento Humano',    'Isimo Regional Sur',   '3144345075'),
  ('Analista Isimo 1',  'Analista',             '3215030445'),
  ('Analista Isimo 2',  'Analista',             '3144343669'),
  ('Analista Isimo 3',  'Analista',             '3197273214'),
  ('Analista Isimo 4',  'Analista',             '3159011453'),
  ('Analista Isimo 5',  'Analista',             '3003091697'),
  ('Analista Isimo 6',  'Analista',             '3166169407'),
  ('Analista Isimo 7',  'Analista',             '3029683351'),
  ('Analista Isimo 8',  'Analista',             '3184574250'),
  ('Analista Isimo 9',  'Analista',             '3046711725'),
  ('Analista Isimo 10', 'Analista',             '3124011955'),
  ('Analista Isimo 11', 'Analista',             '3144341978'),
  ('Analista Isimo 12', 'Analista',             '3144342516'),
  ('Analista Isimo 13', 'Analista',             '3144343735')
) AS v(name, role, phone)
WHERE c.name = 'Isimo'
ON CONFLICT (company_id, phone) DO NOTHING;

COMMIT;
