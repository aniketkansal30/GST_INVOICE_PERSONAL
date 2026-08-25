const app = express();

app.use(cors({ 
  origin: '*',
  credentials: true 
}));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gst-invoice';
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      bufferCommands: true,
    });
    isConnected = true;
    console.log('✓ MongoDB connected successfully');
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err.message);
    console.log('ℹ️ Running in memory / offline resilience mode until MongoDB URI is configured.');
  }
};

// Connection-check middleware — routes se PEHLE
app.use(async (req, res, next) => {
  if (!isConnected) await connectDB();
  next();
});

// Ab routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/products', productRoutes);

app.get('/api/health', (req, res) => res.json({ 
  status: 'ok', 
  mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  timestamp: new Date().toISOString() 
}));

// baaki static/SPA/error-handler code same rahega neeche

connectDB();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ GST POS Server running on port ${PORT}`);
});