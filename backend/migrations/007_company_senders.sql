-- Corrección manual de remitentes de grupo: cómo aparece alguien en el export (nombre guardado o número)
-- → cliente o equipo. Se aplica a todos los chats de la empresa y gana sobre las reglas automáticas.
-- Ejecutar en Supabase SQL Editor.
BEGIN;
SET LOCAL search_path TO wa_nalizer;

CREATE TABLE IF NOT EXISTS company_senders (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL,
  side       TEXT NOT NULL CHECK (side IN ('client', 'team')),
  PRIMARY KEY (company_id, sender)
);
REVOKE ALL ON company_senders FROM anon, authenticated, public;
ALTER TABLE company_senders ENABLE ROW LEVEL SECURITY;

COMMIT;
