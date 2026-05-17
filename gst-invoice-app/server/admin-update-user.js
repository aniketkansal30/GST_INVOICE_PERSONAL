// Admin script - sirf local run karna, deploy mat karna
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

// ✏️ YAHAN APNI DETAILS BHARO
const USER_EMAIL = 'aniketkansal3007@gmail.com'; // jis user ko edit karna hai

const UPDATE_DATA = {
  name: 'Aniket Kansal',
  companyName: 'Abhiyant Sales Corporation',
  gstNumber: '09CMJPS0294K2ZD',
  address: '52/2, Uday Park, Pallavpuram Phase-2, Modipuram, Meerut-250110',
  state: 'Uttar Pradesh',
  contact: '+91 9536535900,+91 9258385619',
  email: 'abhiyantsalescorporation@gmail.com'
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