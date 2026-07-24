import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { environment } from '../environments/environment';
import { parseChat } from './chat-parser';
import { markdownToHtml } from './markdown';

interface Area {
  id: number;
  name: string;
}
interface Person {
  id: number;
  name: string;
  area_id: number;
}
interface Chat {
  id: number;
  filename: string;
  person_id: number;
  area_id: number;
  analysis?: string;
  created_at: string;
}

type View = 'areas' | 'people' | 'chats';

const api = (path: string) => environment.backendUrl.replace(/\/$/, '') + path;

@Component({
  selector: 'app-root',
  imports: [DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private http = inject(HttpClient);

  view = signal<View>('areas');
  areas = signal<Area[]>([]);
  selectedArea = signal<Area | null>(null);
  people = signal<Person[]>([]);
  selectedPerson = signal<Person | null>(null);
  chats = signal<Chat[]>([]);
  selectedChat = signal<Chat | null>(null);
  editingChatId = signal<number | null>(null);
  analysis = signal('');
  analysisHtml = computed(() => {
    const a = this.analysis();
    return a ? markdownToHtml(a) : '';
  });
  chatRaw = signal('');
  chatMode = signal<'chat' | 'analysis'>('chat');
  messages = computed(() => {
    const raw = this.chatRaw();
    const me = this.selectedPerson()?.name ?? '';
    return raw && me ? parseChat(raw, me) : [];
  });

  fileName = signal('');
  loading = signal(false);
  uploading = signal(false);
  analyzing = signal(false);
  error = signal('');
  success = signal('');

  confirmAction = signal<{ message: string; fn: () => void } | null>(null);
  showScrollTop = signal(false);

  private chatText = '';

  @HostListener('window:scroll')
  onScroll() {
    this.showScrollTop.set(window.scrollY > 400);
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ============ confirm ============ */

  confirm(message: string, fn: () => void) {
    this.confirmAction.set({ message, fn });
  }

  cancelConfirm() {
    this.confirmAction.set(null);
  }

  executeConfirm() {
    const c = this.confirmAction();
    if (c) {
      this.confirmAction.set(null);
      c.fn();
    }
  }

  /* ============ navigation ============ */

  async goAreas() {
    this.view.set('areas');
    this.selectedArea.set(null);
    this.selectedPerson.set(null);
    this.selectedChat.set(null);
    this.analysis.set('');
    this.error.set('');
    await this.fetchAreas();
  }

  async selectArea(a: Area) {
    this.selectedArea.set(a);
    this.view.set('people');
    this.selectedPerson.set(null);
    this.selectedChat.set(null);
    this.analysis.set('');
    this.error.set('');
    await this.fetchPeople();
  }

  goPeople() {
    this.view.set('people');
    this.selectedPerson.set(null);
    this.selectedChat.set(null);
    this.analysis.set('');
    this.error.set('');
  }

  async selectPerson(p: Person) {
    this.selectedPerson.set(p);
    this.view.set('chats');
    this.selectedChat.set(null);
    this.analysis.set('');
    this.error.set('');
    this.success.set('');
    await this.fetchChats();
  }

  /* ============ areas ============ */

  async fetchAreas() {
    this.loading.set(true);
    try {
      const r = await this.http.get<Area[]>(api('/api/areas')).toPromise();
      this.areas.set(r ?? []);
    } catch {
      this.error.set('Error al cargar áreas');
    } finally {
      this.loading.set(false);
    }
  }

  async addArea(input: HTMLInputElement) {
    const name = input.value.trim();
    if (!name) return;
    this.error.set('');
    try {
      await this.http.post(api('/api/areas'), { name }).toPromise();
      input.value = '';
      await this.fetchAreas();
    } catch (e: any) {
      this.error.set(e?.error?.error ?? 'Error al crear área');
    }
  }

  deleteArea(id: number, event: Event) {
    event.stopPropagation();
    this.confirm('¿Eliminar esta área y todas sus personas y chats?', async () => {
      this.error.set('');
      try {
        await this.http.delete(api(`/api/areas/${id}`)).toPromise();
        await this.fetchAreas();
      } catch (e: any) {
        this.error.set(e?.error?.error ?? 'Error al eliminar');
      }
    });
  }

  /* ============ people ============ */

  async fetchPeople() {
    this.loading.set(true);
    const areaId = this.selectedArea()?.id;
    if (!areaId) return;
    try {
      const r = await this.http.get<Person[]>(api(`/api/areas/${areaId}/people`)).toPromise();
      this.people.set(r ?? []);
    } catch {
      this.error.set('Error al cargar personas');
    } finally {
      this.loading.set(false);
    }
  }

  async addPerson(input: HTMLInputElement) {
    const name = input.value.trim();
    const areaId = this.selectedArea()?.id;
    if (!name || !areaId) return;
    this.error.set('');
    try {
      await this.http.post(api(`/api/areas/${areaId}/people`), { name }).toPromise();
      input.value = '';
      await this.fetchPeople();
    } catch (e: any) {
      this.error.set(e?.error?.error ?? 'Error al agregar persona');
    }
  }

  deletePerson(id: number, event: Event) {
    event.stopPropagation();
    this.confirm('¿Eliminar esta persona y todos sus chats?', async () => {
      this.error.set('');
      try {
        await this.http.delete(api(`/api/areas/0/people/${id}`)).toPromise();
        await this.fetchPeople();
      } catch (e: any) {
        this.error.set(e?.error?.error ?? 'Error al eliminar');
      }
    });
  }

  /* ============ chats ============ */

  async onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.chatText = await file.text();
    this.error.set('');
    this.success.set('');
  }

  async fetchChats() {
    this.loading.set(true);
    const personId = this.selectedPerson()?.id;
    if (!personId) return;
    try {
      const r = await this.http
        .get<Chat[]>(api('/api/chats'), { params: { person_id: String(personId) } })
        .toPromise();
      this.chats.set(r ?? []);
    } catch {
      this.error.set('Error al cargar chats');
    } finally {
      this.loading.set(false);
    }
  }

  async importChat() {
    if (!this.chatText || this.uploading()) return;
    const person = this.selectedPerson();
    const area = this.selectedArea();
    if (!person || !area) return;
    this.uploading.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await this.http
        .post(api('/api/chats'), {
          filename: this.fileName(),
          text: this.chatText,
          person_id: person.id,
          area_id: area.id,
        })
        .toPromise();
      this.fileName.set('');
      this.chatText = '';
      this.success.set('Chat importado exitosamente');
      await this.fetchChats();
    } catch (e: any) {
      this.error.set(e?.error?.error ?? 'Error al importar chat');
    } finally {
      this.uploading.set(false);
    }
  }

  async openChat(c: Chat) {
    this.error.set('');
    this.chatMode.set('chat');
    this.analysis.set('');
    this.selectedChat.set(c);
    try {
      const r = await this.http.get<Chat>(api(`/api/chats/${c.id}`)).toPromise();
      if (r) {
        this.chatRaw.set((r as any).raw_text ?? '');
        if (r.analysis) this.analysis.set(r.analysis);
      }
    } catch (e: any) {
      this.error.set(e?.error?.error ?? 'Error al cargar chat');
    }
  }

  async runAnalysis() {
    const chat = this.selectedChat();
    if (!chat || this.analyzing()) return;
    this.analyzing.set(true);
    this.error.set('');
    this.analysis.set('');
    try {
      const r = await this.http
        .post<{ analysis: string }>(api(`/api/chats/${chat.id}/analyze`), {})
        .toPromise();
      if (r?.analysis) {
        this.analysis.set(r.analysis);
        this.chatMode.set('analysis');
        await this.fetchChats();
      }
    } catch (e: any) {
      this.error.set(e?.error?.error ?? 'Error en el análisis');
    } finally {
      this.analyzing.set(false);
    }
  }

  deleteChat(id: number, event: Event) {
    event.stopPropagation();
    this.confirm('¿Eliminar este chat?', async () => {
      this.error.set('');
      try {
        await this.http.delete(api(`/api/chats/${id}`)).toPromise();
        if (this.selectedChat()?.id === id) {
          this.selectedChat.set(null);
          this.analysis.set('');
          this.chatRaw.set('');
        }
        await this.fetchChats();
      } catch (e: any) {
        this.error.set(e?.error?.error ?? 'Error al eliminar');
      }
    });
  }

  startEditChat(id: number, event: Event) {
    event.stopPropagation();
    this.editingChatId.set(id);
  }

  cancelEdit() {
    this.editingChatId.set(null);
  }

  async saveChatName(id: number, input: HTMLInputElement) {
    const name = input.value.trim();
    if (!name) { this.cancelEdit(); return; }
    try {
      await this.http.patch(api(`/api/chats/${id}`), { filename: name }).toPromise();
      this.editingChatId.set(null);
      await this.fetchChats();
    } catch (e: any) {
      this.error.set(e?.error?.error ?? 'Error al renombrar');
    }
  }

  exportAnalysis() {
    const blob = new Blob([this.analysis()], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'analisis.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ============ init ============ */

  ngOnInit() {
    this.fetchAreas();
  }
}
