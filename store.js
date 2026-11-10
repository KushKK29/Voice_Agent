// MongoDB side of the ownership layer: the case ledger, the +7-day simulation and the demo reset.
import { caseDrafts, simulate } from './cases.js';
import { SELLERS } from './data.js';

const note = (by, text) => ({ at: new Date(), by, note: text });

// Opens one case per cause per seller the first time it is seen; never overwrites an existing case.
export async function ensureCases(db, sellers) {
  for (const s of sellers) {
    for (const d of caseDrafts(s)) {
      await db.collection('cases').updateOne(
        { _id: `${d.seller_id}:${d.cause}` },
        { $setOnInsert: { ...d, created_at: new Date(), history: [note('saathi', 'Case opened from the seller data')] } },
        { upsert: true },
      );
    }
  }
  return db.collection('cases').find().toArray();
}

export const touchCase = (db, sellerId, cause, status, text, by = 'saathi') =>
  db.collection('cases').updateOne({ _id: `${sellerId}:${cause}` }, { $set: { status }, $push: { history: note(by, text) } });

// +7 days. "Acted" = the seller approved the restock request on a call, which moved the inventory case to in_progress.
export async function runSimulation(db, sellerId) {
  const seller = await db.collection('sellers').findOne({ _id: sellerId });
  if (!seller) return { status: 404, error: 'unknown seller' };
  if (seller.simulated) return { status: 409, error: 'Already simulated. Reset the demo to run it again.' };
  const inv = await db.collection('cases').findOne({ _id: `${sellerId}:inventory` });
  const { seller: next, outcome } = simulate(seller, inv?.status === 'in_progress');
  await db.collection('sellers').replaceOne({ _id: sellerId }, { ...next, simulated: { day: 7, acted: outcome.acted } });
  await db.collection('outcomes').replaceOne({ _id: sellerId }, { ...outcome, at: new Date() }, { upsert: true });
  const open = await db.collection('cases').find({ seller_id: sellerId, status: { $in: ['open', 'in_progress'] } }).toArray();
  for (const c of open) {
    if (outcome.acted && (c.cause === 'inventory' || (c.cause === 'cancellations' && outcome.after.cancel_rate < outcome.before.cancel_rate))) {
      await touchCase(db, sellerId, c.cause, 'improving', `Simulated +7 days: ${outcome.restocked.length} items restocked, about Rs ${outcome.recovered_value} recovered (estimate). Not closed until confirmed on a call.`);
    } else {
      await touchCase(db, sellerId, c.cause, 'escalated', 'Simulated +7 days: no progress. Needs a human account manager.');
    }
  }
  return { status: 200, outcome };
}

export async function resetDemo(db) {
  for (const s of SELLERS) await db.collection('sellers').replaceOne({ _id: s._id }, s, { upsert: true });
  await Promise.all([db.collection('cases').deleteMany({}), db.collection('outcomes').deleteMany({})]);
}
