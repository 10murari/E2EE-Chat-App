/**
 * ============================================================================
 * Login Form Component — E2EE Chat
 * ============================================================================
 * Simple username + password login. The password is also used internally
 * as the passphrase to decrypt the locally stored ECDH private key.
 * No extra key/passphrase field needed — just like Signal/WhatsApp.
 */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    getStoredPrivateKey,
    decryptPrivateKeyWithPassphrase,
    generateKeyPair,
    exportPublicKey,
    encryptPrivateKeyWithPassphrase,
    saveKeysToStorage,
    getStoredPublicKey,
} from '../../crypto/keyManager';

export default function LoginForm({ onSwitchToRegister, onLoginSuccess }) {
    const { login, API_URL } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Step 1: Authenticate with the server (bcrypt password verification)
            setStatus('Verifying credentials...');
            const loginData = await login(username, password);

            // Step 2: Try to decrypt the locally stored private key using the password
            const encryptedPrivateKey = getStoredPrivateKey(username);

            if (encryptedPrivateKey) {
                // Keys exist locally — decrypt with the password (used as passphrase)
                setStatus('Decrypting your private key...');
                try {
                    const privateKey = await decryptPrivateKeyWithPassphrase(encryptedPrivateKey, password);
                    // Force the server to sync with THIS device's public key
                    // If they had logged into another device, the server has the other device's key.
                    // By re-uploading here, we take back the identity so NEW messages are encrypted for THIS device.
                    const localPublicKey = getStoredPublicKey(username);
                    if (localPublicKey) {
                        setStatus('Syncing keys with server...');
                        const keyRes = await fetch(`${API_URL}/auth/update-key`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${loginData.token}`,
                            },
                            body: JSON.stringify({ publicKey: localPublicKey }),
                        });
                        if (!keyRes.ok) {
                            throw new Error('Failed to sync keys with server');
                        }
                    }

                    onLoginSuccess(privateKey);
                    return;
                } catch (decryptErr) {
                    // Decryption failed — keys might belong to a different account.
                    // Fall through to regenerate keys.
                    console.warn('Local key decryption failed, regenerating keys...', decryptErr.message);
                }
            }

            // Step 3: No local keys or decryption failed — generate fresh keys
            // This handles first-login-on-this-device or cleared data scenarios.
            setStatus('Generating encryption keys...');
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);

            // Encrypt the private key using the password as passphrase
            const encrypted = await encryptPrivateKeyWithPassphrase(keyPair.privateKey, password);
            saveKeysToStorage(username, encrypted, publicKeyJwk);

            // Update public key on the server
            setStatus('Updating encryption keys on server...');
            const updateRes = await fetch(`${API_URL}/auth/update-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${loginData.token}`,
                },
                body: JSON.stringify({ publicKey: publicKeyJwk }),
            });
            if (!updateRes.ok) {
                throw new Error('Failed to update encryption keys on server');
            }

            onLoginSuccess(keyPair.privateKey);

        } catch (err) {
            setError(err.message || 'Login failed. Check your credentials.');
            setLoading(false);
            setStatus('');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="auth-logo-icon">🔐</div>
                    <h1>SecureChat</h1>
                    <p>End-to-End Encrypted Messenger</p>
                </div>

                {error && <div className="auth-error">{error}</div>}
                {status && !error && <div className="auth-info">⚙️ {status}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Signing in...' : '🔓 Sign In'}
                    </button>
                </form>

                <div className="auth-toggle">
                    Don't have an account?{' '}
                    <button onClick={onSwitchToRegister}>Create one</button>
                </div>
            </div>
        </div>
    );
}
