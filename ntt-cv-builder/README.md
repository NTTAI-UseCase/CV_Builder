# NTTData AI CV Builder — Phase 1 MVP

A fully conversational, AI-powered CV builder built with Python, FastAPI, the OpenAI Agents SDK, LangChain, and ChromaDB. Runs in the browser with a real-time WebSocket chat interface.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API Server | FastAPI + Uvicorn |
| Real-time | WebSocket (FastAPI native) |
| AI Orchestration | OpenAI Agents SDK (`openai-agents`) |
| LLM | GPT-4o (function calling + vision) |
| RAG Pipeline | LangChain + ChromaDB + `text-embedding-3-large` |
| Schema Validation | Pydantic v2 |
| PDF Rendering | Playwright (Chromium) + Jinja2 |
| DOCX Generation | python-docx + docxtpl |
| Document Parsing | PyMuPDF (fitz) + python-docx |
| Frontend | React 18 + Vite |
| Settings | pydantic-settings (`.env`) |

---

## Quick Start

### 1. Clone & Configure

```bash
git clone <repo-url>
cd contoso-cv-builder
cp .env.example .env
# Set:  OPENAI_API_KEY=sk-...
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r ../requirements.txt
playwright install chromium          # install headless browser for PDF export
uvicorn main:app --reload --port 8000 --log-level info
```

RAG knowledge base seeds automatically on first start (~10 seconds).

### 3. Frontend (dev)

```bash
cd frontend
npm install
npm run dev   # → http://localhost:5173
```

### 4. Production Build

```bash
cd frontend && npm run build
cd ../backend && uvicorn main:app --host 0.0.0.0 --port 8000
# FastAPI serves the built React app at http://localhost:8000
```

---

## Project Structure

```
contoso-cv-builder/
├── backend/
│   ├── main.py                  # FastAPI app + CORS + lifespan
│   ├── config.py                # pydantic-settings from .env
│   ├── schemas/cv_schema.py     # CVData, SessionState (Pydantic v2)
│   ├── agents/
│   │   ├── triage_agent.py      # Conversation Agent (Agents SDK)
│   │   ├── orchestrator.py      # CVOrchestrator — stage machine + WS events
│   │   ├── extraction_agent.py  # GPT-4o function calling → structured CVData
│   │   ├── document_parser.py   # PDF/DOCX parsing + GPT-4o Vision fallback
│   │   └── validation_agent.py  # Schema checks + RAG bullet enrichment
│   ├── tools/cv_tools.py        # @function_tool decorated Agents SDK tools
│   ├── rag/
│   │   ├── ingestion.py         # Seeds ChromaDB with CV knowledge
│   │   └── retriever.py         # LangChain similarity retriever
│   ├── routers/
│   │   ├── chat.py              # WS /ws/{session_id}
│   │   ├── upload.py            # POST /api/upload
│   │   └── export.py            # POST /api/export/{pdf|docx|json|preview}
│   └── renderers/
│       ├── pdf_renderer.py      # 4 Jinja2 templates → WeasyPrint PDF
│       └── docx_renderer.py     # python-docx branded Word export
├── frontend/
│   └── src/
│       ├── App.jsx              # Root — session init + WebSocket event router
│       ├── hooks/useWebSocket.js
│       ├── lib/api.js           # HTTP helpers
│       └── components/
│           ├── ChatPanel.jsx    # Conversation thread + input
│           ├── PreviewPanel.jsx # Right pane + download bar
│           ├── CVPreview.jsx    # Iframe preview + template switcher
│           ├── CVDataPanel.jsx  # Live structured data inspector
│           ├── CVStatusCard.jsx # Completion checklist
│           ├── Header.jsx       # Top bar + stage indicator
│           └── UploadZone.jsx   # Drag-and-drop upload
├── requirements.txt
└── .env.example
```

---

## WebSocket Protocol

| Direction | Event type | Data |
|---|---|---|
| Server → Client | `message` | AI reply (Markdown string) |
| Server → Client | `cv_update` | Full CVData JSON |
| Server → Client | `stage` | Stage string |
| Server → Client | `preview` | HTML string |
| Server → Client | `downloads_ready` | `{pdf_b64, docx_b64, json, filename_stem}` |
| Server → Client | `progress` | Status string |
| Server → Client | `validation` | Completeness report |
| Server → Client | `error` | Error string |
| Client → Server | `message` | `{type: "message", data: "user text"}` |

---

## CV Templates

| Key | Style |
|---|---|
| `professional` | Classic corporate — navy/white, single column |
| `modern` | Teal header band, clean layout |
| `minimal` | Ultra-clean white space |
| `executive` | Two-column sidebar, senior leadership |

---

## Environment Variables

| Variable | Default | Required |
|---|---|---|
| `OPENAI_API_KEY` | — | ✅ Yes |
| `OPENAI_MODEL` | `gpt-4o` | No |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-large` | No |
| `CHROMA_PERSIST_DIR` | `./chroma_db` | No |
| `REDIS_URL` | *(empty = in-memory)* | No |
| `MAX_UPLOAD_SIZE_MB` | `10` | No |
| `LOG_LEVEL` | `INFO` | No |

---

## Adding More CV Knowledge

```bash
# Add .txt files to data/cv_examples/
cd backend
python -m rag.ingestion
```

---

## Phase 2 Roadmap

- Voice input (Whisper STT) + Text-to-Speech output
- Multilingual support (50+ languages via GPT-4o)
- Semantic template matching (Template Agent + Qdrant)
- Human-in-the-loop Review Agent + Quality Agent (self-critique)
- Auto-delivery via Microsoft Teams / Email / SharePoint
- Production-scale: Qdrant vector DB + Redis sessions + Azure AD auth
