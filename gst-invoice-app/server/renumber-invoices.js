// One-time script: saare existing invoices ko 302 se renumber karta hai.
// Order: createdAt ke hisaab se (sabse purana = 302, phir 303, 304...)
//
// Pehle dry-run (kuch change nahi hoga, sirf preview):
//   node renumber-invoices.js
// Phir asli run:
//   node renumber-invoices.js --apply

require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const StockTransaction = require('./models/StockTransaction');

const START_NO = 302;
const PREFIX = 'INV-'; // controller ke INVOICE_PREFIX ke same rakho
const APPLY = process.argv.includes('--apply');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gst-invoice';

async function run() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Connected', APPLY ? '(APPLY MODE)' : '(DRY RUN)');

    const userIds = await Invoice.distinct('user');

    for (const userId of userIds) {
      const invoices = await Invoice.find({ user: userId })
        .sort({ createdAt: 1, _id: 1 })
        .select('_id invoiceNumber createdAt');

      console.log(`\nUser ${userId}: ${invoices.length} invoices`);

      const plan = invoices.map((inv, i) => ({
        id: inv._id,
        oldNo: inv.invoiceNumber,
        newNo: `${PREFIX}${START_NO + i}`,
      }));

      plan.slice(0, 5).forEach(p => console.log(`  ${p.oldNo} -> ${p.newNo}`));
      if (plan.length > 5) {
        const last = plan[plan.length - 1];
        console.log(`  ... ${last.oldNo} -> ${last.newNo}`);
      }

      if (!APPLY) continue;

      // Phase 1: temp numbers (unique index {user, invoiceNumber} mein collision na ho)
      for (const p of plan) {
        await Invoice.collection.updateOne(
          { _id: p.id },
          { $set: { invoiceNumber: `TMP-${p.id}` } }
        );
      }

      // Phase 2: final numbers + stock history note update
      for (const p of plan) {
        await Invoice.collection.updateOne(
          { _id: p.id },
          { $set: { invoiceNumber: p.newNo } }
        );
        await StockTransaction.updateMany(
          { invoiceId: p.id },
          { $set: { note: `POS Bill ${p.newNo}` } }
        );
      }

      console.log(`  ✓ Renumbered ${plan.length} invoices`);
    }

    if (!APPLY) console.log('\nDry run done. Sab theek lage toh: node renumber-invoices.js --apply');
    else console.log('\n✓ Done. Ab naya bill agla number lega.');
  } catch (err) {
    console.error('✗ Error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

run();