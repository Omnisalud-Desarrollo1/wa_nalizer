export function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let inPara = false;

  const closeList = () => {
    if (inList) { out.push(`</${inList}>`); inList = null; }
  };
  const closePara = () => {
    if (inPara) { out.push('</p>'); inPara = false; }
  };

  const inline = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

  for (const line of lines) {
    // headings
    const h = line.match(/^(#{1,4})\s+(.+)/);
    if (h) {
      closeList(); closePara();
      const level = h[1].length + 1; // # → h2, ## → h3
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    // hr
    if (/^[-*_]{3,}\s*$/.test(line)) {
      closeList(); closePara();
      out.push('<hr>');
      continue;
    }

    // unordered list
    const ul = line.match(/^[-*]\s+(.+)/);
    if (ul) {
      closePara();
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    // ordered list
    const ol = line.match(/^\d+\.\s+(.+)/);
    if (ol) {
      closePara();
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    // blank line — close blocks
    if (!line.trim()) {
      closeList(); closePara();
      continue;
    }

    // regular paragraph text
    if (!inPara) { out.push('<p>'); inPara = true; }
    else out.push('<br>');
    out.push(inline(line));
  }

  closeList(); closePara();
  return out.join('\n');
}
