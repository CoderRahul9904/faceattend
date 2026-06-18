import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { token, user, faceRegistered, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F8F9FD]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3B5BDB] border-t-transparent"></div>
      </div>
    );
  }

  // Not logged in
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Student hasn't registered face
  if (user.role === 'student' && !faceRegistered) {
    if (location.pathname !== '/register-face') {
      return <Navigate to="/register-face" replace />;
    }
  }

  // Student has registered face, but tries to access face registration
  if (user.role === 'student' && faceRegistered && location.pathname === '/register-face') {
    return <Navigate to="/student/dashboard" replace />;
  }

  // Check role authorization
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'student') {
      return <Navigate to="/student/dashboard" replace />;
    } else if (user.role === 'teacher') {
      return <Navigate to="/teacher/dashboard" replace />;
    }
  }

  // For /register-face, show full screen onboarding without the sidebar/navbar
  if (location.pathname === '/register-face') {
    return <>{children}</>;
  }

  // Standard dashboard layout
  return (
    <div className="flex h-screen bg-[#F8F9FD] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ProtectedRoute;
