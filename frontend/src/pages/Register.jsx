import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import client from '../api/client';
import { User, Mail, KeyRound, BadgeCheck, AlertCircle, Loader2 } from 'lucide-react';

const Register = () => {
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student'); // Default role
  const [studentId, setStudentId] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // Prevent double submit
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const registrationPayload = {
        name,
        email,
        password,
        role,
        student_id: role === 'student' ? studentId.trim() : null,
      };

      await client.post('/auth/register', registrationPayload);

      addToast('Account created successfully!', 'success');

      if (role === 'teacher') {
        setSuccess('Registration successful! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        // Automatically log in the student
        const loginResponse = await client.post('/auth/login', {
          email,
          password,
        });

        const { access_token, role: userRole, name: userName, email: userEmail } = loginResponse.data;

        // Perform login inside AuthContext
        await login(access_token, {
          name: userName,
          email: userEmail,
          role: userRole,
        });

        addToast('Automatically logged in. Please register your face profile to complete onboarding.', 'info');

        // Redirect directly to the mandatory face registration flow
        navigate('/register-face');
      }
    } catch (err) {
      console.error(err);
      let errMsg = 'Registration failed. Please review your details and try again.';
      if (err.response && err.response.data && err.response.data.detail) {
        errMsg = err.response.data.detail;
      }
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-screen flex h-screen items-center justify-center bg-[#F8F9FD] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-gray-100 p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#3B5BDB] text-white font-bold text-2xl shadow-sm mb-3">
            FA
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Create Account</h1>
          <p className="text-sm text-gray-400 mt-1">Get started with FaceAttend monitoring</p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-6 flex items-start gap-3 p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm">
            <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 animate-ping"></div>
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all duration-150"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all duration-150"
              />
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Account Type / Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all duration-150 bg-white"
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>

          {/* Conditional Student ID */}
          {role === 'student' && (
            <div className="animate-fadeIn">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Student ID
              </label>
              <div className="relative">
                <BadgeCheck className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
                <input
                  type="text"
                  required={role === 'student'}
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. STU001"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all duration-150"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all duration-150"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-3 bg-[#3B5BDB] hover:bg-[#2F4BB2] disabled:bg-blue-300 text-white font-semibold rounded-xl text-sm shadow-md transition-all duration-150 mt-6"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Registering...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Redirect Link */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-[#3B5BDB] hover:underline font-semibold">
              Sign In
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
};

export default Register;
