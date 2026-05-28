// OWNER: Dave
// App orchestration -- wires camera -> analyze -> prompt -> generate -> play
// Supports multiple captures with different motions to generate varied music

import { initCamera, captureFrame } from './camera';
import { renderApp, updateStatus, showPhoto } from './ui';
import { analyzeImage } from './analyze';
import { buildSongPrompt } from './prompt';
import { generateSong } from './generate';
import { renderPlayer } from './player';
import './style.css';

let captureCount = 0;
const maxCaptures = 5;

async function main() {
  const { video, canvas, captureBtn, status, player } = renderApp();

  try {
    const stream = await initCamera(video);
    captureBtn.disabled = false;
    captureBtn.textContent = 'Generate My Walk-On Song';
    updateStatus(status, 'idle', 'Camera ready. Strike a pose! (Try different motions for varied music)');

    captureBtn.addEventListener('click', async () => {
      captureBtn.disabled = true;

      try {
        captureCount++;
        
        // 1. Capture photo
        updateStatus(status, 'capturing', `Capturing your vibe... (${captureCount}/${maxCaptures})`);
        const base64 = captureFrame(video);
        showPhoto(canvas, video);

        // 2. Analyze image via Zero
        updateStatus(status, 'analyzing', 'Analyzing your motion & vibe...');
        const analysis = await analyzeImage(base64);
        updateStatus(
          status,
          'analyzing',
          `Vibe detected: ${analysis.mood}, ${analysis.energy} energy`
        );

        // 3. Build song prompt (varies by capture # and detected vibe)
        const prompt = buildSongPrompt(analysis, captureCount);
        console.log(`Capture #${captureCount} prompt:`, prompt);

        // 4. Generate song via Zero
        updateStatus(status, 'generating', `Composing anthem #${captureCount}...`);
        const song = await generateSong(prompt);

        // 5. Play it
        updateStatus(status, 'playing', `Your walk-on song #${captureCount} is ready!`);
        renderPlayer(player, song.audioUrl, song.title);

        // Allow multiple captures for variety
        if (captureCount < maxCaptures) {
          updateStatus(status, 'idle', `Capture ${captureCount}/${maxCaptures} done! Try another pose for variation.`);
          captureBtn.textContent = `Generate Another (${captureCount}/${maxCaptures})`;
          captureBtn.disabled = false;
        } else {
          updateStatus(status, 'idle', 'Max captures reached! Reset to try again.');
          captureBtn.textContent = 'Reset & Start Over';
          captureBtn.onclick = () => location.reload();
        }
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
