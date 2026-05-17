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

_llm = None
_embeddings = None

def _get_llm():
    global _llm
    if _llm is None:
        _llm = ChatOllama(model="llama3.2:3b")
    return _llm

def _get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = OllamaEmbeddings(model="nomic-embed-text-v2-moe")
    return _embeddings

chat_history = []

def retrieve_docs(query: str, k: int = 5):
    query_embedding = _get_embeddings().embed_query(query)
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
    response = _get_llm().invoke(chat_history)
    chat_history.append(AIMessage(content=response.content))

    return response.content

def stream_rag_response(user_message: str):
    """Generator: yields text chunks from RAG+LLM stream."""
    docs = retrieve_docs(user_message)

    if not docs:
        yield "Maaf, saya tidak menemukan informasi terkait di dokumen."
        return

    context = "\n---\n".join([d["content"] for d in docs])
    prompt = f"""Gunakan konteks berikut untuk menjawab pertanyaan dalam Bahasa Indonesia.
Jika tidak ada di konteks, katakan kamu tidak tahu.

Konteks:
{context}

Pertanyaan: {user_message}"""

    messages = chat_history + [HumanMessage(content=prompt)]
    full = []
    for chunk in _get_llm().stream(messages):
        token = chunk.content
        if token:
            full.append(token)
            yield token
    chat_history.append(HumanMessage(content=prompt))
    chat_history.append(AIMessage(content="".join(full)))

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