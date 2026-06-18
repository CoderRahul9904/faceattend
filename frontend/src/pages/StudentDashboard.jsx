import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatCard from '../components/StatCard';
import AttendanceTable from '../components/AttendanceTable';
import {
  BarChart2,
  BookOpen,
  Star,
  CheckSquare,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Flatten grouped API response into flat table rows.
 * Input:  [{ subject_id, subject_name, subject_code, sessions: [{session_id, date, status}] }]
 * Output: [{ subject_name, subject_code, date, status, session_id }]
 */
const flattenAttendance = (data) => {
  const rows = [];
  for (const subject of data) {
    for (const session of subject.sessions) {
      rows.push({
        subject_name: subject.subject_name,
        subject_code: subject.subject_code,
        date: session.date,
        status: session.status,
        session_id: session.session_id,
      });
    }
  }
  return rows;
};

/**
 * Compute 4 stat values from the grouped API data.
 */
const computeStats = (data) => {
  if (!data || data.length === 0) {
    return {
      attendanceRate: 'N/A',
      totalSubjects: 0,
      bestSubject: 'N/A',
      bestSubjectRate: null,
      totalAttended: 0,
    };
  }

  let totalSessions = 0;
  let totalPresent = 0;
  let bestSubject = '';
  let bestRate = -1;

  for (const subject of data) {
    const sessions = subject.sessions;
    const presentCount = sessions.filter(s => s.status === 'present').length;
    const rate = sessions.length > 0 ? (presentCount / sessions.length) * 100 : 0;

    totalSessions += sessions.length;
    totalPresent += presentCount;

    if (rate > bestRate) {
      bestRate = rate;
      bestSubject = subject.subject_name;
    }
  }

  const overallRate = totalSessions > 0
    ? Math.round((totalPresent / totalSessions) * 100)
    : 0;

  return {
    attendanceRate: `${overallRate}%`,
    totalSubjects: data.length,
    bestSubject,
    bestSubjectRate: bestRate >= 0 ? `${Math.round(bestRate)}%` : null,
    totalAttended: totalPresent,
  };
};

// ─── Loading Skeleton ────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 animate-pulse">
    <div className="h-12 w-12 rounded-xl bg-gray-100 flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-6 bg-gray-100 rounded w-16" />
      <div className="h-3 bg-gray-100 rounded w-24" />
    </div>
  </div>
);

const SkeletonTable = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse space-y-3">
    <div className="h-4 bg-gray-100 rounded w-40" />
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex gap-4">
        <div className="h-4 bg-gray-100 rounded flex-1" />
        <div className="h-4 bg-gray-100 rounded w-20" />
        <div className="h-4 bg-gray-100 rounded w-16" />
      </div>
    ))}
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

const StudentDashboard = () => {
  const { user } = useAuth();

  const [data, setData] = useState([]);     // raw grouped API response
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await client.get('/attendance/student');
      setData(response.data);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
        'Failed to load attendance data. Please check your connection.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const stats = computeStats(data);
  const tableRows = flattenAttendance(data);

  // ── Stat card definitions ──
  const statCards = [
    {
      icon: BarChart2,
      label: 'Attendance Rate',
      value: stats.attendanceRate,
      accentColor: 'bg-blue-50',
      iconColor: 'text-[#3B5BDB]',
    },
    {
      icon: BookOpen,
      label: 'Total Subjects',
      value: stats.totalSubjects,
      accentColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      icon: Star,
      label: 'Best Subject',
      value: stats.bestSubject || 'N/A',
      accentColor: 'bg-amber-50',
      iconColor: 'text-amber-500',
      sublabel: stats.bestSubjectRate ? `${stats.bestSubjectRate} attendance` : undefined,
    },
    {
      icon: CheckSquare,
      label: 'Sessions Attended',
      value: stats.totalAttended,
      accentColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
  ];

  // ── Render ──
  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800">
            Welcome back, <span className="text-[#3B5BDB]">{user?.name}</span>
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Here's your attendance summary across all subjects.
          </p>
        </div>

        {/* Refresh button */}
        {!loading && (
          <button
            onClick={fetchAttendance}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-[#3B5BDB] hover:border-[#3B5BDB] transition-all self-start sm:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        )}
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Could not load attendance data</p>
            <p className="text-xs mt-0.5 text-red-500">{error}</p>
          </div>
          <button
            onClick={fetchAttendance}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card) => (
              <StatCard
                key={card.label}
                icon={card.icon}
                label={card.label}
                value={card.value}
                accentColor={card.accentColor}
                iconColor={card.iconColor}
                sublabel={card.sublabel}
              />
            ))}
      </div>

      {/* Attendance Table */}
      {loading ? (
        <SkeletonTable />
      ) : (
        <AttendanceTable rows={tableRows} />
      )}

    </div>
  );
};

export default StudentDashboard;
