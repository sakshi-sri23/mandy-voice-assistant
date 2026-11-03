// =====================================================
// music.js  —  plays YouTube music inside the page, so Mandy can keep chatting.
// Uses YouTube's official "IFrame Player API".
// Your song list lives in config.js (CONFIG.music.library).
// =====================================================
const MUSIC = CONFIG.music;
const playerWrap = document.getElementById("player");

let ytPlayer = null;      // the YouTube player object, created the first time you play something
let apiPromise = null;    // remembers that we already started loading YouTube's script

// ---------- 1. Understand a YouTube link ----------
// Accepts normal links, short youtu.be links and playlist links.
// Returns { type: "video" | "playlist", id: "..." } or null if the link is not valid.
function parseYouTube(link) {
  try {
    const u = new URL(link);
    const list = u.searchParams.get("list");
    if (list) return { type: "playlist", id: list };
    if (u.hostname.includes("youtu.be")) return { type: "video", id: u.pathname.slice(1) };
    const v = u.searchParams.get("v");
    if (v) return { type: "video", id: v };
  } catch (e) { /* not a valid link */ }
  return null;
}

// Your library, with the bad links removed
function getLibrary() {
  return (MUSIC.library || [])
    .map((entry) => ({ name: entry.name, key: entry.name.toLowerCase(), item: parseYouTube(entry.url) }))
    .filter((entry) => entry.item);
}

// ---------- 2. Load YouTube's player script (only once, only when needed) ----------
function loadYouTubeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve();
    // YouTube calls this exact function name when its script is ready
    window.onYouTubeIframeAPIReady = resolve;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => { apiPromise = null; reject(new Error("Could not load YouTube")); };
    document.head.appendChild(tag);
  });
  return apiPromise;
}

// ---------- 3. Play something ----------
async function startMusic(entry) {
  try {
    await loadYouTubeApi();
    playerWrap.hidden = false;                       // show the player box

    if (!ytPlayer) {
      // Create the player and wait until it says it is ready
      await new Promise((resolve) => {
        ytPlayer = new YT.Player("yt-player", {
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0 },
          events: { onReady: resolve },
        });
      });
    }

    ytPlayer.setVolume(MUSIC.duckedVolume);          // Mandy is mid-reply, so start quiet.
                                                     // setState("idle") raises it afterwards.
    if (entry.item.type === "playlist") {
      ytPlayer.loadPlaylist({ list: entry.item.id, listType: "playlist", index: 0 });
      ytPlayer.setShuffle(true);
    } else {
      ytPlayer.loadVideoById(entry.item.id);
    }
    return `Playing ${entry.name}.`;
  } catch (err) {
    console.error("Music error:", err);
    return "I couldn't reach YouTube right now.";
  }
}

// ---------- 4. Turn the music down while Mandy listens or talks ----------
// script.js calls this from setState().
function duckMusic(quiet) {
  if (!ytPlayer || typeof ytPlayer.setVolume !== "function") return;
  ytPlayer.setVolume(quiet ? MUSIC.duckedVolume : MUSIC.volume);
}

// ---------- 5. Understand music commands ----------
// Returns what Mandy should say, or null if this sentence is not about music.
async function handleMusicCommand(t) {
  // Pause / resume / next
  if (/^(pause|stop)( it)?$|\b(pause|stop)\b.*\b(music|song|playlist)\b/.test(t)) {
    if (!ytPlayer) return "Nothing is playing yet.";
    ytPlayer.pauseVideo();
    return "Paused.";
  }
  if (/^(resume|continue)$|\b(resume|continue|unpause)\b.*\b(music|song|playlist)\b/.test(t)) {
    if (!ytPlayer) return "Nothing is playing yet.";
    ytPlayer.playVideo();
    return "Back on.";
  }
  if (/^(skip|next)( song)?$|\b(next|skip)\b.*\b(song|track)\b/.test(t)) {
    if (!ytPlayer) return "Nothing is playing yet.";
    ytPlayer.nextVideo();
    return "Next one.";
  }

  // Play something. Only sentences that START with play / put on count.
  if (!/^(please )?(play|put on)\b/.test(t)) return null;

  const query = t.replace(/^(please )?(play|put on)( me)?\s*/, "").trim();
  const library = getLibrary();

  // 1) A name from your library, like "play kesariya"
  if (query.length >= 3) {
    const match = library.find((e) => query.includes(e.key) || e.key.includes(query));
    if (match) return await startMusic(match);
  }

  // 2) Something general, like "play music" or "play a random playlist"
  const general = /^(a |an |the |some |my )?(random |good |nice )?(music|songs?|playlist|something|anything|tracks?)?$/;
  if (general.test(query)) {
    if (library.length === 0) {
      return "Your music list is empty. Add YouTube links in config.js, then ask me again.";
    }
    const pick = library[Math.floor(Math.random() * library.length)];
    return await startMusic(pick);
  }

  // 3) Not in your library: give a YouTube search link in the chat
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  addLink(`Search YouTube for "${query}"`, url);
  return `I don't have ${query} saved. I put a search link in the chat.`;
}