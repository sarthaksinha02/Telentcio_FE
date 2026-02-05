import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import Button from '../components/Button';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans overflow-hidden">
      {/* Essential Branding / Hero Section */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative items-center justify-center overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-slate-900 z-0" />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl z-0 pointer-events-none"
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, -5, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl z-0 pointer-events-none"
        />

        {/* Content */}
        <div className="relative z-10 p-12 text-white max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-8 inline-block">
              <div className="bg-blue-600 rounded-2xl px-6 py-4 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-2xl font-bold tracking-wide">TalentCio</span>
              </div>
            </div>
            <h1 className="text-5xl font-bold mb-6 tracking-tight leading-tight">
              Manage your team <br />
              <span className="text-blue-400">with confidence.</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Streamline attendance, projects, and performance in one unified platform. Designed for modern enterprises.
            </p>

            <div className="space-y-4">
              {[
                "Real-time Attendance Tracking",
                "Seamless Project Management",
                "Dynamic Role-Based Access"
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + (idx * 0.1) }}
                  className="flex items-center space-x-3 text-slate-300"
                >
                  <CheckCircle2 size={20} className="text-blue-500" />
                  <span>{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-4">
              <div className="bg-blue-600 rounded-xl px-4 py-3 flex items-center justify-center text-white font-bold text-lg shadow-lg">TalentCio</div>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Welcome</h2>
            <p className="mt-2 text-slate-500">
              Please enter your credentials to access your account.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Email Input */}
              <div className="relative group">
                <label className={`absolute transition-all duration-200 ${focusedInput === 'email' || email ? '-top-6 left-0 text-xs text-blue-600 font-semibold' : 'top-3 left-10 text-slate-400 text-sm'} pointer-events-none`}>
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className={`h-5 w-5 transition-colors ${focusedInput === 'email' ? 'text-blue-600' : 'text-slate-400'}`} />
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
                    className="block w-full py-3 pl-10 bg-transparent border-b-2 border-slate-200 placeholder-transparent text-slate-900 focus:outline-none focus:border-blue-600 transition-colors sm:text-sm"
                    placeholder="Email"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="relative group pt-4">
                <label className={`absolute transition-all duration-200 ${focusedInput === 'password' || password ? 'top-[-0.5rem] left-0 text-xs text-blue-600 font-semibold' : 'top-7 left-10 text-slate-400 text-sm'} pointer-events-none`}>
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className={`h-5 w-5 transition-colors ${focusedInput === 'password' ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                    className="block w-full py-3 pl-10 bg-transparent border-b-2 border-slate-200 placeholder-transparent text-slate-900 focus:outline-none focus:border-blue-600 transition-colors sm:text-sm"
                    placeholder="Password"
                  />

                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full"
              >
                Sign In
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>


          </form>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <p className="text-xs text-center text-slate-400">
              {/* &copy; 2026 HRCODE Inc. All rights reserved. */}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
