/**
 * ============================================================================
 * Sidebar Component — E2EE Chat
 * ============================================================================
 * Contact list with user search functionality.
 */

import { useState, useEffect, useRef } from 'react';

export default function Sidebar({
    contacts,
    activeContact,
    onSelectContact,
    onSearch,
    onAddContact,
    onOpenSettings,
    onLogout,
    user,
    onlineUsers,
    messages,
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef(null);

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            const results = await onSearch(searchQuery);
            setSearchResults(results);
            setIsSearching(false);
        }, 300);

        return () => clearTimeout(searchTimeout.current);
    }, [searchQuery, onSearch]);

    const handleSelectSearchResult = (resultUser) => {
        onAddContact(resultUser);
        setSearchQuery('');
        setSearchResults([]);
    };

    const getLastMessage = (contactId) => {
        const contactMessages = messages[contactId];
        if (!contactMessages || contactMessages.length === 0) return null;
        return contactMessages[contactMessages.length - 1];
    };

    const getInitials = (name) => {
        return name.slice(0, 2).toUpperCase();
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className="sidebar">
            {/* Header */}
            <div className="sidebar-header">
                <h2>🔒 SecureChat</h2>
                <div className="sidebar-header-actions">
                    <button className="icon-btn" onClick={onOpenSettings} title="Settings">
                        ⚙️
                    </button>
                    <button className="icon-btn" onClick={onLogout} title="Logout">
                        🚪
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="search-box">
                <div className="search-input-wrapper">
                    <span className="search-input-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Search Results */}
            {searchQuery.trim() ? (
                <div className="search-results">
                    <div className="search-section-label">Search Results</div>
                    {isSearching ? (
                        <div className="contact-item" style={{ justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                            Searching...
                        </div>
                    ) : searchResults.length > 0 ? (
                        searchResults.map((resultUser) => (
                            <div
                                key={resultUser._id}
                                className="search-result-item"
                                onClick={() => handleSelectSearchResult(resultUser)}
                            >
                                <div className="contact-avatar">
                                    {getInitials(resultUser.username)}
                                </div>
                                <div className="contact-info">
                                    <div className="contact-name">{resultUser.username}</div>
                                    <div className="contact-last-msg">Click to start E2EE chat</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="contact-item" style={{ justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                            No users found
                        </div>
                    )}
                </div>
            ) : (
                /* Contact List */
                <div className="contact-list">
                    {contacts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👥</div>
                            <p style={{ fontSize: 'var(--font-size-sm)' }}>Search for users to start chatting</p>
                        </div>
                    ) : (
                        contacts.map((contact) => {
                            const lastMsg = getLastMessage(contact._id);
                            const isOnline = onlineUsers.includes(contact._id);
                            return (
                                <div
                                    key={contact._id}
                                    className={`contact-item ${activeContact?._id === contact._id ? 'active' : ''}`}
                                    onClick={() => onSelectContact(contact)}
                                >
                                    <div className="contact-avatar">
                                        {getInitials(contact.username)}
                                        {isOnline && <span className="online-dot" />}
                                    </div>
                                    <div className="contact-info">
                                        <div className="contact-name">{contact.username}</div>
                                        <div className="contact-last-msg">
                                            {lastMsg ? (
                                                <>🔒 {lastMsg.plaintext?.slice(0, 35)}{lastMsg.plaintext?.length > 35 ? '...' : ''}</>
                                            ) : (
                                                'Start an encrypted conversation'
                                            )}
                                        </div>
                                    </div>
                                    <div className="contact-meta">
                                        {lastMsg && (
                                            <span className="contact-time">{formatTime(lastMsg.timestamp)}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">
                        {user?.username?.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="sidebar-username">{user?.username}</span>
                </div>
                <div className="e2ee-badge">🔒 E2EE</div>
            </div>
        </div>
    );
}
