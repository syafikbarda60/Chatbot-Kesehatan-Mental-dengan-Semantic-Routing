from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, AIMessage
from semantic_router import Route

llm = ChatOllama(model="llama3.2:3b")

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

SYSTEM_PROMPT = """Kamu adalah asisten psikologi yang empatik dan suportif bernama Hana.
Kamu berbicara dalam Bahasa Indonesia yang hangat dan mudah dipahami.
Dengarkan dan validasi perasaan pengguna, jangan menghakimi."""

chat_history = []

def get_conversational_response(user_message: str) -> str:
    chat_history.append(HumanMessage(content=user_message))
    response = llm.invoke([HumanMessage(content=SYSTEM_PROMPT)] + chat_history)
    chat_history.append(AIMessage(content=response.content))
    return response.content

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