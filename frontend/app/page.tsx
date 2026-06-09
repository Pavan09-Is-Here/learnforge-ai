"use client";

import { useEffect, useState } from "react";

type ChatHistoryItem = {
  id: string;
  question: string;
  learn_answer?: string;
  build_answer?: string;
  improve_answer?: string;
  troubleshoot_answer?: string;
  mode?: string;
  created_at: string;
};

export default function Home() {
  const [chatId, setChatId] = useState("");
  const [question, setQuestion] = useState("");

  const [answer, setAnswer] = useState("");
  const [buildAnswer, setBuildAnswer] = useState("");
  const [improveAnswer, setImproveAnswer] = useState("");
  const [troubleshootAnswer, setTroubleshootAnswer] = useState("");

  const [history, setHistory] = useState<ChatHistoryItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [improving, setImproving] = useState(false);
  const [troubleshooting, setTroubleshooting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  async function askAI() {
    if (!question.trim()) {
      alert("Please type a question first.");
      return;
    }

    try {
      setLoading(true);
      setChatId("");
      setAnswer("");
      setBuildAnswer("");
      setImproveAnswer("");
      setTroubleshootAnswer("");

      const res = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();

      setChatId(data.chat_id);
      setAnswer(data.answer);

      await loadHistory();
    } catch (error) {
      console.error(error);
      setAnswer("Error connecting to backend.");
    } finally {
      setLoading(false);
    }
  }

  async function buildThis() {
    try {
      setBuilding(true);
      setBuildAnswer("");

      const res = await fetch("http://127.0.0.1:8000/build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          chat_id: chatId,
        }),
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
    try {
      setImproving(true);
      setImproveAnswer("");

      const res = await fetch("http://127.0.0.1:8000/improve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          chat_id: chatId,
        }),
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
    try {
      setTroubleshooting(true);
      setTroubleshootAnswer("");

      const res = await fetch("http://127.0.0.1:8000/troubleshoot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          chat_id: chatId,
        }),
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
    try {
      setHistoryLoading(true);

      const res = await fetch("http://127.0.0.1:8000/history");
      const data = await res.json();

      setHistory(data.history || []);
    } catch (error) {
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openHistoryItem(item: ChatHistoryItem) {
    setChatId(item.id || "");
    setQuestion(item.question || "");
    setAnswer(item.learn_answer || "");
    setBuildAnswer(item.build_answer || "");
    setImproveAnswer(item.improve_answer || "");
    setTroubleshootAnswer(item.troubleshoot_answer || "");
  }

  function newChat() {
    setChatId("");
    setQuestion("");
    setAnswer("");
    setBuildAnswer("");
    setImproveAnswer("");
    setTroubleshootAnswer("");
  }

  async function downloadPDF(content: string, title: string) {
    try {
      setPdfLoading(true);

      const res = await fetch("http://127.0.0.1:8000/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-5xl font-bold mb-3">LearnForge AI</h1>
          <p className="text-slate-600 text-lg">
            Learn anything. Build anything. Improve everything. Troubleshoot
            anything.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="bg-white rounded-3xl shadow-sm border p-4 h-fit">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h2 className="font-bold text-xl">History</h2>

              <button
                onClick={newChat}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm"
              >
                New
              </button>
            </div>

            <button
              onClick={loadHistory}
              className="w-full bg-slate-900 hover:bg-black text-white px-3 py-2 rounded-xl text-sm mb-4"
            >
              {historyLoading ? "Refreshing..." : "Refresh History"}
            </button>

            {history.length === 0 && (
              <p className="text-slate-500 text-sm">No saved chats yet.</p>
            )}

            <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openHistoryItem(item)}
                  className="w-full text-left border rounded-2xl p-3 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      {item.mode || "learn"}
                    </span>
                  </div>

                  <p className="font-semibold text-sm line-clamp-2">
                    {item.question}
                  </p>

                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <section className="lg:col-span-3">
            <div className="bg-white rounded-3xl shadow-sm border p-6 mb-6">
              <div className="flex items-center justify-between gap-4 mb-3">
                <label className="block font-bold text-lg">
                  Ask your question
                </label>

                {chatId && (
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                    Saved chat
                  </span>
                )}
              </div>

              <textarea
                className="w-full border border-slate-300 rounded-2xl p-4 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={5}
                placeholder="Example: What is a laptop?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={askAI}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-semibold"
                >
                  {loading ? "Thinking..." : "Ask AI"}
                </button>

                {answer && (
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
              </div>
            </div>

            {answer && (
              <AnswerCard
                title="Learn Mode Answer"
                content={answer}
                pdfLoading={pdfLoading}
                onDownload={() =>
                  downloadPDF(answer, "LearnForge AI - Learn Mode")
                }
              />
            )}

            {buildAnswer && (
              <AnswerCard
                title="Build Mode Guide"
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

function AnswerCard({
  title,
  content,
  pdfLoading,
  onDownload,
}: {
  title: string;
  content: string;
  pdfLoading: boolean;
  onDownload: () => void;
}) {
  return (
    <section className="bg-white rounded-3xl shadow-sm border p-6 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-2xl font-bold">{title}</h2>

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