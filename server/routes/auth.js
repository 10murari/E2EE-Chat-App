/**
 * ============================================================================
 * Authentication Routes — E2EE Chat
 * ============================================================================
 * 
 * SECURITY NOTES:
 * - Registration: The client sends the plaintext password AND the user's 
 *   ECDH public key (in JWK format). The password is hashed with bcrypt
 *   (12 rounds) in the User model's pre-save hook before being stored.
 * - Login: The server verifies the password hash with bcrypt and returns
 *   a signed JWT (HS256) valid for 24 hours. The JWT contains only the
 *   userId and username — no sensitive data.
 * - The public key sent during registration is the ONLY crypto material
 *   the server stores. Private keys never leave the client.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

/**
 * POST /api/auth/register
 * 
 * Registers a new user. Expects:
 *   { username, password, publicKey }
 * 
 * The publicKey is the client's ECDH public key in JWK JSON string format.
 * The server stores it so other clients can fetch it for key agreement.
 */
router.post('/register', async (req, res) => {
    try {
        const { username, password, publicKey } = req.body;

        // Validate required fields
        if (!username || !password || !publicKey) {
            return res.status(400).json({ error: 'Username, password, and public key are required.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        // Check if username already exists
        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ error: 'Username already taken.' });
        }

        // Create user — password hashing happens automatically in the pre-save hook
        const user = new User({
            username: username.toLowerCase(),
            passwordHash: password,  // Will be bcrypt-hashed by the pre-save hook
            publicKey,               // Client's ECDH public key (JWK)
        });

        await user.save();

        // Generate JWT for immediate login after registration
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Registration successful.',
            token,
            user: { id: user._id, username: user.username },
        });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

/**
 * POST /api/auth/login
 * 
 * Authenticates a user. Expects:
 *   { username, password }
 * 
 * Returns a signed JWT on success.
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        // Find the user by username
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            // Vague error message to prevent username enumeration attacks
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Verify password using bcrypt comparison
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful.',
            token,
            user: { id: user._id, username: user.username },
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

/**
 * POST /api/auth/update-key
 * 
 * Updates the user's public key on the server. Used when logging in
 * on a new device where no local keys exist — fresh keys are generated
 * and the public key is updated here.
 */
router.post('/update-key', authMiddleware, async (req, res) => {
    try {
        const { publicKey } = req.body;
        if (!publicKey) {
            return res.status(400).json({ error: 'Public key is required.' });
        }

        await User.findByIdAndUpdate(req.user.userId, { publicKey });
        res.json({ message: 'Public key updated.' });
    } catch (err) {
        console.error('Key update error:', err);
        res.status(500).json({ error: 'Server error updating key.' });
    }
});

module.exports = router;
