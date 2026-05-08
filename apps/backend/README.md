# Backend — Chatbot Psikologi Mahasiswa

Sistem backend AI untuk chatbot dukungan psikologis mahasiswa berbasis Semantic Routing dan RAG. Dibangun sebagai bagian dari Capstone TA Teknik Komputer Universitas Diponegoro.

---

## Struktur Folder

```
backend/
├── docs/                   # Dokumen psikologi (.docx)
├── routes/
│   ├── __init__.py
│   ├── guardrails.py       # Route 3 — Safety guardrail
│   ├── conversational.py   # Route 1 — Percakapan empatik
│   └── rag.py              # Route 2 — Retrieval-Augmented Generation
├── main.py                 # Entry point + semantic router
├── embed.py                # Script chunking + embedding dokumen
└── .env                    # Kredensial Supabase
```

---

## Teknologi

| Komponen | Teknologi |
|---|---|
| LLM | Llama 3.2 3B (via Ollama) |
| Embedding | nomic-embed-text-v2-moe (via Ollama) |
| Vector DB | Supabase pgvector |
| Routing | semantic-router (Aurelio AI) |
| Orkestrasi | LangChain + LangChain Ollama |
| Bahasa | Python 3.10+ |

---

## Setup

### 1. Prasyarat

- Python 3.10+
- Ollama terinstall dan berjalan
- Project Supabase aktif dengan ekstensi `pgvector`

### 2. Pull model Ollama

```bash
ollama pull nomic-embed-text-v2-moe
ollama pull llama3.2:3b
```

### 3. Buat virtual environment

```bash
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Linux/Mac
```

### 4. Install dependencies

```bash
pip install ollama supabase python-dotenv python-docx
pip install semantic-router
pip install langchain langchain-ollama langchain-community langchain-core
```

### 5. Konfigurasi `.env`

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

### 6. Setup database Supabase

Jalankan query berikut di Supabase SQL Editor:

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabel dokumen
CREATE TABLE documents (
    document_id BIGSERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    embedding   VECTOR(768),
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index similarity search
CREATE INDEX ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Fungsi retrieval
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding  VECTOR(768),
    match_threshold  FLOAT DEFAULT 0.3,
    match_count      INT DEFAULT 5
)
RETURNS TABLE (
    document_id     BIGINT,
    content         TEXT,
    metadata        JSONB,
    similarity      FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        document_id,
        content,
        metadata,
        1 - (embedding <=> query_embedding) AS similarity
    FROM documents
    WHERE 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;
```

---

## Embedding Dokumen

Taruh file `.docx` ke folder `docs/`, lalu jalankan:

```bash
python embed.py
```

Script akan otomatis:
1. Extract teks + tabel dari setiap `.docx`
2. Chunking teks (500 karakter, overlap 50)
3. Embed tiap chunk dengan prefix `passage:`
4. Upload ke tabel `documents` di Supabase

---

## Menjalankan Sistem

```bash
python main.py
```

---

## Arsitektur Routing

```
User Input
    |
    v
Semantic Router (nomic-embed-text-v2-moe)
    |
    |-- [guardrail]       --> Hardcoded response + kontak darurat
    |-- [conversational]  --> LangChain + Ollama (Llama 3.2 3B)
    |-- [rag]             --> Supabase retrieval + Ollama
    |-- [fallback]        --> Conversational
```

### Route 1 — Conversational

Menangani percakapan empatik umum. Menggunakan `ChatOllama` dengan `HumanMessage/AIMessage` untuk manajemen history.

Contoh trigger: `"halo"`, `"aku sedih"`, `"aku butuh teman bicara"`

### Route 2 — RAG

Menangani pertanyaan berbasis pengetahuan psikologi. Retrieval dari Supabase pgvector, hasilnya di-inject ke prompt Llama.

Contoh trigger: `"apa itu depresi?"`, `"gejala anxiety apa saja?"`

### Route 3 — Guardrail

Menangani input berbahaya (indikasi bunuh diri, self-harm). Mengembalikan hardcoded response berisi kontak darurat.

Contoh trigger: `"saya mau bunuh diri"`, `"saya ingin menyakiti diri sendiri"`

---

## Tanggung Jawab di Tim

| Komponen | Penanggung Jawab |
|---|---|
| Semantic Router + RAG + Guardrail | AI System Architect |
| Fine-tuning Llama + System Prompt | AI Persona Engineer |
| FastAPI + React Native + Database relasional | Full-Stack Engineer |

---

## Status Pengembangan

- [x] Tahap 1 — Persiapan environment
- [x] Tahap 2 — Setup Supabase + pgvector
- [x] Tahap 3 — Embedding dokumen RAG
- [x] Tahap 4 — Route 3 (Guardrail)
- [x] Tahap 5 — Route 1 (Conversational)
- [x] Tahap 6 — Route 2 (RAG)
- [x] Tahap 7 — Wire up Semantic Router
- [x] Tahap 8 — Testing & Evaluasi
- [ ] Tahap 9 — Swap model fine-tuned
- [ ] Tahap 10 — Deployment (FastAPI + Docker)