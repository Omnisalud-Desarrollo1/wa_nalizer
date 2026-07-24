# Lo-fi Web — Identidad de diseño (Wa-Nalizer)

> Vibe: **chill, nostálgico, cozy**. Texturas suaves, colores apagados, esquinas
> redondeadas, sombras bajas, tipografía blanda. Nada estridente: todo se siente
> como una tarde de lofi hip hop radio.

Base extraída de `10.html` → `.lofi-web` (`#e8e8e8` fondo, `#f5f5f5` panel,
`#5a3921` marrón café, texto `#333`, `Comfortaa`). El resto es la extensión a un
sistema usable.

---

## 1. Design tokens (pegar en `src/styles.css`, `:root`)

```css
@import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;700&family=Quicksand:wght@300;400;500;700&display=swap');

:root {
  /* --- superficies (grises cálidos, apagados) --- */
  --bg:          #e8e8e8;   /* fondo de página */
  --surface:     #f5f5f5;   /* tarjetas / paneles */
  --surface-alt: #ede9e3;   /* papel cálido, zonas secundarias */
  --border:      #d8d4ce;   /* bordes suaves */

  /* --- tinta / texto --- */
  --ink:         #333333;   /* texto principal */
  --ink-soft:    #6b6b6b;   /* texto secundario / metadatos */
  --ink-faint:   #9a938a;   /* placeholders, timestamps */

  /* --- marca (café tostado) --- */
  --brand:       #5a3921;   /* acento principal */
  --brand-soft:  #8a6d52;   /* hover / variantes */
  --brand-wash:  #efe7df;   /* fondo teñido para chips/estados activos */

  /* --- estados (apagados, cálidos, cada uno con su versión "lavada") --- */
  --success:      #6f8a5a;  --success-wash: #e7ece0;  /* ok / analizado / positivo */
  --warn:         #b8894e;  --warn-wash:    #f3ebda;  /* advertencia / pendiente */
  --info:         #5f7d8a;  --info-wash:    #e2eaec;  /* informativo / en proceso */
  --danger:       #a5644e;  --danger-wash:  #f0e2dc;  /* error / eliminar (ladrillo apagado, no rojo puro) */
  --accent-rose:  #b08585;  --accent-rose-wash: #f0e6e6; /* resaltado suave */

  /* --- radios (mínimo viable — nada de pastilla) --- */
  --r-sm: 3px;
  --r-md: 5px;
  --r-lg: 8px;

  /* --- sombras (bajas, difusas, cálidas) --- */
  --shadow-sm: 0 2px 6px rgba(90, 57, 33, .06);
  --shadow-md: 0 5px 15px rgba(0, 0, 0, .05);
  --shadow-inset: inset 0 1px 2px rgba(90, 57, 33, .05);

  /* --- tipografía --- */
  --font-head: 'Comfortaa', cursive;
  --font-body: 'Quicksand', sans-serif;

  /* --- espaciado (base 4px) --- */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;
  --sp-4: 16px; --sp-5: 24px; --sp-6: 32px; --sp-8: 48px;
}
```

---

## 2. Base

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background-color: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-weight: 400;
  line-height: 1.6;
  /* textura opcional: grano sutil de papel */
  background-image: radial-gradient(rgba(90,57,33,.025) 1px, transparent 1px);
  background-size: 4px 4px;
}

h1, h2, h3 { font-family: var(--font-head); color: var(--brand); font-weight: 700; }
h1 { font-size: 2.2rem; letter-spacing: .5px; }
h2 { font-size: 1.4rem; }
h3 { font-size: 1.05rem; font-weight: 500; }

a { color: var(--brand); text-decoration: none; }
a:hover { color: var(--brand-soft); }

::placeholder { color: var(--ink-faint); }
::selection { background: var(--brand-wash); }
```

Reglas de oro:
- **Nada de negro puro ni blanco puro.** Todo tiende a gris cálido / crema.
- **Nada de saturación alta.** Los acentos son versiones "lavadas".
- **Esquinas siempre redondeadas** (`--r-md` por defecto).
- **Sombras difusas y bajas**, nunca duras.
- **Transiciones lentas y suaves**: `transition: all .3s ease;`

---

## 3. Componentes

### Tarjeta / panel
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: var(--sp-5);
  box-shadow: var(--shadow-md);
  margin-bottom: var(--sp-4);
}
```

### Botones
```css
.btn {
  font-family: var(--font-body);
  font-weight: 500;
  border: 0;
  border-radius: var(--r-sm);   /* redondeo mínimo, esquinas casi rectas */
  padding: .6rem 1.2rem;
  cursor: pointer;
  transition: all .25s ease;
  display: inline-flex; align-items: center; gap: .5rem;
}
.btn.primary { background: var(--brand); color: #f5f5f5; box-shadow: var(--shadow-sm); }
.btn.primary:hover { background: var(--brand-soft); }
.btn.ghost  { background: transparent; color: var(--brand); border: 1px solid var(--border); }
.btn.ghost:hover { background: var(--brand-wash); }
.btn.danger { background: var(--danger-wash); color: var(--danger); }
.btn.danger:hover { background: var(--danger); color: #f5f5f5; }
.btn.small  { padding: .35rem .8rem; font-size: .85rem; }
.btn:disabled { opacity: .5; cursor: default; }
```

### Inputs
```css
input, textarea {
  font-family: var(--font-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: .6rem .9rem;
  color: var(--ink);
  transition: border-color .25s ease, box-shadow .25s ease;
}
input:focus, textarea:focus {
  outline: none;
  border-color: var(--brand-soft);
  box-shadow: 0 0 0 3px var(--brand-wash);
}
```

### Dropzone (cargar .txt)
```css
.drop {
  border: 2px dashed var(--border);
  border-radius: var(--r-md);
  background: var(--surface-alt);
  padding: var(--sp-6);
  text-align: center; color: var(--ink-soft);
  cursor: pointer; transition: all .3s ease;
}
.drop:hover, .drop.filled { border-color: var(--brand-soft); background: var(--brand-wash); }
```

### List item (áreas / personas / chats)
```css
.list-item {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: var(--sp-3) var(--sp-4);
  margin-bottom: var(--sp-2);
  cursor: pointer; transition: all .25s ease;
}
.list-item:hover { background: var(--surface-alt); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
.list-item .name { font-weight: 500; }
.list-item .meta { color: var(--ink-faint); font-size: .8rem; }
```

### Burbujas de chat
```css
.bubble {
  max-width: 75%;
  padding: .55rem .8rem;
  border-radius: var(--r-md);
  margin-bottom: var(--sp-1);
  box-shadow: var(--shadow-sm);
  font-size: .92rem;
}
.bubble           { background: var(--surface); border: 1px solid var(--border); align-self: flex-start; border-bottom-left-radius: 4px; }
.bubble.me        { background: var(--brand-wash); border-color: transparent; align-self: flex-end; border-bottom-right-radius: 4px; }
.bubble-sender    { font-family: var(--font-head); font-size: .78rem; color: var(--brand); margin: var(--sp-2) 0 2px; }
.bubble-sender.me { text-align: right; color: var(--brand-soft); }
.bubble-time      { font-size: .68rem; color: var(--ink-faint); margin-top: 2px; text-align: right; }
```

### Badge / chip (por estado)
```css
.badge {
  font-family: var(--font-head);
  font-size: .68rem; letter-spacing: 1px;
  padding: 2px 8px; border-radius: var(--r-sm);
  background: var(--brand-wash); color: var(--brand);
}
.badge.success { background: var(--success-wash); color: var(--success); }  /* ANALIZADO */
.badge.warn    { background: var(--warn-wash);    color: var(--warn); }     /* PENDIENTE */
.badge.info    { background: var(--info-wash);    color: var(--info); }     /* EN PROCESO */
.badge.danger  { background: var(--danger-wash);  color: var(--danger); }   /* ERROR */
```

### Estados (mensajes)
Cada estado tiene color + fondo lavado propio, misma forma:
```css
.error, .success, .warn, .info {
  border-radius: var(--r-sm);
  padding: .5rem .8rem;
  text-align: center;
  font-size: .85rem;
}
.error   { color: var(--danger);  background: var(--danger-wash); }
.success { color: var(--success); background: var(--success-wash); }
.warn    { color: var(--warn);    background: var(--warn-wash); }
.info    { color: var(--info);    background: var(--info-wash); }
.list-empty { color: var(--ink-faint); text-align: center; padding: var(--sp-5); font-style: italic; }
```

**Mapa de estados → color:**

| Estado | Token | Uso |
|---|---|---|
| Positivo / hecho | `--success` (sage) | chat analizado, chat importado, acción ok |
| Advertencia / pendiente | `--warn` (caramelo) | sin analizar, faltan datos |
| Informativo / en curso | `--info` (azul polvo) | subiendo, analizando, tips |
| Error / destructivo | `--danger` (ladrillo) | fallos, eliminar |
| Marca / acción principal | `--brand` (café) | botón primario, activo, seleccionado |

### Spinner (café girando)
```css
.spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--brand-wash);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
.spinner.dark { border-color: var(--border); border-top-color: var(--brand-soft); }
@keyframes spin { to { transform: rotate(360deg); } }
```

### Hero / header
```css
.hero { text-align: center; margin-bottom: var(--sp-6); position: relative; }
.hero h1 { color: var(--brand); }
.hero p  { color: var(--ink-soft); }
.hero::after {
  content: ""; position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%);
  width: 160px; height: 3px; border-radius: 3px;
  background: linear-gradient(90deg, var(--brand), var(--brand-soft), transparent);
}
```

---

## 4. Toques "lofi" opcionales (personalidad)

- **Icono gato/taza**: mascota redonda marrón (`.lofi-cat` original) como spinner o
  empty-state. `width:80px;height:80px;background:var(--brand);border-radius:50%`.
- **"Now playing"**: micro-texto en el footer tipo `♪ now playing: lofi hip hop radio`
  en `var(--ink-faint)`, fuente `--font-body`.
- **Grano de papel**: ya incluido en `body` (radial-gradient sutil).
- **Emojis suaves** en encabezados (☕ 🌙 📼) en vez de iconos filosos.

---

## 5. Aplicación al front actual

1. Pega §1 y §2 en `src/styles.css`.
2. En `src/app/app.css`, reemplaza los colores/gradientes actuales por las variables
   (`var(--brand)`, `var(--surface)`, …). Todo lo violeta/índigo previo → paleta café/gris.
3. Cambia radios rectos por `--r-md`/`--r-lg` y sombras por `--shadow-*`.
4. Fuentes: títulos `--font-head`, cuerpo `--font-body`.

> Regla única de consistencia: `[cualquier color] → una var del §1`. Si un valor no
> tiene variable, es que no pertenece a Lo-fi Web.
```
