"use client";

import { useState } from "react";

type ChatHistoryItem = {
  id: string;
  question: string;
  learn_answer?: string;
  build_answer?: string;
  improve_answer?: string;
  troubleshoot_answer?: string;
  created_at: string;
};

export default function Home() {
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

  async function askAI() {
    if (!question.trim()) {
      alert("Please type a question first.");
      return;
    }

    try {
      setLoading(true);
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
      setAnswer(data.answer);
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
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      setBuildAnswer(data.answer);
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
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      setImproveAnswer(data.answer);
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
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      setTroubleshootAnswer(data.answer);
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
      alert("Could not load history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function openHistoryItem(item: ChatHistoryItem) {
    setQuestion(item.question || "");
    setAnswer(item.learn_answer || "");
    setBuildAnswer(item.build_answer || "");
    setImproveAnswer(item.improve_answer || "");
    setTroubleshootAnswer(item.troubleshoot_answer || "");
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
    <main className="min-h-screen bg-gray-100 text-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-5xl font-bold mb-3">LearnForge AI</h1>
          <p className="text-gray-600 text-lg">
            Learn anything. Build anything. Improve everything. Troubleshoot
            anything.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="bg-white rounded-2xl shadow-sm border p-4 h-fit">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl">History</h2>

              <button
                onClick={loadHistory}
                className="bg-gray-900 hover:bg-black text-white px-3 py-2 rounded-lg text-sm"
              >
                {historyLoading ? "Loading..." : "Load"}
              </button>
            </div>

            {history.length === 0 && (
              <p className="text-gray-500 text-sm">
                No history loaded yet. Click Load.
              </p>
            )}

            <div className="space-y-3">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openHistoryItem(item)}
                  className="w-full text-left border rounded-xl p-3 hover:bg-gray-50"
                >
                  <p className="font-medium text-sm line-clamp-2">
                    {item.question}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <section className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border p-5 mb-6">
              <label className="block font-semibold mb-2">
                Ask your question
              </label>

              <textarea
                className="w-full border border-gray-300 rounded-xl p-4 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={5}
                placeholder="Example: What is a laptop?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={askAI}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium"
                >
                  {loading ? "Thinking..." : "Ask AI"}
                </button>

                {answer && (
                  <>
                    <button
                      onClick={buildThis}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium"
                    >
                      {building ? "Building..." : "Build This"}
                    </button>

                    <button
                      onClick={improveThis}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-medium"
                    >
                      {improving ? "Improving..." : "Improve This"}
                    </button>

                    <button
                      onClick={troubleshootThis}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-medium"
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
              <section className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="text-2xl font-bold">Learn Mode Answer</h2>

                  <button
                    onClick={() =>
                      downloadPDF(answer, "LearnForge AI - Learn Mode")
                    }
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-medium"
                  >
                    {pdfLoading ? "Generating..." : "Download PDF"}
                  </button>
                </div>

                <div className="whitespace-pre-wrap leading-7 text-gray-800">
                  {answer}
                </div>
              </section>
            )}

            {buildAnswer && (
              <section className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="text-2xl font-bold">Build Mode Guide</h2>

                  <button
                    onClick={() =>
                      downloadPDF(buildAnswer, "LearnForge AI - Build Guide")
                    }
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-medium"
                  >
                    {pdfLoading ? "Generating..." : "Download PDF"}
                  </button>
                </div>

                <div className="whitespace-pre-wrap leading-7 text-gray-800">
                  {buildAnswer}
                </div>
              </section>
            )}

            {improveAnswer && (
              <section className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="text-2xl font-bold">Improve Mode Guide</h2>

                  <button
                    onClick={() =>
                      downloadPDF(
                        improveAnswer,
                        "LearnForge AI - Improve Guide"
                      )
                    }
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-medium"
                  >
                    {pdfLoading ? "Generating..." : "Download PDF"}
                  </button>
                </div>

                <div className="whitespace-pre-wrap leading-7 text-gray-800">
                  {improveAnswer}
                </div>
              </section>
            )}

            {troubleshootAnswer && (
              <section className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="text-2xl font-bold">
                    Troubleshoot Mode Guide
                  </h2>

                  <button
                    onClick={() =>
                      downloadPDF(
                        troubleshootAnswer,
                        "LearnForge AI - Troubleshoot Guide"
                      )
                    }
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-medium"
                  >
                    {pdfLoading ? "Generating..." : "Download PDF"}
                  </button>
                </div>

                <div className="whitespace-pre-wrap leading-7 text-gray-800">
                  {troubleshootAnswer}
                </div>
              </section>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}