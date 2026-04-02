/**
 * ============================================================================
 * User Model — E2EE Chat
 * ============================================================================
 * 
 * SECURITY NOTES:
 * - Passwords are NEVER stored in plaintext. They are hashed with bcrypt 
 *   (12 salt rounds) before being saved to the database.
 * - The server stores ONLY the user's PUBLIC key (as a JWK JSON string).
 *   Private keys never leave the client — this is the cornerstone of E2EE.
 * - The publicKey field allows other clients to perform ECDH key agreement
 *   and derive a shared secret for AES-256-GCM message encryption.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Number of salt rounds for bcrypt hashing — 12 is a strong default
const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema({
  // Unique username for authentication and user discovery
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username must be at most 30 characters'],
  },

  // bcrypt-hashed password — raw password is NEVER stored
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
  },

  // User's ECDH public key in JWK (JSON Web Key) format
  // This is the ONLY cryptographic material the server holds.
  // It enables other clients to derive shared secrets via ECDH.
  publicKey: {
    type: String,  // Stored as a JSON string of the JWK object
    required: [true, 'Public key is required for E2EE'],
  },

  // Account creation timestamp
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Pre-save hook: hash the password before persisting.
 * This ensures the plaintext password is never written to MongoDB.
 */
userSchema.pre('save', async function (next) {
  // Only hash if the password field was modified (avoids re-hashing on profile updates)
  if (!this.isModified('passwordHash')) return next();
  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Instance method: compare a candidate password against the stored hash.
 * Used during login to verify the user's identity.
 * 
 * @param {string} candidatePassword - The plaintext password to verify
 * @returns {Promise<boolean>} - True if the password matches
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Prevent the password hash from leaking in JSON responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
