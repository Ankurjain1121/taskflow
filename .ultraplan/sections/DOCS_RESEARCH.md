# Library Documentation Report

## Libraries Researched: 8
## Context7 Hits: 6
## Fallback Required: 2

### Libraries Table

| Library | Version | Context7 ID | Status | Key Topic |
|---------|---------|-------------|--------|-----------|
| Angular CDK (Scrolling) | 20.x | /angular/components | FOUND | Virtual scrolling, DnD |
| Angular CDK (Drag-Drop) | 20.x | /angular/components | FOUND | Kanban board DnD |
| PrimeNG | 19.x | /websites/v19_primeng | FOUND | Theming, components, Tailwind |
| Ollama | latest | /llmstxt/ollama_llms-full_txt | FOUND | REST API, streaming, chat |
| Tailwind CSS | 4.x | /websites/tailwindcss | FOUND | Animations, container queries |
| Angular Animations | 19.x | /websites/angular_dev_guide_animations | FOUND | Route transitions |
| @ngxpert/cmdk | 3.x | N/A | FALLBACK | Command palette |
| ollama-rs | 0.3.4 | N/A | FALLBACK | Rust Ollama client |

---

## HIGH PRIORITY

---

### 1. Angular CDK - Virtual Scrolling

**Version:** 20.x (matches Angular version)
**Source:** Context7 (`/angular/components`)

#### Setup

```bash
npm install @angular/cdk
```

```typescript
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  imports: [ScrollingModule],
  template: `
    <cdk-virtual-scroll-viewport itemSize="50" class="viewport">
      @for (item of items; track item) {
        <div class="item">{{item}}</div>
      }
    </cdk-virtual-scroll-viewport>
  `
})
```

#### Key APIs for This Project

- `CdkVirtualScrollViewport` - The scrollable container; only renders visible items
- `itemSize` directive - **REQUIRED** for fixed-size strategy; sets pixel height of each item
- `minBufferPx` / `maxBufferPx` - Control how much content is pre-rendered outside viewport
- `scrollToIndex(index, behavior)` - Programmatic scrolling (useful for "jump to task")
- `scrolledIndexChange` - Observable that emits when the visible index changes

#### Performance Characteristics

- **Fixed-size strategy** (`itemSize`): Best performance because items do not need to be measured at render time. Only visible items + buffer are in the DOM.
- **Buffer tuning**: `minBufferPx` (minimum buffer before triggering render) and `maxBufferPx` (max buffer to render) control the tradeoff between smoothness and DOM node count.
- **Table support**: CDK table can be wrapped in `cdk-virtual-scroll-viewport` for virtual table scrolling.

#### Code Example - Board Column with Virtual Scroll

```typescript
@Component({
  selector: 'app-board-column',
  imports: [ScrollingModule],
  template: `
    <cdk-virtual-scroll-viewport
      [itemSize]="72"
      [minBufferPx]="200"
      [maxBufferPx]="400"
      class="h-full overflow-auto">
      @for (task of tasks(); track task.id) {
        <app-task-card [task]="task" class="block h-[72px]" />
      }
    </cdk-virtual-scroll-viewport>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardColumnComponent {
  tasks = input.required<Task[]>();
}
```

#### Gotchas

1. **All items MUST have the same fixed height** when using `itemSize` (the fixed-size strategy). Variable-height items require a custom `VirtualScrollStrategy`.
2. **CSS height is mandatory** on the viewport -- it must have an explicit height or it collapses to zero.
3. **`@for` / `*cdkVirtualFor`**: Use `*cdkVirtualFor` for full feature support (templateCacheSize, trackBy). The `@for` syntax works but may lose some CDK-specific features.

---

### 2. Angular CDK - Drag and Drop

**Version:** 20.x
**Source:** Context7 (`/angular/components`)

#### Setup

```typescript
import {
  CdkDrag,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem,
  CdkDragDrop
} from '@angular/cdk/drag-drop';
```

#### Key APIs for This Project

- `cdkDrag` - Makes an element draggable
- `cdkDropList` - Defines a drop zone container
- `cdkDropListGroup` - Groups multiple drop lists so items can transfer between them
- `[cdkDropListData]` - Binds the data array to the drop list
- `(cdkDropListDropped)` - Event fired when an item is dropped
- `[cdkDropListConnectedTo]` - Explicitly connects drop lists (alternative to group)
- `moveItemInArray(array, fromIndex, toIndex)` - Reorder within same list
- `transferArrayItem(source, target, sourceIndex, targetIndex)` - Move between lists

#### Code Example - Kanban Board with Connected Columns

```typescript
@Component({
  selector: 'app-kanban-board',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag],
  template: `
    <div cdkDropListGroup class="flex gap-4">
      @for (column of columns(); track column.id) {
        <div class="w-72 flex flex-col">
          <h3 class="font-semibold mb-2">{{ column.name }}</h3>
          <div
            cdkDropList
            [cdkDropListData]="column.tasks"
            class="min-h-[60px] flex-1 bg-surface-100 rounded-lg p-2"
            (cdkDropListDropped)="drop($event)">
            @for (task of column.tasks; track task.id) {
              <div cdkDrag class="p-3 mb-2 bg-white rounded-lg shadow-sm cursor-move">
                {{ task.title }}
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class KanbanBoardComponent {
  columns = input.required<Column[]>();

  drop(event: CdkDragDrop<Task[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
    // Emit event to persist reorder to backend
  }
}
```

#### Drag Preview & Placeholder CSS

```css
/* Preview shown while dragging */
.cdk-drag-preview {
  box-sizing: border-box;
  border-radius: 8px;
  box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2);
}

/* Animation when item settles */
.cdk-drag-animating {
  transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
}

/* Other items shift smoothly */
.cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) {
  transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
}
```

#### CdkDragDrop Event Interface

```typescript
interface CdkDragDrop<T, O = T, I = T> {
  previousContainer: CdkDropList<O>;  // Source container
  container: CdkDropList<T>;          // Target container
  previousIndex: number;               // Index in source
  currentIndex: number;                // Index in target
  item: CdkDrag<I>;                   // The dragged item
  distance: { x: number; y: number }; // Total drag distance
  dropPoint: { x: number; y: number }; // Drop coordinates
  event: MouseEvent | TouchEvent;
  isPointerOverContainer: boolean;
}
```

#### Gotchas

1. **Scrollable containers**: If draggable items are inside a scrollable div, auto-scrolling during drag will NOT work unless the container has the `cdkScrollable` directive.
2. **`moveItemInArray` MUTATES the array in place** -- this conflicts with immutability patterns. Wrap it: create a new array copy, call `moveItemInArray` on the copy, then set it.
3. **Performance**: For lists under ~200 items per column, CDK DnD performs well. Beyond that, DOM operations during reorder can cause jank.

---

### CRITICAL GOTCHA: Virtual Scrolling + Drag-and-Drop Combined

**Status: NOT OFFICIALLY SUPPORTED**

Angular CDK does **not** officially support combining `cdk-virtual-scroll-viewport` with `cdkDropList`. There are multiple open issues:

- [Issue #22406](https://github.com/angular/components/issues/22406) - Draggable item loses position when virtual scroll renders new items
- [Issue #22900](https://github.com/angular/components/issues/22900) - Items get messed up during drag + scroll
- [Issue #29125](https://github.com/angular/components/issues/29125) - Closed as duplicate of [#10122](https://github.com/angular/components/issues/10122)

**Problems when combined:**
1. Index calculations are wrong (visible indices vs actual list positions)
2. Elements display on top of each other during drag
3. Auto-scrolling does not trigger during drag
4. Items snap back to wrong positions

**Community Workaround (fragile):**

```html
<cdk-virtual-scroll-viewport [itemSize]="96">
  <li cdkDrag [cdkDragData]="[item, idx]"
      *cdkVirtualFor="let item of items; templateCacheSize: 0; let idx = index"
      [attr.data-drag-index]="idx">
    {{ item }}
  </li>
</cdk-virtual-scroll-viewport>
```

```typescript
drop(event: CdkDragDrop<Item[], Item[], [Item, number]>) {
  // Resolve destination index from DOM
  const dataIndex = event.container.element.nativeElement
    .getElementsByClassName("cdk-drag")[event.currentIndex]
    ?.getAttribute("data-drag-index");
  if (dataIndex) event.currentIndex = Number(dataIndex);

  const [, index] = event.item.data;
  event.previousIndex = index;

  moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
}
```

**Limitations of workaround:**
- Requires `templateCacheSize: 0` which **disables view recycling** (hurts performance)
- Reported broken in Angular 20
- Tightly coupled to DOM structure
- No auto-scroll during drag

**RECOMMENDATION FOR TASKFLOW:** Do NOT use virtual scrolling + DnD together. Instead:
- Use CDK DnD without virtual scrolling for board columns (most boards have <100 tasks per column)
- Use virtual scrolling only for read-only list views (e.g., My Tasks list with 500+ items)
- If a column exceeds ~200 tasks, paginate or collapse into groups rather than virtual scroll + DnD

---

### 3. PrimeNG 19

**Version:** 19.x
**Source:** Context7 (`/websites/v19_primeng`)

#### Setup

```bash
npm install primeng @primeng/themes
```

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          prefix: 'p',
          darkModeSelector: '.my-app-dark',
          cssLayer: false
        }
      }
    })
  ]
};
```

#### Theming System (Design Tokens)

PrimeNG 19 uses a **design token** system with three layers:

1. **Primitive tokens** - Raw color palette values (e.g., `blue.500`)
2. **Semantic tokens** - Contextual mappings (e.g., `primary.500` -> `blue.500`)
3. **Component tokens** - Component-specific overrides (e.g., `button.accent.color`)

**Creating a Trello-like Preset:**

```typescript
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

const TaskFlowPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}'
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '{slate.50}',
          100: '{slate.100}',
          // ... warm slate palette for friendly feel
        }
      }
    }
  },
  components: {
    button: {
      borderRadius: '8px',
      // Rounded, friendly buttons
    },
    card: {
      borderRadius: '12px',
      shadow: '0 1px 3px rgba(0,0,0,0.08)',
      // Subtle shadows like Trello
    }
  }
});
```

**Dynamic theme updates at runtime:**

```typescript
import { updatePreset } from '@primeng/themes';

updatePreset({
  semantic: {
    primary: {
      50: '{green.50}',
      // ... swap entire color scheme
    }
  }
});
```

**CSS variable access:**

```css
/* In CSS */
color: var(--p-blue-500);
background: var(--p-surface-0);
```

```typescript
// In TypeScript
import { $dt } from '@primeng/themes';
const blueValue = $dt('blue.500').value;
```

#### Key Components for TaskFlow

| Component | Import | Use Case |
|-----------|--------|----------|
| Dialog | `DialogModule` from `primeng/dialog` | Task detail modal, settings |
| Menu | `MenuModule` from `primeng/menu` | Context menus, dropdowns |
| ConfirmDialog | `ConfirmDialogModule` from `primeng/confirmdialog` | Delete confirmations |
| Toast | `ToastModule` from `primeng/toast` | Success/error notifications |
| Tree | `TreeModule` from `primeng/tree` | Project hierarchy, with virtual scroll |
| AutoComplete | `AutoCompleteModule` from `primeng/autocomplete` | Task assignment, labels |
| Avatar | `AvatarModule` from `primeng/avatar` | User avatars |
| Badge | `BadgeModule` from `primeng/badge` | Notification counts |
| Tooltip | `TooltipModule` from `primeng/tooltip` | Hover info |
| Calendar | `CalendarModule` from `primeng/calendar` | Due date picker |

All components are **standalone** in PrimeNG 19 -- import directly into component `imports` array.

#### Tailwind CSS 4 Integration

```bash
npm install tailwindcss-primeui
```

```css
/* styles.css */
@import "tailwindcss";
@plugin "tailwindcss-primeui";

/* Dark mode variant matching PrimeNG */
@custom-variant dark (&:where(.my-app-dark, .my-app-dark *));
```

The `tailwindcss-primeui` plugin exposes PrimeNG design tokens as Tailwind utilities, so you can use classes like `bg-primary`, `text-surface-500`, etc.

#### Gotchas

1. **`cssLayer: false`** is the safer default. Enabling CSS layers (`cssLayer: true` or `cssLayer: { name: 'primeng' }`) can cause specificity conflicts with Tailwind unless carefully ordered.
2. **`provideAnimationsAsync()`** is required -- without it, dialogs, toasts, and overlays will not animate.
3. **Tree-shaking works via standalone imports** -- only imported components are bundled. Do NOT import entire modules (e.g., `PrimeNGModule`).
4. **Dark mode selector** must match between PrimeNG config and Tailwind custom variant.

#### Hypothesis H3 Evidence: "PrimeNG can achieve Trello-like aesthetic"

**SUPPORTED.** The design token system is deep enough:
- Full control over border-radius, shadows, colors at component level
- `definePreset()` lets you override any Aura token
- CSS variables are exposed for fine-grained control
- The `Aura` preset is already clean/modern (closer to Trello than the older Material theme)
- Dynamic theme switching via `updatePreset()` enables user-selectable themes

---

### 4. Ollama

**Version:** Latest (API is stable)
**Source:** Context7 (`/llmstxt/ollama_llms-full_txt`)

#### REST API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/generate` | POST | Text generation from prompt |
| `/api/chat` | POST | Multi-turn chat with message history |
| `/v1/chat/completions` | POST | OpenAI-compatible chat endpoint |
| `/api/tags` | GET | List local models |
| `/api/pull` | POST | Pull a model |
| `/api/show` | POST | Show model info |
| `/api/delete` | DELETE | Delete a model |
| `/api/embeddings` | POST | Generate embeddings |

#### `/api/chat` - Primary Endpoint for TaskFlow

```bash
# Non-streaming
curl http://localhost:11434/api/chat -d '{
  "model": "qwen2.5:8b",
  "messages": [
    {"role": "system", "content": "You are a helpful project management assistant."},
    {"role": "user", "content": "Summarize these tasks: ..."}
  ],
  "stream": false,
  "options": {
    "temperature": 0.7,
    "num_ctx": 8192
  }
}'
```

**Response (non-streaming):**
```json
{
  "model": "qwen2.5:8b",
  "created_at": "2025-10-26T17:15:24Z",
  "message": {
    "role": "assistant",
    "content": "Here is a summary of your tasks..."
  },
  "done": true,
  "done_reason": "stop"
}
```

#### Streaming Response Format

Streaming is the default. Responses are **newline-delimited JSON** (`application/x-ndjson`):

```json
{"model":"qwen2.5:8b","created_at":"...","message":{"role":"assistant","content":"Here"},"done":false}
{"model":"qwen2.5:8b","created_at":"...","message":{"role":"assistant","content":" is"},"done":false}
{"model":"qwen2.5:8b","created_at":"...","message":{"role":"assistant","content":"..."},"done":true,"done_reason":"stop"}
```

Disable streaming: `"stream": false`

#### Structured JSON Output

Force structured output by providing a JSON schema:

```json
{
  "model": "qwen2.5:8b",
  "messages": [{"role": "user", "content": "Categorize this task: Fix login button"}],
  "stream": false,
  "format": {
    "type": "object",
    "properties": {
      "category": {"type": "string", "enum": ["bug", "feature", "chore"]},
      "priority": {"type": "string", "enum": ["low", "medium", "high"]},
      "summary": {"type": "string"}
    },
    "required": ["category", "priority", "summary"]
  }
}
```

#### Key Options for Qwen 8B

```json
{
  "options": {
    "temperature": 0.7,
    "num_ctx": 8192,
    "top_k": 40,
    "top_p": 0.9,
    "repeat_penalty": 1.1
  }
}
```

- `num_ctx` - Context window size (Qwen 2.5 8B supports up to 32k, but 8192 is good for performance)
- `temperature` - Lower = more deterministic (good for structured tasks like categorization)
- `keep_alive` - How long to keep model in memory (default "5m", use "24h" for always-ready)

#### Gotchas

1. **First request is slow** -- model must load into GPU/RAM. Use `keep_alive: "24h"` or send a warmup request on startup.
2. **Streaming is default** -- always set `"stream": false` for simple integrations, or properly handle NDJSON parsing.
3. **4KB context per token is approximate** -- Qwen 8B at 8192 context uses ~6-8GB VRAM.
4. **No built-in auth** -- Ollama runs on localhost:11434 with no authentication. Ensure it is NOT exposed to the internet.
5. **Structured output (`format`)** -- works best when the schema is also described in the prompt text itself for "grounding."

---

## MEDIUM PRIORITY

---

### 5. @ngxpert/cmdk (Command Palette)

**Version:** 3.x (for Angular 18+, compatible with Angular 19)
**Source:** Web fallback (GitHub)

#### Setup

```bash
npm install @ngxpert/cmdk @ngneat/overview @ngneat/until-destroy @angular/cdk
```

#### Key Components

| Component/Directive | Selector | Purpose |
|--------------------|----------|---------|
| `CommandComponent` | `cmdk-command` | Root container, manages filtering & keyboard |
| `InputDirective` | `cmdkInput` | Search input binding |
| `ListComponent` | `cmdk-list` | Scrollable item container |
| `GroupComponent` | `cmdk-group` | Groups items with labels |
| `ItemDirective` | `cmdkItem` | Individual selectable item |
| `EmptyDirective` | `*cmdkEmpty` | "No results" fallback |
| `SeparatorComponent` | `cmdk-separator` | Visual divider |

#### Code Example - TaskFlow Command Palette

```typescript
@Component({
  selector: 'app-command-palette',
  imports: [
    CommandComponent, InputDirective, ListComponent,
    GroupComponent, ItemDirective, EmptyDirective
  ],
  template: `
    <cmdk-command [loop]="true">
      <input cmdkInput placeholder="Search tasks, projects, commands..." />
      <div *cmdkEmpty>No results found.</div>
      <cmdk-list>
        <cmdk-group label="Tasks">
          @for (task of recentTasks(); track task.id) {
            <button cmdkItem (selected)="openTask(task)">
              {{ task.title }}
            </button>
          }
        </cmdk-group>
        <cmdk-group label="Commands">
          <button cmdkItem (selected)="createTask()">Create new task</button>
          <button cmdkItem (selected)="switchProject()">Switch project</button>
          <button cmdkItem (selected)="openSettings()">Settings</button>
        </cmdk-group>
      </cmdk-list>
    </cmdk-command>
  `
})
```

#### Styling

The library is **unstyled by default**. All elements have predictable CSS classes:

```css
.cmdk-command { /* Root */ }
.cmdk-input { /* Search input */ }
.cmdk-list { /* Item container */
  height: var(--cmdk-list-height);
  transition: height 100ms ease;
}
.cmdk-item { /* Each item */ }
.cmdk-item-active { /* Keyboard-selected item */
  background: var(--p-primary-50);
}
.cmdk-group { /* Group container */ }
.cmdk-empty { /* No results */ }
```

#### Keyboard Navigation

- Arrow Up/Down: Navigate items
- Enter: Select active item
- Escape: Close
- Backspace (when search empty): Go back (nested pages)
- Loop wraps around when `loop=true`

#### Custom Filtering

```typescript
// Default: case-insensitive substring match
// Custom:
<cmdk-command [filter]="myFilter">

myFilter = (value: string, search: string) => {
  // Fuzzy matching, Levenshtein distance, etc.
  return value.toLowerCase().includes(search.toLowerCase());
};
```

#### Gotchas

1. **Peer dependencies** -- requires `@ngneat/overview`, `@ngneat/until-destroy`, and `@angular/cdk`.
2. **Version 3.x requires Angular 18+** -- confirmed compatible with Angular 19.
3. **No built-in dialog wrapper** -- you need to handle the overlay/modal yourself (use PrimeNG Dialog or CDK Overlay).
4. **Limited documentation** -- the library is relatively small; source code is the best reference.

---

### 6. Tailwind CSS 4

**Version:** 4.x
**Source:** Context7 (`/websites/tailwindcss`)

#### Key APIs for TaskFlow

**Container Queries (responsive components):**

```html
<div class="@container">
  <div class="flex flex-col @md:flex-row">
    <!-- Responds to container width, not viewport -->
  </div>
</div>
```

**Transition Utilities:**

```html
<button class="transition duration-200 ease-in-out hover:scale-105 hover:shadow-md">
  Click me
</button>

<div class="transition-all duration-300 ease-out"
     [class.opacity-0]="!visible()"
     [class.translate-y-2]="!visible()">
  Animated content
</div>
```

**Custom Animations via CSS Theme:**

```css
@theme {
  --animate-slide-in: slide-in 200ms ease-out;
  --animate-fade-in: fade-in 150ms ease-out;
  --animate-scale-in: scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes slide-in {
    from { transform: translateY(-8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scale-in {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
}
```

**CSS Layers for Component Library Integration:**

```css
@layer components {
  .task-card {
    @apply rounded-xl shadow-sm border border-surface-200 bg-white p-3;
  }
}
```

#### Integration with PrimeNG (Tailwind v4)

```css
/* styles.css */
@import "tailwindcss";
@plugin "tailwindcss-primeui";
@custom-variant dark (&:where(.my-app-dark, .my-app-dark *));
```

#### Gotchas

1. **Tailwind v4 uses `@import "tailwindcss"` not `@tailwind base/components/utilities`** -- completely different syntax from v3.
2. **`@plugin` replaces `plugins` array** in config -- plugins are imported in CSS, not JS config.
3. **`@theme` replaces `theme.extend`** -- custom values are defined in CSS, not `tailwind.config.js`.
4. **Container queries require `@container` class** on parent -- without it, `@md:` variants have no effect.
5. **CSS layer ordering matters** -- if PrimeNG and Tailwind conflict, you may need explicit `@layer` ordering.

---

### 7. ollama-rs (Rust Ollama Client)

**Version:** 0.3.4
**Source:** Web fallback (docs.rs, GitHub)

#### Setup

```toml
# Cargo.toml
[dependencies]
ollama-rs = { version = "0.3", features = ["stream"] }
tokio = { version = "1", features = ["full"] }
tokio-stream = "0.1"
```

#### Key APIs

```rust
use ollama_rs::Ollama;
use ollama_rs::generation::completion::GenerationRequest;
use ollama_rs::generation::chat::{ChatMessage, ChatMessageRequest};
use ollama_rs::models::ModelOptions;

// Initialize
let ollama = Ollama::new("http://localhost".to_string(), 11434);

// Simple generation
let response = ollama
    .generate(GenerationRequest::new("qwen2.5:8b".into(), "Summarize this".into()))
    .await?;

// Chat with history
let messages = vec![
    ChatMessage::system("You are a project management assistant.".into()),
    ChatMessage::user("Categorize this task: Fix login button".into()),
];
let response = ollama
    .send_chat_messages(ChatMessageRequest::new("qwen2.5:8b".into(), messages))
    .await?;

// Streaming generation
let mut stream = ollama
    .generate_stream(GenerationRequest::new("qwen2.5:8b".into(), prompt))
    .await?;

while let Some(res) = stream.next().await {
    let responses = res?;
    for resp in responses {
        print!("{}", resp.response);
    }
}

// Model options
let options = ModelOptions::default()
    .temperature(0.7)
    .num_ctx(8192)
    .top_k(40)
    .top_p(0.9)
    .repeat_penalty(1.1);

let response = ollama
    .generate(
        GenerationRequest::new("qwen2.5:8b".into(), prompt)
            .options(options)
    )
    .await?;
```

#### Model Management

```rust
// List models
let models = ollama.list_local_models().await?;

// Show model info
let info = ollama.show_model_info("qwen2.5:8b".into()).await?;

// Create custom model
use ollama_rs::models::create::CreateModelRequest;
let req = CreateModelRequest::new("taskflow-assistant".into())
    .from_model("qwen2.5:8b".into())
    .system("You are TaskFlow's AI assistant.".into());
ollama.create_model(req).await?;
```

#### Axum Integration Pattern (Custom)

```rust
use axum::{extract::State, response::sse::{Event, Sse}, Json};
use tokio_stream::StreamExt;
use std::convert::Infallible;

#[derive(Clone)]
struct AppState {
    ollama: Ollama,
}

async fn chat_handler(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, AppError> {
    let messages = vec![
        ChatMessage::system("You are a project management assistant.".into()),
        ChatMessage::user(req.message),
    ];
    let response = state.ollama
        .send_chat_messages(ChatMessageRequest::new("qwen2.5:8b".into(), messages))
        .await?;
    Ok(Json(ChatResponse { content: response.message.content }))
}

// SSE streaming endpoint
async fn chat_stream_handler(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>> {
    let messages = vec![
        ChatMessage::system("You are a project management assistant.".into()),
        ChatMessage::user(req.message),
    ];
    let stream = state.ollama
        .send_chat_messages_stream(
            ChatMessageRequest::new("qwen2.5:8b".into(), messages)
        )
        .await
        .expect("stream creation failed");

    let event_stream = stream.map(|result| {
        match result {
            Ok(responses) => {
                let text: String = responses.iter()
                    .map(|r| r.message.content.clone())
                    .collect();
                Ok(Event::default().data(text))
            }
            Err(_) => Ok(Event::default().data("[ERROR]"))
        }
    });

    Sse::new(event_stream)
}
```

#### Gotchas

1. **`stream` feature flag required** -- without it, `generate_stream` and streaming methods are not available.
2. **Only 38.76% documented** -- rely on source code and examples rather than docs.rs.
3. **Coordinator API** for tool calling requires additional setup and specific model support.
4. **Error handling is sparse in examples** -- always use `?` operator, never `.unwrap()` in production.

---

## LOW PRIORITY

---

### 8. Angular Animations (Route Transitions)

**Version:** 19.x
**Source:** Context7 (`/websites/angular_dev_guide_animations`)

#### Setup - View Transitions API (Recommended)

Angular 19 supports the **browser-native View Transitions API** -- simpler and more performant than the legacy `@angular/animations` approach.

```typescript
// app.config.ts (standalone bootstrap)
import { provideRouter, withViewTransitions } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withViewTransitions()),
  ]
};
```

#### Custom Route Transition CSS

```css
/* global styles -- NOT in component styles due to view encapsulation */
@keyframes slide-from-right {
  from { transform: translateX(30px); opacity: 0; }
}

@keyframes slide-to-left {
  to { transform: translateX(-30px); opacity: 0; }
}

::view-transition-old(root) {
  animation: 200ms ease-out slide-to-left;
}

::view-transition-new(root) {
  animation: 200ms ease-out slide-from-right;
}
```

#### Per-Element Transitions

```css
/* Mark specific elements for independent transitions */
.task-card {
  view-transition-name: task-card;
}

::view-transition-old(task-card),
::view-transition-new(task-card) {
  animation-duration: 200ms;
}
```

#### Gotchas

1. **View Transitions API is in developer preview** in Angular and has limited browser support (Chrome/Edge only as of 2025, no Firefox/Safari).
2. **Global styles only** -- due to Angular's view encapsulation, `::view-transition-*` pseudo-elements must be in global CSS.
3. **Fallback needed** -- for browsers without View Transitions support, the page simply navigates without animation (graceful degradation).
4. **Legacy alternative**: `@angular/animations` with `trigger`, `state`, `transition`, `animate` -- more complex but universal browser support.

---

### 9. Web Push API

**Version:** W3C Standard
**Source:** Web fallback (MDN, Google Codelabs)

#### Architecture

```
Browser <-> Service Worker <-> Push Service (FCM/Mozilla) <-> Your Server (VAPID keys)
```

#### Key Steps

1. **Register Service Worker**
2. **Request notification permission** via `Notification.requestPermission()`
3. **Subscribe to push** via `PushManager.subscribe()` with VAPID public key
4. **Send subscription to backend** (endpoint + keys)
5. **Backend sends push** via web-push library with VAPID private key
6. **Service Worker receives** via `self.addEventListener('push', ...)`
7. **Display notification** via `self.registration.showNotification()`

#### Backend (Rust) Integration Notes

Use the `web-push` crate or make raw HTTP requests to the push service endpoint with VAPID authentication. The subscription object from the browser contains:
- `endpoint` - URL to POST to
- `keys.p256dh` - Public key for encryption
- `keys.auth` - Auth secret

#### Payload limit: 4KB (Chrome/Firefox), 2KB (Safari)

#### Gotchas

1. **Requires HTTPS** -- push subscriptions only work on secure origins.
2. **Service worker scope** -- Angular apps need `ngsw-config.json` or a custom service worker.
3. **Permission UX** -- never request permission on page load; wait for user action.
4. **Subscription can expire** -- handle `pushsubscriptionchange` events.
5. **Safari has different limits** -- 2KB payload max, different API surface.

---

## Cross-Library Integration Notes

| Libraries | Integration Note |
|-----------|-----------------|
| **CDK DnD + PrimeNG** | CDK DnD works independently of PrimeNG. Use CDK for kanban board drag-drop; use PrimeNG for overlays, modals, toasts. No conflict. |
| **PrimeNG + Tailwind v4** | Use `tailwindcss-primeui` plugin. Dark mode selectors must match. Avoid `cssLayer: true` unless you explicitly manage layer ordering. |
| **Ollama + ollama-rs + Axum** | ollama-rs is tokio-native, integrates naturally with Axum. Use SSE for streaming responses to the Angular frontend. |
| **Angular Animations + PrimeNG** | PrimeNG requires `provideAnimationsAsync()` which enables Angular animations platform. View Transitions are orthogonal. |
| **CDK Virtual Scroll + CDK DnD** | **DO NOT combine.** Not officially supported. Use DnD without virtual scroll for interactive lists; use virtual scroll only for read-only lists. |
| **@ngxpert/cmdk + PrimeNG Dialog** | Wrap cmdk in a PrimeNG Dialog for the overlay behavior. cmdk handles filtering/keyboard; Dialog handles open/close/backdrop. |
| **Tailwind v4 animations + Angular** | Define custom animations in `@theme` block. Use Tailwind transition utilities for micro-interactions; Angular View Transitions for route changes. |

---

## Hypothesis Evidence

### H1: "Angular CDK virtual scrolling + OnPush will achieve sub-200ms for 200+ task boards"

**PARTIALLY SUPPORTED with caveats:**
- Virtual scrolling with fixed-size items is extremely performant (only visible items in DOM)
- OnPush change detection eliminates unnecessary re-renders
- **BUT**: Virtual scrolling CANNOT be combined with drag-and-drop (the core kanban interaction)
- **Revised approach**: Use OnPush + trackBy + signals for reactivity. Skip virtual scrolling for board columns (most have <100 tasks). Reserve virtual scrolling for read-only list views (My Tasks, backlog).
- For boards with 200+ tasks per column, use pagination or grouped collapse rather than virtual scroll + DnD.

### H3: "PrimeNG can be styled to achieve Trello-like clean & friendly aesthetic"

**STRONGLY SUPPORTED:**
- `definePreset()` allows full override of any design token (colors, border-radius, shadows, spacing)
- `Aura` preset is already clean and modern
- CSS variables exposed for fine-grained control
- `updatePreset()` enables runtime theme switching
- `tailwindcss-primeui` bridges PrimeNG tokens into Tailwind utilities
- Dark mode fully controllable via selector

---

## Not Found in Context7

| Library | Fallback Source | Notes |
|---------|----------------|-------|
| @ngxpert/cmdk | [GitHub](https://github.com/ngxpert/cmdk) | Small library, full API extracted from README. v3.x for Angular 18+. |
| ollama-rs | [docs.rs](https://docs.rs/ollama-rs/latest/ollama_rs/), [GitHub](https://github.com/pepperoni21/ollama-rs) | v0.3.4, only 38.76% documented. Key APIs extracted from examples. |
| Web Push API | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [Google Codelabs](https://codelabs.developers.google.com/codelabs/push-notifications) | W3C standard, no library needed. |
