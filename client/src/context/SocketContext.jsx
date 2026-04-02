/**
 * ============================================================================
 * Socket Context — E2EE Chat
 * ============================================================================
 * Wraps Socket.io client. Auto-connects when a user is authenticated.
 * All real-time messaging goes through this context.
 */

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = 'http://localhost:5000';

export function SocketProvider({ children }) {
    const { token, isAuthenticated } = useAuth();
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!isAuthenticated || !token) {
            // Disconnect if not authenticated
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
            }
            return;
        }

        // Create authenticated Socket.io connection
        const newSocket = io(SOCKET_URL, {
            auth: { token }, // JWT is sent in the handshake for server-side verification
            transports: ['websocket', 'polling'],
        });

        newSocket.on('connect', () => {
            console.log('🟢 Socket connected:', newSocket.id);
        });

        newSocket.on('online_users', (users) => {
            setOnlineUsers(users);
        });

        newSocket.on('connect_error', (err) => {
            console.error('🔴 Socket connection error:', err.message);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthenticated, token]);

    return (
        <SocketContext.Provider value={{ socket, onlineUsers }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) throw new Error('useSocket must be used within a SocketProvider');
    return context;
}
