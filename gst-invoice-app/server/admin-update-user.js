// Admin script - sirf local run karna, deploy mat karna
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

// ✏️ YAHAN APNI DETAILS BHARO
const USER_EMAIL = 'manishkumarimage@gmail.com'; // jis user ko edit karna hai

const UPDATE_DATA = {
  name: 'Manish Enterprises',
  companyName: 'Manish Enterprises',
  gstNumber: '09AJTPK3679H1ZG',
  panNumber: 'AADFI0426M',
  address: 'Shop No 188 T, Abulane, Near Nishant Cinema, Meerut Cantt, Uttar Pradesh',
  state: 'Uttar Pradesh',
  contact: '9719201802',
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