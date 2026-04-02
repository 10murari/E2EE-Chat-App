/**
 * ============================================================================
 * Authentication Context — E2EE Chat
 * ============================================================================
 * Manages authentication state: JWT token, user info, login/logout.
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { saveAuthData, getAuthToken, getUserInfo, clearAuthStorage } from '../crypto/keyManager';

const AuthContext = createContext(null);

const API_URL = 'http://localhost:5000/api';

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => getAuthToken());
    const [user, setUser] = useState(() => getUserInfo());

    const login = useCallback(async (username, password) => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        saveAuthData(data.token, data.user);
        setToken(data.token);
        setUser(data.user);
        return data;
    }, []);

    const register = useCallback(async (username, password, publicKey) => {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, publicKey }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        saveAuthData(data.token, data.user);
        setToken(data.token);
        setUser(data.user);
        return data;
    }, []);

    const logout = useCallback(() => {
        clearAuthStorage();
        setToken(null);
        setUser(null);
    }, []);

    const isAuthenticated = !!token;

    return (
        <AuthContext.Provider value={{ token, user, login, register, logout, isAuthenticated, API_URL }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}
