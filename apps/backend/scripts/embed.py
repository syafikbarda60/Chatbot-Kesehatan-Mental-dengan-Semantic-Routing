import os, ollama
from docx import Document
from docx.oxml.ns import qn
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

def extract_text_docx(filepath):
    doc = Document(filepath)
    full_text = []

    for block in doc.element.body:
        # Jika block adalah paragraf, gabungkan semua teks di dalamnya
        if block.tag.endswith('}p'):
            text = "".join(node.text or "" for node in block.iter() if node.tag.endswith('}t'))
            if text.strip():
                full_text.append(text.strip())
        # Jika block adalah tabel, gabungkan teks dari setiap sel dengan pemisah "|"
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
            model="nomic-embed-text-v2-moe",
            input=f"passage: {chunk}"
        )
        embedding = res["embeddings"][0]

        supabase.table("documents").insert({
            "content": chunk,
            "embedding": embedding,
            "metadata": {"source": filename, "chunk": i}
        }).execute()

        print(f"[{filename}] chunk {i+1}/{len(chunks)}")

# Run semua .docx di folder docs
for filename in os.listdir("docs"):
    if filename.endswith(".docx"):
        embed_and_upload(f"docs/{filename}")

print("Selesai!")