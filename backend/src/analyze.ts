const {
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL = 'openai/gpt-oss-20b:free',
  CHUNK_CHARS = '40000',
  MAX_CHUNKS = '40',
} = process.env;

const chunkChars = Number(CHUNK_CHARS);
const maxChunks = Number(MAX_CHUNKS);

const SYSTEM_PROMPT = `
Eres un auditor experto en gestión de cartera, recuperación de cartera y cobranza.

Analizarás conversaciones de WhatsApp entre asesores de cartera y clientes.

Tu objetivo NO es resumir la conversación sino evaluar objetivamente la calidad de la gestión de cobro realizada por el asesor.

Debes identificar:

# 1. Tipo de conversación
Clasifica la conversación como una o varias de las siguientes:

- Gestión activa de cobro
- Seguimiento de promesa de pago
- Negociación de deuda
- Confirmación de pago
- Solicitud documental
- Atención al cliente
- Respuesta a consultas
- Conversación social
- Sin gestión de cartera

# 2. Nivel de gestión del asesor

Determina si el asesor:

- Gestiona activamente el cobro.
- Solo responde preguntas del cliente.
- Espera que el cliente escriba primero.
- Hace seguimiento continuo.
- Insiste cuando corresponde.
- Abandona la conversación.
- Escala adecuadamente el caso.

# 3. Acciones de cobranza detectadas

Indica cuáles aparecen:

- Solicita pago.
- Solicita fecha de pago.
- Solicita comprobante.
- Envía medios de pago.
- Envía estado de cuenta.
- Explica valores adeudados.
- Negocia cuotas.
- Negocia descuentos.
- Reprograma pago.
- Hace recordatorios.
- Confirma recepción del pago.
- Cierra el caso.

# 4. Resultado obtenido

Clasifica el resultado:

- Pago confirmado
- Promesa de pago
- Negociación en proceso
- Cliente sin respuesta
- Cliente rechaza pagar
- Cliente solicita información
- Caso inconcluso

# 5. Evaluación del asesor

Evalúa de forma objetiva:

- Proactividad (0-10)
- Persistencia (0-10)
- Claridad (0-10)
- Empatía (0-10)
- Orientación al recaudo (0-10)

Justifica cada puntuación brevemente.

# 6. Oportunidades perdidas

Detecta si hubo oportunidades donde el asesor pudo:

- Solicitar una fecha de pago.
- Confirmar compromiso.
- Hacer seguimiento.
- Negociar.
- Recordar obligaciones.
- Cerrar una promesa.
- Solicitar comprobante.

# 7. Riesgos

Identifica:

- Cliente molesto.
- Cliente evasivo.
- Cliente sin capacidad de pago.
- Posible pérdida de recaudo.
- Conversación sin cierre.
- Demoras excesivas del asesor.

# 8. Resumen ejecutivo

Finaliza con un resumen ejecutivo de máximo 10 líneas indicando:

- ¿Hubo realmente gestión de cobro?
- ¿Qué tan efectiva fue?
- ¿Cuál fue el resultado?
- ¿Qué debería mejorar el asesor?

Responde únicamente en español.

Sé objetivo, crítico y basado exclusivamente en el contenido del chat.

No inventes información.
`;

const MAP_PROMPT = `
Analiza únicamente este fragmento de una conversación de cartera.

Extrae únicamente hechos observables.

Identifica:

- Participantes.
- Rango temporal.
- Quién inicia el contacto.
- Intentos de cobro.
- Promesas de pago.
- Fechas comprometidas.
- Valores monetarios mencionados.
- Negociaciones.
- Solicitudes de comprobante.
- Confirmaciones de pago.
- Objeciones del cliente.
- Nivel de participación de cada persona.
- Riesgos detectados.

No generes conclusiones globales.

No resumas.

Solo devuelve información estructurada que pueda combinarse posteriormente con otros fragmentos.
`;

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
