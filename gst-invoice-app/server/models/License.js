const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  shopName: { type: String, required: true },
  isActivated: { type: Boolean, default: false },
  deviceFingerprint: { type: String, default: null },
  activatedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null }, // null = lifetime
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('License', licenseSchema);
