/**
 * ============================================================================
 * Socket.io Handler — E2EE Chat
 * ============================================================================
 * 
 * SECURITY NOTES:
 * - The server acts as a DUMB RELAY for encrypted messages. It receives
 *   ciphertext from the sender, stores it in MongoDB, and forwards it
 *   to the recipient's socket. It NEVER decrypts or inspects the content.
 * - All socket connections are authenticated via JWT (socketAuthMiddleware).
 * - An in-memory map tracks which users are online and their socket IDs
 *   for real-time message delivery.
 * - If the recipient is offline, the message is still saved to MongoDB
 *   and will be retrieved when they log in (via the REST API).
 */

const Message = require('../models/Message');

// Map userId → socketId for tracking online users
const onlineUsers = new Map();

/**
 * Initialize Socket.io event handlers.
 * 
 * @param {import('socket.io').Server} io - The Socket.io server instance
 */
function initializeSocketHandlers(io) {
    io.on('connection', (socket) => {
        const { userId, username } = socket.user;

        console.log(`🟢 User connected: ${username} (${userId})`);

        // Track this user as online
        onlineUsers.set(userId, socket.id);

        // Broadcast updated online users list to all clients
        io.emit('online_users', Array.from(onlineUsers.keys()));

        // ---- EVENT: send_message ----
        // Receives encrypted message data and relays it to the recipient.
        socket.on('send_message', async (data) => {
            try {
                const { receiverId, ciphertext, iv } = data;

                if (!receiverId || !ciphertext || !iv) {
                    return socket.emit('error_message', { error: 'Missing message data.' });
                }
                
                // Validate receiverId is a valid ObjectId
                const mongoose = require('mongoose');
                if (!mongoose.Types.ObjectId.isValid(receiverId)) {
                    return socket.emit('error_message', { error: 'Invalid receiver ID.' });
                }
                
                // Validate ciphertext and IV size
                if (typeof ciphertext !== 'string' || ciphertext.length > 50000) {
                    return socket.emit('error_message', { error: 'Invalid ciphertext size.' });
                }
                if (typeof iv !== 'string' || iv.length > 100) {
                    return socket.emit('error_message', { error: 'Invalid IV.' });
                }

                // Save the encrypted message to MongoDB
                // NOTE: The server stores ciphertext — it cannot read the message.
                const message = new Message({
                    sender: userId,
                    receiver: receiverId,
                    ciphertext,  // AES-256-GCM encrypted (Base64)
                    iv,          // Initialization Vector (Base64)
                });

                await message.save();

                const messageData = {
                    _id: message._id,
                    sender: userId,
                    receiver: receiverId,
                    ciphertext,
                    iv,
                    timestamp: message.timestamp,
                };

                // If recipient is online, forward the ciphertext in real-time
                const recipientSocketId = onlineUsers.get(receiverId);
                if (recipientSocketId) {
                    io.to(recipientSocketId).emit('receive_message', messageData);
                }

                // Confirm delivery back to the sender
                socket.emit('message_sent', messageData);

            } catch (err) {
                console.error('Message send error:', err);
                socket.emit('error_message', { error: 'Failed to send message.' });
            }
        });

        // ---- EVENT: typing ----
        // Notify the recipient that this user is typing
        socket.on('typing', ({ receiverId }) => {
            const recipientSocketId = onlineUsers.get(receiverId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('user_typing', { userId, username });
            }
        });

        // ---- EVENT: stop_typing ----
        socket.on('stop_typing', ({ receiverId }) => {
            const recipientSocketId = onlineUsers.get(receiverId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('user_stop_typing', { userId });
            }
        });

        // ---- EVENT: disconnect ----
        socket.on('disconnect', () => {
            console.log(`🔴 User disconnected: ${username} (${userId})`);
            onlineUsers.delete(userId);
            io.emit('online_users', Array.from(onlineUsers.keys()));
        });
    });
}

module.exports = { initializeSocketHandlers };
