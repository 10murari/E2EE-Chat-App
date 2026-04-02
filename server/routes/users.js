/**
 * ============================================================================
 * User Routes — E2EE Chat
 * ============================================================================
 * 
 * SECURITY NOTES:
 * - All routes are protected by JWT middleware — only authenticated users
 *   can search for others or fetch public keys.
 * - The /search endpoint returns usernames and public keys. Public keys are
 *   inherently public information (that's the whole point of asymmetric crypto).
 * - The /:id/publickey endpoint is critical for the E2EE flow: before 
 *   encrypting a message, the sender's client fetches the receiver's public
 *   key to perform ECDH key agreement and derive a shared AES-256 key.
 */

const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All user routes require authentication
router.use(authMiddleware);

/**
 * GET /api/users/search?q=<query>
 * 
 * Search for users by username (partial match, case-insensitive).
 * The current user is excluded from results.
 */
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.json({ users: [] });
        }

        // Case-insensitive regex search for partial username matches
        const users = await User.find({
            username: { $regex: q.trim(), $options: 'i' },
            _id: { $ne: req.user.userId }, // Exclude the current user
        })
            .select('username publicKey createdAt')
            .limit(20);

        res.json({ users });

    } catch (err) {
        console.error('User search error:', err);
        res.status(500).json({ error: 'Server error during user search.' });
    }
});

/**
 * GET /api/users/:id/publickey
 * 
 * Fetch a specific user's ECDH public key (JWK format).
 * This is the critical endpoint for E2EE key exchange:
 *   1. Sender requests receiver's public key
 *   2. Sender performs ECDH: deriveBits(senderPrivateKey, receiverPublicKey)
 *   3. Both sides derive the same shared secret → AES-256-GCM key
 */
router.get('/:id/publickey', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('username publicKey');

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({
            userId: user._id,
            username: user.username,
            publicKey: user.publicKey,
        });

    } catch (err) {
        console.error('Public key fetch error:', err);
        res.status(500).json({ error: 'Server error fetching public key.' });
    }
});

/**
 * GET /api/users/me
 * 
 * Get the current authenticated user's profile info.
 */
router.get('/me', async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('username publicKey createdAt');
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ user });
    } catch (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
