import os, sys, ollama
from docx import Document
from docx.oxml.ns import qn
from dotenv import load_dotenv
from psycopg.types.json import Jsonb

# Run directly (`python scripts/embed.py`) from apps/backend: put the backend root on
# sys.path so `core` / `services` import (same shim as test_rag_performance.py).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.db import query
from services.chatbot.rag import EMBED_MODEL, DOCUMENT_PREFIX

load_dotenv()

def extract_text_docx(filepath):
    doc = Document(filepath)
    full_text = []

    for block in doc.element.body:
        if block.tag.endswith('}p'):
            text = "".join(node.text or "" for node in block.iter() if node.tag.endswith('}t'))
            if text.strip():
                full_text.append(text.strip())
        elif block.tag.endswith('}tbl'):
            for row in block.iter(qn('w:tr')):
                cells = []
                for cell in row.iter(qn('w:tc')):
                    text = "".join(node.text or "" for node in cell.iter() if node.tag.endswith('}t'))
                    if text.strip():
                        cells.append(text.strip())
                if cells:
                    full_text.append(" | ".join(cells))

    return "\n".join(full_text)

def chunk_text(text, size=500, overlap=50):
    chunks = []
    i = 0
    while i < len(text):
        chunks.append(text[i:i+size])
        i += size - overlap
    return chunks

def embed_and_upload(filepath):
    text = extract_text_docx(filepath)
    chunks = chunk_text(text)
    filename = os.path.basename(filepath)

    for i, chunk in enumerate(chunks):
        res = ollama.embed(
            model=EMBED_MODEL,
            input=f"{DOCUMENT_PREFIX}{chunk}"
        )
        embedding = res["embeddings"][0]

        query(
            "insert into documents (content, embedding, metadata) values (%s, %s::vector, %s)",
            (chunk, str(embedding), Jsonb({"source": filename, "chunk": i})),
        )

        print(f"[{filename}] chunk {i+1}/{len(chunks)}")

for filename in os.listdir("docs"):
    if filename.endswith(".docx"):
        embed_and_upload(f"docs/{filename}")

print("Selesai!")
