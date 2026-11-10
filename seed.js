import { MongoClient } from 'mongodb';
import { SELLERS } from './data.js';
import { resetDemo } from './store.js';

const client = await new MongoClient(process.env.MONGODB_URI).connect();
const db = client.db('saathi');
await resetDemo(db); // sellers back to the sample data; cases and simulated outcomes cleared
await db.collection('calls').createIndex({ seller_id: 1, started_at: -1 });
console.log(`seeded ${SELLERS.length} sellers`);
await client.close();
