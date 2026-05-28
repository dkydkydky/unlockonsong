// OWNER: Dave
// Music generation via Zero -- discovers and calls a music generation capability

export interface GeneratedSong {
  audioUrl: string;
  title: string;
}

/**
 * Generate a song using Zero's music generation capabilities.
 * Sends the prompt to the server proxy which calls `zero fetch`.
 *
 * @param prompt - The song generation prompt from prompt.ts
 * @returns URL to the generated audio and a title
 */
export async function generateSong(prompt: string): Promise<GeneratedSong> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`Song generation failed: ${response.statusText}`);
  }

  return response.json();
}
