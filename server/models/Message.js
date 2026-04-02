/**
 * ============================================================================
 * Message Model — E2EE Chat
 * ============================================================================
 * 
 * SECURITY NOTES:
 * - The `ciphertext` field stores AES-256-GCM encrypted message data as
 *   a Base64-encoded string. The server CANNOT decrypt this because it 
 *   never possesses the shared secret (derived via ECDH on the clients).
 * - The `iv` (Initialization Vector) is a random 12-byte value generated
 *   per message. It is required for AES-GCM decryption and is safe to 
 *   store alongside the ciphertext (it does not compromise confidentiality).
 * - GCM mode provides built-in authentication (AEAD), so a separate HMAC
 *   is not needed — tampered ciphertext will fail decryption automatically.
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    // Reference to the sending user
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // Reference to the receiving user
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // AES-256-GCM encrypted message content (Base64-encoded)
    // The server stores this opaque blob — it CANNOT read the plaintext.
    ciphertext: {
        type: String,
        required: true,
    },

    // Initialization Vector for AES-GCM (Base64-encoded, 12 bytes)
    // Must be unique per message to prevent nonce reuse attacks.
    iv: {
        type: String,
        required: true,
    },

    // Message timestamp — used for ordering in the UI
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

// Index for efficient retrieval of conversation history
messageSchema.index({ sender: 1, receiver: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);
