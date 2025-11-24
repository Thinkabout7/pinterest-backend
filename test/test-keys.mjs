// test-key.mjs
import fetch from 'node-fetch';

const imageUrl = 'https://res.cloudinary.com/dsjycaezy/image/upload/v1763926264/pinterest_clone/pins/uvklyl7scsbho95xoeyc.jpg';

try {
  const imgRes = await fetch(imageUrl);
  const buffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Give 10 short comma-separated tags only" },
            { inlineData: { mimeType: 'image/jpeg', data: base64 } }
          ]
        }]
      })
    }
  );

  const result = await geminiRes.json();

  console.log('\n=== GEMINI RESULT ===');
  if (result.candidates) {
    console.log('TAGS →', result.candidates[0].content.parts[0].text);
  } else {
    console.log('ERROR →', result.error?.message || 'Unknown error');
  }
  console.log('=====================\n');

} catch (err) {
  console.log('FAILED →', err.message);
}