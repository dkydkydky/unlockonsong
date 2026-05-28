// OWNER: Dave
// Audio playback UI

export function renderPlayer(container: HTMLDivElement, audioUrl: string, title: string): void {
  container.innerHTML = `
    <div class="player">
      <h3>${title}</h3>
      <audio id="audio" controls autoplay>
        <source src="${audioUrl}" type="audio/mpeg">
        Your browser does not support the audio element.
      </audio>
    </div>
  `;
}
