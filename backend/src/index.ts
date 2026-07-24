import express from "express";
import cors from "cors";

const {
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL = "openai/gpt-oss-20b:free",
  ALLOWED_ORIGIN = "*",
  PORT = "3000",
  CHUNK_CHARS = "40000",
  MAX_CHUNKS = "40",
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
Sé conciso pero específico.`;

const MAP_PROMPT = `Extrae notas estructuradas y breves de este FRAGMENTO de un chat más grande:
participantes y nº aproximado de mensajes por persona, temas, tono, citas destacadas y rango temporal.
No concluyas todavía; solo extrae datos.`;

// corta por líneas para no partir mensajes a la mitad
function chunkByLines(text: string, size: number): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let buf = "";
  for (const line of lines) {
    if (buf.length + line.length + 1 > size && buf) {
      chunks.push(buf);
      buf = "";
    }
    buf += line + "\n";
  }
  if (buf) chunks.push(buf);
  return chunks;
}

// ponytail: retry con backoff para modelos free que tiran ECONNRESET.
// Si el modelo es de pago, se puede bajar maxRetries o quitarlo.
async function ask(system: string, user: string, maxRetries = 3): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`OpenRouter ${res.status}: ${await res.text().catch(() => "")}`);
        throw lastErr;
      }
      if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      lastErr = e;
      if (attempt === maxRetries) break;
      const delay = Math.pow(2, attempt) * 1000;
      console.error(`ask attempt ${attempt + 1} failed, retrying in ${delay}ms: ${(e as Error).message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function analyze(text: string): Promise<string> {
  let chunks = chunkByLines(text, chunkChars);
  let capped = false;
  if (chunks.length > maxChunks) {
    chunks = chunks.slice(0, maxChunks);
    capped = true;
  }

  // caso pequeño: una sola pasada, mejor calidad
  if (chunks.length <= 1) return ask(SYSTEM_PROMPT, text);

  // ponytail: map secuencial para no reventar el rate limit del modelo free.
  // Para chats gigantes conviene paralelizar con límite o mover a un job/cola.
  const notes: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    notes.push(`### Fragmento ${i + 1}\n` + (await ask(MAP_PROMPT, chunks[i])));
  }

  const reduceUser =
    "Notas de varios fragmentos del MISMO chat, en orden. Combínalas en un análisis final coherente:\n\n" +
    notes.join("\n\n") +
    (capped ? "\n\n(Nota: el chat era muy largo y se analizó una parte.)" : "");
  return ask(SYSTEM_PROMPT, reduceUser);
}

if (process.argv.includes("--selfcheck")) {
  const t = Array.from({ length: 10 }, (_, i) => `linea ${i}`).join("\n");
  const c = chunkByLines(t, 20);
  console.assert(c.length > 1, "debe partir en varios chunks");
  console.assert(c.join("").replace(/\n/g, "") === t.replace(/\n/g, ""), "no debe perder contenido");
  console.log("selfcheck ok", c.length, "chunks");
  process.exit(0);
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: "25mb" }));

app.get("/", (_req, res) => res.json({ ok: true }));

app.post("/analyze", async (req, res) => {
  const text = (req.body?.text ?? "").toString();
  if (!text.trim()) return res.status(400).json({ error: "text vacío" });
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: "falta OPENROUTER_API_KEY" });
  try {
    res.json({ analysis: await analyze(text) });
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    console.error("analyze error:", err.message, err.cause);
    res.status(502).json({ error: err.message + (err.cause ? ` (${String(err.cause)})` : "") });
  }
});

app.listen(Number(PORT), () => console.log(`wa_nalizer backend on :${PORT}`));
