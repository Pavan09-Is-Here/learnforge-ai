# LearnForge AI

LearnForge AI is an educational AI platform designed to help people truly understand knowledge instead of memorizing answers.

## Features

- Learn Mode
- Build Mode
- Improve Mode
- Troubleshoot Mode
- Document (PDF) Q&A
- PDF Generation
- Groq AI Integration

## Tech Stack

### Frontend
- Next.js
- React
- Tailwind CSS

### Backend
- FastAPI
- Python
- Groq API
- Supabase (auth + database)

## Project Structure

learnforge-ai/
├── backend/
├── frontend/
└── README.md

## Setup

Secrets are never committed. Copy the example files and fill in your own values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

`backend/.env` needs a Groq API key, your Supabase URL, and the Supabase anon
key. `frontend/.env.local` needs the same Supabase values prefixed with
`NEXT_PUBLIC_`, plus the backend URL.

Run the backend:

```bash
pip install -r backend/requirements.txt && uvicorn main:app --reload --app-dir backend
```

Run the frontend:

```bash
cd frontend && npm install && npm run dev
```

## Authentication

Every endpoint except `/` requires a Supabase access token, sent as
`Authorization: Bearer <token>`. The backend resolves the user id from that
verified token and never trusts a user id supplied in a URL or request body, so
one signed-in user cannot read or delete another user's chats or documents.

## Current Status

MVP Version 1

Completed:
- Learn Mode
- Build Mode
- Improve Mode
- Troubleshoot Mode
- PDF Download