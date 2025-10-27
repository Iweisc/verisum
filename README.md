# Verisum

**Get concise, sourced answers from any website** - A Chrome extension that uses AI to answer questions about web pages.

## Features

### Core Functionality

- **Instant Answers**: Ask questions about any webpage and get AI-powered answers with cited sources
- **Smart Search**: Vector-based search finds the most relevant content on the page
- **Source Citations**: Every answer includes clickable sources that highlight the referenced text
- **Streaming Responses**: See answers appear in real-time as the AI generates them

### User Interface

#### Popup (Click Extension Icon)

- **Suggested Questions**: 4 smart suggestions based on common queries
- **Query History**: Access your last 10 queries with dropdown
- **Copy Options**: Copy answer only or answer with sources
- **Quality Indicators**: Confidence badges (High/Medium/Low) based on source count
- **Loading Progress**: Multi-stage progress bar with percentages
- **Error Handling**: Specific error messages with retry button

#### Spotlight (Alt+Space)

- **Quick Access**: Overlay that appears on any page
- **Persistent State**: Reopens with your last question and answer
- **Keyboard Navigation**: Arrow keys to navigate sources, Enter to select
- **Auto-focus**: Input refocuses after answer for immediate follow-up questions
- **Markdown Support**: Bold, italic, code, and links in answers

### ⌨️ Keyboard Shortcuts

- **Alt+Space**: Open Spotlight search
- **Ctrl+Shift+V** (Cmd+Shift+V on Mac): Open popup
- **Escape**: Close Spotlight
- **↑/↓**: Navigate through sources
- **Enter**: Select/highlight source on page

### UX Improvements

- Multi-stage progress indicators during initialization
- Visual feedback with hover effects and animations
- Source click animations with pulse effect
- Streaming answer animations
- Quality confidence badges
- Source count indicators
- Copy buttons with success feedback

## Project Structure

```
verisum/
├── src/
│   ├── @types/                    # TypeScript definitions
│   │   ├── global.d.ts
│   │   └── vite.d.ts
│   │
│   ├── contentScript/             # Content script (runs on web pages)
│   │   ├── App.tsx                # Voice mode component (hold Space)
│   │   ├── App.module.css
│   │   ├── Spotlight.tsx          # Quick search overlay (Alt+Space)
│   │   ├── Spotlight.module.css
│   │   ├── Sources.tsx            # Source citations component
│   │   ├── Sources.module.css
│   │   └── contentScript.ts       # Entry point, spotlight management
│   │
│   ├── popup/                     # Extension popup (click icon)
│   │   ├── App/
│   │   │   ├── Form.tsx           # Query input with suggestions & history
│   │   │   ├── Form.module.css
│   │   │   ├── Result.tsx         # Answer display with sources
│   │   │   ├── Result.module.css
│   │   │   ├── Footer.tsx
│   │   │   └── Footer.module.css
│   │   ├── styles/
│   │   │   ├── document.css       # Global styles
│   │   │   ├── reset.css
│   │   │   └── typography.css
│   │   ├── App.tsx                # Main popup logic
│   │   ├── App.module.css
│   │   ├── Initializer.tsx        # Loading/initialization screen
│   │   ├── Initializer.module.css
│   │   ├── popup.tsx              # Entry point
│   │   └── popup.module.css
│   │
│   ├── serviceWorker/             # Background service worker
│   │   ├── serviceWorker.ts       # Main service worker logic
│   │   └── vectorDB.ts            # Vector database + AI integration
│   │
│   ├── helpers/                   # Shared utilities
│   │   ├── chromeMessages.ts      # Chrome extension messaging
│   │   ├── classnames.ts          # CSS class utilities
│   │   ├── extractWebsiteParts.ts # DOM content extraction
│   │   ├── getPrompt.ts           # AI prompt generation
│   │   ├── highlightParagraph.ts  # Source highlighting on page
│   │   ├── SpeechToText.ts        # Voice input (experimental)
│   │   ├── textToSpeech.ts        # Voice output (experimental)
│   │   ├── types.ts               # TypeScript types
│   │   └── VectorDB.ts            # Vector database client
│   │
│   ├── theme/                     # Reusable UI components
│   │   ├── Loader/
│   │   │   ├── Loader.tsx
│   │   │   └── Loader.module.css
│   │   └── index.ts
│   │
│   ├── icons/                     # Extension icons
│   │   ├── 16x.png
│   │   ├── 32x.png
│   │   ├── 48x.png
│   │   └── 128x.png
│   │
│   └── popup.html                 # Popup HTML template
│
├── dist/                          # Build output (generated)
├── .env.example                   # Environment variables template
├── .gitignore
├── LICENSE
├── package.json
├── tsconfig.json
├── vite.config.ts                 # Build configuration + manifest
└── README.md
```

## Architecture

### Component Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                       │
├──────────────────────┬──────────────────────────────────────┤
│   Popup (Icon)       │   Spotlight (Alt+Space)              │
│   - Suggestions      │   - Quick overlay                    │
│   - History          │   - Persistent state                 │
│   - Copy features    │   - Keyboard nav                     │
└──────────────────────┴──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Content Script Layer                     │
│   - Extract page content (h1-6, p tags)                     │
│   - Handle user interactions                                │
│   - Highlight sources on page                               │
│   - State management                                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   Service Worker (Background)               │
├─────────────────────────────────────────────────────────────┤
│   VectorDB:                                                 │
│   - Xenova/all-MiniLM-L6-v2 (WASM, q8 quantization)         │
│   - Generate embeddings for page paragraphs                 │
│   - Vector search (top 7 results, 0.5 threshold)            │ 
│   - Cache: 1 hour TTL, URL-validated                        │
│                                                             │
│   AI Integration:                                           │
│   - Stream responses from OpenAI-compatible API             │
│   - Query cache: 30 min TTL                                 │
│   - Token optimization (~350 tokens per query)              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    External AI Service                      │
│   - OpenAI-compatible API endpoint                          │
│   - Model: claude-3-5-haiku-20241022 (configurable)         │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Page Load**: Content script extracts page content (h1-6, p tags)
2. **Embedding**: Service worker generates vector embeddings for all paragraphs
3. **Caching**: Embeddings cached in chrome.storage.local (1 hour TTL)
4. **Query**: User asks question in popup or spotlight
5. **Search**: Vector search finds top 7 most relevant paragraphs
6. **AI Request**: Relevant paragraphs + query sent to AI API
7. **Stream**: Answer streams back through service worker
8. **Display**: UI shows answer with source citations
9. **Interaction**: User can click sources to highlight on page

### Storage

**chrome.storage.local**:

- `verisum_last_query`: Last popup query, answer, and sources
- `verisum_query_history`: Last 10 queries (popup only)
- `{url}:{contentHash}`: Cached VectorDB embeddings (1 hour TTL)

**In-memory (Service Worker)**:

- Query result cache (30 min TTL)
- VectorDB model and entries

**In-memory (Content Script)**:

- Spotlight state (query, answer, sources) - persists until page navigation

## Technologies

### Core

- **Preact**: Lightweight React alternative for UI
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool
- **CRXJS**: Chrome extension plugin for Vite

### AI/ML

- **Transformers.js (Xenova)**: Browser-based ML model execution
- **all-MiniLM-L6-v2**: Sentence embeddings model (WASM, quantized)
- **Vector Search**: Cosine similarity for semantic search

### UI/UX

- **CSS Modules**: Scoped styling
- **Lucide Icons**: Icon library
- **Showdown**: Markdown to HTML conversion (popup)

### Chrome APIs

- **chrome.storage.local**: Persistent caching
- **chrome.runtime**: Service worker messaging
- **chrome.commands**: Keyboard shortcuts
- **chrome.action**: Extension popup

## Performance

### Bundle Sizes

- **Content Script**: ~12 KB (includes UI components)
- **Popup**: ~84 KB (includes form logic, history, suggestions)
- **Service Worker**: ~743 KB (includes ML model)

### Optimizations

- **Token Reduction**: Send only top 7 paragraphs (~350 tokens vs ~10,000)
- **Query Caching**: 30 min TTL for instant repeated queries
- **VectorDB Caching**: 1 hour TTL with URL validation
- **Lazy Loading**: Models load on-demand
- **WASM Acceleration**: Fast embeddings generation
- **Quantization**: q8 model for smaller size

### Response Times

- **Cached Query**: <100ms
- **Fresh Query**: 1-3s (vector search + AI generation)
- **First-Time Load**: 10-30s (model download, first run only)

## Configuration

The extension uses environment variables for API configuration. Copy `.env.example` to `.env` and configure:

```bash
# OpenAI-compatible API endpoint
VITE_API_URL=http://192.168.110.114:4000

# Model name
VITE_MODEL_NAME=claude-3-5-haiku-20241022
```

These are embedded at build time via Vite.

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

Output: `dist/` directory

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` directory

### Development Notes

- Service worker hot-reload may be flaky - reload extension manually
- Content script changes require page refresh
- Popup changes hot-reload automatically
- Check service worker console for VectorDB logs

## API Requirements

The extension requires an OpenAI-compatible API endpoint that supports:

- Streaming responses (SSE)
- POST `/chat/completions` endpoint
- Standard OpenAI request/response format

Example compatible APIs:

- OpenAI API
- Anthropic API (via proxy)
- Local LLM servers (LM Studio, Ollama with openai-compatible mode)
- Custom proxy servers

## Future Enhancements

See `CONVERSATION_MODE_PLAN.md` for planned features:

- Multi-turn conversations with context
- Misinformation detection
- Better discussion site support (HN, Reddit)
- Dark mode
- Settings page
- Additional export formats

## License

See LICENSE file for details.

## Contributing

Contributions welcome! Please ensure:

- TypeScript types are properly defined
- CSS modules are used for styling
- Follow existing code structure
- Test in both popup and spotlight modes
- Verify keyboard shortcuts work
