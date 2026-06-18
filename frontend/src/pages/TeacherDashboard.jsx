import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import {
  BookOpen,
  Plus,
  Play,
  Download,
  AlertCircle,
  Calendar,
  Clock,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database
} from 'lucide-react';

const TeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [subjects, setSubjects] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [pastSessions, setPastSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Subject Creation Form
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Start Session Modal
  const [selectedSubject, setSelectedSubject] = useState(null); // subject object
  const [scanInterval, setScanInterval] = useState(15); // default 15 seconds
  const [startingSession, setStartingSession] = useState(false);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [subjectsRes, activeRes, sessionsRes] = await Promise.all([
        client.get('/subjects/'),
        client.get('/sessions/active'),
        client.get('/sessions/')
      ]);

      setSubjects(subjectsRes.data);
      setActiveSession(activeRes.data);
      setPastSessions(sessionsRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Create Subject Handler
  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!subjectName.trim() || !subjectCode.trim()) {
      setCreateError('Please fill in all fields.');
      return;
    }

    setCreatingSubject(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      const response = await client.post('/subjects/', {
        name: subjectName.trim(),
        code: subjectCode.trim().toUpperCase()
      });
      
      setSubjects(prev => [...prev, response.data]);
      setSubjectName('');
      setSubjectCode('');
      setCreateSuccess('Subject created successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setCreateSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setCreateError(err.response?.data?.detail || 'Failed to create subject.');
    } finally {
      setCreatingSubject(false);
    }
  };

  // Start Session Handler
  const handleStartSession = async () => {
    if (!selectedSubject) return;
    setStartingSession(true);
    setError('');

    try {
      const response = await client.post('/sessions/start', {
        subject_id: selectedSubject.id,
        scan_interval_seconds: Number(scanInterval)
      });
      
      const sessionId = response.data.session_id;
      // Close modal
      setSelectedSubject(null);
      // Navigate to live session
      navigate(`/teacher/session/${sessionId}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start session.');
    } finally {
      setStartingSession(false);
    }
  };

  // Export Excel Blob Download
  const handleExportExcel = async (sessionId, subjectName, date) => {
    try {
      const response = await client.get(`/attendance/export/${sessionId}`, {
        responseType: 'blob'
      });

      // Create blob download link
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${subjectName.replace(/\s+/g, '_')}_${date}.xlsx`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download Excel report. Please make sure the session is stopped.');
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatTime = (timeStr) => {
    const d = new Date(timeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800">
            Teacher <span className="text-[#3B5BDB]">Dashboard</span>
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Welcome back, {user?.name}. Monitor and manage your lecture sessions.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-[#3B5BDB] hover:border-[#3B5BDB] transition-all self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Global Error Notice */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="font-semibold">Error occurred</p>
            <p className="text-xs text-red-500">{error}</p>
          </div>
        </div>
      )}

      {/* Active Session Alert Banner */}
      {activeSession && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-md p-5 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#00C9A7]" />
              <h3 className="font-bold text-base">Active Lecture Session In Progress</h3>
            </div>
            <p className="text-sm text-blue-100">
              Lecture for <span className="font-bold">{activeSession.subject_name}</span> is currently active (interval: {activeSession.scan_interval_seconds}s).
            </p>
          </div>
          <button
            onClick={() => navigate(`/teacher/session/${activeSession.id}`)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-lg transition-colors shadow-sm shrink-0"
          >
            Go to Live Session
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Grid: Subjects and Create Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Subjects List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
              <BookOpen className="h-4.5 w-4.5 text-[#3B5BDB]" />
              My Subjects
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-500 rounded-full">
              {subjects.length} subjects
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 space-y-3 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-6 bg-gray-100 rounded w-2/3" />
                  <div className="h-8 bg-gray-100 rounded w-full mt-4" />
                </div>
              ))}
            </div>
          ) : subjects.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center flex flex-col items-center justify-center">
              <div className="p-4 bg-blue-50 text-[#3B5BDB] rounded-full mb-3">
                <BookOpen className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-gray-600">No subjects registered yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
                Create a subject using the registration form on the right to start marking attendance.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subjects.map(subject => (
                <div
                  key={subject.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between hover:shadow-md transition-shadow duration-200"
                >
                  <div>
                    <span className="text-[10px] font-mono font-bold text-[#3B5BDB] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                      {subject.code}
                    </span>
                    <h3 className="font-bold text-gray-800 text-lg mt-2 leading-tight">
                      {subject.name}
                    </h3>
                  </div>
                  
                  <div className="mt-5">
                    <button
                      onClick={() => setSelectedSubject(subject)}
                      disabled={!!activeSession}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-colors ${
                        activeSession 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                          : 'bg-[#3B5BDB] hover:bg-blue-700 text-white shadow-sm'
                      }`}
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Start Session
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Subject Column */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4 self-start">
          <h2 className="text-base font-bold text-gray-700 flex items-center gap-1.5">
            <Plus className="h-4.5 w-4.5 text-[#3B5BDB]" />
            Create Subject
          </h2>
          
          <form onSubmit={handleCreateSubject} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Subject Name
              </label>
              <input
                type="text"
                placeholder="e.g. Software Engineering"
                value={subjectName}
                onChange={e => setSubjectName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all"
                required
              />
            </div>
            
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Subject Code
              </label>
              <input
                type="text"
                placeholder="e.g. CS304"
                value={subjectCode}
                onChange={e => setSubjectCode(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all"
                required
              />
            </div>

            {createError && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {createError}
              </p>
            )}

            {createSuccess && (
              <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
                {createSuccess}
              </p>
            )}
            
            <button
              type="submit"
              disabled={creatingSubject}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-[#3B5BDB] hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
            >
              {creatingSubject ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add Subject
            </button>
          </form>
        </div>
      </div>

      {/* Session History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Calendar className="h-4.5 w-4.5 text-[#3B5BDB]" />
          <h2 className="text-sm font-bold text-gray-700">Recent Sessions</h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-5 bg-gray-100 rounded w-full" />
            ))}
          </div>
        ) : pastSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="p-3 bg-gray-50 rounded-full mb-3 text-gray-300">
              <Clock className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No session history available</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
              Once you start and stop active lecture sessions, they will be listed here with options to export results.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">
                    Date
                  </th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">
                    Subject
                  </th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">
                    Interval
                  </th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pastSessions.map(session => (
                  <tr
                    key={session.id}
                    className="hover:bg-gray-50/60 transition-colors duration-100"
                  >
                    <td className="px-5 py-3.5 text-gray-700 font-semibold whitespace-nowrap">
                      {formatDate(session.date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{session.subject_name}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">Session #{session.id}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 font-medium text-xs">
                      {session.scan_interval_seconds}s
                    </td>
                    <td className="px-5 py-3.5">
                      {session.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Completed
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {session.status === 'active' ? (
                        <button
                          onClick={() => navigate(`/teacher/session/${session.id}`)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-700 hover:text-white border border-blue-200 hover:bg-blue-600 rounded-lg transition-colors shadow-sm"
                        >
                          Resume
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleExportExcel(session.id, session.subject_name, session.date)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 bg-white hover:bg-[#3B5BDB] hover:text-white border border-gray-200 hover:border-transparent rounded-lg transition-all shadow-sm"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Excel Report
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Start Session / Interval Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="font-extrabold text-gray-800 text-lg">Configure Lecture Session</h3>
              <p className="text-xs text-gray-400 mt-1">
                Configure scanning interval for <span className="font-bold text-[#3B5BDB]">{selectedSubject.name}</span>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Face Scan Interval
              </label>
              
              <div className="grid grid-cols-4 gap-2">
                {[5, 15, 30, 60].map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setScanInterval(sec)}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                      scanInterval === sec
                        ? 'bg-[#3B5BDB] text-white border-transparent shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
              
              <p className="text-[10px] text-gray-400 italic mt-1 leading-relaxed">
                During the lecture, the system will automatically snap a photo and run AI facial checks at the configured interval rate.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSubject(null)}
                disabled={startingSession}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleStartSession}
                disabled={startingSession}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#3B5BDB] hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
              >
                {startingSession && <RefreshCw className="h-3 w-3 animate-spin" />}
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
