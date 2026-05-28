// OWNER: Dave + Sam
// Express proxy server -- calls Zero CLI for image analysis (cnvrt.ing) and music generation (Suno)
// Run with: npx tsx server.ts

import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT || 3001);

function zeroFetch(capability: string, data: object): any {
  const tmpFile = join(tmpdir(), `zero-${randomUUID()}.json`);
  writeFileSync(tmpFile, JSON.stringify(data));
  try {
    const result = execSync(
      `zero fetch --capability ${capability} --json -d @${tmpFile} --max-pay 0.50`,
      { encoding: 'utf-8', timeout: 120_000 }
    );
    const parsed = JSON.parse(result);
    if (!parsed.ok) {
      throw new Error(`Zero fetch failed: status ${parsed.status}`);
    }
    return parsed.body;
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Static file serving for uploads and generated audio
const publicUploadsDir = join(process.cwd(), 'public', 'uploads');
const publicGeneratedDir = join(process.cwd(), 'public', 'generated');
mkdirSync(publicUploadsDir, { recursive: true });
mkdirSync(publicGeneratedDir, { recursive: true });
app.use('/uploads', express.static(publicUploadsDir));
app.use('/generated', express.static(publicGeneratedDir));

function isDataAudio(s: any) {
  return typeof s === 'string' && /^data:audio\/[a-zA-Z0-9.+-]+;base64,/.test(s);
}

// POST /api/analyze -- receive base64 image, analyze via Zero (cnvrt.ing)
app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    try {
      const result = zeroFetch('cnvrt-ing-5f6b4e95', {
        file: image,
        detail: 'high',
      });

      const objects: string[] = result.detected_objects || [];
      const ocrText: string = result.ocr_text || '';
      const analysis = deriveAnalysis(objects, ocrText);
      return res.json(analysis);
    } catch (zeroErr: any) {
      console.error('Zero analyze failed, using fallback:', zeroErr.message);
      // Fallback stub when Zero is unavailable
      return res.json({
        mood: 'confident',
        energy: 'high',
        colors: ['blue', 'purple', 'white'],
        scene: 'person at a desk with dramatic lighting',
        keywords: ['focused', 'determined', 'bold'],
        rawDescription: 'Fallback: Zero CLI not available or failed',
      });
    }
  } catch (err: any) {
    console.error('Analyze error:', err.message || err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

function deriveAnalysis(objects: string[], ocrText: string) {
  const objectStr = objects.join(', ').toLowerCase();

  let mood = 'confident';
  let energy: 'low' | 'medium' | 'high' = 'medium';

  if (objectStr.match(/smile|laugh|party|celebration/)) {
    mood = 'happy';
    energy = 'high';
  } else if (objectStr.match(/dark|shadow|night|hoodie/)) {
    mood = 'mysterious';
    energy = 'medium';
  } else if (objectStr.match(/sun|bright|outdoor|nature|plant/)) {
    mood = 'energetic';
    energy = 'high';
  } else if (objectStr.match(/book|desk|computer|glasses/)) {
    mood = 'focused';
    energy = 'medium';
  } else if (objectStr.match(/person|face|portrait/)) {
    mood = 'confident';
    energy = 'high';
  }

  const colorKeywords = objects.filter((o) =>
    /red|blue|green|yellow|purple|orange|pink|black|white|gold|silver/i.test(o)
  );
  const colors = colorKeywords.length > 0 ? colorKeywords : ['blue', 'purple', 'gold'];

  return {
    mood,
    energy,
    colors,
    scene: objects.slice(0, 5).join(', ') || 'person in frame',
    keywords: objects.slice(0, 8),
    rawDescription: `Detected: ${objects.join(', ')}. OCR: ${ocrText || 'none'}`,
  };
}

// POST /api/generate -- receive prompt, generate song via Zero (Suno)
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    try {
      // Step 1: Submit generation to Suno
      console.log('Submitting to Suno...');
      const genResult = zeroFetch('suno-generate-music-148a60d9', {
        prompt,
        style: 'electronic, anthem, cinematic',
        title: 'Walk-On Anthem',
        instrumental: 'true',
        customMode: 'true',
      });

      const taskId = genResult?.data?.taskId || genResult?.taskId;
      if (!taskId) {
        console.error('Suno response:', JSON.stringify(genResult));
        throw new Error('No taskId returned from Suno');
      }

      console.log(`Suno taskId: ${taskId}. Polling for completion...`);

      // Step 2: Poll for completion (up to 90 seconds)
      let audioUrl: string | null = null;
      for (let i = 0; i < 30; i++) {
        await sleep(3000);
        const statusResult = zeroFetch('suno-get-music-status-97b3ca48', { taskId });

        const status = statusResult?.data?.status || statusResult?.status;
        console.log(`Poll ${i + 1}: status=${status}`);

        if (status === 'completed' || status === 'SUCCESS') {
          const tracks = statusResult?.data?.tracks || statusResult?.data?.data || statusResult?.tracks;
          if (Array.isArray(tracks) && tracks.length > 0) {
            audioUrl = tracks[0].audioUrl || tracks[0].audio_url || tracks[0].source_audio_url;
          } else if (statusResult?.data?.audioUrl) {
            audioUrl = statusResult.data.audioUrl;
          }
          break;
        } else if (status === 'failed' || status === 'FAILED') {
          throw new Error('Suno generation failed');
        }
      }

      if (!audioUrl) {
        throw new Error('Suno generation timed out (90s)');
      }

      // If audio is base64, save locally
      if (isDataAudio(audioUrl)) {
        const extMatch = audioUrl.match(/^data:audio\/(.+);base64,/);
        const ext = extMatch ? extMatch[1].split('+')[0] : 'mp3';
        const filename = `song-${Date.now()}.${ext}`;
        const outPath = join(publicGeneratedDir, filename);
        const b64 = audioUrl.split(',')[1];
        writeFileSync(outPath, Buffer.from(b64, 'base64'));
        audioUrl = `/generated/${filename}`;
      }

      return res.json({ audioUrl, title: 'Your Walk-On Anthem' });
    } catch (zeroErr: any) {
      console.error('Zero generate failed, using fallback:', zeroErr.message);
      return res.json({
        audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        title: 'Your Walk-On Anthem (stub)',
        _note: 'Zero CLI failed -- using stub audio',
      });
    }
  } catch (err: any) {
    console.error('Generate error:', err.message || err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', port: PORT });
});

app.get('/', (_req, res) => {
  res.send('<html><body><h2>UnlockOnSong - Zero proxy</h2><p>Use <code>/api/health</code> for status.</p></body></html>');
});

// Upload endpoint: saves image under public/uploads
app.post('/api/upload-image', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const matches = image.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid data URL' });

    const ext = matches[1].split('/')[1] || 'jpg';
    const b64 = matches[2];
    const filename = `img-${Date.now()}.${ext}`;
    const outPath = join(publicUploadsDir, filename);
    writeFileSync(outPath, Buffer.from(b64, 'base64'));

    const url = `/uploads/${filename}`;
    return res.json({ url, filename });
  } catch (err: any) {
    console.error('Upload error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Zero proxy server running on http://localhost:${PORT}`);
  console.log('Capabilities:');
  console.log('  - Image Analysis: cnvrt.ing (GPT-4o Vision) @ $0.005/call');
  console.log('  - Music Generation: Suno @ $0.105/call + $0.005/status poll');
  console.log('  - Deploy: cdn.withzero.xyz @ $0/call');
});
