-- Análisis conjunto de varios chats. Ejecutar en Supabase/psql.
CREATE TABLE IF NOT EXISTS bulk_analyses (
  id         serial PRIMARY KEY,
  person_id  int NOT NULL,
  area_id    int NOT NULL,
  chat_ids   int[] NOT NULL,          -- chats que entraron al análisis
  label      text NOT NULL,
  analysis   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bulk_analyses_person_idx ON bulk_analyses (person_id);
