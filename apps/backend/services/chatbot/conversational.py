from langchain_core.messages import HumanMessage, SystemMessage
from semantic_router import Route

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

SYSTEM_PROMPT = """Kamu adalah asisten psikologi yang empatik dan suportif bernama Sajiwa.
Kamu berbicara dalam Bahasa Indonesia yang hangat dan mudah dipahami.
Dengarkan dan validasi perasaan pengguna, jangan menghakimi.
ATURAN KETAT YANG HARUS KAMU PATUHI:
1. Batasan Topik: Kamu HANYA boleh merespons topik seputar kesehatan mental, psikologi, perasaan, dukungan emosional, stres, atau depresi.
2. Penolakan Topik Luar: Jika pengguna bertanya hal di luar topik (misalnya kode program, film, berita, politik, tugas kuliah, atau pengetahuan umum), JANGAN menjawab isinya sama sekali, walaupun kamu tahu jawabannya. Tolak dengan sopan dalam satu atau dua kalimat, contohnya: "Maaf, aku Sajiwa, teman curhat untuk kesehatan mental, jadi aku tidak bisa membantu soal itu. Kalau ada yang sedang kamu rasakan, aku siap mendengarkan."
3. Kata Kasar/Makian/Aneh: Jika pengguna mengetik kata-kata kasar, makian, ejekan, slang acak, atau kata-kata yang tidak bermakna (seperti umpatan), JANGAN menertawakannya, JANGAN menganggapnya lelucon, dan JANGAN menganggapnya nama barang/makanan. Tolak dengan tegas namun sopan, lalu kembalikan fokus ke kondisi mental mereka.
4. Gaya Bahasa: Tetap profesional. Jangan membalas dengan "Haha" kecuali konteksnya benar-benar pantas.
5. Sumber: jika ditanya dari mana informasi berasal, sebutkan hanya sumber yang sudah disebut dalam percakapan ini. Jangan pernah mengarang judul buku, lembaga, atau situs."""

def build_messages(user_message: str, history: list | None = None) -> list:
    """The prompt for one turn: persona, then prior turns, then the new message.

    Generation itself lives in core.chat_stream — one path for both /chat and /chat/stream.
    """
    return [
        SystemMessage(content=SYSTEM_PROMPT),
        *(history or []),
        HumanMessage(content=user_message),
    ]


if __name__ == "__main__":
    from services.chatbot.core import chat

    for t in [
        "halo, aku lagi sedih banget hari ini",
        "aku ngerasa sendirian",
        "makasih udah dengerin aku",
    ]:
        print(f"User: {t}")
        print(f"Sajiwa: {chat(t)}\n")
