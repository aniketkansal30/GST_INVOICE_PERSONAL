const License = require('../models/License');

// ── Verify License ────────────────────────────────────────────────────────────
exports.verify = async (req, res) => {
  try {
    const { key, deviceFingerprint } = req.body;

    if (!key || !deviceFingerprint)
      return res.status(400).json({ message: 'Key aur device info chahiye' });

    const license = await License.findOne({ key: key.toUpperCase() });
    if (!license)
      return res.status(404).json({ message: '❌ Invalid License Key!' });

    // Expire check
    if (license.expiresAt && new Date() > license.expiresAt)
      return res.status(403).json({ message: '❌ License expire ho gayi! Admin se contact karo.' });

    // Case 1: Device pre-bound hai, abhi activate nahi hua
    if (license.deviceFingerprint && !license.isActivated) {
      if (license.deviceFingerprint !== deviceFingerprint)
        return res.status(403).json({ message: '❌ Yeh license is device ke liye nahi hai!' });

      license.isActivated = true;
      license.activatedAt = new Date();
      await license.save();
      return res.json({ success: true, shopName: license.shopName, message: '✅ License Activated!' });
    }

    // Case 2: Already activated
    if (license.isActivated) {
      if (license.deviceFingerprint !== deviceFingerprint)
        return res.status(403).json({ message: '❌ Yeh license doosre device pe activate hai!' });
      return res.json({ success: true, shopName: license.shopName, message: '✅ License Valid!' });
    }

    // Case 3: No device bound yet - block karo
    return res.status(403).json({
      message: '❌ License activate nahi hui. Pehle Admin ko apna Device ID bhejo.',
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Create License (Admin only) ───────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { adminSecret, shopName, deviceFingerprint, daysValid } = req.body;

    if (adminSecret !== process.env.ADMIN_SECRET)
      return res.status(403).json({ message: 'Not authorized' });

    const key =
      'GST-' +
      Math.random().toString(36).substr(2, 4).toUpperCase() +
      '-' +
      Math.random().toString(36).substr(2, 4).toUpperCase() +
      '-' +
      Math.random().toString(36).substr(2, 4).toUpperCase();

    const expiresAt = daysValid
      ? new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000)
      : null;

    const license = new License({ key, shopName, deviceFingerprint: deviceFingerprint || null, expiresAt });
    await license.save();

    res.json({ success: true, key, shopName, deviceFingerprint, expiresAt });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Bind Device (Admin only) ──────────────────────────────────────────────────
exports.bind = async (req, res) => {
  try {
    const { adminSecret, key, deviceFingerprint } = req.body;

    if (adminSecret !== process.env.ADMIN_SECRET)
      return res.status(403).json({ message: 'Not authorized' });

    const license = await License.findOne({ key: key.toUpperCase() });
    if (!license) return res.status(404).json({ message: 'License nahi mili' });
    if (license.isActivated) return res.status(400).json({ message: 'Already activated hai. Reset karo pehle.' });

    license.deviceFingerprint = deviceFingerprint;
    await license.save();

    res.json({ success: true, message: '✅ Device bind ho gaya!', key, deviceFingerprint });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Reset License (Admin only) ────────────────────────────────────────────────
exports.reset = async (req, res) => {
  try {
    const { adminSecret, key } = req.body;

    if (adminSecret !== process.env.ADMIN_SECRET)
      return res.status(403).json({ message: 'Not authorized' });

    const license = await License.findOne({ key: key.toUpperCase() });
    if (!license) return res.status(404).json({ message: 'License nahi mili' });

    license.isActivated = false;
    license.deviceFingerprint = null;
    license.activatedAt = null;
    await license.save();

    res.json({ success: true, message: '✅ License reset ho gayi!' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── List All (Admin only) ─────────────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { adminSecret } = req.body;

    if (adminSecret !== process.env.ADMIN_SECRET)
      return res.status(403).json({ message: 'Not authorized' });

    const licenses = await License.find().sort({ createdAt: -1 });
    res.json({ success: true, licenses });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
