import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { LogIn, Eye, EyeOff, Lock, User, KeyRound } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL}/api/onboarding`;

const PreOnboardingLogin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('login'); // 'login' or 'changePassword'
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenReason, setRegenReason] = useState('');

  const [credentials, setCredentials] = useState({ tempEmployeeId: '', password: '' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState('');

  // Add tenant header like the main app does
  const getHeaders = (authToken) => {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const hostname = window.location.hostname;
    const urlParams = new URLSearchParams(window.location.search);
    let tenant = urlParams.get('tenant');
    const parts = hostname.split('.');
    if (!tenant && hostname.endsWith('localhost') && parts.length > 1 && parts[0] !== 'localhost') {
      tenant = parts[0];
    } else if (!tenant && parts.length > 2) {
      const cloudProviders = ['render.com', 'onrender.com', 'vercel.app', 'herokuapp.com'];
      if (!cloudProviders.some(p => hostname.endsWith(p))) tenant = parts[0];
    }
    if (tenant && !['telentcio', 'telentcio-demo', 'talentcio'].includes(tenant.toLowerCase())) {
      headers['x-tenant-id'] = tenant.toLowerCase();
    }
    return headers;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/login`, credentials, { headers: getHeaders() });
      const { token: authToken, isPasswordChanged, employee } = res.data;

      if (!isPasswordChanged) {
        setToken(authToken);
        setStep('changePassword');
        toast.success('Please change your password to continue');
      } else {
        localStorage.setItem('onboardingToken', authToken);
        localStorage.setItem('onboardingEmployee', JSON.stringify(employee));
        navigate('/pre-onboarding/portal');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      toast.error(msg);
      if (msg.toLowerCase().includes('expired')) {
        setShowRegenModal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRegen = async (e) => {
    e.preventDefault();
    if (!credentials.tempEmployeeId) {
      toast.error('Please enter your Employee ID first');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/request-regeneration`, {
        tempEmployeeId: credentials.tempEmployeeId,
        reason: regenReason
      }, { headers: getHeaders() });
      toast.success(res.data.message || 'Request sent!');
      setShowRegenModal(false);
      setRegenReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/change-password`, { newPassword }, { headers: getHeaders(token) });
      localStorage.setItem('onboardingToken', res.data.token);
      const empData = JSON.parse(localStorage.getItem('onboardingEmployee') || '{}');
      localStorage.setItem('onboardingEmployee', JSON.stringify(empData));
      toast.success('Password changed successfully!', { duration: 2000 });
      navigate('/pre-onboarding/portal');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <Toaster position="top-right" />

      {/* Decorative background elements */}
      <div style={{ position: 'fixed', top: '-100px', right: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-150px', left: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative' }}>
        {/* Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', marginBottom: '16px', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}>
            <User size={28} color="white" />
          </div>
          <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>Pre-Onboarding Portal</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            {step === 'login' ? 'Log in with your temporary credentials' : 'Set your new password'}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(30,41,59,0.8)', backdropFilter: 'blur(20px)', borderRadius: '20px', border: '1px solid rgba(148,163,184,0.15)', padding: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
          {step === 'login' ? (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Employee ID</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    required
                    placeholder="e.g., EMP-2024-0001"
                    value={credentials.tempEmployeeId}
                    onChange={(e) => setCredentials({ ...credentials, tempEmployeeId: e.target.value })}
                    style={{ width: '100%', padding: '14px 14px 14px 44px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '12px', color: '#f1f5f9', fontSize: '15px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(148,163,184,0.2)'}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your temporary password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    style={{ width: '100%', padding: '14px 44px 14px 44px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '12px', color: '#f1f5f9', fontSize: '15px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(148,163,184,0.2)'}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(37,99,235,0.3)', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}>
                <LogIn size={18} />
                {loading ? 'Logging in...' : 'Log In'}
              </button>

              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button type="button" onClick={() => setShowRegenModal(true)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
                  Credentials expired or lost? Request new ones
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePassword}>
              <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '12px', padding: '14px', marginBottom: '24px', border: '1px solid rgba(99,102,241,0.2)' }}>
                <p style={{ margin: 0, color: '#a5b4fc', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <KeyRound size={16} /> You must set a new password before continuing.
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    required
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', padding: '14px 44px 14px 44px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '12px', color: '#f1f5f9', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(148,163,184,0.2)'}
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    required
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ width: '100%', padding: '14px 14px 14px 44px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '12px', color: '#f1f5f9', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(148,163,184,0.2)'}
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(37,99,235,0.3)', opacity: loading ? 0.7 : 1 }}>
                <KeyRound size={18} />
                {loading ? 'Saving...' : 'Set Password & Continue'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '24px' }}>
          © {new Date().getFullYear()} TalentCio. Powered by HRCODE.
        </p>
      </div>

      {showRegenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', border: '1px solid rgba(148,163,184,0.1)' }}>
            <h3 style={{ color: '#f1f5f9', marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Request New Credentials</h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>If your temporary password has expired or you've lost it, you can request HR to generate a new one.</p>

            <form onSubmit={handleRequestRegen}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Your Employee ID</label>
                <input
                  required
                  value={credentials.tempEmployeeId}
                  onChange={(e) => setCredentials({ ...credentials, tempEmployeeId: e.target.value })}
                  placeholder="e.g., EMP-2024-0001"
                  style={{ width: '100%', padding: '12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Reason (Optional)</label>
                <input
                  value={regenReason}
                  onChange={(e) => setRegenReason(e.target.value)}
                  placeholder="e.g., Link expired"
                  style={{ width: '100%', padding: '12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowRegenModal(false)} style={{ padding: '10px 16px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: '8px', fontWeight: '600' }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '8px', fontWeight: '600' }}>Send Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreOnboardingLogin;
