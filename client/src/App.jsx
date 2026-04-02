/**
 * ============================================================================
 * App Root Component — E2EE Chat
 * ============================================================================
 * Manages the top-level routing between Auth and Dashboard views.
 * Wraps everything in Auth and Socket context providers.
 */

import { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import ChatDashboard from './components/Chat/ChatDashboard';

function AppContent() {
    const { isAuthenticated } = useAuth();
    const [view, setView] = useState('login'); // 'login' | 'register'
    const [privateKey, setPrivateKey] = useState(null);

    const handleLoginSuccess = useCallback((key) => {
        setPrivateKey(key);
    }, []);

    const handleRegisterSuccess = useCallback((key) => {
        setPrivateKey(key);
    }, []);

    // If authenticated and we have the decrypted private key, show the dashboard
    if (isAuthenticated && privateKey) {
        return (
            <SocketProvider>
                <ChatDashboard privateKey={privateKey} />
            </SocketProvider>
        );
    }

    // Auth screens
    if (view === 'register') {
        return (
            <RegisterForm
                onSwitchToLogin={() => setView('login')}
                onRegisterSuccess={handleRegisterSuccess}
            />
        );
    }

    return (
        <LoginForm
            onSwitchToRegister={() => setView('register')}
            onLoginSuccess={handleLoginSuccess}
        />
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}
