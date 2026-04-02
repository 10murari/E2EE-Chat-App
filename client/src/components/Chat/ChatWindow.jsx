/**
 * ============================================================================
 * Chat Window Component — E2EE Chat
 * ============================================================================
 * Active chat view with message history, input, and E2EE status bar.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

export default function ChatWindow({
    contact,
    messages,
    onSendMessage,
    userId,
    isOnline,
    typingUser,
    socket,
    onOpenKeyVerify,
}) {
    const messagesEndRef = useRef(null);
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle typing indicator
    const handleTyping = useCallback(() => {
        if (!socket || !contact) return;

        if (!isTyping) {
            setIsTyping(true);
            socket.emit('typing', { receiverId: contact._id });
        }

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            socket.emit('stop_typing', { receiverId: contact._id });
        }, 2000);
    }, [socket, contact, isTyping]);

    // Format date for date dividers
    const getDateLabel = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) return 'Today';
        if (isYesterday) return 'Yesterday';
        return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    };

    // Determine if we need a date divider between messages
    const shouldShowDateDivider = (current, previous) => {
        if (!previous) return true;
        const currentDate = new Date(current.timestamp).toDateString();
        const previousDate = new Date(previous.timestamp).toDateString();
        return currentDate !== previousDate;
    };

    return (
        <div className="chat-area">
            {/* Chat Header */}
            <div className="chat-header">
                <div className="chat-header-info">
                    <div className="contact-avatar" style={{ width: 38, height: 38, fontSize: '0.85rem' }}>
                        {contact.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="chat-header-details">
                        <h3>{contact.username}</h3>
                        <span className={`status-text ${isOnline ? '' : 'offline'}`}>
                            {isOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>
                </div>
                <div className="chat-header-actions">
                    <button className="icon-btn" onClick={onOpenKeyVerify} title="Verify encryption keys">
                        🔑
                    </button>
                </div>
            </div>

            {/* E2EE Info Bar */}
            <div className="crypto-info-bar">
                🔒 Messages are end-to-end encrypted. Only you and {contact.username} can read them.
            </div>

            {/* Messages */}
            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">🔐</div>
                        <h3>Start of encrypted conversation</h3>
                        <p>
                            Messages in this chat are secured with end-to-end encryption using
                            AES-256-GCM. Not even the server can read them.
                        </p>
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div key={msg._id || index}>
                            {shouldShowDateDivider(msg, messages[index - 1]) && (
                                <div className="date-divider">
                                    <span>{getDateLabel(msg.timestamp)}</span>
                                </div>
                            )}
                            <MessageBubble
                                message={msg}
                                isSent={msg.sender === userId}
                            />
                        </div>
                    ))
                )}

                {/* Typing indicator */}
                {typingUser && typingUser.userId === contact._id && (
                    <div className="typing-indicator">
                        <div className="typing-dots">
                            <span></span><span></span><span></span>
                        </div>
                        {typingUser.username} is typing...
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <MessageInput
                onSend={onSendMessage}
                onTyping={handleTyping}
            />
        </div>
    );
}
