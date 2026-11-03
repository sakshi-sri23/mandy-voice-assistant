// =====================================================
// config.js  —  the file you edit to make the app yours.
// Change the text between the quotes, save, refresh the page.
// (Colours and fonts live at the top of style.css.)
// =====================================================
const CONFIG = {
  assistantName: "Mandy",      // shown as the big title and the browser tab
  userName: "Sakshi",          // used in the first greeting
  defaultCity: "Patna",        // used when you ask for weather without a city

  voice: {
    useAIVoice: true,          // true = Gemini's natural voice (needs the internet + your key). Falls back to the browser voice if it fails.
    listenLang: "en-IN",       // what the mic understands in English mode
    hindiListenLang: "hi-IN",  // what the mic understands in Hindi mode (the language button switches)
    speakLang: "en-IN",        // language of Mandy's English voice
    hindiLang: "hi-IN",        // language of Mandy's Hindi voice (used whenever her reply has Hindi letters)
    hindiRate: 1,              // speed of the Hindi voice
    hindiName: "",             // optional: part of an exact Hindi voice name, like "Swara"
    // Female Hindi voices, in order of preference. Edge has the best one ("Swara" Natural).
    hindiPreferredNames: ["Swara", "Kalpana", "Google हिन्दी", "Google Hindi", "Lekha", "Female"],
    rate: 1.05,                // speed: 0.8 slow, 1 normal, 1.3 fast
    pitch: 1.1,                // 0.8 deeper, 1.2 higher
    name: "",                  // optional: type part of an exact voice name, like "Neerja".
                               // To see the voices on your computer, open the browser console (F12)
                               // and type listVoices()
    // Mandy picks the first voice from this list that exists on your computer.
    // These are all female voices. Edge has the best ones ("Neerja", "Natural").
    preferredNames: ["Neerja", "Heera", "Veena", "Swara", "Kalpana", "Raveena",
                     "Google UK English Female", "Zira", "Samantha", "Google US English", "Female"],
  },

  // The first page
  welcome: {
    title: "Hey buddy!",
    line: "I'm Mandy. Talk to me like a friend. I can chat about your day, and help you plan a meet-up.",
    spoken: "Hey buddy! I'm Mandy. Talk to me like a friend. I can chat about your day, and help you plan a meet up.",
    startButton: "Start conversation",
    hint: "Tap anywhere to hear me say hi",
  },

  text: {
    idle: "Tap the circle and talk to me.",
    listening: "I'm listening.",
    thinking: "One sec.",
    speaking: "Mandy is talking.",
    noVoice: "Voice needs Chrome or Edge. You can still type below.",
    micBlocked: "The microphone is blocked. Allow it in the address bar, or type below.",
    micMissing: "I can't find a microphone. Plug one in and check your system settings.",
    voiceNetwork: "Voice needs the internet, and this browser may block it. Try Chrome or Edge.",
    voiceBlocked: "This browser doesn't allow voice here. Use Chrome or Edge on localhost.",
    fileMode: "Open this page with Live Server or vercel dev, not by double-clicking the file. Voice won't work otherwise.",
    placeholder: "Or type to me here",
    sendButton: "Send",
    starter: "Say something, or start with one of these.",
    greeting: "Heyy {name}! क्या चल रहा है?",   // {name} becomes userName
  },

  // Buttons shown before the first message. Add, remove or reword them.
  suggestions: [
    "What time is it?",
    "Weather in Delhi",
    "Tell me something fun",
    "I had a long day",
  ],

  historyLimit: 12,            // how many past messages Mandy remembers

  music: {
    volume: 80,                // music volume when nobody is talking (0 to 100)
    duckedVolume: 25,          // music volume while Mandy listens or speaks
    // Paste your own YouTube links here. A playlist link plays shuffled, a video link plays that song.
    // Say "play music" for a random pick, or "play" + the name, like "play kesariya".
    // Example line (remove the // and use a real link). "aliases" are other ways you might say it,
    // like the Hindi spelling, so "केसरिया चलाओ" works too:
    //   { name: "Kesariya", aliases: ["केसरिया"], url: "https://www.youtube.com/watch?v=XXXXXXXXXXX" },
    library: [
    ],
  },
};