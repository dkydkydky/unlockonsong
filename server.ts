// OWNER: Dave + Sam
// Express proxy server -- integrates Zero CLI for image analysis and music generation
// Discovered capabilities:
//   - Image: cnvrt.ing Image Analyzer (cnvrt-ing-5f6b4e95) — $0.005/call, 100% success
//   - Music: Suno Generate Music (suno-generate-music-148a60d9) — $0.105/call, 96% success
// Run with: npx tsx server.ts

import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT || 3001);

// Zero capabilities (discovered via zero search + zero get)
const ZERO_IMAGE_CAPABILITY = 'cnvrt-ing-5f6b4e95'; // cnvrt.ing Image Analyzer
const ZERO_MUSIC_CAPABILITY = 'suno-generate-music-148a60d9'; // Suno Generate Music

function runZero(args: string[]): string | null {
  try {
    // join args for exec; ensure no shell globbing issues by not using a shell string where possible
    const cmd = `zero ${args.map(a => a.replace(/"/g, '\\"')).join(' ')}`;
    const out = execSync(cmd, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 });
    return out;
  } catch (err: any) {
    console.error('Zero CLI invocation failed:', err?.message || err);
    return null;
  }
}

async function tryAnalyzeWithZero(filePath: string) {
  // Use discovered capability: cnvrt.ing Image Analyzer
  // Read file and encode as base64 for the API
  try {
    const fs = require('fs');
    const imageData = fs.readFileSync(filePath);
    const base64 = imageData.toString('base64');
    
    const cmd = `zero fetch --capability ${ZERO_IMAGE_CAPABILITY} -d '{"image":"data:image/jpeg;base64,${base64}"}' --json`;
    const out = execSync(cmd, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 });
    const result = JSON.parse(out);
    
    if (result.ok && result.body) {
      return result.body;
    }
    return null;
  } catch (err: any) {
    console.error('Zero image analysis failed:', err?.message || err);
    return null;
  }
}

async function tryGenerateWithZero(prompt: string) {
  // Use discovered capability: Suno Generate Music
  const musicPayload = {
    model: 'V5',
    style: 'hip-hop, trap, empowering, energetic, stadium anthem',
    title: 'Walk-On Anthem',
    customMode: true,
    instrumental: true,
    vocalGender: 'male'
  };

  try {
    const cmd = `zero fetch --capability ${ZERO_MUSIC_CAPABILITY} -d '${JSON.stringify(musicPayload)}' --json`;
    const out = execSync(cmd, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 });
    const result = JSON.parse(out);
    
    if (result.ok && result.body) {
      return result.body;
    }
    return null;
  } catch (err: any) {
    console.error('Zero music generation failed:', err?.message || err);
    return null;
  }
}

// Helper: write base64 data URL to a temp JPEG file
function writeBase64ToTempFile(dataUrl: string) {
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid data URL');
  const b64 = matches[2];
  const buffer = Buffer.from(b64, 'base64');
  const tmpPath = join(tmpdir(), `zero-img-${Date.now()}.jpg`);
  writeFileSync(tmpPath, buffer);
  return tmpPath;
}

// POST /api/analyze -- receive base64 image, analyze via Zero's cnvrt.ing capability
app.post('/api/analyze', async (req, res) => {
  let tmpPath: string | undefined;
  try {
    const { image } = req.body; // data:image/jpeg;base64,...
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Write image to temp file
    try {
      tmpPath = writeBase64ToTempFile(image);
    } catch (err: any) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    // Try Zero image analysis capability
    const zeroResp = await tryAnalyzeWithZero(tmpPath);
    if (zeroResp) {
      // cnvrt.ing returns OCR text + detected objects; map to our schema
      const mapped = {
        mood: 'neutral',
        energy: 'medium' as const,
        colors: [],
        scene: zeroResp.description || zeroResp.text || 'Scene captured',
        keywords: zeroResp.objects || zeroResp.tags || [],
        rawDescription: JSON.stringify(zeroResp),
      };
      return res.json(mapped);
    }

    // Fallback/stub response
    res.json({
      mood: 'confident',
      energy: 'high',
      colors: ['blue', 'purple', 'white'],
      scene: 'person at a desk with dramatic lighting',
      keywords: ['focused', 'determined', 'bold'],
      rawDescription: 'Stub response (Zero not called or analysis failed)',
      _note: 'To enable real analysis, fund your Zero wallet: zero wallet fund --no-open',
    });
  } catch (err: any) {
    console.error('Analyze error:', err.message || err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  } finally {
    if (tmpPath) {
      try {
        unlinkSync(tmpPath);
      } catch {}
    }
  }
});

// POST /api/generate -- receive prompt, generate song via Zero
app.post('/api/generate', async (req, res) => {
  let tmpInput: string | undefined;
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    // If Zero capability configured, attempt to call it
    if (process.env.ZERO_GENERATE_CAPABILITY) {
      const inputObj = { prompt };
      tmpInput = join(tmpdir(), `zero-prompt-${Date.now()}.json`);
      writeFileSync(tmpInput, JSON.stringify(inputObj));

      const zeroResp = await tryGenerateWithZero(tmpInput);
      if (zeroResp) {
        // Try to map common fields
        const audioUrl = zeroResp.audioUrl || zeroResp.result?.audioUrl || zeroResp.url || zeroResp.audio || null;
        const title = zeroResp.title || zeroResp.result?.title || 'Walk-On Anthem';
        if (audioUrl) {
          return res.json({ audioUrl, title });
        }

        // If response format unknown, return raw body for debugging
        return res.json({ audioUrl: null, title, raw: zeroResp });
      }
    }

    // Fallback stub
    res.json({
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      title: 'Your Walk-On Anthem (stub)',
      _note: 'To enable real generation set ZERO_GENERATE_CAPABILITY and install the Zero CLI: npm i -g @zeroxyz/cli',
    });
  } catch (err: any) {
    console.error('Generate error:', err.message || err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  } finally {
    if (tmpInput) {
      try {
        unlinkSync(tmpInput);
      } catch {}
    }
  }
});

// Serve uploaded and generated assets so the frontend can play them directly
const publicUploadsDir = join(process.cwd(), 'public', 'uploads');
const publicGeneratedDir = join(process.cwd(), 'public', 'generated');

mkdirSync(publicUploadsDir, { recursive: true });
mkdirSync(publicGeneratedDir, { recursive: true });

app.use('/uploads', express.static(publicUploadsDir));
app.use('/generated', express.static(publicGeneratedDir));

// Lightweight health and root endpoints to aid local dev and avoid 404s
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    port: PORT, 
    capabilities: {
      imageAnalysis: ZERO_IMAGE_CAPABILITY,
      musicGeneration: ZERO_MUSIC_CAPABILITY
    },
    _note: 'To use real capabilities, fund wallet: zero wallet fund --no-open'
  });
});

app.get('/', (_req, res) => {
  res.send('<html><body><h2>Zero proxy server</h2><p>Use <code>/api/health</code> for status.</p></body></html>');
});

// Upload endpoint: saves image under public/uploads and returns a static URL
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

    const url = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    return res.json({ url, filename });
  } catch (err: any) {
    console.error('Upload error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

// Helper to detect base64 audio data URLs
function isDataAudio(s: any) {
  return typeof s === 'string' && /^data:audio\/[a-zA-Z0-9.+-]+;base64,/.test(s);
}

// POST /api/generate -- receive prompt, generate song via Zero's Suno capability
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    // Try Zero Suno music generation capability
    const zeroResp = await tryGenerateWithZero(prompt);
    if (zeroResp) {
      // Suno returns taskId; link to polling endpoint
      const taskId = zeroResp.taskId || zeroResp.data?.data?.taskId;
      if (taskId) {
        // Return stub: in production, poll suno-get-music-status with taskId
        return res.json({
          audioUrl: null,
          title: 'Walk-On Anthem (generating)',
          taskId,
          _note: 'Music generation queued; poll suno-get-music-status with taskId to get audio URL',
        });
      }
    }

    // Fallback/stub response
    res.json({
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      title: 'Your Walk-On Anthem (stub)',
      _note: 'To enable real generation, fund your Zero wallet: zero wallet fund --no-open',
    });
  } catch (err: any) {
    console.error('Generate error:', err.message || err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🎵 Zero proxy server running on http://localhost:${PORT}`);
  console.log('📋 Discovered capabilities:');
  console.log(`   - Image Analysis: ${ZERO_IMAGE_CAPABILITY} (cnvrt.ing, $0.005/call)`);
  console.log(`   - Music Generation: ${ZERO_MUSIC_CAPABILITY} (Suno, $0.105/call)`);
  console.log('\n💰 To activate, fund your wallet:');
  console.log('   zero wallet fund --no-open');
  console.log('   zero wallet balance');
  console.log('');
});
