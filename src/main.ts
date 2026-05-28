// OWNER: Dave
// App orchestration -- wires camera -> analyze -> prompt -> generate -> play

import { initCamera, captureFrame } from './camera';
import { renderApp, updateStatus, showPhoto } from './ui';
import { analyzeImage } from './analyze';
import { buildSongPrompt } from './prompt';
import { generateSong } from './generate';
import { renderPlayer } from './player';
import './style.css';

async function main() {
  const { video, canvas, captureBtn, status, player } = renderApp();

  try {
    const stream = await initCamera(video);
    captureBtn.disabled = false;
    updateStatus(status, 'idle', 'Camera ready. Strike a pose!');

    captureBtn.addEventListener('click', async () => {
      captureBtn.disabled = true;

      try {
        // 1. Capture photo
        updateStatus(status, 'capturing', 'Capturing your vibe...');
        const base64 = captureFrame(video);
        showPhoto(canvas, video);

        // 2. Analyze image via Zero
        updateStatus(status, 'analyzing', 'Analyzing your vibe...');
        const analysis = await analyzeImage(base64);
        updateStatus(
          status,
          'analyzing',
          `Vibe detected: ${analysis.mood}, ${analysis.energy} energy`
        );

        // 3. Build song prompt
        const prompt = buildSongPrompt(analysis);
        console.log('Song prompt:', prompt);

        // 4. Generate song via Zero
        updateStatus(status, 'generating', 'Composing your walk-on anthem...');
        const song = await generateSong(prompt);

        // 5. Play it
        updateStatus(status, 'playing', 'Your walk-on song is ready!');
        renderPlayer(player, song.audioUrl, song.title);
      } catch (err) {
        updateStatus(status, 'error', `Error: ${(err as Error).message}`);
        captureBtn.disabled = false;
      }
    });
  } catch (err) {
    updateStatus(status, 'error', 'Camera access denied. Please allow camera permissions.');
  }
}

main();
