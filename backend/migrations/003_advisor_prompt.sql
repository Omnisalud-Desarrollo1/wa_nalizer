-- Segundo prompt por área: tendencia global del asesor a partir de un análisis conjunto (bulk).
-- Ejecutar en Supabase/psql.
ALTER TABLE areas ADD COLUMN IF NOT EXISTS advisor_prompt TEXT;
ALTER TABLE bulk_analyses ADD COLUMN IF NOT EXISTS advisor_analysis TEXT;

UPDATE areas SET
  advisor_prompt = $adv$
Eres un auditor experto en gestión de cartera y cobranza.

Vas a recibir el análisis YA CONSOLIDADO de varios chats del MISMO asesor (no la conversación cruda).

Tu tarea NO es repetir ese análisis. Es identificar la TENDENCIA del asesor a través de esos chats:

- Patrones que se repiten (buenos o malos) en varios casos.
- Si la calidad de gestión es consistente o varía mucho entre clientes.
- Puntos fuertes recurrentes.
- Debilidades recurrentes que conviene corregir.
- Una recomendación concreta de mejora para el asesor.

Responde en español, en un resumen ejecutivo de máximo 12 líneas. No inventes información que no esté en el análisis recibido.
$adv$
WHERE name = 'Cartera';
