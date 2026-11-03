// =====================================================
// 1. GRAB ELEMENTS FROM THE PAGE (the DOM)
// =====================================================
const orb       = document.getElementById("orb");
const statusEl  = document.getElementById("status");
const chatEl    = document.getElementById("chat");
const form      = document.getElementById("text-form");
const input     = document.getElementById("text-input");
const sendBtn   = document.getElementById("send-btn");
const nameEl    = document.getElementById("app-name");
const langBtn   = document.getElementById("lang-btn");

// =====================================================
// 2. APP STATE (variables that describe "what is happening right now")
// =====================================================
let active = false;     // is voice conversation switched on?
let busy   = false;     // is Mandy currently thinking or speaking?

// Hindi mode decides what language the MICROPHONE listens for.
// We remember your choice in the browser (localStorage), wrapped in try/catch because it can be blocked.
let hindiMode = false;
try { hindiMode = localStorage.getItem("mandy-lang") === "hi"; } catch (e) {}

// Should the CURRENT answer be in Hindi? Set again for every message (see getReply).
let replyHindi = false;

// The conversation so far. Sent to the server each time so Mandy remembers.
const chatHistory = [];

// Speech recognition has different names in different browsers
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let chosenVoice = null;   // the female English voice picked by pickVoice()
let hindiVoice  = null;   // the female Hindi voice picked by pickVoice()

// =====================================================
// 3. FILL THE PAGE FROM config.js
// =====================================================
// Safety net: if your config.js is an older copy that lacks the newer settings, fill them in
// so the app still starts instead of crashing (a crash here means the mic would never be set up).
CONFIG.voice = Object.assign({
  useAIVoice: false, hindiListenLang: "hi-IN", hindiLang: "hi-IN", hindiRate: 1, hindiName: "", hindiPreferredNames: [],
}, CONFIG.voice);
CONFIG.welcome = Object.assign({
  title: "Hey buddy!",
  line: "I'm Mandy. Talk to me like a friend.",
  spoken: "Hey buddy! I'm Mandy. Talk to me like a friend.",
  startButton: "Start conversation",
  hint: "Tap anywhere to hear me say hi",
}, CONFIG.welcome);

nameEl.textContent = CONFIG.assistantName;
document.title = CONFIG.assistantName;
input.placeholder = CONFIG.text.placeholder;
sendBtn.textContent = CONFIG.text.sendButton;

// ---------- Language helpers ----------
// Hindi is written in the Devanagari script (Unicode range 0900 to 097F).
function hasDevanagari(text) {
  return /[ऀ-ॿ]/.test(text);
}

// tr("English text", "हिंदी text") gives back the one that matches the current answer language.
// Every fixed reply in the app goes through this.
function tr(english, hindi) {
  return replyHindi ? hindi : english;
}

// The button shows the language you can switch TO.
function updateLangButton() {
  if (!langBtn) return;                                 // an older index.html has no language button
  langBtn.textContent = hindiMode ? "English" : "हिंदी";
  langBtn.setAttribute("aria-label", hindiMode
    ? "Mic is listening for Hindi. Switch to English"
    : "Mic is listening for English. Switch to Hindi");
}
updateLangButton();

// =====================================================
// 4. SMALL UI HELPERS
// =====================================================
function setState(state, text) {
  orb.dataset.state = state;          // CSS reacts to this attribute
  statusEl.textContent = text;
  duckMusic(state !== "idle");        // music goes quiet whenever Mandy listens, thinks or talks
}

function scrollChat() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addMessage(who, text) {
  const div = document.createElement("div");
  div.className = `msg msg--${who}`;
  div.textContent = text;             // textContent, never innerHTML, so nobody can inject HTML
  chatEl.appendChild(div);
  scrollChat();
}

function addWeatherCard(place, temp, sky, feels, humidity) {
  const card = document.createElement("div");
  card.className = "card";

  const big = document.createElement("div");
  big.className = "card__temp";
  big.textContent = `${temp}°`;

  const body = document.createElement("div");
  body.className = "card__body";

  const name = document.createElement("p");
  name.className = "card__place";
  name.textContent = place;

  const line1 = document.createElement("p");
  line1.className = "card__line";
  line1.textContent = sky;

  const line2 = document.createElement("p");
  line2.className = "card__line";
  line2.textContent = tr(`Feels like ${feels}°, humidity ${humidity}%`, `महसूस ${feels}°, नमी ${humidity}%`);

  body.append(name, line1, line2);
  card.append(big, body);
  chatEl.appendChild(card);
  scrollChat();
}

// A clickable link inside the chat (used for "search YouTube" results)
function addLink(label, url) {
  const a = document.createElement("a");
  a.className = "msg msg--mandy msg--link";
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";      // always add this to links that open a new tab
  a.textContent = label;
  chatEl.appendChild(a);
  scrollChat();
}

// The suggestion buttons shown before the first message
function showStarter() {
  const wrap = document.createElement("div");
  wrap.id = "starter";
  wrap.className = "starter";

  const p = document.createElement("p");
  p.textContent = CONFIG.text.starter;

  const chips = document.createElement("div");
  chips.className = "chips";

  CONFIG.suggestions.forEach((suggestion) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = suggestion;
    b.addEventListener("click", () => handleUserInput(suggestion));
    chips.appendChild(b);
  });

  wrap.append(p, chips);
  chatEl.appendChild(wrap);
}

function removeStarter() {
  const starter = document.getElementById("starter");
  if (starter) starter.remove();
}

// =====================================================
// 5. MANDY'S VOICE (text -> speech)
// =====================================================
// Every computer has different voices installed, so we pick one by name.
// Order of preference: your own CONFIG.voice.name, then the preferredNames list
// (female voices), then any voice in the right language.
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;                      // list not loaded yet, we try again later

  const named = (v, part) => v.name.toLowerCase().includes(part.toLowerCase());
  const langOf = (v) => v.lang.toLowerCase().replace("_", "-");

  // ---- English voice ----
  const lang = CONFIG.voice.speakLang.toLowerCase();
  const sameLang = (v) => langOf(v) === lang;

  chosenVoice = null;
  if (CONFIG.voice.name) {
    chosenVoice = voices.find((v) => named(v, CONFIG.voice.name)) || null;
  }
  if (!chosenVoice) {
    for (const part of CONFIG.voice.preferredNames) {
      // Prefer the right language, but accept any language if that is all there is
      chosenVoice = voices.find((v) => named(v, part) && sameLang(v))
                 || voices.find((v) => named(v, part));
      if (chosenVoice) break;
    }
  }
  if (!chosenVoice) chosenVoice = voices.find(sameLang) || null;

  // ---- Hindi voice (strict: must really be a Hindi voice, an English one would mangle the words) ----
  const isHindiVoice = (v) => langOf(v).startsWith("hi");
  const hindiVoices = voices.filter(isHindiVoice);

  hindiVoice = null;
  if (CONFIG.voice.hindiName) {
    hindiVoice = hindiVoices.find((v) => named(v, CONFIG.voice.hindiName)) || null;
  }
  if (!hindiVoice) {
    for (const part of CONFIG.voice.hindiPreferredNames) {
      hindiVoice = hindiVoices.find((v) => named(v, part));
      if (hindiVoice) break;
    }
  }
  if (!hindiVoice) hindiVoice = hindiVoices[0] || null;
}

// Type listVoices() in the browser console (F12) to see what your computer has
function listVoices() {
  window.speechSynthesis.getVoices().forEach((v) => console.log(`${v.name}  (${v.lang})`));
  console.log("English voice:", chosenVoice ? chosenVoice.name : "the browser default");
  console.log("Hindi voice:", hindiVoice ? hindiVoice.name : "NONE FOUND (install a Hindi voice, or use Edge)");
}

// ---------- Natural voice from our server (api/tts.js) ----------
let currentAudio = null;        // the <audio> that is playing right now
let speakId = 0;                // counts speak() calls, so a late answer can't talk over a newer one
let aiVoiceDownUntil = 0;       // if the natural voice fails, skip it for a couple of minutes

function stopSpeaking() {
  speakId++;                                            // anything still loading is now out of date
  window.speechSynthesis.cancel();
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
}

// Asks the server for a voice clip and plays it. Resolves true if it played, false if we should use the browser voice.
async function speakNatural(text, myId) {
  if (!CONFIG.voice.useAIVoice || Date.now() < aiVoiceDownUntil) return false;
  try {
    // Give up after 12 seconds, so a slow server can never freeze the conversation
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`Voice server replied ${res.status}`);
    const { audio } = await res.json();
    if (myId !== speakId) return true;                  // you stopped her while it loaded: stay silent

    await new Promise((resolve, reject) => {
      const a = new Audio("data:audio/wav;base64," + audio);
      currentAudio = a;
      a.onplay  = () => setState("speaking", CONFIG.text.speaking);
      a.onended = resolve;
      a.onerror = () => reject(new Error("Audio would not play"));
      a.onloadedmetadata = () => setTimeout(resolve, (a.duration || 30) * 1000 + 3000);   // safety net: never wait forever
      a.play().catch(reject);
    });
    return true;
  } catch (err) {
    console.warn("Natural voice failed, using the browser voice:", err);
    aiVoiceDownUntil = Date.now() + 2 * 60 * 1000;
    return false;
  }
}

// Returns a Promise so we can write `await speak(...)` and wait until she finishes.
async function speak(text) {
  stopSpeaking();
  const myId = speakId;
  if (await speakNatural(text, myId)) return;
  if (myId !== speakId) return;
  await speakWithBrowser(text);
}

function speakWithBrowser(text) {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);

    // Hindi letters in the text -> use the Hindi voice, otherwise the English one
    const hindi = hasDevanagari(text);
    const voice = hindi ? hindiVoice : chosenVoice;
    utterance.lang = hindi ? CONFIG.voice.hindiLang : CONFIG.voice.speakLang;
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = hindi ? CONFIG.voice.hindiRate : CONFIG.voice.rate;
    utterance.pitch = CONFIG.voice.pitch;

    utterance.onstart = () => setState("speaking", CONFIG.text.speaking);
    utterance.onend   = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
  });
}

// =====================================================
// 6. THE BRAIN (decides what to answer)
// =====================================================
// Words that are not city names, in "आज दिल्ली का मौसम"
const HI_NOT_CITY = ["आज", "अभी", "कल", "यहाँ", "यहां", "वहाँ", "वहां", "बाहर", "का", "की", "के", "में", "ये", "यह", "इस"];

// Pulls a city out of a Hindi sentence like "दिल्ली का मौसम" or "मौसम कैसा है पटना में"
function hindiCity(t) {
  const m = t.match(/((?:[ऀ-ॿ]+\s+)?[ऀ-ॿ]+)\s+(?:का|की|के|में)\s+(?:आज\s+|अभी\s+)?(?:मौसम|वेदर|तापमान|टेम्परेचर|टेंपरेचर)/)
         || t.match(/(?:मौसम|वेदर|तापमान).*?\s([ऀ-ॿ]+)\s+में/);
  if (!m) return "";
  return m[1].split(/\s+/).filter((w) => !HI_NOT_CITY.includes(w)).join(" ");
}

// Says the time the way people say it: "शाम के 6 बजकर 15 मिनट हुए हैं"
function hindiTime(d) {
  const h = d.getHours(), min = d.getMinutes();
  const part = h < 4 ? "रात" : h < 12 ? "सुबह" : h < 16 ? "दोपहर" : h < 19 ? "शाम" : "रात";
  const h12 = h % 12 || 12;
  if (min === 0) return `${part} के ${h12} ${h12 === 1 ? "बजा है" : "बजे हैं"}`;
  return `${part} के ${h12} बजकर ${min} मिनट हुए हैं`;
}

async function getReply(text) {
  // Lowercase, and drop the Hindi "nukta" dot so म्यूज़िक and म्यूजिक are treated the same
  const t = text.toLowerCase().replace(/़/g, "");
  replyHindi = hindiMode || hasDevanagari(t);          // answer in Hindi if you speak Hindi mode or type Hindi letters

  if (/\b(bye|goodbye|good night|that's all)\b|अलविदा|बाय बाय|गुड नाइट|शुभ रात्रि|चलती हूँ|चलता हूँ/.test(t)) {
    active = false;
    return tr("Okay, talk to you later, bye!", "ठीक है, बाद में बात करते हैं। बाय!");
  }

  if (/what time|current time|time is it|tell me the time|कितने बजे|क्या समय|समय क्या|समय बताओ|टाइम क्या|टाइम बताओ|क्या टाइम/.test(t)) {
    if (replyHindi) return `अभी ${hindiTime(new Date())}।`;
    const time = new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    return `It's ${time} right now.`;
  }

  if (/\bdate\b|what day|today's date|तारीख|कौन सा दिन|कौन-सा दिन|कौन सी डेट|डेट क्या/.test(t)) {
    const opts = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    if (replyHindi) return `आज ${new Date().toLocaleDateString("hi-IN", opts)} है।`;
    return `Today is ${new Date().toLocaleDateString("en-IN", opts)}.`;
  }

  if (/weather|temperature|मौसम|वेदर|तापमान|टेम्परेचर|टेंपरेचर/.test(t)) {
    let city = "";
    if (hasDevanagari(t)) {
      city = hindiCity(t);                               // "दिल्ली का मौसम" -> "दिल्ली"
    } else {
      const match = t.match(/ in ([a-z\s]+)/);          // "weather in delhi" -> "delhi"
      if (match) city = match[1].trim();
    }
    return await getWeather(city || CONFIG.defaultCity);
  }

  // Music commands live in music.js. It returns null when the sentence isn't about music.
  const musicReply = await handleMusicCommand(t);
  if (musicReply !== null) return musicReply;

  return await askAI(text);
}

// Sends the conversation to OUR server function (/api/chat), which talks to OpenAI.
// The browser never sees the secret key.
async function askAI(text) {
  chatHistory.push({ role: "user", content: text });
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory.slice(-CONFIG.historyLimit) }),
    });
    if (!res.ok) throw new Error(`Server replied ${res.status}`);

    const data = await res.json();
    chatHistory.push({ role: "assistant", content: data.reply });
    return data.reply;
  } catch (err) {
    // The AI server can't be reached (for example you are using plain Live Server).
    // Be honest about it instead of giving random answers.
    console.error("AI error:", err);
    chatHistory.pop();                                  // forget this question, it was never answered
    return offlineReply(text.toLowerCase());
  }
}

// Used only when the AI server can't be reached. A few fixed answers, then an honest message.
let toldAboutOffline = false;
function offlineReply(t) {
  if (/\b(hi|hello|hey)\b|हेलो|हैलो|नमस्ते|हाय/.test(t)) {
    return tr("Heyy! So tell me, what's going on?", "हेलो! बोलो न, क्या चल रहा है?");
  }
  if (/your name|who are you|तुम्हारा नाम|आपका नाम|तुम कौन/.test(t)) {
    return tr(`I'm ${CONFIG.assistantName}, your friend who lives inside this browser tab.`,
              `मैं ${CONFIG.assistantName} हूँ, तुम्हारी दोस्त, जो इस ब्राउज़र टैब में रहती है।`);
  }
  if (/thank|धन्यवाद|शुक्रिया|थैंक/.test(t)) {
    return tr("Arre, anytime!", "अरे, कोई बात नहीं!");
  }
  if (!toldAboutOffline) {
    toldAboutOffline = true;
    return tr(
      "My AI brain isn't connected, so I can only do the time, weather and music. Start the app with npm run dev to chat properly.",
      "मेरा AI दिमाग़ जुड़ा नहीं है, इसलिए मैं अभी सिर्फ़ समय, मौसम और म्यूज़िक बता सकती हूँ। ठीक से बात करने के लिए npm run dev से ऐप चलाओ।"
    );
  }
  return tr("My AI brain is still offline. Ask me the time, the weather or some music.",
            "मेरा AI दिमाग़ अभी भी बंद है। मुझसे समय, मौसम या म्यूज़िक के बारे में पूछो।");
}

// Weather uses Open-Meteo: free, no API key, allows requests straight from the browser.
const WEATHER_CODES = {
  0: "clear sky", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
  45: "foggy", 48: "foggy", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow",
  80: "rain showers", 81: "rain showers", 82: "heavy showers",
  95: "a thunderstorm", 96: "a thunderstorm", 99: "a thunderstorm",
};

// The same list in Hindi. Each one finishes the sentence "मौसम ___ है".
const WEATHER_CODES_HI = {
  0: "साफ़", 1: "ज़्यादातर साफ़", 2: "थोड़ा बादलों भरा", 3: "बादलों से घिरा",
  45: "कोहरे भरा", 48: "कोहरे भरा", 51: "हल्की बूंदाबांदी वाला", 53: "बूंदाबांदी वाला", 55: "तेज़ बूंदाबांदी वाला",
  61: "हल्की बारिश वाला", 63: "बारिश वाला", 65: "तेज़ बारिश वाला", 71: "हल्की बर्फ़बारी वाला", 73: "बर्फ़बारी वाला",
  80: "बौछारों वाला", 81: "बौछारों वाला", 82: "तेज़ बौछारों वाला",
  95: "आंधी-तूफ़ान वाला", 96: "आंधी-तूफ़ान वाला", 99: "आंधी-तूफ़ान वाला",
};

async function getWeather(city) {
  try {
    // Step 1: turn the city name into coordinates.
    // In Hindi mode we ask for Hindi place names first, then fall back to English.
    let place = null;
    for (const language of replyHindi ? ["hi", "en"] : ["en"]) {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=${language}`
      );
      const geo = await geoRes.json();
      if (geo.results) { place = geo.results[0]; break; }
    }
    if (!place) return tr(`I couldn't find a place called ${city}.`, `मुझे ${city} नाम की कोई जगह नहीं मिली।`);

    // Step 2: ask for the current weather at those coordinates
    const wRes = await fetch(
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${place.latitude}&longitude=${place.longitude}` +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code" +
      "&timezone=auto"
    );
    const w = (await wRes.json()).current;

    const sky   = tr(WEATHER_CODES[w.weather_code] || "mixed weather", WEATHER_CODES_HI[w.weather_code] || "मिला-जुला");
    const temp  = Math.round(w.temperature_2m);
    const feels = Math.round(w.apparent_temperature);

    addWeatherCard(place.name, temp, tr(sky, `मौसम ${sky}`), feels, w.relative_humidity_2m);
    return tr(
      `In ${place.name} it's ${temp} degrees with ${sky}. Feels like ${feels}.`,
      `${place.name} में अभी ${temp} डिग्री है, और मौसम ${sky} है। महसूस ${feels} डिग्री जैसा हो रहा है।`
    );
  } catch (err) {
    console.error("Weather error:", err);
    return tr("I couldn't check the weather right now.", "अभी मैं मौसम नहीं देख पा रही हूँ।");
  }
}

// =====================================================
// 7. THE CONVERSATION FLOW
// =====================================================
async function handleUserInput(text) {
  if (busy) return;
  busy = true;
  if (recognition) { try { recognition.abort(); } catch (e) {} }   // stop listening while she answers

  try {
    removeStarter();
    addMessage("user", text);
    setState("thinking", CONFIG.text.thinking);

    const reply = await getReply(text);
    addMessage("mandy", reply);
    await speak(reply);
  } catch (err) {
    // Without this, one error would leave busy = true forever and Mandy would stop responding
    console.error("Something broke:", err);
    addMessage("mandy", tr("Oops, something went wrong on my side. Try again?", "ओह, मेरी तरफ़ कुछ गड़बड़ हो गई। फिर से कोशिश करो?"));
  }

  busy = false;
  if (active) {
    setTimeout(startListening, 600);      // wait a moment so the mic doesn't catch the end of her own voice
  } else {
    setState("idle", CONFIG.text.idle);
  }
}

// =====================================================
// 8. LISTENING (speech -> text)
// =====================================================
function setupRecognition() {
  if (!SpeechRecognition) {
    setState("idle", CONFIG.text.noVoice);
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = CONFIG.voice.listenLang;
  recognition.interimResults = false;
  recognition.continuous = false;       // one phrase at a time

  recognition.onstart = () => setState("listening", CONFIG.text.listening);

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript.trim();
    if (!text) return;                    // blank result (silence or noise): ignore it, don't make a blank bubble
    handleUserInput(text);
  };

  recognition.onerror = (event) => {
    console.warn("Voice error:", event.error);            // check the console (F12) if voice fails

    // These errors mean listening cannot work, so stop and tell the user why
    const fatal = {
      "not-allowed": CONFIG.text.micBlocked,
      "audio-capture": CONFIG.text.micMissing,
      "network": CONFIG.text.voiceNetwork,
      "service-not-allowed": CONFIG.text.voiceBlocked,
    };
    if (fatal[event.error]) {
      active = false;
      setState("idle", fatal[event.error]);
    }
    // "no-speech" and "aborted" are normal; onend below handles them
  };

  recognition.onend = () => {
    if (active && !busy) setTimeout(startListening, 600);   // keep the conversation going (short pause so she doesn't hear her own voice)
    else if (!active && !busy) setState("idle", CONFIG.text.idle);
  };
}

function startListening() {
  if (!recognition || !active || busy) return;
  // Set the language every time, so the language button works right away
  recognition.lang = hindiMode ? CONFIG.voice.hindiListenLang : CONFIG.voice.listenLang;
  try { recognition.start(); } catch (e) { /* already started, ignore */ }
}

// =====================================================
// 9. EVENTS (what the user can do)
// =====================================================
orb.addEventListener("click", () => {
  if (!recognition) return;
  active = !active;
  if (active) {
    startListening();
  } else {
    recognition.abort();
    stopSpeaking();
    busy = false;
    setState("idle", CONFIG.text.idle);
  }
});

// English <-> Hindi switch for the microphone
if (langBtn) langBtn.addEventListener("click", () => {
  hindiMode = !hindiMode;
  try { localStorage.setItem("mandy-lang", hindiMode ? "hi" : "en"); } catch (e) {}
  updateLangButton();
  // If she is listening right now, stop. onend then restarts her with the new language.
  if (recognition && active && !busy) { try { recognition.abort(); } catch (e) {} }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();               // stop the browser from reloading the page
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  handleUserInput(text);
});

// =====================================================
// 9b. THE WELCOME PAGE (page 1) -> THE CHAT PAGE (page 2)
// =====================================================
const welcomeEl = document.getElementById("welcome");
const chatPage  = document.getElementById("chat-page");
const startBtn  = document.getElementById("start-btn");

// Only wire up the welcome page if index.html actually has it (an older index.html does not)
if (welcomeEl && chatPage && startBtn) {
  document.getElementById("welcome-title").textContent = CONFIG.welcome.title;
  document.getElementById("welcome-line").textContent  = CONFIG.welcome.line;
  document.getElementById("welcome-hint").textContent  = CONFIG.welcome.hint;
  startBtn.textContent = CONFIG.welcome.startButton;

  // Browsers only allow sound after you touch the page, so she says hi on your first tap (and again on every tap).
  welcomeEl.addEventListener("pointerdown", (event) => {
    if (event.target.closest("#start-btn")) return;       // the Start button has its own job
    speak(CONFIG.welcome.spoken).then(() => { if (!active) setState("idle", CONFIG.text.idle); });
  });

  startBtn.addEventListener("click", () => {
    stopSpeaking();                                       // stop the hello if she is still talking
    welcomeEl.hidden = true;
    chatPage.hidden = false;
    setState("idle", CONFIG.text.idle);
    if (recognition && location.protocol !== "file:") {   // start the conversation straight away
      active = true;
      startListening();
    } else {
      input.focus();
    }
  });
}

// =====================================================
// 10. START
// =====================================================
pickVoice();                                              // some browsers have the voice list ready now...
window.speechSynthesis.onvoiceschanged = pickVoice;       // ...others fill it in a moment later

setupRecognition();
if (!SpeechRecognition) {
  // setupRecognition already showed the "no voice" message
} else if (location.protocol === "file:") {
  setState("idle", CONFIG.text.fileMode);                 // double-clicked files can't use the mic
} else {
  setState("idle", CONFIG.text.idle);
}
addMessage("mandy", CONFIG.text.greeting.replace("{name}", CONFIG.userName));
showStarter();