// OWNER: Dave + Sam
// Express proxy server -- attempts to call Zero CLI when configured, otherwise falls back to clear stubs
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
  const capability = process.env.ZERO_ANALYZE_CAPABILITY;
  if (!capability) return null;

  // Attempt to fetch the capability with an input file
  const out = runZero(['fetch', capability, '--input-file', filePath, '--json']);
  if (!out) return null;

  try {
    return JSON.parse(out);
  } catch (err) {
    // not JSON? return raw
    return { raw: out };
  }
}

async function tryGenerateWithZero(inputFilePath: string) {
  const capability = process.env.ZERO_GENERATE_CAPABILITY;
  if (!capability) return null;

  const out = runZero(['fetch', capability, '--input-file', inputFilePath, '--json']);
  if (!out) return null;

  try {
    return JSON.parse(out);
  } catch (err) {
    return { raw: out };
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

// POST /api/analyze -- receive base64 image, analyze via Zero (if configured)
app.post('/api/analyze', async (req, res) => {
  let tmpPath: string | undefined;
  try {
    const { image } = req.body; // data:image/jpeg;base64,...
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // If Zero capabilities are configured, attempt to call them
    try {
      tmpPath = writeBase64ToTempFile(image);
    } catch (err: any) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    const zeroResp = await tryAnalyzeWithZero(tmpPath);
    if (zeroResp) {
      // Attempt to map common fields, but return raw when mapping not possible
      const mapped = {
        mood: zeroResp.mood || zeroResp.result?.mood || 'neutral',
        energy: zeroResp.energy || zeroResp.result?.energy || 'medium',
        colors: zeroResp.colors || zeroResp.result?.colors || [],
        scene: zeroResp.scene || zeroResp.result?.scene || (zeroResp.description || ''),
        keywords: zeroResp.keywords || zeroResp.result?.keywords || [],
        rawDescription: JSON.stringify(zeroResp),
      };
      return res.json(mapped);
    }

    // Fallback/stub response when Zero is not configured or failed
    res.json({
      mood: 'confident',
      energy: 'high',
      colors: ['blue', 'purple', 'white'],
      scene: 'person at a desk with dramatic lighting',
      keywords: ['focused', 'determined', 'bold'],
      rawDescription: 'A confident person in a well-lit environment with cool tones. (stubbed response)',
      _note: 'To enable real analysis set ZERO_ANALYZE_CAPABILITY and install the Zero CLI: npm i -g @zeroxyz/cli',
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
  res.json({ status: 'ok', port: PORT, zeroAnalyze: !!process.env.ZERO_ANALYZE_CAPABILITY, zeroGenerate: !!process.env.ZERO_GENERATE_CAPABILITY, suno: !!process.env.SUNO_API_KEY });
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

// POST /api/generate -- receive prompt, generate song via Zero or save base64 audio
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
        // zeroResp might contain a remote URL, or base64 audio, or structured result
        const maybeAudio = zeroResp.audioUrl || zeroResp.result?.audioUrl || zeroResp.url || zeroResp.audio || null;
        const maybeTitle = zeroResp.title || zeroResp.result?.title || 'Walk-On Anthem';

        if (maybeAudio) {
          // If it's a data URL, save it locally
          if (isDataAudio(maybeAudio)) {
            const extMatch = (maybeAudio as string).match(/^data:audio\/(.+);base64,/);
            const ext = extMatch ? extMatch[1].split('+')[0] : 'mp3';
            const filename = `song-${Date.now()}.${ext}`;
            const outPath = join(publicGeneratedDir, filename);
            const b64 = (maybeAudio as string).split(',')[1];
            writeFileSync(outPath, Buffer.from(b64, 'base64'));
            const url = `${req.protocol}://${req.get('host')}/generated/${filename}`;
            return res.json({ audioUrl: url, title: maybeTitle });
          }

          // Otherwise assume it's a remote URL and return as-is
          return res.json({ audioUrl: maybeAudio, title: maybeTitle });
        }

        // If response shape not recognized, return raw for debugging
        return res.json({ audioUrl: null, title: maybeTitle, raw: zeroResp });
      }
    }

    // If Suno is configured and Zero not used, attempt to call Suno via environment
    if (process.env.SUNO_API_KEY) {
      // Leave placeholder: integrating real Suno API requires API spec and key. Return stub with note.
      return res.json({ audioUrl: null, title: 'Suno generation not implemented in proxy', _note: 'Set ZERO_GENERATE_CAPABILITY or implement Suno API call in server.ts' });
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

app.listen(PORT, () => {
  console.log(`Zero proxy server running on http://localhost:${PORT}`);
  console.log('Environment note: set ZERO_ANALYZE_CAPABILITY and ZERO_GENERATE_CAPABILITY to enable real Zero CLI calls');
});
