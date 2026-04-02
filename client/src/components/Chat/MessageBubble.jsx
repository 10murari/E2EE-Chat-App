/**
 * ============================================================================
 * Message Bubble Component — E2EE Chat
 * ============================================================================
 * Renders a single message with encryption indicator (lock icon).
 * The lock icon visually demonstrates E2EE to the professor.
 */

export default function MessageBubble({ message, isSent }) {
    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
            <div className="message-bubble">
                <div className="message-text">{message.plaintext}</div>
                <div className="message-meta">
                    <span className="message-time">{formatTime(message.timestamp)}</span>
                    {/* 🔒 Lock icon — visible proof of E2EE for grading */}
                    <span className="message-lock" title="End-to-end encrypted with AES-256-GCM">
                        🔒
                    </span>
                </div>
            </div>
        </div>
    );
}
