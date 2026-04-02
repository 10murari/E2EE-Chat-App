/**
 * ============================================================================
 * Key Verification Component — E2EE Chat
 * ============================================================================
 * 
 * SECURITY PURPOSE:
 * This component allows users to compare their key fingerprints with the
 * contact's fingerprint. If an attacker performs a MITM attack by substituting
 * public keys (e.g., on the server), the fingerprints will NOT match.
 * 
 * Users should verify fingerprints through an out-of-band channel
 * (e.g., in person, phone call) to ensure they're communicating securely.
 */

import { useState, useEffect } from 'react';
import { getFingerprint } from '../../crypto/keyManager';

export default function KeyVerification({ onClose, myPublicKey, contactPublicKey, contactName, myName }) {
    const [myFingerprint, setMyFingerprint] = useState('');
    const [contactFingerprint, setContactFingerprint] = useState('');

    useEffect(() => {
        const loadFingerprints = async () => {
            if (myPublicKey) {
                const fp = await getFingerprint(myPublicKey);
                setMyFingerprint(fp);
            }
            if (contactPublicKey) {
                const fp = await getFingerprint(contactPublicKey);
                setContactFingerprint(fp);
            }
        };
        loadFingerprints();
    }, [myPublicKey, contactPublicKey]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🔑 Verify Encryption Keys</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    <div className="verify-section">
                        <div className="verify-title">🛡️ Key Fingerprint Verification</div>
                        <div className="verify-description">
                            To verify that your conversation is truly end-to-end encrypted and
                            not subject to a Man-in-the-Middle (MITM) attack, compare the
                            fingerprints below with {contactName} through an out-of-band channel
                            (e.g., in person, phone call, or trusted messaging).
                        </div>

                        <div className="verify-fingerprints">
                            <div className="verify-fingerprint-card">
                                <div className="verify-fingerprint-label">Your Key ({myName})</div>
                                <div className="verify-fingerprint-hash">
                                    {myFingerprint || 'Loading...'}
                                </div>
                            </div>

                            <div className="verify-fingerprint-card">
                                <div className="verify-fingerprint-label">{contactName}'s Key</div>
                                <div className="verify-fingerprint-hash">
                                    {contactFingerprint || 'Loading...'}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '16px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                            <strong>How to verify:</strong>
                            <ol style={{ paddingLeft: '16px', marginTop: '4px' }}>
                                <li>Ask {contactName} to open their Settings and find their key fingerprint</li>
                                <li>Compare {contactName}'s fingerprint (shown here) with what they see as their own fingerprint</li>
                                <li>If they match, the connection is secure ✅</li>
                                <li>If they don't match, someone may be intercepting your messages ⚠️</li>
                            </ol>
                        </div>
                    </div>

                    {/* Visual Key Comparison Info */}
                    <div className="key-section">
                        <div className="key-section-title">📚 Why This Matters</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                            In a MITM attack, an adversary could intercept public key exchanges and
                            substitute their own keys. This would let them decrypt, read, and re-encrypt
                            messages in transit. By verifying fingerprints out-of-band, you confirm that
                            the public keys were not tampered with, ensuring true end-to-end encryption.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
