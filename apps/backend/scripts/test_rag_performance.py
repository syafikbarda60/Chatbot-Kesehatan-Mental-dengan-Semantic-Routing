import os
import sys
import time

# Tambahkan path backend ke sys.path agar bisa import services
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.chatbot.rag import retrieve_docs

def test_rag_performance():
    queries = [
        "apa itu depresi?",
        "bagaimana cara mengatasi stres kerja?",
        "saya merasa cemas berlebihan",
        "apa bedanya bipolar dan perubahan mood biasa?",
        "apakah gangguan tidur berhubungan dengan kesehatan mental?"
    ]
    
    print("="*60)
    print(f"{'TEST RAG PERFORMANCE (Similarity & Latency)':^60}")
    print("="*60)
    
    total_time = 0
    
    for i, query in enumerate(queries, 1):
        print(f"\n[{i}] Query: '{query}'")
        
        # Mulai timer
        start_time = time.time()
        
        # Ambil dokumen
        try:
            docs = retrieve_docs(query, k=3)
            # Hitung waktu
            latency = time.time() - start_time
            total_time += latency
            
            print(f"   Latency: {latency:.4f} detik")
            
            if not docs:
                print("   [!] Tidak ada dokumen yang ditemukan (Similarity < 0.3)")
            else:
                for j, doc in enumerate(docs, 1):
                    # Biasanya RPC Supabase match_documents mereturn kolom 'similarity'
                    similarity = doc.get("similarity", "N/A")
                    if isinstance(similarity, float):
                        similarity = f"{similarity:.4f}"
                        
                    source = doc.get("metadata", {}).get("source", "Unknown")
                    content_preview = doc.get('content', '')[:60].replace('\n', ' ') + "..."
                    
                    print(f"   [Doc {j}] Similarity: {similarity} | Source: {source}")
                    print(f"      Preview: {content_preview}")
                    
        except Exception as e:
            print(f"   [Error] saat memproses kueri: {e}")

    print("\n" + "="*60)
    print(f"Rata-rata waktu kueri RAG: {(total_time/len(queries)):.4f} detik/kueri")
    print("="*60)

if __name__ == "__main__":
    test_rag_performance()
