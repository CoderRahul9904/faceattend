import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import FaceRegistration from './pages/FaceRegistration';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import SessionPage from './pages/SessionPage';

// A component to handle root level redirects based on current user state
const RootRedirect = () => {
  const { token, user, faceRegistered } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'teacher') {
    return <Navigate to="/teacher/dashboard" replace />;
  }

  if (user.role === 'student') {
    return faceRegistered ? (
      <Navigate to="/student/dashboard" replace />
    ) : (
      <Navigate to="/register-face" replace />
    );
  }

  return <Navigate to="/login" replace />;
};

function AppContent() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Student Face Registration Route */}
      <Route
        path="/register-face"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <FaceRegistration />
          </ProtectedRoute>
        }
      />

      {/* Protected Student Routes */}
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      {/* Protected Teacher Routes */}
      <Route
        path="/teacher/dashboard"
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/session/:sessionId"
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <SessionPage />
          </ProtectedRoute>
        }
      />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
