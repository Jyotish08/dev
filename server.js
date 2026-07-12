import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const fetchApi = globalThis.fetch || fetch;

// Endpoint: STT via Groq Whisper
app.post('/api/stt', upload.single('audio'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No audio file provided' });

    const formData = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype || 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-large-v3');

    const response = await fetchApi('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'STT failed');

    res.json({ text: data.text });
  } catch (error) {
    console.error('STT Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Roast via Google Gemini
app.post('/api/roast', async (req, res) => {
  try {
    const transcript = req.body.transcript || req.body.text;
    if (!transcript) return res.status(400).json({ error: 'No transcript provided' });

    const prompt = `Generate a short, punchy, PG-13 sports rivalry roast responding to this trash talk: "${transcript}"`;

    const response = await fetchApi(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API Error details:', JSON.stringify(data, null, 2));
      throw new Error(data.error?.message || 'Roast generation failed');
    }

    const roast = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Failed to generate roast';
    res.json({ roast });
  } catch (error) {
    console.error('Roast Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: TTS via ElevenLabs
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'CwhRBWXzGAHq8TQ4Fs17';

    const response = await fetchApi(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('ElevenLabs API Error details:', response.status, errorBody);
      throw new Error(`TTS failed: ${response.status} - ${errorBody}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (error) {
    console.error('TTS Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve the built frontend (production only — after all /api routes)
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));