from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from prometheus_fastapi_instrumentator import Instrumentator
import httpx

app = FastAPI()
Instrumentator().instrument(app).expose(app)

DB_URL = "postgresql://chatuser:chatpass@192.168.122.14:5432/chatdb"
OLLAMA_URL = "http://localhost:11434"
engine = create_engine(DB_URL)

@app.on_event("startup")
def startup():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                role TEXT,
                content TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.commit()

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat(req: ChatRequest):
    with engine.connect() as conn:
        conn.execute(text("INSERT INTO messages (role,content) VALUES (:r,:c)"),
                     {"r": "user", "c": req.message})
        conn.commit()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(f"{OLLAMA_URL}/api/generate", json={
            "model": "phi3",
            "prompt": req.message,
            "stream": False
        })
    reply = resp.json().get("response", "No response")
    with engine.connect() as conn:
        conn.execute(text("INSERT INTO messages (role,content) VALUES (:r,:c)"),
                     {"r": "assistant", "c": reply})
        conn.commit()
    return {"reply": reply}

@app.get("/history")
def history():
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT role, content FROM messages ORDER BY created_at")
        ).fetchall()
    return [{"role": r[0], "content": r[1]} for r in rows]

@app.get("/health")
def health():
    return {"status": "ok"}
