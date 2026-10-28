// Chats de grupo empresarial: identifica a cada remitente contra el directorio del cliente y arma el contexto del prompt.
// Regla: quien está en el directorio es CLIENTE; cualquier otro remitente es nuestro EQUIPO.

export interface Contact {
  name: string;
  role: string;
  phone: string;
}

export interface SenderInfo {
  side: 'client' | 'team';
  label: string; // como se muestra en la UI
}

// Encabezado de mensaje de un export de WhatsApp ("24/7/2026, 4:26 p. m. - Remitente: texto" o "[24/7/26 16:26:00] Remitente: texto").
// Mismo criterio que frontend/src/app/chat-parser.ts.
const HEADER_RE = /^([\[\(]?[\d\/\-.,\s]+[\d:]{4,}[apmAPM.\s]*[\])]?\s*[-–—]\s*)(.+)$/;
const BRACKET_RE = /^(\[[\d\/\-.,\s]+\d{1,2}:\d{2}:\d{2}[,\s]*\]\s*)(.+)$/;

// WhatsApp envuelve números en marcas de dirección invisibles (U+202A/U+202C/U+200E…).
const INVISIBLE_RE = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export const phoneKey = (s: string) => s.replace(/\D/g, '').slice(-10);

const nameKey = (s: string) =>
  s.replace(INVISIBLE_RE, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function splitHeader(line: string): { prefix: string; sender: string; body: string } | null {
  const m = line.match(HEADER_RE) ?? line.match(BRACKET_RE);
  if (!m) return null;
  const colon = m[2].indexOf(': ');
  if (colon <= 0) return null; // mensajes de sistema ("X añadió a Y") no tienen remitente
  return { prefix: m[1], sender: m[2].slice(0, colon), body: m[2].slice(colon + 2) };
}

function makeResolver(contacts: Contact[]) {
  const byPhone = new Map(contacts.map((c) => [phoneKey(c.phone), c]));
  const byName = new Map(contacts.map((c) => [nameKey(c.name), c]));
  return (sender: string): SenderInfo => {
    const clean = sender.replace(INVISIBLE_RE, '').trim();
    const digits = clean.replace(/[\s+\-()]/g, '');
    const contact = /^\d{7,}$/.test(digits) ? byPhone.get(phoneKey(digits)) : byName.get(nameKey(clean));
    if (contact) return { side: 'client', label: contact.role ? `${contact.name} (${contact.role})` : contact.name };
    return { side: 'team', label: clean };
  };
}

// Remitentes distintos del chat con su clasificación, para mostrarlos en la UI.
export function detectSenders(raw: string, contacts: Contact[]): Record<string, SenderInfo> {
  const resolve = makeResolver(contacts);
  const out: Record<string, SenderInfo> = {};
  for (const line of raw.split('\n')) {
    const h = splitHeader(line);
    if (h && !(h.sender in out)) out[h.sender] = resolve(h.sender);
  }
  return out;
}

// Reescribe cada encabezado con la etiqueta del remitente, para que el modelo sepa quién es quién en cada fragmento.
export function labelGroupChat(raw: string, contacts: Contact[]): string {
  const resolve = makeResolver(contacts);
  const cache = new Map<string, string>();
  return raw
    .split('\n')
    .map((line) => {
      const h = splitHeader(line);
      if (!h) return line;
      let tag = cache.get(h.sender);
      if (!tag) {
        const s = resolve(h.sender);
        tag = s.side === 'client' ? `[CLIENTE] ${s.label}` : `[EQUIPO] ${s.label}`;
        cache.set(h.sender, tag);
      }
      return `${h.prefix}${tag}: ${h.body}`;
    })
    .join('\n');
}

function contextBlock(company: string, context: string, contacts: Contact[]): string {
  const directory = contacts.map((c) => `- ${c.name}${c.role ? ` — ${c.role}` : ''}`).join('\n');
  return `
# Contexto del grupo

Cliente empresarial: ${company}
Propósito del grupo: ${context || 'No especificado.'}

Cada mensaje viene etiquetado:
- [CLIENTE] Nombre (Cargo): persona de ${company}, según el directorio de abajo.
- [EQUIPO] Nombre o número: integrante de NUESTRO equipo de servicio, que es quien se evalúa.

Directorio de participantes del cliente (nombre — cargo):
${directory || '- (sin directorio cargado)'}

Ten en cuenta el cargo: solicitudes y quejas de jefes y líderes tienen mayor impacto en la relación con el cliente.
Si por el contenido un remitente [EQUIPO] parece ser realmente del cliente (o al revés), indícalo explícitamente.
`;
}

// Prompts editables (vienen de la DB) + bloque de contexto fijo, que depende de cómo labelGroupChat etiqueta los mensajes.
export function groupPrompts(
  prompts: { system: string; map: string },
  company: string,
  context: string,
  contacts: Contact[],
) {
  const ctx = contextBlock(company, context, contacts);
  return { system: `${prompts.system}\n${ctx}`, map: `${prompts.map}\n${ctx}` };
}
