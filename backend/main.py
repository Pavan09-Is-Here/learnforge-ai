from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
from supabase import create_client
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import textwrap
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.79:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)


class AskRequest(BaseModel):
    question: str
    user_id: str


class ModeRequest(BaseModel):
    question: str
    user_id: str
    chat_id: str | None = None


class PDFRequest(BaseModel):
    title: str
    content: str


def validate_question(question: str):
    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")


def generate_ai_response(prompt: str):
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=2048,
        )
        return response.choices[0].message.content
    except Exception as error:
        print("GROQ ERROR:", error)
        raise HTTPException(
            status_code=503,
            detail="AI service temporarily unavailable. Please try again."
        )


def safe_insert_chat(data: dict):
    try:
        result = supabase.table("chats").insert(data).execute()
        return result.data[0]["id"]
    except Exception as error:
        print("SUPABASE INSERT ERROR:", error)
        return None


def safe_update_chat(chat_id: str, user_id: str, data: dict):
    try:
        supabase.table("chats").update(data).eq("id", chat_id).eq("user_id", user_id).execute()
    except Exception as error:
        print("SUPABASE UPDATE ERROR:", error)


@app.get("/")
def home():
    return {"message": "LearnForge AI backend running with private history"}


@app.post("/ask")
def ask_question(request: AskRequest):
    validate_question(request.question)

    prompt = f"""
You are LearnForge AI.

Explain the user's question clearly using this structure:

1. Topic Title
2. Quick Answer
3. Simple Explanation
4. Real-Life Uses
5. Where It Is Used
6. How It Works
7. Advantages
8. Disadvantages
9. Examples
10. Common Mistakes
11. Related Topics
12. Summary
13. Suggested Next Actions

Important Formatting Rules:
- Do not use Markdown.
- Do not use # symbols.
- Do not use * symbols.
- Use clean plain text.
- Use numbered section titles.
- Use dash bullets instead of star bullets.
- Make the response beginner-friendly and practical.

User Question:
{request.question}
"""

    answer = generate_ai_response(prompt)

    chat_id = safe_insert_chat({
        "question": request.question,
        "learn_answer": answer,
        "mode": "learn",
        "user_id": request.user_id
    })

    return {"chat_id": chat_id, "answer": answer}


@app.post("/build")
def build_thing(request: ModeRequest):
    validate_question(request.question)

    prompt = f"""
You are LearnForge AI Build Mode.

Create a complete practical building guide for:

{request.question}

Use this structure:

1. Project Title
2. What We Are Building
3. Difficulty Level
4. Time Required
5. Estimated Budget
6. Required Skills
7. Required Materials
8. Required Tools
9. Safety Precautions
10. Step-by-Step Procedure
11. Testing Method
12. Common Problems
13. Troubleshooting Guide
14. Improvement Ideas
15. Final Checklist
16. Summary

Important Formatting Rules:
- Do not use Markdown.
- Do not use # symbols.
- Do not use * symbols.
- Use clean plain text.
- Use numbered section titles.
- Use dash bullets instead of star bullets.
"""

    answer = generate_ai_response(prompt)

    chat_id = request.chat_id

    if chat_id:
        safe_update_chat(chat_id, request.user_id, {
            "build_answer": answer,
            "mode": "build"
        })
    else:
        chat_id = safe_insert_chat({
            "question": request.question,
            "build_answer": answer,
            "mode": "build",
            "user_id": request.user_id
        })

    return {"chat_id": chat_id, "answer": answer}


@app.post("/improve")
def improve_thing(request: ModeRequest):
    validate_question(request.question)

    prompt = f"""
You are LearnForge AI Improve Mode.

Create a complete improvement guide for:

{request.question}

Use this structure:

1. Improvement Title
2. Current Version / Current Understanding
3. Main Weaknesses
4. Improvement Goals
5. Performance Improvements
6. Cost Reduction Ideas
7. Quality Improvements
8. Better Tools or Materials
9. Step-by-Step Improvement Plan
10. Testing After Improvement
11. Before vs After Comparison
12. Risks or Limitations
13. Final Recommendations
14. Summary

Important Formatting Rules:
- Do not use Markdown.
- Do not use # symbols.
- Do not use * symbols.
- Use clean plain text.
- Use numbered section titles.
- Use dash bullets instead of star bullets.
"""

    answer = generate_ai_response(prompt)

    chat_id = request.chat_id

    if chat_id:
        safe_update_chat(chat_id, request.user_id, {
            "improve_answer": answer,
            "mode": "improve"
        })
    else:
        chat_id = safe_insert_chat({
            "question": request.question,
            "improve_answer": answer,
            "mode": "improve",
            "user_id": request.user_id
        })

    return {"chat_id": chat_id, "answer": answer}


@app.post("/troubleshoot")
def troubleshoot_thing(request: ModeRequest):
    validate_question(request.question)

    prompt = f"""
You are LearnForge AI Troubleshoot Mode.

Create a complete troubleshooting guide for:

{request.question}

Use this structure:

1. Troubleshooting Title
2. Problem Summary
3. Possible Causes
4. Most Likely Cause
5. Diagnostic Steps
6. Step-by-Step Fixes
7. What Not To Do
8. Prevention Tips
9. When To Ask An Expert
10. Final Checklist
11. Summary

Important Formatting Rules:
- Do not use Markdown.
- Do not use # symbols.
- Do not use * symbols.
- Use clean plain text.
- Use numbered section titles.
- Use dash bullets instead of star bullets.
"""

    answer = generate_ai_response(prompt)

    chat_id = request.chat_id

    if chat_id:
        safe_update_chat(chat_id, request.user_id, {
            "troubleshoot_answer": answer,
            "mode": "troubleshoot"
        })
    else:
        chat_id = safe_insert_chat({
            "question": request.question,
            "troubleshoot_answer": answer,
            "mode": "troubleshoot",
            "user_id": request.user_id
        })

    return {"chat_id": chat_id, "answer": answer}


@app.get("/history/{user_id}")
def get_history(user_id: str):
    try:
        result = (
            supabase
            .table("chats")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(30)
            .execute()
        )
        return {"history": result.data}
    except Exception as error:
        print("SUPABASE HISTORY ERROR:", error)
        return {"history": []}


@app.delete("/history/{user_id}/{chat_id}")
def delete_history(user_id: str, chat_id: str):
    try:
        supabase.table("chats").delete().eq("id", chat_id).eq("user_id", user_id).execute()
        return {"message": "Chat deleted successfully"}
    except Exception as error:
        print("SUPABASE DELETE ERROR:", error)
        raise HTTPException(status_code=500, detail="Could not delete chat.")


@app.post("/generate-pdf")
def generate_pdf(request: PDFRequest):
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="PDF content cannot be empty.")

    file_name = "learnforge_output.pdf"

    pdf = canvas.Canvas(file_name, pagesize=A4)
    width, height = A4
    y = height - 50

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(50, y, request.title or "LearnForge AI Output")
    y -= 40

    pdf.setFont("Helvetica", 11)

    clean_content = request.content.replace("#", "").replace("*", "")
    lines = clean_content.split("\n")

    for line in lines:
        wrapped_lines = textwrap.wrap(line, width=90)

        if not wrapped_lines:
            y -= 14

        for wrapped_line in wrapped_lines:
            if y < 50:
                pdf.showPage()
                pdf.setFont("Helvetica", 11)
                y = height - 50

            pdf.drawString(50, y, wrapped_line)
            y -= 16

    pdf.save()

    return FileResponse(
        file_name,
        media_type="application/pdf",
        filename=file_name
    )