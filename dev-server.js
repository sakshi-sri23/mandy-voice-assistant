// =====================================================
// dev-server.js  —  runs Mandy on your own computer, including the AI chat.
// Start it with:  npm run dev     then open  http://localhost:3000
// It does what Vercel will do later: serve the page, and run api/chat.js.
// =====================================================
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;
const HOST = "127.0.0.1";   // use this exact address in the browser, not "localhost"

// Read your secret key from the .env.local file (it never goes to the browser)
try {
  const lines = fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  console.log("No .env.local file found, so the AI chat will not work yet.");
}
// Tell you clearly which AI key was found (only the last 4 characters are shown)
if (process.env.GEMINI_API_KEY) {
  console.log(`AI: Gemini key found (ends with ${process.env.GEMINI_API_KEY.slice(-4)})`);
} else if (process.env.OPENAI_API_KEY) {
  console.log(`AI: OpenAI key found (ends with ${process.env.OPENAI_API_KEY.slice(-4)})`);
} else {
  console.log("AI: NO KEY FOUND. Put this line in a file named .env.local next to package.json:");
  console.log("    GEMINI_API_KEY=your-key-here");
}

// Only these file types are ever sent to the browser
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const { default: chatHandler } = await import(pathToFileURL(path.join(root, "api", "chat.js")).href);
const { default: ttsHandler }  = await import(pathToFileURL(path.join(root, "api", "tts.js")).href);

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err) {
    // Show the real problem in the terminal instead of failing silently
    console.error("Server error:", err);
    if (!res.headersSent) res.statusCode = 500;
    res.end("Server error. Look at the terminal for details.");
  }
});

async function handleRequest(req, res) {
  console.log(req.method, req.url);                    // one line per request, so you can see it working
  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. The AI endpoint: same job Vercel does in production
  if (url.pathname === "/api/chat" || url.pathname === "/api/tts") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    };
    return (url.pathname === "/api/tts" ? ttsHandler : chatHandler)(req, res);
  }

  // 2. Everything else: serve the page's files
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const parts = requested.split("/").filter(Boolean);
  const hidden = parts.some((p) => p.startsWith(".")) || ["api", "lib", "node_modules"].includes(parts[0]);
  const type = TYPES[path.extname(requested).toLowerCase()];
  const full = path.join(root, path.normalize(requested));

  if (hidden || !type || !full.startsWith(root + path.sep) || !fs.existsSync(full)) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  res.setHeader("Content-Type", type);
  fs.createReadStream(full).pipe(res);
}

server.listen(PORT, HOST, () => {
  console.log(`Mandy is running at http://${HOST}:${PORT}  (press Ctrl+C to stop)`);
});