import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, CheckCircle2, Eye, EyeOff, Sparkles, Shield, BarChart3 } from 'lucide-react';

const MotionDiv = motion.div;

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await login(email, password);

      if (data?.passwordResetRequired) {
        toast.success("Identity verification required");
        navigate('/reset-password', { state: { email: data.email, userId: data.userId } });
        return;
      }

      toast.success("Welcome back!");
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: BarChart3, label: 'Smart Analytics', desc: 'Data-driven workforce insights' },
    { icon: Sparkles, label: 'Automated Workflows', desc: 'Streamline HR operations' },
    { icon: Shield, label: '360° People View', desc: 'Complete talent visibility' },
  ];

  return (
    <div className="min-h-screen flex bg-white font-sans overflow-hidden">
      {/* ── Left Hero Panel ── */}
      <div className="hidden lg:flex w-[55%] relative items-center justify-center overflow-hidden">
        {/* Deep navy gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#152244] to-[#1e3a5f]" />

        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Animated gradient orbs */}
        <MotionDiv
          animate={{ scale: [1, 1.15, 1], x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-20 w-[420px] h-[420px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)' }}
        />
        <MotionDiv
          animate={{ scale: [1, 1.2, 1], x: [0, -25, 0], y: [0, 30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          className="absolute bottom-10 right-[-60px] w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)' }}
        />
        <MotionDiv
          animate={{ scale: [1, 1.1, 1], rotate: [0, 8, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 6 }}
          className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 70%)' }}
        />

        {/* Content */}
        <div className="relative z-10 px-14 py-16 max-w-xl w-full">
          {/* Logo */}
          <MotionDiv
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="mb-14"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
                <span className="text-lg font-black text-white tracking-tight">T</span>
              </div>
              <span className="text-xl font-bold text-white tracking-tight">TalentCIO</span>
            </div>
          </MotionDiv>

          {/* Headline */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
          >
            <h1 className="text-[2.75rem] leading-[1.1] font-extrabold text-white tracking-tight mb-5">
              Empower Your
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                Workforce.
              </span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed max-w-md mb-12">
              Streamline HR operations with intelligent talent management — from hiring to performance, all in one platform.
            </p>
          </MotionDiv>

          {/* Feature Cards — Glassmorphic */}
          <div className="space-y-3">
            {features.map((feat, idx) => (
              <MotionDiv
                key={feat.label}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 + idx * 0.12, duration: 0.5 }}
                className="group flex items-center gap-4 px-5 py-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-md hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300 cursor-default"
              >
                <div className="h-9 w-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0 group-hover:bg-blue-500/25 transition-colors">
                  <feat.icon size={18} className="text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white mb-0.5">{feat.label}</div>
                  <div className="text-xs text-slate-500">{feat.desc}</div>
                </div>
              </MotionDiv>
            ))}
          </div>


        </div>
      </div>

      {/* ── Right Login Form Panel ── */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-12 bg-white relative">
        {/* Subtle background accent */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[160px] pointer-events-none opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }}
        />

        <MotionDiv
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="w-full max-w-[400px] relative z-10"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <span className="text-base font-black text-white">T</span>
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">TalentCIO</span>
          </div>

          {/* Heading */}
          <div className="mb-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Welcome back</h2>
            <p className="text-slate-500 text-sm">Sign in to your workspace to continue.</p>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Email */}
            <div>
              <label
                htmlFor="email-address"
                className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className={`h-[18px] w-[18px] transition-colors duration-200 ${focusedInput === 'email' ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                  className={`block w-full py-3.5 pl-11 pr-4 rounded-xl text-sm text-slate-900 bg-slate-50/80 border-2 placeholder:text-slate-400 outline-none transition-all duration-200
                    ${focusedInput === 'email'
                      ? 'border-blue-600 bg-white ring-4 ring-blue-600/10 shadow-sm'
                      : 'border-slate-200/80 hover:border-slate-300'}`}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className={`h-[18px] w-[18px] transition-colors duration-200 ${focusedInput === 'password' ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  className={`block w-full py-3.5 pl-11 pr-12 rounded-xl text-sm text-slate-900 bg-slate-50/80 border-2 placeholder:text-slate-400 outline-none transition-all duration-200
                    ${focusedInput === 'password'
                      ? 'border-blue-600 bg-white ring-4 ring-blue-600/10 shadow-sm'
                      : 'border-slate-200/80 hover:border-slate-300'}`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.01 }}
                whileTap={{ scale: isLoading ? 1 : 0.99 }}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-600/25 hover:shadow-blue-700/30 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-blue-600/20"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </motion.button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-slate-100">
            <p className="text-[11px] text-center text-slate-400 font-medium">
              Powered by <span className="font-semibold text-slate-500">TalentCIO</span> · Secure Enterprise Login
            </p>
          </div>
        </MotionDiv>
      </div>
    </div>
  );
};

export default Login;
