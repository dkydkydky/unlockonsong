// OWNER: Erica
// UI rendering -- DOM manipulation, status updates, layout

export type AppState = 'idle' | 'capturing' | 'analyzing' | 'generating' | 'playing' | 'error';

export function renderApp(): {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  captureBtn: HTMLButtonElement;
  status: HTMLDivElement;
  player: HTMLDivElement;
} {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <div class="container">
      <h1>Unlock On Song</h1>
      <p class="subtitle">Your walk-on anthem, generated from your vibe.</p>

      <div class="camera-section">
        <video id="video" autoplay playsinline muted></video>
        <canvas id="canvas" style="display:none"></canvas>
      </div>

      <button id="capture-btn" class="btn" disabled>Generate My Walk-On Song</button>

      <div id="status" class="status"></div>

      <div id="player" class="player-section"></div>
    </div>
  `;

  return {
    video: document.querySelector<HTMLVideoElement>('#video')!,
    canvas: document.querySelector<HTMLCanvasElement>('#canvas')!,
    captureBtn: document.querySelector<HTMLButtonElement>('#capture-btn')!,
    status: document.querySelector<HTMLDivElement>('#status')!,
    player: document.querySelector<HTMLDivElement>('#player')!,
  };
}

export function updateStatus(el: HTMLDivElement, state: AppState, message: string): void {
  el.className = `status status-${state}`;
  el.textContent = message;
}

export function showPhoto(canvas: HTMLCanvasElement, video: HTMLVideoElement): void {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  canvas.style.display = 'block';
  video.style.display = 'none';
}
