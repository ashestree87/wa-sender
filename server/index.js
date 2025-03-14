const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const supabase = require('./config/database');
const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const whatsappRoutes = require('./routes/whatsapp');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['https://wa.livefreshr.com', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Log assigned port
console.log(`Starting server on port: ${PORT}`);

// Test database connection
(async () => {
  try {
    const { data, error } = await supabase.from('users').select('count');
    if (error) throw error;
    console.log('✅ Connected to Supabase');
  } catch (err) {
    console.error('❌ Error connecting to Supabase:', err);
  }
})();

// Default route to prevent "Cannot GET /"
app.get('/', (req, res) => {
  res.json({ message: '✅ Server is running!' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
