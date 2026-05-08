from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_core.messages import HumanMessage, AIMessage
from supabase import create_client
from semantic_router import Route
import os
from dotenv import load_dotenv

load_dotenv()


rag_route = Route(
    name="rag",
    utterances=[
        "apa itu depresi?",
        "apa saja gejala depresi?",
        "bagaimana cara menangani depresi?",
        "apa penyebab depresi?",
        "jelaskan tentang kesehatan mental",
        "apa itu anxiety?",
        "bagaimana cara mengatasi stres?",
        "apa itu gangguan jiwa?",
        "terapi apa yang cocok untuk depresi?",
        "apa bedanya depresi dan sedih biasa?",
    ]
)

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))
llm = ChatOllama(model="llama3.2:3b")
embeddings = OllamaEmbeddings(model="nomic-embed-text-v2-moe")

chat_history = []

def retrieve_docs(query: str, k: int = 5):
    query_embedding = embeddings.embed_query(query)
    result = supabase.rpc("match_documents", {
        "query_embedding": query_embedding,
        "match_threshold": 0.3,
        "match_count": k
    }).execute()
    return result.data or []

def get_rag_response(user_message: str) -> str:
    docs = retrieve_docs(user_message)
    
    if not docs:
        return "Maaf, saya tidak menemukan informasi terkait di dokumen."
    
    context = "\n---\n".join([d["content"] for d in docs])

    prompt = f"""Gunakan konteks berikut untuk menjawab pertanyaan dalam Bahasa Indonesia.
Jika tidak ada di konteks, katakan kamu tidak tahu.

Konteks:
{context}

Pertanyaan: {user_message}"""

    chat_history.append(HumanMessage(content=prompt))
    response = llm.invoke(chat_history)
    chat_history.append(AIMessage(content=response.content))

    return response.content

if __name__ == "__main__":
    tests = [
        "apa itu depresi?",
        "siapa itu mr ambatunat?",
        "apa saja gejala depresi?",
        "bagaimana cara menangani depresi?"
    ]
    for t in tests:
        print(f"User: {t}")
        print(f"RAG: {get_rag_response(t)}\n")