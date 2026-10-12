// One-time script: purane invoices ke items mein brand bhar deta hai,
// Product collection se match karke.
// Match order: productId -> barcode -> name (sirf tab jab us naam ke saare products ka brand same ho)
//
// Pehle dry-run (kuch change nahi hoga, sirf preview):
//   node backfill-brand.js
// Phir asli run:
//   node backfill-brand.js --apply
//
// Jin items mein pehle se brand hai, unhe touch nahi karta.

require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const Product = require('./models/Product');

const APPLY = process.argv.includes('--apply');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gst-invoice';

const norm = (s) => String(s || '').trim().toLowerCase();

async function run() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Connected', APPLY ? '(APPLY MODE)' : '(DRY RUN)');

    const userIds = await Invoice.distinct('user');
    let totalItemsFilled = 0;
    let totalInvoicesTouched = 0;
    const unmatched = new Map(); // item name -> count

    for (const userId of userIds) {
      // Is user ke saare products ko maps mein load karo
      const products = await Product.find({ user: userId, brand: { $exists: true, $ne: '' } })
        .select('_id barcode name brand')
        .lean();

      const byId = new Map();
      const byBarcode = new Map();
      const nameBrands = new Map(); // name -> Set of brands

      products.forEach((p) => {
        const brand = String(p.brand || '').trim();
        if (!brand) return;
        byId.set(String(p._id), brand);
        if (p.barcode && p.barcode.trim()) byBarcode.set(p.barcode.trim(), brand);
        const nk = norm(p.name);
        if (!nameBrands.has(nk)) nameBrands.set(nk, new Set());
        nameBrands.get(nk).add(brand);
      });

      console.log(`\nUser ${userId}: ${products.length} products with brand`);

      const invoices = await Invoice.find({ user: userId }).select('_id invoiceNumber items').lean();

      for (const inv of invoices) {
        const setOps = {};
        let filledHere = 0;

        (inv.items || []).forEach((item, idx) => {
          if (item.brand && String(item.brand).trim()) return; // pehle se hai

          let brand = '';
          if (item.productId && byId.has(String(item.productId))) {
            brand = byId.get(String(item.productId));
          } else if (item.barcode && byBarcode.has(String(item.barcode).trim())) {
            brand = byBarcode.get(String(item.barcode).trim());
          } else {
            const set = nameBrands.get(norm(item.name));
            if (set && set.size === 1) brand = [...set][0];
          }

          if (brand) {
            setOps[`items.${idx}.brand`] = brand;
            filledHere += 1;
          } else {
            const k = item.name || '(no name)';
            unmatched.set(k, (unmatched.get(k) || 0) + 1);
          }
        });

        if (filledHere > 0) {
          totalItemsFilled += filledHere;
          totalInvoicesTouched += 1;
          if (totalInvoicesTouched <= 5) {
            console.log(`  ${inv.invoiceNumber}: ${filledHere} item(s) -> brand set`);
          }
          if (APPLY) {
            // raw collection update — updatedAt wagairah nahi badlega
            await Invoice.collection.updateOne({ _id: inv._id }, { $set: setOps });
          }
        }
      }
    }

    console.log(`\nInvoices updated: ${totalInvoicesTouched}`);
    console.log(`Items brand filled: ${totalItemsFilled}`);

    if (unmatched.size > 0) {
      console.log('\nBrand nahi mila (product delete hua / brand khaali / naam ke multiple brands):');
      [...unmatched.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .forEach(([name, count]) => console.log(`  ${name}: ${count} item(s)`));
    }

    if (!APPLY) console.log('\nDry run done. Sab theek lage toh: node backfill-brand.js --apply');
    else console.log('\n✓ Done. Report refresh karke dekho.');
  } catch (err) {
    console.error('✗ Error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

run();