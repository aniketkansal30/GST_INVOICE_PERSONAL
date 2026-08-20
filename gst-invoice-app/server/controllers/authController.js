const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (userId) => jwt.sign(
  { userId },
  process.env.JWT_SECRET || 'dev-secret',
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

exports.signup = async (req, res) => {
  try {
    const { name, email, password, companyName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password, companyName });
    const token = signToken(user._id);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProfile = async (req, res) => {
  res.json({ user: req.user });
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, companyName, gstNumber, panNumber, address, state, contact, theme } = req.body;

    // 🔒 Sirf admin hi store/profile details change kar sakta hai
    const isAdmin = req.user.role === 'admin';
    const restrictedFields = { name, email, companyName, gstNumber, panNumber, address, state, contact };
    const wantsRestrictedChange = Object.values(restrictedFields).some(v => v !== undefined);

    if (wantsRestrictedChange && !isAdmin) {
      return res.status(403).json({ message: 'Only admin can update store/profile details' });
    }

    const allowedFields = isAdmin
      ? { name, email, companyName, gstNumber, panNumber, address, state, contact, theme }
      : { theme }; // non-admin sirf theme change kar sakta hai

    Object.keys(allowedFields).forEach(k => allowedFields[k] === undefined && delete allowedFields[k]);

    if (allowedFields.email) {
      const existing = await User.findOne({ email: allowedFields.email });
      if (existing && String(existing._id) !== String(req.user._id)) {
        return res.status(400).json({ message: 'Email already in use by another account' });
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, allowedFields, { new: true, runValidators: true });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};