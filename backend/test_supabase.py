from dotenv import load_dotenv
from supabase import create_client
import os

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

print("URL:", url)
print("KEY START:", key[:10] if key else None)

supabase = create_client(url, key)

result = supabase.table("chats").select("*").limit(1).execute()

print("SUCCESS")
print(result.data)