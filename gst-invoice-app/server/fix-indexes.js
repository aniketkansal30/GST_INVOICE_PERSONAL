// One-time script: syncs the Product collection's indexes with the current
// Mongoose schema. This drops any stale/old indexes (e.g. a leftover plain
// `barcode` unique index from before the {user, barcode} partial index was
// introduced) and creates whatever indexes the schema currently defines.
//
// Run this ONCE after deploying the updated Product.js schema:
//   node fix-indexes.js
//
// Safe to run multiple times — it's idempotent.

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gst-invoice';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✓ Connected\n');

    console.log('Indexes BEFORE fix:');
    const before = await Product.collection.indexes();
    console.log(JSON.stringify(before, null, 2));

    console.log('\nSyncing indexes with current schema (dropping stale ones, creating correct ones)...');
    const result = await Product.syncIndexes();
    console.log('Sync result:', result);

    console.log('\nIndexes AFTER fix:');
    const after = await Product.collection.indexes();
    console.log(JSON.stringify(after, null, 2));

    console.log('\n✓ Done! Product barcode indexes are now correctly scoped per-user.');
  } catch (err) {
    console.error('✗ Error fixing indexes:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

run();