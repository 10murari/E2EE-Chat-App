/**
 * ============================================================================
 * E2EE Chat Server — Main Entry Point
 * ============================================================================
 * 
 * SECURITY ARCHITECTURE OVERVIEW:
 * 
 * This server is designed to be a "zero-knowledge" relay. It handles:
 *   1. User authentication (bcrypt + JWT)
 *   2. Public key storage and retrieval (for ECDH key exchange)
 *   3. Encrypted message relay and storage
 * 
 * The server NEVER has access to:
 *   - Users' private keys (generated and stored client-side only)
 *   - Plaintext messages (encrypted with AES-256-GCM before leaving the client)
 *   - Shared secrets (derived via ECDH entirely on the client)
 * 
 * TRANSPORT SECURITY:
 * - In production, this should be deployed behind an HTTPS/WSS reverse proxy
 *   (e.g., Nginx with TLS certificates) to prevent MITM attacks.
 * - CORS is restricted to the frontend origin.
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

// Route handlers
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');

// Socket.io handlers
const { initializeSocketHandlers } = require('./socket/handler');
const { socketAuthMiddleware } = require('./middleware/auth');

// ---- Configuration ----
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/e2ee_chat';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// ---- Express App Setup ----
const app = express();
const server = http.createServer(app);

// Parse JSON request bodies with reasonable size limits
app.use(express.json({ limit: '1mb' })); // Limit to 1MB for messages and data

// CORS configuration — restrict to frontend origin
app.use(cors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: false
}));

// ---- API Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- Socket.io Setup ----
const io = new Server(server, {
    cors: {
        origin: CORS_ORIGIN,
        methods: ['GET', 'POST'],
    },
});

// Authenticate WebSocket connections with JWT
io.use(socketAuthMiddleware);

// Initialize real-time message handlers
initializeSocketHandlers(io);

// ---- MongoDB Connection & Server Start ----
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        server.listen(PORT, () => {
            console.log(`🚀 E2EE Chat Server running on port ${PORT}`);
            console.log(`🔒 CORS origin: ${CORS_ORIGIN}`);
            console.log('');
            console.log('=== SECURITY REMINDER ===');
            console.log('This server is a zero-knowledge relay.');
            console.log('It stores ONLY public keys and encrypted ciphertext.');
            console.log('Private keys and plaintext NEVER touch this server.');
            console.log('=========================');
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });
