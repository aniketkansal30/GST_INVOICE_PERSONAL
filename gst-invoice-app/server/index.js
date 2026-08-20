const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const invoiceRoutes = require('./routes/invoices');
const productRoutes = require('./routes/productRoutes');

const app = express();

app.use(cors({ 
  origin: '*',
  credentials: true 
}));
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/products', productRoutes);

app.get('/api/health', (req, res) => res.json({ 
  status: 'ok', 
  mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  timestamp: new Date().toISOString() 
}));

// Serve static React build files
const clientBuildPath = path.join(__dirname, '../client/build');
app.use(express.static(clientBuildPath));

// Handle React SPA client routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('<h1>GST Clothing POS System is building... Please refresh in a moment.</h1>');
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;

// Connect to MongoDB with graceful fallback
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gst-invoice';

mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 4000 })
  .then(() => {
    console.log('✓ MongoDB connected successfully');
  })
  .catch(err => {
    console.warn('⚠️ MongoDB connection warning:', err.message);
    console.log('ℹ️ Running in memory / offline resilience mode until MongoDB URI is configured.');
  });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ GST POS Server running on port ${PORT}`);
});
