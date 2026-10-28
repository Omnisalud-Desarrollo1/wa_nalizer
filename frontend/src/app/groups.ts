import { Component, computed, inject, input, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { parseChat } from './chat-parser';
import { markdownToHtml } from './markdown';
import { authRole } from './auth';

interface Company {
  id: number;
  name: string;
  context: string;
  system_prompt: string | null; // null = usa el prompt por defecto
  map_prompt: string | null;
  contact_count: number;
  chat_count: number;
}
interface Contact {
  id: number;
  name: string;
  role: string;
  phone: string;
}
interface GroupChat {
  id: number;
  filename: string;
  analyzed: boolean;
  created_at: string;
  char_count: number;
}
type Side = 'client' | 'team';
interface SenderInfo {
  side: Side;
  label: string;
  reason: 'manual' | 'phone' | 'name' | 'company' | 'default';
}

// Misma clave que senderKey() del backend: el export envuelve números en marcas de dirección invisibles.
const senderKey = (s: string) => s.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim();

export const REASONS: Record<SenderInfo['reason'], string> = {
  manual: 'corregido a mano',
  phone: 'teléfono del directorio',
  name: 'nombre del directorio',
  company: 'contiene el nombre de la empresa',
  default: 'no está en el directorio',
};
interface GroupChatDetail {
  raw_text: string;
  analysis: string | null;
  senders: Record<string, SenderInfo>;
}
type NewContact = Omit<Contact, 'id'>;
interface Prompts {
  system: string;
  map: string;
}

const api = (path: string) => environment.backendUrl.replace(/\/$/, '') + path;
function errorMessage(e: unknown, fallback: string): string {
  const body: unknown = e instanceof HttpErrorResponse ? e.error : null;
  return body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : fallback;
}

// Convierte una tabla pegada (Excel/Sheets: tabs, o columnas separadas por 2+ espacios) en contactos.
// Columnas: Nombre, Cargo, Teléfono (el cargo es opcional). Las filas sin teléfono (p.ej. el encabezado) se ignoran.
function parseContactTable(text: string): NewContact[] {
  return text
    .split('\n')
    .map((line) => line.split(/\t| {2,}/).map((c) => c.trim()).filter(Boolean))
    .filter((cols) => cols.length >= 2 && /\d{7,}/.test(cols[cols.length - 1].replace(/\D/g, '')))
    .map((cols) => ({
      name: cols[0],
      role: cols.length >= 3 ? cols.slice(1, -1).join(' / ') : '',
      phone: cols[cols.length - 1].replace(/\D/g, ''),
    }));
}

@Component({
  selector: 'app-groups',
  imports: [DatePipe],
  templateUrl: './groups.html',
  // comparte los estilos base de la app (card, btn, list-item, chat…) bajo el encapsulado de este componente
  styleUrls: ['./app.css', './groups.css'],
})
export class Groups {
  private http = inject(HttpClient);

  isRoot = computed(() => authRole() === 'root');

  confirm = input.required<(message: string, fn: () => void) => void>();

  companies = signal<Company[]>([]);
  selected = signal<Company | null>(null);
  tab = signal<'chats' | 'config'>('chats');
  defaultPrompts = signal<Prompts>({ system: '', map: '' });
  hasCustomPrompt = computed(() => {
    const c = this.selected();
    return !!c && (c.system_prompt !== null || c.map_prompt !== null);
  });
  contacts = signal<Contact[]>([]);
  chats = signal<GroupChat[]>([]);

  openChat = signal<GroupChat | null>(null);
  chatDetail = signal<GroupChatDetail | null>(null);
  chatMode = signal<'chat' | 'analysis' | 'participants'>('chat');
  analysisHtml = computed(() => {
    const a = this.chatDetail()?.analysis;
    return a ? markdownToHtml(a) : '';
  });
  messages = computed(() => {
    const d = this.chatDetail();
    if (!d) return [];
    return parseChat(d.raw_text, (sender) => d.senders[senderKey(sender)]?.side === 'team').map((m) => ({
      ...m,
      sender: d.senders[senderKey(m.sender)]?.label ?? m.sender,
    }));
  });
  participantColumns = computed(() => {
    const all = Object.entries(this.chatDetail()?.senders ?? {}).map(([key, info]) => ({ key, ...info }));
    const column = (side: Side, title: string, move: Side, moveLabel: string) => ({
      title,
      list: all.filter((s) => s.side === side),
      move,
      moveLabel,
    });
    return [
      column('client', 'Cliente', 'team', '→ Equipo'),
      column('team', 'Nuestro equipo — se evalúa', 'client', '→ Cliente'),
    ];
  });

  readonly reasons = REASONS;

  pendingFiles = signal<{ name: string; text: string }[]>([]);
  pastePreview = signal<NewContact[]>([]);
  editingContactId = signal<number | null>(null);

  loading = signal(false);
  uploading = signal(false);
  analyzing = signal(false);
  error = signal('');
  success = signal('');

  ngOnInit() {
    this.fetchCompanies();
    if (this.isRoot()) this.fetchDefaultPrompts();
  }

  private async run(fallback: string, fn: () => Promise<unknown>) {
    this.error.set('');
    try {
      await fn();
    } catch (e) {
      this.error.set(errorMessage(e, fallback));
    }
  }

  /* ============ empresas ============ */

  async fetchCompanies() {
    this.loading.set(true);
    await this.run('Error al cargar grupos empresariales', async () => {
      this.companies.set(await firstValueFrom(this.http.get<Company[]>(api('/api/companies'))));
    });
    this.loading.set(false);
  }

  async addCompany(input: HTMLInputElement) {
    const name = input.value.trim();
    if (!name) return;
    await this.run('Error al crear grupo', async () => {
      await firstValueFrom(this.http.post(api('/api/companies'), { name }));
      input.value = '';
      await this.fetchCompanies();
    });
  }

  deleteCompany(c: Company, event: Event) {
    event.stopPropagation();
    this.confirm()(`¿Eliminar el grupo "${c.name}" con su directorio y todos sus chats?`, () =>
      this.run('Error al eliminar', async () => {
        await firstValueFrom(this.http.delete(api(`/api/companies/${c.id}`)));
        await this.fetchCompanies();
      }),
    );
  }

  async selectCompany(c: Company) {
    this.selected.set(c);
    this.tab.set('chats');
    this.closeChat();
    this.success.set('');
    await Promise.all([this.fetchChats(), this.fetchContacts()]);
  }

  async back() {
    this.selected.set(null);
    this.closeChat();
    await this.fetchCompanies();
  }

  /* ============ prompts ============ */

  async fetchDefaultPrompts() {
    await this.run('Error al cargar el prompt por defecto', async () => {
      this.defaultPrompts.set(await firstValueFrom(this.http.get<Prompts>(api('/api/companies/prompts'))));
    });
  }

  async saveDefaultPrompts(system: string, map: string) {
    this.success.set('');
    await this.run('Error al guardar el prompt por defecto', async () => {
      this.defaultPrompts.set(await firstValueFrom(this.http.put<Prompts>(api('/api/companies/prompts'), { system, map })));
      this.success.set('Prompt por defecto guardado');
    });
  }

  saveCompanyPrompts(system: string, map: string) {
    return this.saveCompany({ system_prompt: system, map_prompt: map });
  }

  resetCompanyPrompts() {
    this.confirm()('¿Descartar el prompt personalizado y volver al prompt por defecto?', () =>
      this.saveCompany({ system_prompt: null, map_prompt: null }),
    );
  }

  async saveCompany(patch: Partial<Pick<Company, 'name' | 'context' | 'system_prompt' | 'map_prompt'>>) {
    const c = this.selected();
    if (!c) return;
    if (patch.name !== undefined && !patch.name?.trim()) return;
    this.success.set('');
    await this.run('Error al guardar', async () => {
      this.selected.set(await firstValueFrom(this.http.patch<Company>(api(`/api/companies/${c.id}`), patch)));
      this.success.set('Guardado');
    });
  }

  /* ============ directorio ============ */

  async fetchContacts() {
    const id = this.selected()?.id;
    if (!id) return;
    await this.run('Error al cargar directorio', async () => {
      this.contacts.set(await firstValueFrom(this.http.get<Contact[]>(api(`/api/companies/${id}/contacts`))));
    });
  }

  private async upsertContacts(contacts: NewContact[]) {
    const id = this.selected()?.id;
    if (!id || !contacts.length) return false;
    let ok = false;
    await this.run('Error al guardar contactos', async () => {
      await firstValueFrom(this.http.post(api(`/api/companies/${id}/contacts`), { contacts }));
      await this.fetchContacts();
      ok = true;
    });
    return ok;
  }

  async addContact(name: HTMLInputElement, role: HTMLInputElement, phone: HTMLInputElement) {
    if (await this.upsertContacts([{ name: name.value, role: role.value, phone: phone.value }])) {
      name.value = role.value = phone.value = '';
      name.focus();
    }
  }

  previewPaste(text: string) {
    this.pastePreview.set(parseContactTable(text));
  }

  async importPaste(textarea: HTMLTextAreaElement) {
    const n = this.pastePreview().length;
    if (await this.upsertContacts(this.pastePreview())) {
      textarea.value = '';
      this.pastePreview.set([]);
      this.success.set(`${n} contacto(s) agregados o actualizados`);
    }
  }

  async saveContact(c: Contact, name: string, role: string, phone: string) {
    const id = this.selected()?.id;
    if (!id) return;
    await this.run('Error al guardar contacto', async () => {
      await firstValueFrom(this.http.patch(api(`/api/companies/${id}/contacts/${c.id}`), { name, role, phone }));
      this.editingContactId.set(null);
      await this.fetchContacts();
    });
  }

  deleteContact(c: Contact) {
    const id = this.selected()?.id;
    this.confirm()(`¿Quitar a ${c.name} del directorio?`, () =>
      this.run('Error al eliminar', async () => {
        await firstValueFrom(this.http.delete(api(`/api/companies/${id}/contacts/${c.id}`)));
        await this.fetchContacts();
      }),
    );
  }

  /* ============ chats de grupo ============ */

  async fetchChats() {
    const id = this.selected()?.id;
    if (!id) return;
    this.loading.set(true);
    await this.run('Error al cargar chats', async () => {
      this.chats.set(await firstValueFrom(this.http.get<GroupChat[]>(api(`/api/companies/${id}/chats`))));
    });
    this.loading.set(false);
  }

  async addFiles(files: FileList | null | undefined) {
    if (!files) return;
    const read = await Promise.all(
      Array.from(files).map(async (f) => ({
        name: f.name.replace(/^Chat de WhatsApp con\s*/i, '').replace(/\.txt$/i, ''),
        text: await f.text(),
      })),
    );
    this.pendingFiles.update((p) => [...p, ...read]);
  }

  async importChats() {
    const id = this.selected()?.id;
    const files = this.pendingFiles();
    if (!id || !files.length || this.uploading()) return;
    this.uploading.set(true);
    this.success.set('');
    await this.run('Error al importar', async () => {
      for (const f of files) {
        await firstValueFrom(this.http.post(api(`/api/companies/${id}/chats`), { filename: f.name, text: f.text }));
      }
      this.pendingFiles.set([]);
      this.success.set(`${files.length} chat(s) importados`);
      await this.fetchChats();
    });
    this.uploading.set(false);
  }

  async showChat(chat: GroupChat) {
    const id = this.selected()?.id;
    this.openChat.set(chat);
    this.chatDetail.set(null);
    this.chatMode.set('chat');
    await this.run('Error al cargar chat', async () => {
      this.chatDetail.set(
        await firstValueFrom(this.http.get<GroupChatDetail>(api(`/api/companies/${id}/chats/${chat.id}`))),
      );
    });
  }

  // Corrige a mano el lado de un remitente (null = volver a la clasificación automática) y recarga la vista.
  async setSenderSide(key: string, side: Side | null) {
    const id = this.selected()?.id;
    const chat = this.openChat();
    if (!id || !chat) return;
    await this.run('Error al guardar la corrección', async () => {
      await firstValueFrom(this.http.put(api(`/api/companies/${id}/senders`), { sender: key, side }));
      const detail = await firstValueFrom(this.http.get<GroupChatDetail>(api(`/api/companies/${id}/chats/${chat.id}`)));
      this.chatDetail.set(detail);
    });
  }

  closeChat() {
    this.openChat.set(null);
    this.chatDetail.set(null);
  }

  async analyze() {
    const id = this.selected()?.id;
    const chat = this.openChat();
    if (!id || !chat || this.analyzing()) return;
    this.analyzing.set(true);
    this.chatMode.set('analysis');
    await this.run('Error en el análisis', async () => {
      const r = await firstValueFrom(
        this.http.post<{ analysis: string }>(api(`/api/companies/${id}/chats/${chat.id}/analyze`), {}),
      );
      this.chatDetail.update((d) => (d ? { ...d, analysis: r.analysis } : d));
      await this.fetchChats();
    });
    this.analyzing.set(false);
  }

  async renameChat(chat: GroupChat, filename: string) {
    const id = this.selected()?.id;
    if (!filename.trim() || filename === chat.filename) return;
    await this.run('Error al renombrar', async () => {
      await firstValueFrom(this.http.patch(api(`/api/companies/${id}/chats/${chat.id}`), { filename }));
      await this.fetchChats();
    });
  }

  deleteChat(chat: GroupChat, event: Event) {
    event.stopPropagation();
    const id = this.selected()?.id;
    this.confirm()(`¿Eliminar el chat "${chat.filename}"?`, () =>
      this.run('Error al eliminar', async () => {
        await firstValueFrom(this.http.delete(api(`/api/companies/${id}/chats/${chat.id}`)));
        if (this.openChat()?.id === chat.id) this.closeChat();
        await this.fetchChats();
      }),
    );
  }

  exportAnalysis() {
    const a = this.chatDetail()?.analysis;
    if (!a) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([a], { type: 'text/markdown' }));
    link.download = `analisis-${this.selected()?.name}-${this.openChat()?.filename}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
