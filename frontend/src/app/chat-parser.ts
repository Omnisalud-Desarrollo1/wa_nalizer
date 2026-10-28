export interface Message {
  sender: string;
  content: string;
  time: string;
  side: 'me' | 'other';
}

// Matches any line that looks like a WhatsApp message header:
//   01/01/2024, 10:30 - Sender: msg
//   1/1/24, 10:30 AM - Sender: msg
//   [01/01/2024 10:30:00] Sender: msg
//   [01/01/2024, 10:30:00] Sender: msg
//   2024-01-01, 10:30 - Sender: msg
// Generic: starts with a date-like pattern, has time, then separator
const HEADER_RE = /^[\[\(]?[\d\/\-.,\s]+[\d:]{4,}[apmAPM.\s]*[\])]?\s*[-–—]\s*(.+)$/;
const BRACKET_RE = /^\u200e?\[[\d\/\-.,\s]+\d{1,2}:\d{2}(?::\d{2})?[\s\u202f\u00a0]*(?:[aApP]\.?\s*[mM]\.?)?\]\s*(.+)$/;
const TIME_RE = /(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[aApP]\s*\.?\s*[mM]\s*\.?)?)/;

function extractTime(line: string): string {
  const m = line.match(TIME_RE);
  return m ? m[1].trim() : '';
}

// isMe decide qué remitentes van a la derecha (asesor en chats 1-1, nuestro equipo en grupos).
export function parseChat(raw: string, isMe: (sender: string) => boolean): Message[] {
  if (!raw) return [];
  const lines = raw.split('\n');
  const msgs: Message[] = [];
  let current: { sender: string; time: string; content: string[] } | null = null;

  const flush = () => {
    if (current) {
      const content = current.content.join('\n').trim();
      if (content) {
        msgs.push({
          sender: current.sender,
          time: current.time,
          content,
          side: current.sender && isMe(current.sender) ? 'me' : 'other',
        });
      }
      current = null;
    }
  };

  for (const line of lines) {
    let rest: string | undefined;
    let time: string;

    const m1 = line.match(HEADER_RE);
    if (m1) {
      rest = m1[1];
    } else {
      const m2 = line.match(BRACKET_RE);
      if (m2) {
        rest = m2[1];
      }
    }

    if (rest) {
      flush();
      time = extractTime(line);
      const colon = rest.indexOf(': ');
      if (colon > 0) {
        current = { sender: rest.slice(0, colon).trim(), time, content: [rest.slice(colon + 2)] };
      } else {
        current = { sender: '', time, content: [rest] };
      }
    } else if (current && line.trim()) {
      current.content.push(line);
    }
  }
  flush();
  return msgs;
}
