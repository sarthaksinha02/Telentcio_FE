import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          // Always fetch fresh user data from server so permissions are up-to-date
          const response = await api.get('/auth/profile');
          const freshUser = response.data;
          // Normalise roles to flat string array (roleNames) for uniform AuthContext usage
          // (Profile.jsx fetches separately and gets full role objects)
          const normalisedUser = {
            ...freshUser,
            roles: freshUser.roleNames || (Array.isArray(freshUser.roles) ? freshUser.roles.map(r => r.name || r) : [])
          };
          setUser(normalisedUser);
          localStorage.setItem('user', JSON.stringify(normalisedUser));
        } catch (err) {
          // Token invalid or expired — fall back to localStorage, then clear if 401
          if (err.response?.status === 401) {
            setToken(null);
            setUser(null);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          } else {
            // Network error — use cached data
            const storedUser = localStorage.getItem('user');
            if (storedUser) setUser(JSON.parse(storedUser));
          }
        }
      }
      setLoading(false);
    };
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token: newToken, ...userData } = response.data;

    setToken(newToken);
    setUser(userData);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const register = async (data) => {
    const response = await api.post('/auth/register-company', data);
    const { token: newToken, ...userData } = response.data;

    setToken(newToken);
    setUser(userData);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#f1f5f9', zIndex: 9999
      }}>
        <div style={{
          width: 36, height: 36, border: '3px solid #e2e8f0',
          borderTop: '3px solid #2563eb', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
