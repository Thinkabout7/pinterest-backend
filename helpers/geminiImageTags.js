// helpers/geminiImageTags.js
import fetch from 'node-fetch';

/**
 * Generates 12�?"15 high-quality AI tags (including brands) for images OR videos using Gemini 2.0 Flash
 * @param {string} mediaUrl - Cloudinary URL of the image or video
 * @returns {string[]} - Array of lowercase tags
 */
export async function generateImageTags(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') return [];

  try {
    // --- Detect if media is video or image ---
    const isVideo = /\.(mp4|webm|mov|avi)$/i.test(mediaUrl) ||
                    mediaUrl.includes('/video/') ||
                    mediaUrl.includes('video/upload');

    const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';

    // --- strongest full-spectrum prompt for both images + videos ---
    const prompt = isVideo
      ? `Analyze this video VERY carefully and generate 20�25 short, specific tags.
Identify clearly:
- celebrities or public figures (name them if recognizable)
- exact fashion brands (nike, adidas, puma, timberland, herm�s, gucci, balenciaga, zara)
- clothing items, shoes, outfits, accessories
- handbags (birkin, clutch, crossbody), jewelry, sunglasses
- tech devices and models (iphone 14 pro, samsung s23 ultra)
- food, drinks, animals, objects, vehicles
- environment and scene context (street, cafe, bedroom, outdoor, studio)
- actions, gestures, movements visible in the video
- colors, textures, materials, style

OUTPUT RULES:
- Return ONLY comma-separated tags.
- No sentences, no explanations, no full phrases.
`
      : `Analyze this image VERY carefully and generate 20�25 short, specific tags.
Identify clearly:
- celebrities or public figures (name them if recognizable)
- exact product and fashion brands (herm�s birkin bag, nike air force 1, adidas samba, timberland boots)
- clothing pieces and fashion details (oversized blazer, ripped jeans, tailored coat)
- accessories (handbag, sunglasses, hoop earrings, necklace, wristwatch)
- tech devices and models (iphone 14 pro, macbook air)
- animals, food, plants, objects, furniture
- scene/environment (street style, cafe interior, living room, beach)
- colors, materials, textures, aesthetic theme

OUTPUT RULES:
- Return ONLY comma-separated tags.
- No sentences, no explanations, no filler words.
`;

    // --- Download media file ---
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error(`Failed to fetch media: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');

    // --- Call Gemini 2.0 Flash ---
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  }
                }
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

    const text =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      console.warn("Gemini returned no tags for:", mediaUrl);
      return [];
    }

    // --- Clean and format tags ---
    return text
      .split(',')
      .map(tag => tag.trim().toLowerCase().replace(/[^\w\s-]/g, ''))
      .filter(tag => tag.length > 1 && tag.length < 30)
      .slice(0, 15);

  } catch (error) {
    console.error('Gemini Tag Error:', error.message);
    return []; // Never break pin upload
  }
}

