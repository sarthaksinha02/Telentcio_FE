import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { connectSocket, disconnectSocket } from '../api/socket';
import InvalidWorkspace from '../pages/InvalidWorkspace';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const [invalidWorkspace, setInvalidWorkspace] = useState(false);
  const [workspace, setWorkspace] = useState(null);

  useEffect(() => {
    const loadUserAndVerifyWorkspace = async () => {
      // 1. Verify workspace first
      try {
        const response = await api.get('/auth/verify-workspace');
        if (response.data.type === 'tenant') {
          setWorkspace(response.data);
          // If we have a subdomain, ensure it's in localStorage so axios can pick it up
          if (response.data.subdomain) {
            localStorage.setItem('tenant', response.data.subdomain);
          }
        }
      } catch (err) {
        if (err.response?.status === 404 || err.response?.status === 403) {
          setInvalidWorkspace(true);
          setLoading(false);
          return;
        }
      }

      if (!token) {
        setLoading(false);
        return;
      }

      // 2. Try localStorage for initial state (avoids flicker)
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          const normalisedUser = {
            ...parsed,
            roles: parsed.roleNames || (Array.isArray(parsed.roles)
              ? parsed.roles.map(r => r.name || r)
              : [])
          };
          setUser(normalisedUser);
        } catch {
          localStorage.removeItem('user');
        }
      }

      // 3. ALWAYS fetch fresh profile from server to get latest company configuration (modules, styles, etc.)
      try {
        const response = await api.get('/auth/profile');
        const freshUser = response.data;
        const normalisedUser = {
          ...freshUser,
          roles: freshUser.roleNames || (Array.isArray(freshUser.roles)
            ? freshUser.roles.map(r => r.name || r)
            : [])
        };
        setUser(normalisedUser);
        localStorage.setItem('user', JSON.stringify(normalisedUser));

        if (normalisedUser?._id) {
          connectSocket(normalisedUser._id);
        }
      } catch (err) {
        console.error('Profile Load Error:', err);
        if (err.response?.status === 401 || err.response?.status === 403 || err.response?.status === 404) {
          setToken(null);
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('tenant');
        }
      } finally {
        setLoading(false);
      }
    };

    loadUserAndVerifyWorkspace();
  }, [token]);

  const login = async (email, password, companyId = null) => {
    const loginData = { email, password };

    // Priority: 1. Explicit selection, 2. Auto-detected from domain, 3. Empty (discovers via email)
    const targetCompanyId = companyId || workspace?.id;
    if (targetCompanyId) loginData.companyId = targetCompanyId;

    const response = await api.post('/auth/login', loginData);

    if (response.data.passwordResetRequired) {
      return response.data;
    }

    const { token: newToken, ...userData } = response.data;

    // Normalise roles before storing
    const normalisedUser = {
      ...userData,
      roles: userData.roleNames || (Array.isArray(userData.roles)
        ? userData.roles.map(r => r.name || r)
        : [])
    };

    setToken(newToken);
    setUser(normalisedUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(normalisedUser));

    // Connect socket on login
    if (normalisedUser?._id) {
      connectSocket(normalisedUser._id);
    }

    return response.data;
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
    disconnectSocket();
    setToken(null);
    setUser(null);
    localStorage.clear();
    sessionStorage.clear();
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

  if (invalidWorkspace) {
    return <InvalidWorkspace />;
  }

  const hasModule = (moduleName) => {
    return user?.company?.enabledModules?.includes(moduleName) || false;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, hasModule, loading, workspace }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
