# Mandy

Mandy is a voice-first AI friend that runs in the browser. You tap one button and talk to her in English or Hindi, and she talks back. She also tells you the time and the weather, and plays music from YouTube while you chat.

I started with a Python voice assistant and rebuilt it as a web app so anyone can open it from a link, and so I could finally put my HTML, CSS and JavaScript to real use.

## The idea behind the design

A sunflower needs another sunflower to face in order to survive. Friends are the same. Mandy is meant to be the other sunflower, so the whole interface is built around a sunflower palette, with yellow for warmth and positivity.

There are two pages. The first is a waving hand and a "Hey buddy" welcome. The second is the chat. I designed both screens in Figma first, including the colour palette, fonts and layout, and then built them in HTML and CSS.

## What she can do

- Listen and speak, using the browser's Web Speech API
- Understand and answer in Hindi (a button next to the typing box switches the microphone language)
- Chat like a friend through the Gemini API, with a personality I wrote for her
- Tell the time, the date and the weather for any city, without calling the AI
- Play YouTube songs and playlists inside the page, and turn the music down while she listens or speaks
- Fall back to typing, a simpler voice or an honest error message when something fails

## Built with

- HTML, CSS and plain JavaScript, no framework
- Figma for the UI design
- Web Speech API for voice in and out
- Node.js serverless functions (the `api` folder)
- Google Gemini API for chat and, optionally, a more natural voice
- Open-Meteo for weather, YouTube IFrame Player API for music
- GitHub and Vercel for hosting

## How the pieces fit

The browser handles the page, the voice and the simple commands. For chat, it sends the conversation to `/api/chat`, a small serverless function. That function adds the secret API key and talks to Gemini. The key never reaches the browser, which is the whole reason the function exists. Weather and music need no secret, so the browser calls those directly.

## Running it on your computer

You need Node.js and a free Gemini API key from Google AI Studio.

1. Download or clone this repo:

```
git clone https://github.com/sakshi-sri23/mandy-voice-assistant.git
cd mandy-voice-assistant
```

2. Create a file named `.env.local` next to `package.json` and put your key in it:

```
GEMINI_API_KEY=your-key-here
```

3. Start it:

```
npm run dev
```

4. Open http://127.0.0.1:4321 in Chrome or Edge and allow the microphone.

Voice will not work if you open `index.html` by double-clicking it, because browsers only allow the microphone on localhost or https.

## Making it your own

Names, voices, texts and your music list are all in `config.js`. Mandy's personality is in `lib/persona.js`. Colours and fonts are variables at the top of `style.css`.

To add a song, paste a YouTube link into the `library` list in `config.js`, then say "play" and its name.

## Files

- `index.html`: the welcome page and the chat page
- `style.css`: the sunflower theme, layout and animations
- `config.js`: settings and texts
- `script.js`: the main logic
- `music.js`: YouTube player and music commands
- `api/chat.js`: chat replies through Gemini
- `api/tts.js`: the natural voice
- `lib/persona.js`: Mandy's personality
- `dev-server.js`: a small local server for development

## Things that don't work well yet

- Speech recognition only works in Chrome and Edge, and needs internet
- It mishears sometimes, especially when Hindi and English are mixed
- She only remembers the last 12 messages of the current visit
- She can chat about plans, but she cannot actually make calls or book anything
- The API has no rate limit yet, so someone could use up the free quota
- I tested it by hand and with simulated browser scripts, but there are no automated tests

## What I want to add next

- Rate limiting
- A "Hey Mandy" wake word
- An installable phone version (PWA)
- Automated tests
- Moving it to Vite and React

## Author

Sakshi
GitHub: [sakshi-sri23](https://github.com/sakshi-sri23)
