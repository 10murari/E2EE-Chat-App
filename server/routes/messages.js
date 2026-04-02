/**
 * ============================================================================
 * Message Routes — E2EE Chat
 * ============================================================================
 * 
 * SECURITY NOTES:
 * - Messages stored in MongoDB are ENCRYPTED (AES-256-GCM ciphertext).
 *   The server returns them as-is — it cannot read, modify, or filter
 *   message content because it doesn't possess the decryption key.
 * - The client decrypts messages locally after fetching them.
 * - Message history is returned sorted by timestamp for correct ordering.
 */

const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All message routes require authentication
router.use(authMiddleware);

/**
 * GET /api/messages/conversations/list
 * 
 * IMPORTANT: This route must be defined BEFORE /:contactId
 * to prevent Express from matching "conversations" as a contactId.
 * 
 * Returns a list of all users the current user has conversed with,
 * along with their usernames, public keys, and last message timestamps.
 */
router.get('/conversations/list', async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.userId);

        // Aggregate to find all unique conversation partners
        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: userId },
                        { receiver: userId },
                    ],
                },
            },
            {
                // Determine the "other" user in each message
                $addFields: {
                    contactId: {
                        $cond: {
                            if: { $eq: ['$sender', userId] },
                            then: '$receiver',
                            else: '$sender',
                        },
                    },
                },
            },
            {
                // Group by contact and get the latest message timestamp
                $group: {
                    _id: '$contactId',
                    lastMessageAt: { $max: '$timestamp' },
                },
            },
            { $sort: { lastMessageAt: -1 } },
            {
                // Join the User collection to get username and publicKey
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo',
                },
            },
            { $unwind: '$userInfo' },
            {
                $project: {
                    _id: 1,
                    lastMessageAt: 1,
                    username: '$userInfo.username',
                    publicKey: '$userInfo.publicKey',
                },
            },
        ]);

        res.json({ conversations });

    } catch (err) {
        console.error('Conversations list error:', err);
        res.status(500).json({ error: 'Server error fetching conversations.' });
    }
});

/**
 * GET /api/messages/:contactId
 * 
 * Fetch encrypted message history between the current user and a contact.
 * Returns ciphertext + IV pairs — decryption happens on the client.
 */
router.get('/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit) || 50;
        const before = req.query.before ? new Date(req.query.before) : new Date();

        // Fetch messages where either user is sender or receiver
        const messages = await Message.find({
            $or: [
                { sender: userId, receiver: contactId },
                { sender: contactId, receiver: userId },
            ],
            timestamp: { $lt: before },
        })
            .sort({ timestamp: -1 }) // Newest first for pagination
            .limit(limit)
            .lean();

        // Reverse to chronological order for the client
        messages.reverse();

        res.json({ messages });

    } catch (err) {
        console.error('Message fetch error:', err);
        res.status(500).json({ error: 'Server error fetching messages.' });
    }
});

module.exports = router;
