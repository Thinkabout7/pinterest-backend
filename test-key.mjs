import fetch from 'node-fetch';

const url = 'https://res.cloudinary.com/dsjycaezy/image/upload/v1763926264/pinterest_clone/pins/uvklyl7scsbho95xoeyc.jpg';

const img = await fetch(url);
const buffer = Buffer.from(await img.arrayBuffer());
const base64 = buffer.toString('base64');

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [
      { text: "Give 10 short tags, comma separated" },
      { inlineData: { mimeType: "image/jpeg", data: base64 }}
    ]}]
  })
});

const json = await res.json();
console.log(json.candidates ? "SUCCESS → " + json.candidates[0].content.parts[0].text : "ERROR → " + (json.error?.message || "No response"));