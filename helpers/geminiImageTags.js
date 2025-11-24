// helpers/geminiImageTags.js   ← REPLACE ENTIRE FILE WITH THIS
import fetch from 'node-fetch';

/**
 * Generates 10–15 high-quality AI tags for images OR videos using Gemini 2.0 Flash
 * @param {string} mediaUrl - Cloudinary URL of the image or video
 * @returns {string[]} - Array of lowercase tags
 */
export async function generateImageTags(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') return [];

  try {
    // --- Smart video/image detection ---
    const isVideo = /\.(mp4|webm|mov|avi)$/i.test(mediaUrl) || 
                    mediaUrl.includes('/video/') || 
                    mediaUrl.includes('video-upload');

    const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';

    // --- Tailored prompts (Gemini performs way better with these) ---
    const prompt = isVideo
      ? "Watch the entire video carefully. Extract 12-15 short, accurate, comma-separated tags describing the main subject, actions, characters, setting, and mood. Example: spiderman, swinging, city skyline, night, action, superhero, rooftop, web shooting, dramatic, marvel"
      : "Analyze this image and return 12-15 short, accurate, comma-separated tags. Focus on objects, people, colors, style, and mood. Example: tea, porcelain cup, steam, cozy morning, minimalist, white background, hot beverage, saucer";

    // --- Download media ---
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error(`Failed to fetch media: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');

    // --- Call Gemini 2.0 Flash ---
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64 } }
              ]
            }
          ],
          safetySettings: [
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
          ]
        })
      }
    );

    const result = await geminiResponse.json();

    if (result.error) {
      throw new Error(result.error.message || 'Gemini API error');
    }

    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.warn("Gemini returned no tags for:", mediaUrl);
      return [];
    }

    const text = result.candidates[0].content.parts[0].text;

    return text
      .split(',')
      .map(tag => tag.trim().toLowerCase().replace(/[^\w\s-]/g, '')) // clean weird chars
      .filter(tag => tag.length > 1 && tag.length < 30) // reasonable length
      .slice(0, 15);

  } catch (error) {
    console.error('Gemini Tag Error →', error.message);
    return []; // Never crash the upload flow
  }
}