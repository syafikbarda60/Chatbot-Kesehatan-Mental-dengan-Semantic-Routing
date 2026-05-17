from cryptography.fernet import Fernet
import os
import sys

_raw_key = os.getenv("ENCRYPTION_KEY")
if _raw_key:
    fernet = Fernet(_raw_key.encode())
else:
    # Generate satu kali dan print peringatan — simpan ke .env segera
    _generated = Fernet.generate_key()
    print(
        f"[WARNING] ENCRYPTION_KEY tidak ditemukan di .env. "
        f"Gunakan key berikut:\nENCRYPTION_KEY={_generated.decode()}",
        file=sys.stderr,
    )
    fernet = Fernet(_generated)

def encrypt_text(text: str) -> str:
    return fernet.encrypt(text.encode()).decode()

def decrypt_text(token: str) -> str:
    return fernet.decrypt(token.encode()).decode()
