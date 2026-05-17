const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const EMAIL = 'aniketkansal3007@gmail.com';
const NEW_PASSWORD = 'abhiyantsalescorporation';

const MONGO_URI = 'mongodb+srv://aniketkansal3007:aniketkansal3007@cluster0.ftqtfuq.mongodb.net/gstDB';

async function resetPassword() {
  try {
    await mongoose.connect(MONGO_URI);
    const hash = await bcrypt.hash(NEW_PASSWORD, 12);
    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: EMAIL },
      { $set: { password: hash } }
    );
    if (result.matchedCount === 0) {
      console.log('Email nahi mila:', EMAIL);
    } else {
      console.log('Password reset ho gaya! Email:', EMAIL, '| Password:', NEW_PASSWORD);
    }
    process.exit();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
resetPassword();
