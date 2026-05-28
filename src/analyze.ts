// OWNER: Sam
// Image analysis via Zero -- discovers and calls an image analysis capability

export interface ImageAnalysis {
  mood: string;
  energy: 'low' | 'medium' | 'high';
  colors: string[];
  scene: string;
  keywords: string[];
  rawDescription: string;
}

/**
 * Analyze an image using Zero's image analysis capabilities.
 * Sends base64 JPEG to the server proxy which calls `zero fetch`.
 *
 * @param base64DataUrl - The full data URL (data:image/jpeg;base64,...)
 * @returns Structured analysis of the image
 */
export async function analyzeImage(base64DataUrl: string): Promise<ImageAnalysis> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64DataUrl }),
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  return response.json();
}
