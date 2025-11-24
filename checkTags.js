// Paste this in a new file checkTags.js and run `node checkTags.js`
import mongoose from 'mongoose';
import Pin from './models/Pin.js';
await mongoose.connect(process.env.MONGO_URI);
const pins = await Pin.find({ tags: { $exists: true, $ne: [] } }).select('title tags');
console.log(pins.map(p => `${p.title} → ${p.tags.join(', ')}`));
process.exit();