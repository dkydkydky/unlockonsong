// OWNER: Sam
// Convert image analysis into a song generation prompt

import type { ImageAnalysis } from './analyze';

const GENRE_MAP: Record<string, string> = {
  happy: 'pop, upbeat electronic',
  confident: 'hip-hop, trap, stadium anthem',
  calm: 'lo-fi, chill wave',
  energetic: 'EDM, drum and bass',
  mysterious: 'dark synth, cinematic',
  playful: 'funk, disco',
  serious: 'orchestral, epic cinematic',
  romantic: 'R&B, smooth jazz',
};

const TEMPO_MAP: Record<string, string> = {
  low: '70-90 BPM, slow and deliberate',
  medium: '100-120 BPM, steady groove',
  high: '130-150 BPM, high energy',
};

/**
 * Build a song generation prompt from image analysis.
 * Maps visual attributes to musical ones.
 */
export function buildSongPrompt(analysis: ImageAnalysis): string {
  const genre = GENRE_MAP[analysis.mood] || 'pop, electronic';
  const tempo = TEMPO_MAP[analysis.energy] || TEMPO_MAP['medium'];
  const colorVibe = analysis.colors.slice(0, 3).join(', ');

  return [
    `Create a 30-second walk-on song anthem.`,
    `Genre: ${genre}.`,
    `Tempo: ${tempo}.`,
    `Mood: ${analysis.mood}, inspired by a scene of ${analysis.scene}.`,
    `Visual inspiration: colors are ${colorVibe}.`,
    `Keywords: ${analysis.keywords.join(', ')}.`,
    `This should feel like a confident entrance theme -- short, punchy, memorable.`,
    `No lyrics needed, instrumental only.`,
  ].join(' ');
}
