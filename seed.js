import { MongoClient } from 'mongodb';
import { SELLERS } from './data.js';

const client = await new MongoClient(process.env.MONGODB_URI).connect();
const db = client.db('saathi');
for (const s of SELLERS) await db.collection('sellers').replaceOne({ _id: s._id }, s, { upsert: true });
await db.collection('calls').createIndex({ seller_id: 1, started_at: -1 });
console.log(`seeded ${SELLERS.length} sellers`);
await client.close();
