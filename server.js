// Import packages
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

// Initialize the express app and create a server from the express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Security enhancements
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Session management
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' },  // set based on your HTTPS configuration
}));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.log('MongoDB Connection Error:', err));

// WebSocket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.query.token;
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = decoded;
      next();
    });
  } else {
    next(new Error('Authentication error'));
  }
});

// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log('A user connected:', socket.user.id);

  // Handle chat messages
  socket.on('chat message', (msg) => {
    io.emit('chat message', {
      user: socket.user.id,
      message: msg,
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.get('/', (req, res) => {
  res.send('Secure Messaging App Backend Running');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {  // Make sure to use 'server.listen' not 'app.listen'
  console.log(`Server running on port ${PORT}`);
});
