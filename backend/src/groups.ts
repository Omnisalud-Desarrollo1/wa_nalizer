// Chats de grupo empresarial: identifica a cada remitente (cliente o nuestro equipo) y arma el contexto del prompt.
// Orden de reglas: corrección manual → teléfono del directorio → nombre del directorio → nombre de la empresa → equipo.

export interface Contact {
  name: string;
  role: string;
  phone: string;
}

export type Side = 'client' | 'team';

export interface Directory {
  company: string;
  contacts: Contact[];
  overrides: Record<string, Side>; // remitente (senderKey) → lado, corregido a mano en la UI
}

export interface SenderInfo {
  side: Side;
  label: string; // como se muestra en la UI y se le pasa a la IA
  reason: 'manual' | 'phone' | 'name' | 'company' | 'default';
}

// Encabezado de mensaje de un export de WhatsApp ("24/7/2026, 4:26 p. m. - Remitente: texto" o "[24/7/26 16:26:00] Remitente: texto").
// Mismo criterio que frontend/src/app/chat-parser.ts.
const HEADER_RE = /^([\[\(]?[\d\/\-.,\s]+[\d:]{4,}[apmAPM.\s]*[\])]?\s*[-–—]\s*)(.+)$/;
// iOS: "[9/23/26, 2:03:41 PM] Remitente: texto" (AM/PM opcional, a veces con espacio angosto U+202F y U+200E al inicio)
const BRACKET_RE = /^(\u200e?\[[\d\/\-.,\s]+\d{1,2}:\d{2}(?::\d{2})?[\s\u202f\u00a0]*(?:[aApP]\.?\s*[mM]\.?)?\]\s*)(.+)$/;

// WhatsApp envuelve números en marcas de dirección invisibles (U+202A/U+202C/U+200E…).
const INVISIBLE_RE = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export const phoneKey = (s: string) => s.replace(/\D/g, '').slice(-10);

// Clave estable de un remitente tal como viene en el export (sin marcas invisibles); es la que guarda la corrección manual.
export const senderKey = (s: string) => s.replace(INVISIBLE_RE, '').trim();

// Palabras sin tildes ni signos: "TIENDAS ISIMO Wendy Echavarría" → ["tiendas","isimo","wendy","echavarria"]
const words = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9ñ]+/).filter(Boolean);

const containsAll = (haystack: Set<string>, needle: string[]) => needle.length > 0 && needle.every((w) => haystack.has(w));

function splitHeader(line: string): { prefix: string; sender: string; body: string } | null {
  const m = line.match(HEADER_RE) ?? line.match(BRACKET_RE);
  if (!m) return null;
  const colon = m[2].indexOf(': ');
  if (colon <= 0) return null; // mensajes de sistema ("X añadió a Y") no tienen remitente
  return { prefix: m[1], sender: m[2].slice(0, colon), body: m[2].slice(colon + 2) };
}

function makeResolver({ company, contacts, overrides }: Directory) {
  const byPhone = new Map(contacts.map((c) => [phoneKey(c.phone), c]));
  const contactWords = contacts.map((c) => ({ contact: c, words: words(c.name) }));
  const companyWords = words(company);
  const withRole = (base: string, c: Contact) => (c.role ? `${base} (${c.role})` : base);

  return (sender: string): SenderInfo => {
    const clean = senderKey(sender);
    const manual = overrides[clean];
    // los contactos guardados por número llegan como "+57 314 4342678"
    const isPhone = /^\+?[\d\s\-()]{7,}$/.test(clean);
    const byNumber = isPhone ? byPhone.get(phoneKey(clean)) : undefined;
    if (manual) {
      return { side: manual, label: byNumber ? withRole(byNumber.name, byNumber) : clean, reason: 'manual' };
    }
    if (byNumber) return { side: 'client', label: withRole(byNumber.name, byNumber), reason: 'phone' };
    if (isPhone) return { side: 'team', label: clean, reason: 'default' };

    // contactos guardados por nombre: "Wendy Echavarria" dentro de "TIENDAS ISIMO Wendy Echavarría"
    const senderWords = new Set(words(clean));
    const byName = contactWords.find((c) => containsAll(senderWords, c.words))?.contact;
    if (byName) return { side: 'client', label: withRole(clean, byName), reason: 'name' };
    if (containsAll(senderWords, companyWords)) return { side: 'client', label: clean, reason: 'company' };
    return { side: 'team', label: clean, reason: 'default' };
  };
}

// Remitentes distintos del chat (por senderKey) con su clasificación, para mostrarlos en la UI.
export function detectSenders(raw: string, directory: Directory): Record<string, SenderInfo> {
  const resolve = makeResolver(directory);
  const out: Record<string, SenderInfo> = {};
  for (const line of raw.split('\n')) {
    const h = splitHeader(line);
    if (h && !(senderKey(h.sender) in out)) out[senderKey(h.sender)] = resolve(h.sender);
  }
  return out;
}

// Reescribe cada encabezado con la etiqueta del remitente, para que el modelo sepa quién es quién en cada fragmento.
export function labelGroupChat(raw: string, directory: Directory): string {
  const resolve = makeResolver(directory);
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
- "Tú" es la persona de nuestro equipo que exportó el chat.

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
