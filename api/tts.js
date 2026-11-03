// =====================================================
// api/tts.js  —  turns Mandy's reply into a natural, human-sounding voice.
// Same idea as chat.js: the browser asks OUR server, the server asks Gemini,
// so your secret key never reaches the browser.
// If this fails for any reason, the browser quietly falls back to its built-in voice.
// =====================================================

// Gemini sends raw audio (24,000 samples per second, 16-bit, mono).
// A browser can only play it if it is wrapped in a WAV "header", so we add one.
function pcmToWav(pcm) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);          // size of this block
  header.writeUInt16LE(1, 20);           // 1 = plain PCM
  header.writeUInt16LE(1, 22);           // 1 channel (mono)
  header.writeUInt32LE(24000, 24);       // samples per second
  header.writeUInt32LE(24000 * 2, 28);   // bytes per second
  header.writeUInt16LE(2, 32);           // bytes per sample
  header.writeUInt16LE(16, 34);          // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "No GEMINI_API_KEY" });

  const text = String(req.body?.text || "").trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: "No text" });

  // You can change these without touching code: add them to .env.local (and Vercel's settings)
  const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
  const voice = process.env.GEMINI_TTS_VOICE || "Leda";    // other female voices: Aoede, Kore, Zephyr, Autonoe

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          // The sentence before the colon tells the voice HOW to speak, it is not read aloud
          contents: [{ parts: [{ text: `Say this in a warm, relaxed, friendly tone, like a close girlfriend chatting: ${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      }
    );
    if (!r.ok) throw new Error(`Gemini TTS ${r.status}: ${(await r.text()).slice(0, 300)}`);

    const data = await r.json();
    const b64 = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
    if (!b64) throw new Error("Gemini TTS returned no audio");

    const wav = pcmToWav(Buffer.from(b64, "base64"));
    return res.status(200).json({ audio: wav.toString("base64") });
  } catch (err) {
    console.error("TTS error:", err.message);
    return res.status(502).json({ error: "Voice failed" });
  }
}