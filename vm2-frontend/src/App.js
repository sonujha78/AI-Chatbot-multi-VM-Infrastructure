import { useState, useEffect, useRef } from "react";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch("/api/history").then(r => r.json()).then(setMessages).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setMessages(m => [...m, { role: "user", content: msg }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Error: Backend se connect nahi ho pa raha." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h2 style={{ borderBottom: "2px solid #eee", paddingBottom: 10 }}>
        AI Chatbot (phi3 via Ollama)
      </h2>
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16,
                    height: 440, overflowY: "auto", background: "#f9f9f9", marginBottom: 12 }}>
        {messages.length === 0 && (
          <p style={{ color: "#aaa", textAlign: "center", marginTop: 180 }}>
            Kuch poochho...
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 14,
            textAlign: m.role === "user" ? "right" : "left" }}>
            <span style={{
              background: m.role === "user" ? "#0055ff" : "#e2e2e2",
              color: m.role === "user" ? "#fff" : "#111",
              padding: "10px 15px", borderRadius: 14,
              display: "inline-block", maxWidth: "78%", lineHeight: 1.5
            }}>{m.content}</span>
          </div>
        ))}
        {loading && (
          <div style={{ color: "#888", fontStyle: "italic" }}>
            AI soch raha hai...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          disabled={loading}
          style={{ flex: 1, padding: "12px 16px", borderRadius: 10,
                   border: "1px solid #ccc", fontSize: 15 }}
          placeholder="Message likho aur Enter dabao..."
        />
        <button onClick={send} disabled={loading}
          style={{ padding: "12px 22px",
                   background: loading ? "#aaa" : "#0055ff",
                   color: "#fff", border: "none", borderRadius: 10,
                   cursor: loading ? "not-allowed" : "pointer", fontSize: 15 }}>
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
