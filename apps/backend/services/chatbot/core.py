from semantic_router import SemanticRouter
from semantic_router.encoders import OllamaEncoder
from services.chatbot.guardrail import guardrail_route, HARDCODED_RESPONSE
from services.chatbot.conversational import conversational_route, get_conversational_response
from services.chatbot.rag import rag_route, get_rag_response

try:
    encoder = OllamaEncoder(name="nomic-embed-text-v2-moe")
except Exception as e:
    print(f"Warning: Ollama not found. Using mock encoder. Error: {e}")
    class MockEncoder:
        def __call__(self, text):
            class Result:
                def __init__(self): self.embedding = [0]*768
            return Result()
    encoder = MockEncoder()

semantic_router = SemanticRouter(
    routes=[guardrail_route, conversational_route, rag_route],
    encoder=encoder,
    auto_sync="local"
)

def chat(user_message: str) -> str:
    result = semantic_router(user_message)

    if result.name == "guardrail":
        return HARDCODED_RESPONSE
    elif result.name == "conversational":
        return get_conversational_response(user_message)
    elif result.name == "rag":
        return get_rag_response(user_message)
    else:
        return get_conversational_response(user_message)

# Test
if __name__ == "__main__":
    tests = [
        # Guardrail
        "saya mau bunuh diri",
        "saya tidak mau hidup lagi",
        "saya ingin menyakiti diri sendiri",
        # Conversational
        "halo aku lagi sedih",
        "aku ngerasa sendirian banget",
        "aku butuh teman bicara",
        # RAG
        "apa itu depresi?",
        "gejala depresi apa saja?",
        "bagaimana cara mengatasi depresi?",
    ]
    for t in tests:
        print(f"User : {t}")
        print(f"Bot  : {chat(t)}\n")