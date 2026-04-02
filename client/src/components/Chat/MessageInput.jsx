/**
 * ============================================================================
 * Message Input Component — E2EE Chat
 * ============================================================================
 * Text input for composing messages. Triggers the send handler which
 * encrypts the message with AES-256-GCM before transmission.
 */

import { useState, useRef } from 'react';

export default function MessageInput({ onSend, onTyping }) {
    const [text, setText] = useState('');
    const inputRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed) return;

        onSend(trimmed);
        setText('');
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleChange = (e) => {
        setText(e.target.value);
        onTyping();
    };

    return (
        <div className="message-input-area">
            <input
                ref={inputRef}
                type="text"
                className="message-input"
                placeholder="Type an encrypted message..."
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                autoFocus
            />
            <button
                className="send-btn"
                onClick={handleSubmit}
                disabled={!text.trim()}
                title="Send encrypted message"
            >
                ➤
            </button>
        </div>
    );
}
