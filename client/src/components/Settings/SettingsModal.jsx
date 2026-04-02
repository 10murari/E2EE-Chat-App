/**
 * ============================================================================
 * Settings Modal — E2EE Chat
 * ============================================================================
 * Allows the user to view their cryptographic keys and fingerprint.
 * This is critical for demonstrating E2EE to the professor.
 */

import { useState, useEffect } from 'react';
import { getStoredPublicKey, getFingerprint } from '../../crypto/keyManager';

export default function SettingsModal({ onClose, user }) {
    const [publicKey, setPublicKey] = useState('');
    const [fingerprint, setFingerprint] = useState('');

    useEffect(() => {
        const loadKeyInfo = async () => {
            const pubKey = getStoredPublicKey(user?.username);
            if (pubKey) {
                setPublicKey(pubKey);
                const fp = await getFingerprint(pubKey);
                setFingerprint(fp);
            }
        };
        loadKeyInfo();
    }, []);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>⚙️ Security Settings</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {/* User Info */}
                    <div className="key-section">
                        <div className="key-section-title">👤 Account</div>
                        <div style={{ padding: '8px 0', fontSize: 'var(--font-size-md)' }}>
                            <strong>Username:</strong> {user?.username}
                        </div>
                    </div>

                    {/* Key Fingerprint */}
                    <div className="key-section">
                        <div className="key-section-title">🔑 Your Key Fingerprint</div>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                            Share this fingerprint with your contacts to verify your identity.
                            If it doesn't match what they see, a MITM attack may be occurring.
                        </p>
                        <div className="fingerprint-value">{fingerprint || 'Loading...'}</div>
                    </div>

                    {/* Public Key */}
                    <div className="key-section">
                        <div className="key-section-title">📤 Your Public Key (ECDH P-256, JWK)</div>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                            This key is stored on the server. Other users fetch it to perform ECDH key agreement.
                        </p>
                        <div className="key-value">{publicKey || 'Not available'}</div>
                    </div>

                    {/* Private Key Notice */}
                    <div className="key-section" style={{ borderColor: 'rgba(248, 81, 73, 0.3)' }}>
                        <div className="key-section-title" style={{ color: 'var(--color-error)' }}>
                            🔐 Private Key
                        </div>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            Your private key is encrypted with your passphrase and stored <strong>only</strong> in
                            this browser's localStorage. It is <strong>never</strong> sent to the server.
                            If you clear your browser data, you will lose access to your encrypted messages.
                        </p>
                    </div>

                    {/* Crypto Summary */}
                    <div className="key-section" style={{ background: 'rgba(0, 212, 170, 0.05)' }}>
                        <div className="key-section-title">🛡️ Encryption Summary</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                            <div>• <strong>Key Exchange:</strong> ECDH (Elliptic Curve Diffie-Hellman, P-256)</div>
                            <div>• <strong>Key Derivation:</strong> HKDF (SHA-256)</div>
                            <div>• <strong>Message Encryption:</strong> AES-256-GCM (Authenticated)</div>
                            <div>• <strong>Key Protection:</strong> PBKDF2 (100,000 iterations) + AES-GCM</div>
                            <div>• <strong>Password Hashing:</strong> bcrypt (12 rounds, server-side)</div>
                            <div>• <strong>Authentication:</strong> JWT (HS256, 24h expiry)</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
