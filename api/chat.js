// Serverless function: runs on a server (your dev-server now, Vercel later), NOT in the browser.
// The browser sends the chat history here, and this file talks to the AI.
// That is the whole point: the secret key lives only on the server.
//
// Which AI is used depends on which key you set in .env.local:
//   GEMINI_API_KEY  -> Google Gemini (has a free tier)   <- recommended
//   OPENAI_API_KEY  -> OpenAI (paid)

import { PERSONA } from "../lib/persona.js";

export default async function handler(req, res) {
  // 1. Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  // 2. Keys come from environment variables, never from your code
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !openaiKey) {
    return res.status(500).json({ error: "Server needs GEMINI_API_KEY (free) or OPENAI_API_KEY" });
  }

  // 3. Never trust input from the browser: check it and trim it
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array" });
  }

  const clean = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)                                        // only the last 12 messages
    .map((m) => ({ role: m.role, content: m.content.slice(0, 500) }));

  // The conversation must start with something the user said
  while (clean.length > 0 && clean[0].role !== "user") clean.shift();

  if (clean.length === 0) {
    return res.status(400).json({ error: "No valid messages" });
  }

  // 4. Ask the AI
  try {
    const reply = geminiKey ? await askGemini(geminiKey, clean) : await askOpenAI(openaiKey, clean);
    return res.status(200).json({ reply: reply || "Hmm, I blanked out. Say that again?" });
  } catch (err) {
    console.error("AI error:", err.message);           // this shows in your terminal
    return res.status(502).json({ error: "The AI service had a problem" });
  }
}

// ---------- Google Gemini (free tier) ----------
async function askGemini(key, messages) {
  // If this model name stops working, open aistudio.google.com, pick a free Flash model,
  // and put its name in .env.local as GEMINI_MODEL=the-model-name
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PERSONA }] },
        // Gemini calls the assistant "model" instead of "assistant"
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.9, maxOutputTokens: 600 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`);

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

// ---------- OpenAI (paid) ----------
async function askOpenAI(key, messages) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.9,
      max_tokens: 150,
      messages: [{ role: "system", content: PERSONA }, ...messages],
    }),
  });

  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim();
}