const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const supabase = require('./config/database');
const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const whatsappRoutes = require('./routes/whatsapp');
const app = require('./app');

dotenv.config();

const PORT = process.env.PORT || 3000;

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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
