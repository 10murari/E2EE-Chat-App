/**
 * ============================================================================
 * Registration Form Component — E2EE Chat
 * ============================================================================
 * 
 * SECURITY FLOW:
 * 1. User enters username, password, and confirm password
 * 2. Client generates an ECDH P-256 key pair (Web Crypto API)
 * 3. Public key is exported (JWK) and sent to the server with credentials
 * 4. Private key is encrypted with the PASSWORD (PBKDF2 + AES-GCM)
 *    and stored in localStorage — it NEVER leaves the client
 * 5. Server hashes the password with bcrypt and stores username + public key
 * 
 * The password doubles as the passphrase for private key encryption,
 * so the user only needs to remember one credential (like Signal/WhatsApp).
 */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    generateKeyPair,
    exportPublicKey,
    encryptPrivateKeyWithPassphrase,
    saveKeysToStorage,
} from '../../crypto/keyManager';

export default function RegisterForm({ onSwitchToLogin, onRegisterSuccess }) {
    const { register } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);

        try {
            // Step 1: Generate ECDH key pair entirely on the client
            setStatus('🔑 Generating ECDH key pair (P-256)...');
            const keyPair = await generateKeyPair();

            // Step 2: Export public key as JWK for server storage
            setStatus('📤 Exporting public key...');
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);

            // Step 3: Encrypt private key using the PASSWORD (invisible to user)
            setStatus('🔒 Securing private key...');
            const encryptedPrivateKey = await encryptPrivateKeyWithPassphrase(
                keyPair.privateKey,
                password  // Password doubles as the passphrase
            );

            // Step 4: Register with the server (password will be bcrypt-hashed server-side)
            setStatus('📡 Registering with server...');
            await register(username, password, publicKeyJwk);

            // Step 5: Save keys to localStorage
            saveKeysToStorage(username, encryptedPrivateKey, publicKeyJwk);

            setStatus('✅ Registration complete!');
            onRegisterSuccess(keyPair.privateKey);

        } catch (err) {
            setError(err.message || 'Registration failed.');
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="auth-logo-icon">🛡️</div>
                    <h1>SecureChat</h1>
                    <p>Create your encrypted identity</p>
                </div>

                {error && <div className="auth-error">{error}</div>}
                {status && !error && (
                    <div className="auth-info">⚙️ {status}</div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Choose a username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                            minLength={3}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="At least 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Re-enter your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="auth-info">
                        🔐 Your encryption keys are generated automatically and protected by your password.
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? status : '🛡️ Create Secure Account'}
                    </button>
                </form>

                <div className="auth-toggle">
                    Already have an account?{' '}
                    <button onClick={onSwitchToLogin}>Sign in</button>
                </div>
            </div>
        </div>
    );
}
