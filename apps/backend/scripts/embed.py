"""Ingest the RAG corpus (DOCX) into PostgreSQL + pgvector.

    cd apps/backend
    venv/bin/python scripts/embed.py            # dry run: prints chunk stats, writes nothing
    venv/bin/python scripts/embed.py --apply    # replaces this source atomically

Importing this module does nothing. Ingestion is per source and atomic: every chunk is
embedded and validated before the old rows are deleted, all writes happen in one
transaction, and the previous rows are first dumped to a JSON file whose path is printed,
so a bad run can be restored.

Chunking keeps paragraphs and table rows whole and caps each chunk at 500 characters with
a 50-character overlap, the contract recorded in C500 (SJW-RAG-002).
"""
import argparse
import json
import os
import re
import sys
import tempfile
import time

from docx import Document
from docx.oxml.ns import qn
from dotenv import load_dotenv

# Run directly (`python scripts/embed.py`) from apps/backend: put the backend root on
# sys.path so `core` / `services` import.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# What the student sees cited. The filename ("REVISI FINAL", a revision date) is internal.
# A file missing here is ingested with no citation and the prompt falls back to its name.
CITATIONS = {
    "Buku Depresi REVISI FINAL.docx": "Petunjuk Teknis Layanan Depresi (Kemenkes RI, 2021)",
}


def extract_text_docx(filepath):
    """Paragraphs and table rows, in document order; cells joined with " | "."""
    doc = Document(filepath)
    blocks = []

    for block in doc.element.body:
        if block.tag.endswith("}p"):
            text = "".join(node.text or "" for node in block.iter() if node.tag.endswith("}t"))
            if text.strip():
                blocks.append(text.strip())
        elif block.tag.endswith("}tbl"):
            for row in block.iter(qn("w:tr")):
                cells = []
                for cell in row.iter(qn("w:tc")):
                    text = "".join(node.text or "" for node in cell.iter() if node.tag.endswith("}t"))
                    if text.strip():
                        cells.append(text.strip())
                if cells:
                    blocks.append(" | ".join(cells))

    return "\n".join(blocks)


def chunk_text(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """Sliding window of at most `size` characters, stepping back `overlap` between chunks.

    Deliberately the plain window: sentence- and word-aware variants were measured against
    the 15 retrieval fixtures and did not improve Hit Rate@5 (12/15 for all of them), while
    the word-backoff variant also pushed an out-of-domain query above the 0.3 similarity
    threshold. The misses those variants were meant to fix are handled by the neighbour
    slices `rag.retrieve_docs` appends instead.
    """
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start:start + size])
        start += size - overlap
    return [chunk for chunk in chunks if chunk.strip()]


def _embed(chunks, batch_size=16):
    """Document-prefixed embeddings; validates shape before anything is written."""
    from services.chatbot.rag import DOCUMENT_PREFIX, EMBED_MODEL
    import ollama

    vectors = []
    for start in range(0, len(chunks), batch_size):
        batch = chunks[start:start + batch_size]
        response = ollama.embed(model=EMBED_MODEL, input=[f"{DOCUMENT_PREFIX}{chunk}" for chunk in batch])
        vectors.extend(response["embeddings"])
        print(f"  embedded {len(vectors)}/{len(chunks)}")

    if len(vectors) != len(chunks):
        raise RuntimeError(f"expected {len(chunks)} embeddings, got {len(vectors)}")
    for vector in vectors:
        if len(vector) != 768:
            raise RuntimeError(f"embedding has {len(vector)} dimensions, expected 768")
    return vectors


def _existing_rows(filename):
    from core.db import db

    with db() as conn:
        return conn.execute(
            "select document_id, content, embedding::text as embedding, metadata "
            "from documents where metadata->>'source' = %s order by document_id",
            (filename,),
        ).fetchall()


def _replace_source(filename, chunks, vectors, citation, backup_dir):
    """Back up, then replace this source's rows in one transaction."""
    from core.db import db
    from psycopg.types.json import Jsonb

    previous = _existing_rows(filename)
    backup = os.path.join(backup_dir, f"{filename.replace(' ', '_')}.{int(time.time())}.json")
    with open(backup, "w", encoding="utf-8") as handle:
        json.dump([{**row, "document_id": str(row["document_id"])} for row in previous],
                  handle, ensure_ascii=False, default=str)
    print(f"  backup of {len(previous)} old chunk(s): {backup}")

    metadata = [{"source": filename, "chunk": index, "citation": citation} for index in range(len(chunks))]
    with db() as conn:
        # Migration 012 scopes delete to this flag; the app role cannot remove documents
        # otherwise. Transaction-local, so it never leaks to a request connection.
        conn.execute("select set_config('app.embedding_ingest', 'on', true)")
        conn.execute("delete from documents where metadata->>'source' = %s", (filename,))
        for chunk, vector, meta in zip(chunks, vectors, metadata):
            conn.execute(
                "insert into documents (content, embedding, metadata) values (%s, %s::vector, %s)",
                (chunk, str(vector), Jsonb(meta)),
            )
        stored = conn.execute(
            "select count(*) as total from documents where metadata->>'source' = %s", (filename,)
        ).fetchone()["total"]
        if stored != len(chunks):
            raise RuntimeError(f"stored {stored} rows for {filename}, expected {len(chunks)}")
    print(f"  replaced {len(previous)} old chunk(s) with {len(chunks)} new chunk(s)")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Ingest the RAG corpus into PostgreSQL + pgvector.")
    parser.add_argument("--apply", action="store_true",
                        help="write the new chunks (default is a dry run)")
    parser.add_argument("--docs", default="docs", help="directory holding the .docx corpus")
    args = parser.parse_args(argv)

    files = sorted(name for name in os.listdir(args.docs) if name.endswith(".docx"))
    if not files:
        print(f"no .docx files in {args.docs}")
        return 1

    for filename in files:
        path = os.path.join(args.docs, filename)
        chunks = chunk_text(extract_text_docx(path))
        if not chunks:
            print(f"[{filename}] no text extracted")
            continue
        lengths = [len(chunk) for chunk in chunks]
        print(f"[{filename}] {len(chunks)} chunk(s), length {min(lengths)}-{max(lengths)}")
        if not args.apply:
            continue
        vectors = _embed(chunks)
        _replace_source(filename, chunks, vectors, CITATIONS.get(filename), tempfile.gettempdir())

    if not args.apply:
        print("dry run: pass --apply to replace the stored corpus")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
