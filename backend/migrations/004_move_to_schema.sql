-- Mueve las tablas de la app de public a un schema propio que NO expone la Data API de Supabase,
-- así el advisor deja de marcar "RLS disabled in public". Ejecutar en Supabase SQL Editor.
-- ALTER TABLE ... SET SCHEMA arrastra índices, constraints, FKs y las secuencias de los SERIAL; los datos no se copian.
-- Desplegar el backend con DB_SCHEMA=wa_nalizer justo después: la versión vieja busca las tablas en public.
BEGIN;

CREATE SCHEMA IF NOT EXISTS wa_nalizer;

ALTER TABLE public.areas         SET SCHEMA wa_nalizer;
ALTER TABLE public.people        SET SCHEMA wa_nalizer;
ALTER TABLE public.chats         SET SCHEMA wa_nalizer;
ALTER TABLE public.bulk_analyses SET SCHEMA wa_nalizer;

-- Nadie fuera del backend (rol postgres, dueño de las tablas) debe poder tocarlas vía anon/authenticated.
REVOKE ALL ON SCHEMA wa_nalizer FROM anon, authenticated, public;
REVOKE ALL ON ALL TABLES IN SCHEMA wa_nalizer FROM anon, authenticated, public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA wa_nalizer FROM anon, authenticated, public;

-- Defensa extra: RLS sin políticas = denegado para todo rol que no sea dueño/superusuario. El backend no se ve afectado.
ALTER TABLE wa_nalizer.areas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_nalizer.people        ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_nalizer.chats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_nalizer.bulk_analyses ENABLE ROW LEVEL SECURITY;

COMMIT;
