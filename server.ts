// OWNER: Dave + Sam
// Express proxy server -- shells out to Zero CLI for API calls
// Run with: npx tsx server.ts

import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = 3001;

// POST /api/analyze -- receive base64 image, analyze via Zero
app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body; // data:image/jpeg;base64,...
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // TODO (Sam): Implement Zero-based image analysis
    // 1. zero search "image analysis" or "image description"
    // 2. zero get <n> --formatted to find the right capability
    // 3. zero fetch with the image data
    // 4. Parse response into ImageAnalysis shape

    // STUB: Return mock data until wired up
    res.json({
      mood: 'confident',
      energy: 'high',
      colors: ['blue', 'purple', 'white'],
      scene: 'person at a desk with dramatic lighting',
      keywords: ['focused', 'determined', 'bold'],
      rawDescription: 'A confident person in a well-lit environment with cool tones.',
    });
  } catch (err: any) {
    console.error('Analyze error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate -- receive prompt, generate song via Zero
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    // TODO (Dave): Implement Zero-based music generation
    // 1. zero search "music generation" or "AI song"
    // 2. zero get <n> --formatted to find the right capability
    // 3. zero fetch with the prompt
    // 4. Return { audioUrl, title }

    // STUB: Return mock data until wired up
    res.json({
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      title: 'Your Walk-On Anthem',
    });
  } catch (err: any) {
    console.error('Generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Zero proxy server running on http://localhost:${PORT}`);
});
