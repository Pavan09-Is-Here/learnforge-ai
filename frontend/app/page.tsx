"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://learnforge-ai-backend.onrender.com";

// The backend identifies the caller from this token, so every request that
// touches user data must carry it. It never trusts a user id sent by the client.
async function authHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  return { ...extra, Authorization: `Bearer ${token}` };
}

type ChatHistoryItem = {
  id: string;
  question: string;
  learn_answer?: string;
  build_answer?: string;
  improve_answer?: string;
  troubleshoot_answer?: string;
  mode?: string;
  created_at: string;
  user_id?: string;
};

type ChatMessage = {
  id: string;
  chat_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type DocumentItem = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
};

type DocumentSource = {
  chunk_index: number;
  score: number;
  preview: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [chatId, setChatId] = useState("");
  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [answer, setAnswer] = useState("");
  const [buildAnswer, setBuildAnswer] = useState("");
  const [improveAnswer, setImproveAnswer] = useState("");
  const [troubleshootAnswer, setTroubleshootAnswer] = useState("");

  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState("");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [documentQuestion, setDocumentQuestion] = useState("");
  const [documentAnswer, setDocumentAnswer] = useState("");
  const [documentSources, setDocumentSources] = useState<DocumentSource[]>([]);

  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [improving, setImproving] = useState(false);
  const [troubleshooting, setTroubleshooting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [askingDocument, setAskingDocument] = useState(false);

  useEffect(() => {
    checkUser();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadHistory();
      loadDocuments();
    }
  }, [user]);

  const filteredHistory = useMemo(() => {
    const search = historySearch.toLowerCase().trim();

    if (!search) return history;

    return history.filter((item) =>
      item.question.toLowerCase().includes(search)
    );
  }, [history, historySearch]);

  async function checkUser() {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
  }

  async function signUp() {
    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    try {
      setAuthLoading(true);

      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        alert(error.message);
        return;
      }

      alert("Signup successful. You can now login.");
      setAuthMode("login");
    } finally {
      setAuthLoading(false);
    }
  }

  async function login() {
    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    try {
      setAuthLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert(error.message);
        return;
      }

      await checkUser();
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    newChat();
    setHistory([]);
    setDocuments([]);
    setSelectedDocumentId("");
    setDocumentQuestion("");
    setDocumentAnswer("");
    setDocumentSources([]);
  }

  async function askAI() {
    if (!question.trim()) {
      alert("Please type a question first.");
      return;
    }

    if (!user) {
      alert("Please login first.");
      return;
    }

    const userQuestion = question;

    try {
      setLoading(true);

      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          chat_id: chatId,
          user_id: user.id,
          role: "user",
          content: userQuestion,
          created_at: new Date().toISOString(),
        },
      ]);

      setQuestion("");

      const res = await fetch(`${BACKEND_URL}/ask`, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          question: userQuestion,
          chat_id: chatId || null,
        }),
      });

      const data = await res.json();

      setChatId(data.chat_id);
      setAnswer(data.answer);

      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          chat_id: data.chat_id,
          user_id: user.id,
          role: "assistant",
          content: data.answer,
          created_at: new Date().toISOString(),
        },
      ]);

      await loadHistory();
    } catch (error) {
      console.error(error);
      setAnswer("Error connecting to backend.");
    } finally {
      setLoading(false);
    }
  }

  async function buildThis() {
    if (!user) return;

    try {
      setBuilding(true);
      setBuildAnswer("");

      const res = await fetch(`${BACKEND_URL}/build`, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ question: answer || question, chat_id: chatId }),
      });

      const data = await res.json();

      setChatId(data.chat_id);
      setBuildAnswer(data.answer);

      await loadHistory();
    } catch (error) {
      console.error(error);
      setBuildAnswer("Error connecting to Build Mode.");
    } finally {
      setBuilding(false);
    }
  }

  async function improveThis() {
    if (!user) return;

    try {
      setImproving(true);
      setImproveAnswer("");

      const res = await fetch(`${BACKEND_URL}/improve`, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ question: answer || question, chat_id: chatId }),
      });

      const data = await res.json();

      setChatId(data.chat_id);
      setImproveAnswer(data.answer);

      await loadHistory();
    } catch (error) {
      console.error(error);
      setImproveAnswer("Error connecting to Improve Mode.");
    } finally {
      setImproving(false);
    }
  }

  async function troubleshootThis() {
    if (!user) return;

    try {
      setTroubleshooting(true);
      setTroubleshootAnswer("");

      const res = await fetch(`${BACKEND_URL}/troubleshoot`, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ question: answer || question, chat_id: chatId }),
      });

      const data = await res.json();

      setChatId(data.chat_id);
      setTroubleshootAnswer(data.answer);

      await loadHistory();
    } catch (error) {
      console.error(error);
      setTroubleshootAnswer("Error connecting to Troubleshoot Mode.");
    } finally {
      setTroubleshooting(false);
    }
  }

  async function loadHistory() {
    if (!user) return;

    try {
      setHistoryLoading(true);

      const res = await fetch(`${BACKEND_URL}/history`, {
        headers: await authHeaders(),
      });
      const data = await res.json();

      setHistory(data.history || []);
    } catch (error) {
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadMessages(activeChatId: string) {
    try {
      const res = await fetch(`${BACKEND_URL}/messages/${activeChatId}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();

      setChatMessages(data.messages || []);
    } catch (error) {
      console.error(error);
      setChatMessages([]);
    }
  }

  async function deleteHistoryItem(id: string) {
    if (!user) return;

    const confirmDelete = confirm("Delete this saved chat?");
    if (!confirmDelete) return;

    try {
      await fetch(`${BACKEND_URL}/history/${id}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });

      if (chatId === id) {
        newChat();
      }

      await loadHistory();
    } catch (error) {
      console.error(error);
      alert("Could not delete chat.");
    }
  }

  async function loadDocuments() {
    if (!user) return;

    try {
      setDocumentLoading(true);

      const res = await fetch(`${BACKEND_URL}/documents`, {
        headers: await authHeaders(),
      });
      const data = await res.json();

      setDocuments(data.documents || []);
    } catch (error) {
      console.error(error);
      alert("Could not load documents.");
    } finally {
      setDocumentLoading(false);
    }
  }

  async function uploadDocument(file: File | null) {
    if (!user) return;

    if (!file) {
      alert("Please choose a PDF file.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Only PDF files are supported for now.");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${BACKEND_URL}/documents/upload`, {
        method: "POST",
        headers: await authHeaders(),
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Upload failed.");
        return;
      }

      alert("PDF uploaded successfully.");
      await loadDocuments();
      setSelectedDocumentId(data.document_id);
      setDocumentSources([]);
    } catch (error) {
      console.error(error);
      alert("Could not upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function askFromDocument() {
    if (!user) return;

    if (!selectedDocumentId) {
      alert("Please select a document first.");
      return;
    }

    if (!documentQuestion.trim()) {
      alert("Please type a document question.");
      return;
    }

    try {
      setAskingDocument(true);
      setDocumentAnswer("");
      setDocumentSources([]);

      const res = await fetch(`${BACKEND_URL}/documents/ask`, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          document_id: selectedDocumentId,
          question: documentQuestion,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDocumentAnswer(data.detail || "Could not answer from document.");
        setDocumentSources([]);
        return;
      }

      setDocumentAnswer(data.answer);
      setDocumentSources(data.sources || []);
    } catch (error) {
      console.error(error);
      setDocumentAnswer("Error connecting to Document Mode.");
      setDocumentSources([]);
    } finally {
      setAskingDocument(false);
    }
  }

  async function deleteDocument(documentId: string) {
    if (!user) return;

    const confirmDelete = confirm("Delete this uploaded document?");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${BACKEND_URL}/documents/${documentId}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });

      if (!res.ok) {
        alert("Could not delete document.");
        return;
      }

      if (selectedDocumentId === documentId) {
        setSelectedDocumentId("");
        setDocumentQuestion("");
        setDocumentAnswer("");
        setDocumentSources([]);
      }

      await loadDocuments();
    } catch (error) {
      console.error(error);
      alert("Could not delete document.");
    }
  }

  async function openHistoryItem(item: ChatHistoryItem) {
    if (!user) return;

    setChatId(item.id || "");
    setQuestion("");
    setAnswer(item.learn_answer || "");
    setBuildAnswer(item.build_answer || "");
    setImproveAnswer(item.improve_answer || "");
    setTroubleshootAnswer(item.troubleshoot_answer || "");

    await loadMessages(item.id);
  }

  function newChat() {
    setChatId("");
    setQuestion("");
    setChatMessages([]);
    setAnswer("");
    setBuildAnswer("");
    setImproveAnswer("");
    setTroubleshootAnswer("");
  }

  async function downloadPDF(content: string, title: string) {
    try {
      setPdfLoading(true);

      const res = await fetch(`${BACKEND_URL}/generate-pdf`, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title, content }),
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "learnforge-output.pdf";
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("PDF generation failed.");
    } finally {
      setPdfLoading(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-sm border p-8 w-full max-w-md text-center">
          <p className="text-sm font-semibold text-red-600 mb-2">
            Configuration missing
          </p>
          <p className="text-slate-600 text-sm">
            This deployment is missing{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Add
            them in the Vercel project settings, then redeploy.
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-sm border p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <p className="text-sm font-semibold text-blue-600 mb-2">
              LearnForge AI
            </p>
            <h1 className="text-4xl font-bold mb-2">
              {authMode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-slate-500">
              Learn, build, improve, and troubleshoot with AI.
            </p>
          </div>

          <div className="space-y-4">
            <input
              className="w-full border border-slate-300 rounded-xl px-4 py-3"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-300 rounded-xl px-4 py-3"
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="bg-gray-200 px-4 rounded-xl font-bold"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <button
              onClick={authMode === "login" ? login : signUp}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold"
            >
              {authLoading
                ? "Please wait..."
                : authMode === "login"
                ? "Login"
                : "Sign Up"}
            </button>
          </div>

          <div className="mt-6 text-center">
            {authMode === "login" ? (
              <button
                onClick={() => setAuthMode("signup")}
                className="text-blue-600 font-semibold"
              >
                New user? Create an account
              </button>
            ) : (
              <button
                onClick={() => setAuthMode("login")}
                className="text-blue-600 font-semibold"
              >
                Already have an account? Login
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-600 mb-2">
              LearnForge AI MVP
            </p>
            <h1 className="text-5xl font-bold mb-3">LearnForge AI</h1>
            <p className="text-slate-600 text-lg">
              Learn anything. Build anything. Improve everything. Troubleshoot
              anything.
            </p>
          </div>

          <div className="bg-white border rounded-2xl p-4 text-sm">
            <p className="text-slate-500">Signed in as</p>
            <p className="font-semibold mb-3">{user.email}</p>
            <button
              onClick={logout}
              className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="bg-white rounded-3xl shadow-sm border p-4 h-fit">
            <div className="flex items-center justify-between mb-4 gap-2">
              <div>
                <h2 className="font-bold text-xl">History</h2>
                <p className="text-xs text-slate-500">
                  {history.length} private chats
                </p>
              </div>

              <button
                onClick={newChat}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm"
              >
                New
              </button>
            </div>

            <input
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-3 text-sm"
              placeholder="Search history..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />

            <button
              onClick={() => loadHistory()}
              className="w-full bg-slate-900 hover:bg-black text-white px-3 py-2 rounded-xl text-sm mb-4"
            >
              {historyLoading ? "Refreshing..." : "Refresh History"}
            </button>

            {filteredHistory.length === 0 && (
              <p className="text-slate-500 text-sm">No matching chats.</p>
            )}

            <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className={`border rounded-2xl p-3 transition ${
                    chatId === item.id
                      ? "bg-blue-50 border-blue-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <button
                    onClick={() => openHistoryItem(item)}
                    className="w-full text-left"
                  >
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      {item.mode || "learn"}
                    </span>

                    <p className="font-semibold text-sm line-clamp-2 mt-2">
                      {item.question}
                    </p>

                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </button>

                  <button
                    onClick={() => deleteHistoryItem(item.id)}
                    className="mt-3 text-xs text-red-600 font-semibold"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <section className="lg:col-span-3">
            <div className="bg-white rounded-3xl shadow-sm border p-6 mb-6">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <label className="block font-bold text-lg">
                    Ask your question
                  </label>
                  <p className="text-sm text-slate-500">
                    Ask follow-up questions in the same chat. LearnForge will remember context.
                  </p>
                </div>

                {chatId && (
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                    Memory active
                  </span>
                )}
              </div>

              <textarea
                className="w-full border border-slate-300 rounded-2xl p-4 mb-4"
                rows={4}
                placeholder="Example: What is Machine Learning? Then ask: explain it more simply"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={askAI}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-semibold"
                >
                  {loading ? "Thinking..." : chatId ? "Send Follow-up" : "Ask AI"}
                </button>

                {chatMessages.length > 0 && (
                  <>
                    <button
                      onClick={buildThis}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-semibold"
                    >
                      {building ? "Building..." : "Build This"}
                    </button>

                    <button
                      onClick={improveThis}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-semibold"
                    >
                      {improving ? "Improving..." : "Improve This"}
                    </button>

                    <button
                      onClick={troubleshootThis}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-semibold"
                    >
                      {troubleshooting
                        ? "Troubleshooting..."
                        : "Troubleshoot This"}
                    </button>
                  </>
                )}

                {(chatMessages.length > 0 || question) && (
                  <button
                    onClick={newChat}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-3 rounded-2xl font-semibold"
                  >
                    New Chat
                  </button>
                )}
              </div>
            </div>

            {chatMessages.length > 0 && (
              <section className="bg-white rounded-3xl shadow-sm border p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">Conversation</h2>

                <div className="space-y-4">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-2xl p-4 whitespace-pre-wrap leading-7 ${
                        msg.role === "user"
                          ? "bg-blue-50 border border-blue-100"
                          : "bg-slate-50 border"
                      }`}
                    >
                      <p className="text-xs font-bold mb-2 text-slate-500">
                        {msg.role === "user" ? "You" : "LearnForge AI"}
                      </p>
                      {msg.content}
                    </div>
                  ))}
                </div>

                {answer && (
                  <button
                    onClick={() =>
                      downloadPDF(answer, "LearnForge AI - Latest Answer")
                    }
                    className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-semibold"
                  >
                    {pdfLoading ? "Generating..." : "Download Latest Answer PDF"}
                  </button>
                )}
              </section>
            )}

            <DocumentMode
              documents={documents}
              selectedDocumentId={selectedDocumentId}
              setSelectedDocumentId={setSelectedDocumentId}
              documentQuestion={documentQuestion}
              setDocumentQuestion={setDocumentQuestion}
              documentAnswer={documentAnswer}
              documentSources={documentSources}
              uploadDocument={uploadDocument}
              loadDocuments={() => loadDocuments()}
              askFromDocument={askFromDocument}
              deleteDocument={deleteDocument}
              documentLoading={documentLoading}
              uploading={uploading}
              askingDocument={askingDocument}
            />

            {buildAnswer && (
              <AnswerCard
                title="Build Mode Guide"
                badge="Build"
                content={buildAnswer}
                pdfLoading={pdfLoading}
                onDownload={() =>
                  downloadPDF(buildAnswer, "LearnForge AI - Build Guide")
                }
              />
            )}

            {improveAnswer && (
              <AnswerCard
                title="Improve Mode Guide"
                badge="Improve"
                content={improveAnswer}
                pdfLoading={pdfLoading}
                onDownload={() =>
                  downloadPDF(improveAnswer, "LearnForge AI - Improve Guide")
                }
              />
            )}

            {troubleshootAnswer && (
              <AnswerCard
                title="Troubleshoot Mode Guide"
                badge="Troubleshoot"
                content={troubleshootAnswer}
                pdfLoading={pdfLoading}
                onDownload={() =>
                  downloadPDF(
                    troubleshootAnswer,
                    "LearnForge AI - Troubleshoot Guide"
                  )
                }
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function DocumentMode({
  documents,
  selectedDocumentId,
  setSelectedDocumentId,
  documentQuestion,
  setDocumentQuestion,
  documentAnswer,
  documentSources,
  uploadDocument,
  loadDocuments,
  askFromDocument,
  deleteDocument,
  documentLoading,
  uploading,
  askingDocument,
}: {
  documents: DocumentItem[];
  selectedDocumentId: string;
  setSelectedDocumentId: (id: string) => void;
  documentQuestion: string;
  setDocumentQuestion: (q: string) => void;
  documentAnswer: string;
  documentSources: DocumentSource[];
  uploadDocument: (file: File | null) => void;
  loadDocuments: () => void;
  askFromDocument: () => void;
  deleteDocument: (id: string) => void;
  documentLoading: boolean;
  uploading: boolean;
  askingDocument: boolean;
}) {
  return (
    <section className="bg-white rounded-3xl shadow-sm border p-6 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <span className="inline-block text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full mb-2">
            RAG Knowledge Base
          </span>
          <h2 className="text-2xl font-bold">Ask from PDF</h2>
          <p className="text-sm text-slate-500">
            Upload a PDF and ask questions based on its content.
          </p>
        </div>

        <button
          onClick={loadDocuments}
          className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl font-semibold"
        >
          {documentLoading ? "Loading..." : "Refresh Docs"}
        </button>
      </div>

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => uploadDocument(e.target.files?.[0] || null)}
        className="w-full border border-slate-300 rounded-xl p-3 mb-4"
      />

      {uploading && (
        <p className="text-sm text-blue-600 font-semibold mb-4">
          Uploading and reading PDF...
        </p>
      )}

      <select
        className="w-full border border-slate-300 rounded-xl p-3 mb-4"
        value={selectedDocumentId}
        onChange={(e) => setSelectedDocumentId(e.target.value)}
      >
        <option value="">Select uploaded document</option>
        {documents.map((doc) => (
          <option key={doc.id} value={doc.id}>
            {doc.title}
          </option>
        ))}
      </select>

      {selectedDocumentId && (
        <button
          onClick={() => deleteDocument(selectedDocumentId)}
          className="mb-4 text-sm text-red-600 font-semibold"
        >
          Delete Selected Document
        </button>
      )}

      <textarea
        className="w-full border border-slate-300 rounded-2xl p-4 mb-4"
        rows={4}
        placeholder="Ask a question from the selected PDF..."
        value={documentQuestion}
        onChange={(e) => setDocumentQuestion(e.target.value)}
      />

      <button
        onClick={askFromDocument}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-semibold"
      >
        {askingDocument ? "Reading Document..." : "Ask From PDF"}
      </button>

      {documentAnswer && (
        <div className="mt-6 border rounded-2xl p-4 bg-slate-50 whitespace-pre-wrap leading-7">
          {documentAnswer}
        </div>
      )}

      {documentSources.length > 0 && (
        <div className="mt-4 border rounded-2xl p-4 bg-white">
          <h3 className="font-bold mb-3">Sources Used</h3>

          <div className="space-y-3">
            {documentSources.map((source) => (
              <div
                key={source.chunk_index}
                className="border rounded-xl p-3 bg-slate-50"
              >
                <p className="font-semibold text-sm mb-2">
                  Chunk {source.chunk_index} • Score {source.score}
                </p>

                <p className="text-sm text-slate-700">{source.preview}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AnswerCard({
  title,
  badge,
  content,
  pdfLoading,
  onDownload,
}: {
  title: string;
  badge: string;
  content: string;
  pdfLoading: boolean;
  onDownload: () => void;
}) {
  return (
    <section className="bg-white rounded-3xl shadow-sm border p-6 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <span className="inline-block text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full mb-2">
            {badge}
          </span>
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>

        <button
          onClick={onDownload}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-semibold"
        >
          {pdfLoading ? "Generating..." : "Download PDF"}
        </button>
      </div>

      <div className="whitespace-pre-wrap leading-7 text-slate-800">
        {content}
      </div>
    </section>
  );
}