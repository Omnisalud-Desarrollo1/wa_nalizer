import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private http = inject(HttpClient);

  fileName = signal('');
  loading = signal(false);
  error = signal('');
  analysis = signal('');
  private chatText = '';

  async onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.chatText = await file.text();
    this.error.set('');
    this.analysis.set('');
  }

  analyze() {
    if (!this.chatText.trim() || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.analysis.set('');
    this.http
      .post<{ analysis?: string; error?: string }>(
        environment.backendUrl.replace(/\/$/, '') + '/analyze',
        { text: this.chatText },
      )
      .subscribe({
        next: (res) => {
          this.analysis.set(res.analysis ?? '');
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error || err?.message || 'Error desconocido');
          this.loading.set(false);
        },
      });
  }

  exportAnalysis() {
    const blob = new Blob([this.analysis()], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'analisis.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
