/**
 * ============================================================================
 * JWT Authentication Middleware — E2EE Chat
 * ============================================================================
 * 
 * SECURITY NOTES:
 * - Every protected route and WebSocket connection must pass through this
 *   middleware to verify the user's JSON Web Token (JWT).
 * - The JWT is signed with a server-side secret (HS256). Tampering with the 
 *   token payload will cause verification to fail.
 * - Tokens are expected in the Authorization header as: "Bearer <token>"
 * - This middleware adds `req.user` with the decoded payload (userId, username)
 *   so downstream handlers know who the authenticated user is.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_change_me_in_production_' + Date.now();

/**
 * Express middleware: verify JWT from the Authorization header.
 * Rejects requests that lack a valid token with 401 Unauthorized.
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify the token's signature and decode its payload
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { userId, username }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

/**
 * Socket.io middleware: verify JWT from the handshake auth object.
 * This secures WebSocket connections — only authenticated users can connect.
 */
function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Authentication error: No token provided.'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded; // Attach user info to the socket instance
        next();
    } catch (err) {
        return next(new Error('Authentication error: Invalid token.'));
    }
}

module.exports = { authMiddleware, socketAuthMiddleware };
