import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, ShieldCheck, ArrowRight, Loader2, Lock, RefreshCw, CheckCircle2 } from 'lucide-react';
import Button from '../components/Button';

const MotionDiv = motion.div;

const OTPReset = () => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [step, setStep] = useState(1); // 1: OTP, 2: New Password, 3: Success
    const [timer, setTimer] = useState(60);

    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email;

    useEffect(() => {
        if (!email) {
            toast.error("Invalid session. Please login again.");
            navigate('/login');
        }
    }, [email, navigate]);

    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer(prev => prev - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleOtpChange = (element, index) => {
        if (isNaN(element.value)) return false;

        setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

        // Focus next input
        if (element.nextSibling) {
            element.nextSibling.focus();
        }
    };

    const handleResendOtp = async () => {
        setIsResending(true);
        try {
            await api.post('/auth/resend-otp', { email });
            toast.success("A new OTP has been sent to your email.");
            setTimer(60);
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to resend OTP");
        } finally {
            setIsResending(false);
        }
    };

    const handleVerifyOtp = (e) => {
        e.preventDefault();
        const otpCode = otp.join('');
        if (otpCode.length < 6) {
            toast.error("Please enter the full 6-digit OTP");
            return;
        }
        setStep(2);
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/auth/verify-otp-reset', {
                email,
                otp: otp.join(''),
                newPassword
            });
            setStep(3);
            toast.success("Password reset successfully!");
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to reset password");
            if (error.response?.status === 400) {
                setStep(1); // Go back to OTP if it was invalid
            }
        } finally {
            setIsLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
        exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <MotionDiv
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl shadow-slate-200/60 p-10 border border-slate-100"
            >
                <div className="flex justify-center mb-8">
                    <div className="bg-blue-600 rounded-2xl p-4 shadow-lg shadow-blue-500/20">
                        {step === 1 ? <KeyRound className="text-white" size={32} /> : 
                         step === 2 ? <ShieldCheck className="text-white" size={32} /> : 
                         <CheckCircle2 className="text-white" size={32} />}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <MotionDiv
                            key="otp-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="text-center">
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Verify Identity</h1>
                                <p className="text-slate-500 mt-2">
                                    We've sent a 6-digit verification code to <br />
                                    <span className="font-semibold text-slate-800">{email}</span>
                                </p>
                            </div>

                            <form onSubmit={handleVerifyOtp} className="space-y-8">
                                <div className="flex justify-center gap-2">
                                    {otp.map((data, index) => (
                                        <input
                                            key={index}
                                            type="text"
                                            maxLength="1"
                                            value={data}
                                            onChange={e => handleOtpChange(e.target, index)}
                                            onFocus={e => e.target.select()}
                                            className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                                        />
                                    ))}
                                </div>

                                <Button type="submit" className="w-full group">
                                    Verify OTP
                                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </form>

                            <div className="text-center space-y-4">
                                <p className="text-sm text-slate-400">
                                    Didn't receive the code? {timer > 0 ? (
                                        <span className="text-blue-600 font-medium">Resend in {timer}s</span>
                                    ) : (
                                        <button 
                                            onClick={handleResendOtp}
                                            disabled={isResending}
                                            className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1"
                                        >
                                            {isResending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                            Resend Now
                                        </button>
                                    )}
                                </p>
                                <button 
                                    onClick={() => navigate('/login')}
                                    className="text-slate-500 text-sm hover:text-slate-800 transition-colors"
                                >
                                    Back to Login
                                </button>
                            </div>
                        </MotionDiv>
                    )}

                    {step === 2 && (
                        <MotionDiv
                            key="password-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="text-center">
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Security Update</h1>
                                <p className="text-slate-500 mt-2">
                                    Your identity is verified. Please set a strong new password to secure your account.
                                </p>
                            </div>

                            <form onSubmit={handleResetPassword} className="space-y-5">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">New Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="password"
                                            required
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all text-slate-900"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Confirm Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all text-slate-900"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <Button 
                                    type="submit" 
                                    isLoading={isLoading} 
                                    className="w-full group !mt-8"
                                >
                                    Update Password & Login
                                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </form>
                        </MotionDiv>
                    )}

                    {step === 3 && (
                        <MotionDiv
                            key="success-step"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center space-y-6 py-4"
                        >
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                <CheckCircle2 size={48} />
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900">All Set!</h1>
                            <p className="text-slate-500 max-w-sm mx-auto">
                                Your password has been successfully updated. You are now being redirected to the login page.
                            </p>
                            <div className="flex justify-center">
                                <Loader2 className="animate-spin text-blue-600" size={24} />
                            </div>
                        </MotionDiv>
                    )}
                </AnimatePresence>
            </MotionDiv>
        </div>
    );
};

export default OTPReset;
