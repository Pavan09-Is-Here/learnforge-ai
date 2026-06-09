from fastapi import FastAPI
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


class ModeRequest(BaseModel):
    question: str
    chat_id: str | None = None


class PDFRequest(BaseModel):
    title: str
    content: str


def generate_ai_response(prompt: str):
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        temperature=0.4,
        max_tokens=2048,
    )

    return response.choices[0].message.content


@app.get("/")
def home():
    return {
        "message": "LearnForge AI backend is running with Groq and Supabase"
    }


@app.post("/ask")
def ask_question(request: AskRequest):
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

    result = supabase.table("chats").insert({
        "question": request.question,
        "learn_answer": answer,
        "mode": "learn"
    }).execute()

    chat_id = result.data[0]["id"]

    return {
        "chat_id": chat_id,
        "answer": answer
    }


@app.post("/build")
def build_thing(request: ModeRequest):
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
- Make the guide practical and beginner-friendly.
"""

    answer = generate_ai_response(prompt)

    if request.chat_id:
        supabase.table("chats").update({
            "build_answer": answer,
            "mode": "build"
        }).eq("id", request.chat_id).execute()
    else:
        result = supabase.table("chats").insert({
            "question": request.question,
            "build_answer": answer,
            "mode": "build"
        }).execute()
        request.chat_id = result.data[0]["id"]

    return {
        "chat_id": request.chat_id,
        "answer": answer
    }


@app.post("/improve")
def improve_thing(request: ModeRequest):
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
- Make the guide easy to understand and actionable.
"""

    answer = generate_ai_response(prompt)

    if request.chat_id:
        supabase.table("chats").update({
            "improve_answer": answer,
            "mode": "improve"
        }).eq("id", request.chat_id).execute()
    else:
        result = supabase.table("chats").insert({
            "question": request.question,
            "improve_answer": answer,
            "mode": "improve"
        }).execute()
        request.chat_id = result.data[0]["id"]

    return {
        "chat_id": request.chat_id,
        "answer": answer
    }


@app.post("/troubleshoot")
def troubleshoot_thing(request: ModeRequest):
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
- Make the guide safe, practical, and beginner-friendly.
"""

    answer = generate_ai_response(prompt)

    if request.chat_id:
        supabase.table("chats").update({
            "troubleshoot_answer": answer,
            "mode": "troubleshoot"
        }).eq("id", request.chat_id).execute()
    else:
        result = supabase.table("chats").insert({
            "question": request.question,
            "troubleshoot_answer": answer,
            "mode": "troubleshoot"
        }).execute()
        request.chat_id = result.data[0]["id"]

    return {
        "chat_id": request.chat_id,
        "answer": answer
    }


@app.get("/history")
def get_history():
    result = (
        supabase
        .table("chats")
        .select("*")
        .order("created_at", desc=True)
        .limit(30)
        .execute()
    )

    return {"history": result.data}


@app.post("/generate-pdf")
def generate_pdf(request: PDFRequest):
    file_name = "learnforge_output.pdf"

    pdf = canvas.Canvas(file_name, pagesize=A4)
    width, height = A4
    y = height - 50

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(50, y, request.title)
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