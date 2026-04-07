/**
 * ============================================================================
 * Cryptographic Key Manager — E2EE Chat (Web Crypto API)
 * ============================================================================
 * 
 * This module is the HEART of the E2EE implementation. It handles:
 * 
 * 1. ECDH Key Pair Generation (P-256 curve)
 *    - Private key stays on the client FOREVER
 *    - Public key is sent to the server for key exchange
 * 
 * 2. Shared Secret Derivation (ECDH + HKDF)
 *    - Both parties independently compute the same shared secret
 *    - deriveBits(myPrivateKey, theirPublicKey) → same result on both sides
 *    - HKDF stretches the ECDH output into a proper AES-256 key
 * 
 * 3. Message Encryption/Decryption (AES-256-GCM)
 *    - Each message gets a unique random 12-byte IV (nonce)
 *    - GCM provides authenticated encryption (integrity + confidentiality)
 *    - Tampered ciphertext will fail decryption automatically
 * 
 * 4. Private Key Protection
 *    - Private key is encrypted at rest using a passphrase
 *    - PBKDF2 derives an AES key from the passphrase (100,000 iterations)
 *    - Even if localStorage is compromised, the key is still protected
 * 
 * 5. Key Fingerprinting
 *    - SHA-256 hash of the public key for visual verification
 *    - Allows users to confirm they're talking to the right person
 *    - Prevents Man-in-the-Middle attacks on the key exchange
 * 
 * SECURITY NOTE: All cryptographic operations use the browser's native
 * Web Crypto API (window.crypto.subtle). This is a hardware-backed,
 * audited implementation — much safer than third-party JavaScript libraries.
 * 
 * ERROR HANDLING: All crypto operations throw descriptive errors if they fail.
 */

// Check if Web Crypto API is available
if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API is not available. This application requires HTTPS to function properly.');
}

// ---- Helper: Convert between ArrayBuffer and Base64 ----

/**
 * Convert an ArrayBuffer to a Base64 string.
 * Used for serializing ciphertext, IVs, and keys for storage/transmission.
 */
export function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return window.btoa(binary);
}

/**
 * Convert a Base64 string back to an ArrayBuffer.
 * Used for deserializing ciphertext, IVs, and keys.
 */
export function base64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// ============================================================================
// 1. KEY PAIR GENERATION (ECDH P-256)
// ============================================================================

/**
 * Generate a new ECDH key pair using the P-256 (secp256r1) elliptic curve.
 * 
 * SECURITY: P-256 provides ~128-bit security level, recommended by NIST.
 * The private key is marked as non-extractable for deriveBits but we need
 * it extractable for export/storage — we encrypt it before storing.
 * 
 * @returns {Promise<CryptoKeyPair>} The generated { publicKey, privateKey }
 */
export async function generateKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: 'ECDH',          // Elliptic Curve Diffie-Hellman
            namedCurve: 'P-256',   // NIST P-256 curve (128-bit security)
        },
        true,    // extractable — needed to export/store keys
        ['deriveBits'] // Usage: derive shared secrets
    );
    return keyPair;
}

/**
 * Export a public key to JWK (JSON Web Key) format for server storage.
 * JWK is a standard JSON format that's easy to serialize and transmit.
 * 
 * @param {CryptoKey} publicKey - The ECDH public key to export
 * @returns {Promise<string>} JSON string of the JWK
 */
export async function exportPublicKey(publicKey) {
    const jwk = await window.crypto.subtle.exportKey('jwk', publicKey);
    return JSON.stringify(jwk);
}

/**
 * Import a public key from JWK format (retrieved from the server).
 * 
 * @param {string} jwkString - JSON string of the JWK public key
 * @returns {Promise<CryptoKey>} The imported CryptoKey object
 */
export async function importPublicKey(jwkString) {
    const jwk = JSON.parse(jwkString);
    return window.crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [] // Public keys don't need usage flags for ECDH
    );
}

/**
 * Export a private key to JWK format for encrypted local storage.
 * 
 * @param {CryptoKey} privateKey - The ECDH private key to export
 * @returns {Promise<string>} JSON string of the JWK
 */
export async function exportPrivateKey(privateKey) {
    const jwk = await window.crypto.subtle.exportKey('jwk', privateKey);
    return JSON.stringify(jwk);
}

/**
 * Import a private key from JWK format (loaded from local storage).
 * 
 * @param {string} jwkString - JSON string of the JWK private key
 * @returns {Promise<CryptoKey>} The imported CryptoKey object
 */
export async function importPrivateKey(jwkString) {
    const jwk = JSON.parse(jwkString);
    return window.crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );
}

// ============================================================================
// 2. SHARED SECRET DERIVATION (ECDH + HKDF → AES-256 Key)
// ============================================================================

/**
 * Derive a shared AES-256 key from ECDH key agreement.
 * 
 * THE MAGIC OF ECDH:
 *   deriveBits(A_private, B_public) === deriveBits(B_private, A_public)
 *   Both parties compute the SAME shared secret independently!
 *   The server NEVER sees the private keys, so it CANNOT compute this.
 * 
 * PROCESS:
 *   1. ECDH deriveBits → raw shared secret (256 bits)
 *   2. HKDF (SHA-256) → proper AES-256-GCM key
 *   HKDF adds key stretching and domain separation for defense-in-depth.
 * 
 * @param {CryptoKey} myPrivateKey - Our ECDH private key
 * @param {CryptoKey} theirPublicKey - The peer's ECDH public key
 * @returns {Promise<CryptoKey>} An AES-256-GCM key for encrypting messages
 */
export async function deriveSharedSecret(myPrivateKey, theirPublicKey) {
    // Step 1: ECDH key agreement → raw shared bits
    const sharedBits = await window.crypto.subtle.deriveBits(
        {
            name: 'ECDH',
            public: theirPublicKey,
        },
        myPrivateKey,
        256 // Derive 256 bits
    );

    // Step 2: Import the raw bits as HKDF key material
    const hkdfKey = await window.crypto.subtle.importKey(
        'raw',
        sharedBits,
        { name: 'HKDF' },
        false,
        ['deriveKey']
    );

    // Step 3: HKDF → AES-256-GCM key with proper domain separation
    const aesKey = await window.crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new TextEncoder().encode('e2ee-chat-v1'),     // Application-specific salt
            info: new TextEncoder().encode('message-encryption'), // Context info
        },
        hkdfKey,
        { name: 'AES-GCM', length: 256 },  // Output: AES-256-GCM key
        false,      // Non-extractable for security
        ['encrypt', 'decrypt']
    );

    return aesKey;
}

// ============================================================================
// 3. MESSAGE ENCRYPTION / DECRYPTION (AES-256-GCM)
// ============================================================================

/**
 * Encrypt a plaintext message with AES-256-GCM.
 * 
 * SECURITY:
 * - A fresh random 12-byte IV is generated for EVERY message.
 *   Reusing an IV with the same key would be CATASTROPHIC for GCM security.
 * - GCM provides authenticated encryption (AEAD):
 *   • Confidentiality: message content is hidden
 *   • Integrity: any tampering is detected on decryption
 *   This means we don't need a separate HMAC.
 * 
 * @param {string} plaintext - The message to encrypt
 * @param {CryptoKey} aesKey - The shared AES-256-GCM key
 * @returns {Promise<{ciphertext: string, iv: string}>} Base64-encoded ciphertext and IV
 */
export async function encryptMessage(plaintext, aesKey) {
    // Generate a random 12-byte IV (nonce) — MUST be unique per message
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encode the plaintext as UTF-8 bytes
    const encodedMessage = new TextEncoder().encode(plaintext);

    // Encrypt with AES-256-GCM
    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv,
            // GCM appends a 128-bit authentication tag automatically
        },
        aesKey,
        encodedMessage
    );

    return {
        ciphertext: arrayBufferToBase64(ciphertext), // Base64 for JSON transmission
        iv: arrayBufferToBase64(iv),                  // IV needed for decryption
    };
}

/**
 * Decrypt a ciphertext message with AES-256-GCM.
 * 
 * If the ciphertext or IV has been tampered with, this will throw an error
 * (GCM's authentication tag verification will fail). This is BY DESIGN —
 * it prevents attackers from modifying messages in transit.
 * 
 * @param {string} ciphertextB64 - Base64-encoded ciphertext
 * @param {string} ivB64 - Base64-encoded IV
 * @param {CryptoKey} aesKey - The shared AES-256-GCM key
 * @returns {Promise<string>} The decrypted plaintext message
 */
export async function decryptMessage(ciphertextB64, ivB64, aesKey) {
    const ciphertext = base64ToArrayBuffer(ciphertextB64);
    const iv = base64ToArrayBuffer(ivB64);

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv,
        },
        aesKey,
        ciphertext
    );

    return new TextDecoder().decode(decrypted);
}

// ============================================================================
// 4. PRIVATE KEY PROTECTION (PBKDF2 + AES-GCM)
// ============================================================================

/**
 * Encrypt the private key with a passphrase for secure local storage.
 * 
 * PROCESS:
 *   1. PBKDF2 (100,000 iterations, SHA-256) derives an AES key from the passphrase
 *   2. AES-256-GCM encrypts the exported private key JWK
 * 
 * This means even if an attacker accesses localStorage, they still need
 * the passphrase to use the private key.
 * 
 * @param {CryptoKey} privateKey - The ECDH private key to protect
 * @param {string} passphrase - User's passphrase for encryption
 * @returns {Promise<string>} JSON string with encrypted key data
 */
export async function encryptPrivateKeyWithPassphrase(privateKey, passphrase) {
    const privateKeyJwk = await exportPrivateKey(privateKey);
    const encoder = new TextEncoder();

    // Generate a random salt for PBKDF2
    const salt = window.crypto.getRandomValues(new Uint8Array(16));

    // Derive an AES key from the passphrase using PBKDF2
    const passphraseKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    const wrappingKey = await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,  // High iteration count for brute-force resistance
            hash: 'SHA-256',
        },
        passphraseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    // Encrypt the private key JWK with AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedKey = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        wrappingKey,
        encoder.encode(privateKeyJwk)
    );

    // Return all components needed for decryption
    return JSON.stringify({
        encryptedKey: arrayBufferToBase64(encryptedKey),
        iv: arrayBufferToBase64(iv),
        salt: arrayBufferToBase64(salt),
    });
}

/**
 * Decrypt a passphrase-protected private key from local storage.
 * 
 * @param {string} encryptedData - JSON string from encryptPrivateKeyWithPassphrase
 * @param {string} passphrase - User's passphrase
 * @returns {Promise<CryptoKey>} The decrypted ECDH private key
 */
export async function decryptPrivateKeyWithPassphrase(encryptedData, passphrase) {
    const { encryptedKey, iv, salt } = JSON.parse(encryptedData);
    const encoder = new TextEncoder();

    // Re-derive the same AES key from the passphrase
    const passphraseKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    const wrappingKey = await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: base64ToArrayBuffer(salt),
            iterations: 100000,
            hash: 'SHA-256',
        },
        passphraseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    // Decrypt the private key JWK
    const decryptedKeyData = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToArrayBuffer(iv) },
        wrappingKey,
        base64ToArrayBuffer(encryptedKey)
    );

    const privateKeyJwk = new TextDecoder().decode(decryptedKeyData);
    return importPrivateKey(privateKeyJwk);
}

// ============================================================================
// 5. KEY FINGERPRINTING (SHA-256)
// ============================================================================

/**
 * Generate a human-readable fingerprint of a public key.
 * 
 * This allows users to verify each other's identity out-of-band
 * (e.g., in person or over a trusted call) to detect MITM attacks.
 * 
 * Format: "A1B2:C3D4:E5F6:..." (SHA-256 hash split into pairs)
 * 
 * @param {string} publicKeyJwk - The public key in JWK JSON string format
 * @returns {Promise<string>} Formatted fingerprint string
 */
export async function getFingerprint(publicKeyJwk) {
    const encoder = new TextEncoder();
    const data = encoder.encode(publicKeyJwk);

    // SHA-256 hash of the public key
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);

    // Format as colon-separated hex pairs (first 16 bytes = 32 hex chars)
    const fingerprint = Array.from(hashArray.slice(0, 16))
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(':');

    return fingerprint;
}

// ============================================================================
// 6. LOCAL STORAGE HELPERS
// ============================================================================

const STORAGE_KEYS = {
    AUTH_TOKEN: 'e2ee_auth_token',
    USER_INFO: 'e2ee_user_info',
};

const getKeyName = (username, type) => `e2ee_${type}_${username.toLowerCase()}`;

/**
 * Save keys to localStorage after registration or login.
 * Scoped by username so multiple accounts can be tested on one browser.
 */
export function saveKeysToStorage(username, encryptedPrivateKey, publicKeyJwk) {
    localStorage.setItem(getKeyName(username, 'priv'), encryptedPrivateKey);
    localStorage.setItem(getKeyName(username, 'pub'), publicKeyJwk);
}

export function getStoredPublicKey(username) {
    if (!username) return null;
    return localStorage.getItem(getKeyName(username, 'pub'));
}

export function getStoredPrivateKey(username) {
    if (!username) return null;
    return localStorage.getItem(getKeyName(username, 'priv'));
}

export function saveAuthData(token, user) {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
}

export function getAuthToken() {
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
}

export function getUserInfo() {
    const info = localStorage.getItem(STORAGE_KEYS.USER_INFO);
    return info ? JSON.parse(info) : null;
}

export function clearAuthStorage() {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_INFO);
    // Notice: We specifically DO NOT delete encryption keys here.
    // They are preserved so the user can decrypt past messages upon login.
}

export { STORAGE_KEYS };
