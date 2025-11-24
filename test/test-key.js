// test-key.js
require('node-fetch')('https://res.cloudinary.com/dsjycaezy/image/upload/v1763926264/pinterest_clone/pins/uvklyl7scsbho95xoeyc.jpg')
  .then(r => r.arrayBuffer())
  .then(b => Buffer.from(b).toString('base64'))
  .then(b64 => {
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Give 10 short tags, comma separated only" },
            { inlineData: { mimeType: "image/jpeg", data: b64 } }
          ]
        }]
      })
    });
  })
  .then(r => r.json())
  .then(j => {
    console.log("\nRESULT:");
    if (j.candidates) {
      console.log("TAGS →", j.candidates[0].content.parts[0].text);
    } else {
      console.log("ERROR →", j.error?.message || j);
    }
  })
  .catch(e => console.log("FAILED →", e.message));