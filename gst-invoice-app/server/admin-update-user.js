// Admin script - sirf local run karna, deploy mat karna
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

// ✏️ YAHAN APNI DETAILS BHARO
const USER_EMAIL = 'aniketkansal3007@gmail.com'; // jis user ko edit karna hai

const UPDATE_DATA = {
  name: 'Aniket Kansal',
  companyName: 'NEW TECH ENTERPRISES',
  gstNumber: '09HEVPS3324P1ZB',
  address: 'C-1, KRISHNA KUNJ-II, NEAR BABA FARM HOUSE, Nand Gram, Ghaziabad, 201003\nPAN: HEVPS3324P\nMSME: UDYAM-UP-29-0185368',
  state: 'Uttar Pradesh',
  contact: '+91 98765 43210',
};

async function updateUser() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');

    const user = await User.findOne({ email: USER_EMAIL });
    if (!user) {
      console.log('❌ User not found:', USER_EMAIL);
      process.exit(1);
    }

    console.log('👤 User found:', user.name, '|', user.email);
    console.log('📝 Updating...');

    Object.assign(user, UPDATE_DATA);
    await user.save();

    console.log('✅ User updated successfully!');
    console.log('Updated data:', UPDATE_DATA);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

updateUser();