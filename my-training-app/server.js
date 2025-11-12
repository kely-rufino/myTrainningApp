import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Counter state (in production this would be in a database)
let counterState = {
  count: 0,
  lastUpdated: new Date().toISOString()
};

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the Counter API Server!',
    endpoints: {
      'GET /api/counter': 'Get current counter value',
      'POST /api/counter/increment': 'Increment counter by 1',
      'POST /api/counter/decrement': 'Decrement counter by 1',
      'POST /api/counter/reset': 'Reset counter to 0',
      'GET /api/health': 'Health check'
    },
    currentCount: counterState.count
  });
});

// Endpoint to get current counter
app.get('/api/counter', (req, res) => {
  console.log(`📊 Counter queried: ${counterState.count}`);
  
  res.json({
    success: true,
    message: 'Counter retrieved successfully',
    data: {
      count: counterState.count,
      lastUpdated: counterState.lastUpdated
    }
  });
});

// Endpoint to increment counter
app.post('/api/counter/increment', (req, res) => {
  counterState.count += 1;
  counterState.lastUpdated = new Date().toISOString();
  
  // Log as requested
  console.log('Plus 1');
  console.log(`📈 Counter incremented to: ${counterState.count}`);
  
  res.json({
    success: true,
    message: 'Counter incremented successfully',
    data: {
      count: counterState.count,
      lastUpdated: counterState.lastUpdated
    }
  });
});

// Endpoint to decrement counter
app.post('/api/counter/decrement', (req, res) => {
  counterState.count -= 1;
  counterState.lastUpdated = new Date().toISOString();
  
  console.log(`📉 Counter decremented to: ${counterState.count}`);
  
  res.json({
    success: true,
    message: 'Counter decremented successfully',
    data: {
      count: counterState.count,
      lastUpdated: counterState.lastUpdated
    }
  });
});

// Endpoint to reset counter
app.post('/api/counter/reset', (req, res) => {
  counterState.count = 0;
  counterState.lastUpdated = new Date().toISOString();
  
  console.log('🔄 Counter reset to: 0');
  
  res.json({
    success: true,
    message: 'Counter reset successfully',
    data: {
      count: counterState.count,
      lastUpdated: counterState.lastUpdated
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Initial counter state: ${counterState.count}`);
});