from cryptography.fernet import Fernet
import os

_raw_key = os.getenv("ENCRYPTION_KEY")
if not _raw_key:
    raise RuntimeError(
        "ENCRYPTION_KEY tidak ditemukan di .env. "
        "Generate dengan: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )
fernet = Fernet(_raw_key.encode())

def encrypt_text(text: str) -> str:
    return fernet.encrypt(text.encode()).decode()

def decrypt_text(token: str) -> str:
    return fernet.decrypt(token.encode()).decode()
