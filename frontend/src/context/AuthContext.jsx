import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [faceRegistered, setFaceRegistered] = useState(() => {
    const savedStatus = localStorage.getItem('faceRegistered');
    return savedStatus === 'true';
  });
  const [loading, setLoading] = useState(true);

  const checkFaceStatus = async () => {
    if (!token) return false;
    if (user && user.role !== 'student') {
      setFaceRegistered(true);
      localStorage.setItem('faceRegistered', 'true');
      return true;
    }
    try {
      const response = await client.get('/face/status');
      const registered = response.data.registered;
      setFaceRegistered(registered);
      localStorage.setItem('faceRegistered', registered ? 'true' : 'false');
      return registered;
    } catch (error) {
      console.error("Failed to fetch face registration status:", error);
      return false;
    }
  };

  const login = async (newToken, newUser) => {
    // Save token first so the subsequent API request can use it
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);

    if (newUser.role === 'student') {
      try {
        const response = await client.get('/face/status', {
          headers: { Authorization: `Bearer ${newToken}` }
        });
        const registered = response.data.registered;
        setFaceRegistered(registered);
        localStorage.setItem('faceRegistered', registered ? 'true' : 'false');
      } catch (err) {
        console.error("Error fetching face status during login:", err);
        setFaceRegistered(false);
        localStorage.setItem('faceRegistered', 'false');
      }
    } else {
      setFaceRegistered(true);
      localStorage.setItem('faceRegistered', 'true');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setFaceRegistered(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('faceRegistered');
  };

  const isAuthenticated = () => !!token;

  useEffect(() => {
    const initializeAuth = async () => {
      if (token && user && user.role === 'student') {
        await checkFaceStatus();
      }
      setLoading(false);
    };
    initializeAuth();
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, user, faceRegistered, loading, login, logout, isAuthenticated, checkFaceStatus, setFaceRegistered }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
