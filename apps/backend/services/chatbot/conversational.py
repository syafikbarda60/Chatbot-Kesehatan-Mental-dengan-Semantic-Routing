from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, AIMessage
from semantic_router import Route

_llm = None

def _get_llm():
    global _llm
    if _llm is None:
        _llm = ChatOllama(model="hf.co/SekarBestNY/llama-3-8b-instruct-gguf:Q4_K_M")
    return _llm

conversational_route = Route(
    name="conversational",
    utterances=[
        "halo",
        "hai",
        "apa kabar?",
        "terima kasih",
        "kamu siapa?",
        "bisa bantu saya?",
        "saya sedang sedih",
        "saya merasa kesepian",
        "saya butuh teman bicara",
        "saya tidak tahu harus bagaimana",
        "saya stres banget",
        "saya lelah",
        "saya merasa tidak dihargai",
        "saya butuh motivasi",
    ]
)

# SYSTEM_PROMPT = """Kamu adalah asisten psikologi yang empatik dan suportif.
# Kamu berbicara dalam Bahasa Indonesia yang hangat dan mudah dipahami.
# Dengarkan dan validasi perasaan pengguna, jangan menghakimi."""

SYSTEM_PROMPT = """Kamu adalah asisten psikologi yang empatik dan suportif bernama Hana.
Kamu berbicara dalam Bahasa Indonesia yang hangat dan mudah dipahami.
Dengarkan dan validasi perasaan pengguna, jangan menghakimi.
ATURAN KETAT YANG HARUS KAMU PATUHI:
1. Batasan Topik: Kamu HANYA boleh merespons topik seputar kesehatan mental, psikologi, perasaan, dukungan emosional, stres, atau depresi.
2. Penolakan Topik Luar: Jika pengguna bertanya hal di luar topik, tolak dengan sopan dengan mengatakan kamu adalah chatbot terapi.
3. Kata Kasar/Makian/Aneh: Jika pengguna mengetik kata-kata kasar, makian, ejekan, slang acak, atau kata-kata yang tidak bermakna (seperti umpatan), JANGAN menertawakannya, JANGAN menganggapnya lelucon, dan JANGAN menganggapnya nama barang/makanan. Tolak dengan tegas namun sopan, lalu kembalikan fokus ke kondisi mental mereka.
4. Gaya Bahasa: Tetap profesional. Jangan membalas dengan "Haha" kecuali konteksnya benar-benar pantas."""

chat_history = []

def get_conversational_response(user_message: str) -> str:
    chat_history.append(HumanMessage(content=user_message))
    response = _get_llm().invoke([HumanMessage(content=SYSTEM_PROMPT)] + chat_history)
    chat_history.append(AIMessage(content=response.content))
    return response.content

def stream_conversational_response(user_message: str):
    """Generator: yields text chunks from LLM stream."""
    messages = [HumanMessage(content=SYSTEM_PROMPT)] + chat_history + [HumanMessage(content=user_message)]
    full = []
    for chunk in _get_llm().stream(messages):
        token = chunk.content
        if token:
            full.append(token)
            yield token
    # Store full response in history after stream completes
    chat_history.append(HumanMessage(content=user_message))
    chat_history.append(AIMessage(content="".join(full)))

# Test
if __name__ == "__main__":
    tests = [
        "halo, aku lagi sedih banget hari ini",
        "aku ngerasa sendirian",
        "makasih udah dengerin aku",
    ]
    for t in tests:
        print(f"User: {t}")
        print(f"Hana: {get_conversational_response(t)}\n")