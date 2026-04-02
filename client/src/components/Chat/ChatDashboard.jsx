/**
 * ============================================================================
 * Chat Dashboard — E2EE Chat (Main Layout)
 * ============================================================================
 * The primary dashboard view with:
 * - Sidebar (contacts, search, user info)
 * - Chat window (messages, input, header)
 * - Settings modal (key viewer, fingerprint verification)
 * 
 * On mount, it loads existing conversation partners from the server
 * so the sidebar is pre-populated with previous contacts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
    importPublicKey,
    deriveSharedSecret,
    encryptMessage,
    decryptMessage,
    getFingerprint,
    getStoredPublicKey,
} from '../../crypto/keyManager';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import SettingsModal from '../Settings/SettingsModal';
import KeyVerification from '../Settings/KeyVerification';

export default function ChatDashboard({ privateKey }) {
    const { token, user, logout, API_URL } = useAuth();
    const { socket, onlineUsers } = useSocket();

    // State
    const [contacts, setContacts] = useState([]);
    const [activeContact, setActiveContact] = useState(null);
    const [messages, setMessages] = useState({});
    const [derivedKeys, setDerivedKeys] = useState({});
    const [showSettings, setShowSettings] = useState(false);
    const [showKeyVerify, setShowKeyVerify] = useState(false);
    const [typingUser, setTypingUser] = useState(null);

    // Refs for use in callbacks/effects without stale closures
    const derivedKeysRef = useRef(derivedKeys);
    const privateKeyRef = useRef(privateKey);
    const contactsRef = useRef(contacts);
    derivedKeysRef.current = derivedKeys;
    privateKeyRef.current = privateKey;
    contactsRef.current = contacts;

    /**
     * Derive or retrieve the shared AES key for a given contact.
     * Uses ECDH: deriveBits(myPrivateKey, theirPublicKey) → HKDF → AES-256 key
     */
    const getOrDeriveKey = useCallback(async (contactId, contactPublicKeyJwk) => {
        if (derivedKeysRef.current[contactId]) {
            return derivedKeysRef.current[contactId];
        }

        const theirPublicKey = await importPublicKey(contactPublicKeyJwk);
        const sharedKey = await deriveSharedSecret(privateKeyRef.current, theirPublicKey);

        setDerivedKeys(prev => ({ ...prev, [contactId]: sharedKey }));
        return sharedKey;
    }, []);

    /**
     * Fetch and decrypt message history for a contact.
     */
    const loadMessages = useCallback(async (contactId, contactPublicKeyJwk) => {
        try {
            const res = await fetch(`${API_URL}/messages/${contactId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (data.messages && data.messages.length > 0) {
                const aesKey = await getOrDeriveKey(contactId, contactPublicKeyJwk);

                // Decrypt each message on the client side
                const decryptedMessages = await Promise.all(
                    data.messages.map(async (msg) => {
                        try {
                            const plaintext = await decryptMessage(msg.ciphertext, msg.iv, aesKey);
                            return { ...msg, plaintext, decrypted: true };
                        } catch {
                            return {
                                ...msg,
                                plaintext: '[🔒 Message unreadable: Encryption keys were changed]',
                                decrypted: false
                            };
                        }
                    })
                );

                setMessages(prev => ({ ...prev, [contactId]: decryptedMessages }));
            }
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    }, [token, API_URL, getOrDeriveKey]);

    /**
     * Load existing conversations on mount.
     * This populates the sidebar with previous contacts.
     */
    useEffect(() => {
        const loadConversations = async () => {
            try {
                const res = await fetch(`${API_URL}/messages/conversations/list`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();

                if (data.conversations && data.conversations.length > 0) {
                    const loadedContacts = data.conversations.map(conv => ({
                        _id: conv._id,
                        username: conv.username,
                        publicKey: conv.publicKey,
                    }));

                    setContacts(prev => {
                        // Merge loaded contacts with any existing ones (avoid duplicates)
                        const existing = new Set(prev.map(c => c._id));
                        const merged = [...prev];
                        for (const contact of loadedContacts) {
                            if (!existing.has(contact._id)) {
                                merged.push(contact);
                            }
                        }
                        return merged;
                    });
                }
            } catch (err) {
                console.error('Failed to load conversations:', err);
            }
        };

        loadConversations();
    }, [token, API_URL]);

    /**
     * Select a contact and load their message history.
     */
    const handleSelectContact = useCallback(async (contact) => {
        setActiveContact(contact);

        // Fetch their public key if we don't have it
        if (!contact.publicKey) {
            try {
                const res = await fetch(`${API_URL}/users/${contact._id}/publickey`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                contact.publicKey = data.publicKey;
            } catch (err) {
                console.error('Failed to fetch public key:', err);
                return;
            }
        }

        await loadMessages(contact._id, contact.publicKey);
    }, [token, API_URL, loadMessages]);

    /**
     * Send an encrypted message to the active contact.
     */
    const handleSendMessage = useCallback(async (plaintext) => {
        if (!activeContact || !socket) return;

        try {
            const aesKey = await getOrDeriveKey(activeContact._id, activeContact.publicKey);
            const { ciphertext, iv } = await encryptMessage(plaintext, aesKey);

            // Send the encrypted ciphertext through Socket.io
            socket.emit('send_message', {
                receiverId: activeContact._id,
                ciphertext,
                iv,
            });
        } catch (err) {
            console.error('Encryption/send error:', err);
        }
    }, [activeContact, socket, getOrDeriveKey]);

    /**
     * Handle incoming real-time messages.
     */
    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = async (data) => {
            const senderId = data.sender;

            try {
                // Fetch sender's public key if needed for decryption
                let senderPublicKey = null;
                const existingContact = contactsRef.current.find(c => c._id === senderId);

                if (existingContact?.publicKey) {
                    senderPublicKey = existingContact.publicKey;
                } else {
                    const res = await fetch(`${API_URL}/users/${senderId}/publickey`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const keyData = await res.json();
                    senderPublicKey = keyData.publicKey;

                    // Add to contacts if not already there
                    setContacts(prev => {
                        if (prev.find(c => c._id === senderId)) return prev;
                        return [...prev, { _id: senderId, username: keyData.username, publicKey: senderPublicKey }];
                    });
                }

                const aesKey = await getOrDeriveKey(senderId, senderPublicKey);
                const plaintext = await decryptMessage(data.ciphertext, data.iv, aesKey);

                setMessages(prev => ({
                    ...prev,
                    [senderId]: [...(prev[senderId] || []), { ...data, plaintext, decrypted: true }],
                }));
            } catch (err) {
                console.warn('Decryption error on initial attempt. The contact may have rotated keys. Retrying...', err);
                try {
                    // Self-healing: Fetch the absolute latest public key from the server
                    const res = await fetch(`${API_URL}/users/${senderId}/publickey`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const keyData = await res.json();

                    // Skip the derivedKeys cache and manually derive a fresh AES key
                    const freshTheirPublicKey = await importPublicKey(keyData.publicKey);
                    const freshAesKey = await deriveSharedSecret(privateKeyRef.current, freshTheirPublicKey);

                    const plaintext = await decryptMessage(data.ciphertext, data.iv, freshAesKey);

                    // It worked! Update our local contacts cache and derived keys cache with the new key
                    setContacts(prev => prev.map(c => c._id === senderId ? { ...c, publicKey: keyData.publicKey } : c));
                    setDerivedKeys(prev => ({ ...prev, [senderId]: freshAesKey }));

                    setMessages(prev => ({
                        ...prev,
                        [senderId]: [...(prev[senderId] || []), { ...data, plaintext, decrypted: true }],
                    }));
                } catch (retryErr) {
                    console.error('Decryption failed even after key refresh:', retryErr);
                    setMessages(prev => ({
                        ...prev,
                        [senderId]: [...(prev[senderId] || []), {
                            ...data,
                            plaintext: '[🔒 Message unreadable: Encryption keys were changed]',
                            decrypted: false
                        }],
                    }));
                }
            }
        };

        const handleMessageSent = async (data) => {
            const receiverId = data.receiver;
            try {
                const aesKey = derivedKeysRef.current[receiverId];
                const plaintext = aesKey ? await decryptMessage(data.ciphertext, data.iv, aesKey) : '[Sent]';

                setMessages(prev => ({
                    ...prev,
                    [receiverId]: [...(prev[receiverId] || []), { ...data, plaintext, decrypted: true }],
                }));
            } catch {
                setMessages(prev => ({
                    ...prev,
                    [receiverId]: [...(prev[receiverId] || []), { ...data, plaintext: '[Sent]', decrypted: true }],
                }));
            }
        };

        const handleUserTyping = ({ userId, username }) => {
            setTypingUser({ userId, username });
        };

        const handleUserStopTyping = () => {
            setTypingUser(null);
        };

        socket.on('receive_message', handleReceiveMessage);
        socket.on('message_sent', handleMessageSent);
        socket.on('user_typing', handleUserTyping);
        socket.on('user_stop_typing', handleUserStopTyping);

        return () => {
            socket.off('receive_message', handleReceiveMessage);
            socket.off('message_sent', handleMessageSent);
            socket.off('user_typing', handleUserTyping);
            socket.off('user_stop_typing', handleUserStopTyping);
        };
    }, [socket, token, API_URL, getOrDeriveKey]);

    /**
     * Search for users.
     */
    const handleSearchUsers = useCallback(async (query) => {
        if (!query.trim()) return [];
        try {
            const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            return data.users || [];
        } catch {
            return [];
        }
    }, [token, API_URL]);

    /**
     * Add a user from search results to contacts.
     */
    const handleAddContact = useCallback((newContact) => {
        setContacts(prev => {
            if (prev.find(c => c._id === newContact._id)) return prev;
            return [...prev, newContact];
        });
        handleSelectContact(newContact);
    }, [handleSelectContact]);

    return (
        <div className={`dashboard ${activeContact ? 'chat-open' : ''}`}>
            <Sidebar
                contacts={contacts}
                activeContact={activeContact}
                onSelectContact={handleSelectContact}
                onSearch={handleSearchUsers}
                onAddContact={handleAddContact}
                onOpenSettings={() => setShowSettings(true)}
                onLogout={logout}
                user={user}
                onlineUsers={onlineUsers}
                messages={messages}
            />

            {activeContact ? (
                <ChatWindow
                    contact={activeContact}
                    messages={messages[activeContact._id] || []}
                    onSendMessage={handleSendMessage}
                    userId={user.id}
                    isOnline={onlineUsers.includes(activeContact._id)}
                    typingUser={typingUser}
                    socket={socket}
                    onOpenKeyVerify={() => setShowKeyVerify(true)}
                />
            ) : (
                <div className="no-chat-selected">
                    <div className="no-chat-icon">💬</div>
                    <h2>Welcome to SecureChat</h2>
                    <p>Select a contact or search for users to start an end-to-end encrypted conversation.</p>
                    <div className="e2ee-badge">🔒 All messages are end-to-end encrypted</div>
                </div>
            )}

            {showSettings && (
                <SettingsModal
                    onClose={() => setShowSettings(false)}
                    user={user}
                />
            )}

            {showKeyVerify && activeContact && (
                <KeyVerification
                    onClose={() => setShowKeyVerify(false)}
                    myPublicKey={getStoredPublicKey(user.username)}
                    contactPublicKey={activeContact.publicKey}
                    contactName={activeContact.username}
                    myName={user.username}
                />
            )}
        </div>
    );
}
