const {
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL = 'openai/gpt-oss-20b:free',
  CHUNK_CHARS = '40000',
  MAX_CHUNKS = '40',
} = process.env;

const chunkChars = Number(CHUNK_CHARS);
const maxChunks = Number(MAX_CHUNKS);

const SYSTEM_PROMPT = `Eres un analista de conversaciones. Recibirás el export de un chat (por ejemplo de WhatsApp).
Devuelve insights claros y accionables en español y en formato Markdown:
- Participantes y quién escribe más
- Temas principales
- Tono y sentimiento general
- Patrones (horarios, frecuencia, quién inicia)
- Momentos o citas destacadas
- Observaciones interesantes o inesperadas
responde de la manera mas objetiva, concisa, resumida y estructurada posible.`;

const MAP_PROMPT = `Extrae notas estructuradas y breves de este FRAGMENTO de un chat más grande:
participantes y nº aproximado de mensajes por persona, temas, tono, citas destacadas y rango temporal.
No concluyas todavía; solo extrae datos.`;

function chunkByLines(text: string, size: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let buf = '';
  for (const line of lines) {
    if (buf.length + line.length + 1 > size && buf) {
      chunks.push(buf);
      buf = '';
    }
    buf += line + '\n';
  }
  if (buf) chunks.push(buf);
  return chunks;
}

async function ask(system: string, user: string, maxRetries = 3): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`OpenRouter ${res.status}: ${await res.text().catch(() => '')}`);
        throw lastErr;
      }
      if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    } catch (e) {
      lastErr = e;
      if (attempt === maxRetries) break;
      const delay = Math.pow(2, attempt) * 1000;
      console.error(`ask attempt ${attempt + 1} failed, retrying in ${delay}ms: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function analyze(text: string): Promise<string> {
  let chunks = chunkByLines(text, chunkChars);
  let capped = false;
  if (chunks.length > maxChunks) {
    chunks = chunks.slice(0, maxChunks);
    capped = true;
  }

  if (chunks.length <= 1) return ask(SYSTEM_PROMPT, text);

  const notes: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    notes.push(`### Fragmento ${i + 1}\n` + (await ask(MAP_PROMPT, chunks[i])));
  }

  const reduceUser =
    'Notas de varios fragmentos del MISMO chat, en orden. Combínalas en un análisis final coherente:\n\n' +
    notes.join('\n\n') +
    (capped ? '\n\n(Nota: el chat era muy largo y se analizó una parte.)' : '');
  return ask(SYSTEM_PROMPT, reduceUser);
}
