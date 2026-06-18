import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { KeyRound, Mail, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await client.post('/auth/login', {
        email,
        password,
      });

      const { access_token, role, name, email: userEmail } = response.data;

      // Authenticate in context - this will fetch face registration status internally for students
      await login(access_token, {
        name,
        email: userEmail,
        role,
      });

      // Redirect based on role and face status
      if (role === 'teacher') {
        navigate('/teacher/dashboard');
      } else {
        // We need to check the updated faceRegistered status from localStorage
        const faceRegistered = localStorage.getItem('faceRegistered') === 'true';
        if (faceRegistered) {
          navigate('/student/dashboard');
        } else {
          navigate('/register-face');
        }
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-screen flex h-screen items-center justify-center bg-[#F8F9FD] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-gray-100 p-8">
        
        {/* Brand/Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#3B5BDB] text-white font-bold text-2xl shadow-sm mb-3">
            FA
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to monitor or mark attendance</p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-6 flex items-start gap-3 p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm animate-shake">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email field */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4.5 w-4.5 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all duration-150"
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3.5 h-4.5 w-4.5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all duration-150"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-3 bg-[#3B5BDB] hover:bg-[#2F4BB2] disabled:bg-blue-300 text-white font-semibold rounded-xl text-sm shadow-md transition-all duration-150"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Redirect Link */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#3B5BDB] hover:underline font-semibold">
              Create Account
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
};

export default Login;
