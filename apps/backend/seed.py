import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

def seed_admin():
    print("Menambahkan akun Admin Mock Data...")
    email = "admin@sanctuary.com"
    password = "adminpassword123"
    
    try:
        # 1. Sign Up Admin di Supabase Auth
        res = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "nama": "Super Administrator",
                    "role": "admin"
                }
            }
        })
        
        if res.user:
            user_id = res.user.id
            print(f"[OK] Auth user dibuat: {user_id}")
            
            # 2. Insert ke public.users
            supabase.table("users").upsert({
                "user_id": user_id,
                "email": email,
                "nama": "Super Administrator",
                "role": "admin"
            }, on_conflict="user_id").execute()
            
            print("[OK] Admin berhasil ditambahkan ke tabel public.users.")
            print("\n==================================")
            print("Gunakan kredensial ini untuk login:")
            print(f"Email    : {email}")
            print(f"Password : {password}")
            print("==================================\n")
        else:
            print("[GAGAL] Gagal membuat user.")
            
    except Exception as e:
        print(f"[INFO] Mungkin akun sudah ada atau terjadi error: {e}")

if __name__ == "__main__":
    seed_admin()
