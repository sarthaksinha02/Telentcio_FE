import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const Register = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(formData);
      toast.success('Registration Successful');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration Failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-lg border border-slate-700">
        <h2 className="text-3xl font-bold text-white mb-2 text-center">Start Your Journey</h2>
        <p className="text-slate-400 text-center mb-6">Create your company account</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Company Name</label>
            <input name="companyName" required onChange={handleChange} className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">First Name</label>
              <input name="firstName" required onChange={handleChange} className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Last Name</label>
              <input name="lastName" onChange={handleChange} className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Work Email</label>
            <input name="email" type="email" required onChange={handleChange} className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
            <input name="password" type="password" required onChange={handleChange} className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white outline-none" />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg text-white font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all mt-4"
          >
            Create Account
          </button>
        </form>
         <p className="mt-4 text-center text-slate-400 text-sm">
          Already have an account? <Link to="/login" className="text-cyan-400 hover:text-cyan-300">Log In</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
