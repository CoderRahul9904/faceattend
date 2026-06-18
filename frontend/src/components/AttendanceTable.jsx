import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, BookOpen, Inbox } from 'lucide-react';

/**
 * AttendanceTable
 * Props:
 *   rows — array of { subject_name, subject_code, date, status, session_id }
 */
const AttendanceTable = ({ rows = [] }) => {
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'
  const [selectedSubject, setSelectedSubject] = useState('all');

  // Build unique subject list for the filter dropdown
  const subjectOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    for (const row of rows) {
      const key = row.subject_code;
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ code: row.subject_code, name: row.subject_name });
      }
    }
    return options;
  }, [rows]);

  // Apply filter then sort
  const displayRows = useMemo(() => {
    let filtered = selectedSubject === 'all'
      ? rows
      : rows.filter(r => r.subject_code === selectedSubject);

    return [...filtered].sort((a, b) => {
      const diff = new Date(a.date) - new Date(b.date);
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [rows, selectedSubject, sortDirection]);

  const toggleSort = () =>
    setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));

  const SortIcon = sortDirection === 'asc' ? ArrowUp : ArrowDown;

  const formatDate = (iso) => {
    const [y, m, d] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Table Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4.5 w-4.5 text-[#3B5BDB]" />
          <h2 className="text-sm font-bold text-gray-700">Attendance History</h2>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 ml-1">
            {displayRows.length} record{displayRows.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Subject Filter */}
          <div className="relative flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all"
            >
              <option value="all">All Subjects</option>
              {subjectOptions.map(opt => (
                <option key={opt.code} value={opt.code}>
                  {opt.name} ({opt.code})
                </option>
              ))}
            </select>
          </div>

          {/* Sort Button */}
          <button
            onClick={toggleSort}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-[#3B5BDB] hover:text-[#3B5BDB] transition-all"
          >
            <SortIcon className="h-3.5 w-3.5" />
            Date {sortDirection === 'asc' ? 'Oldest' : 'Newest'}
          </button>
        </div>
      </div>

      {/* Table */}
      {displayRows.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="p-4 bg-gray-50 rounded-full mb-4">
            <Inbox className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">No attendance records yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            {selectedSubject !== 'all'
              ? 'No records for the selected subject. Try switching the filter.'
              : 'Your attendance will appear here once a teacher runs a session and marks results.'}
          </p>
          {selectedSubject !== 'all' && (
            <button
              onClick={() => setSelectedSubject('all')}
              className="mt-3 text-xs text-[#3B5BDB] hover:underline font-semibold"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Subject
                </th>
                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">
                  <button
                    onClick={toggleSort}
                    className="flex items-center gap-1 hover:text-[#3B5BDB] transition-colors"
                  >
                    Date
                    <SortIcon className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayRows.map((row, idx) => (
                <tr
                  key={`${row.session_id}-${idx}`}
                  className="hover:bg-gray-50/60 transition-colors duration-100"
                >
                  {/* Subject */}
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-semibold text-gray-700 text-sm">{row.subject_name}</p>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">{row.subject_code}</p>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-5 py-3.5 text-gray-600 text-sm whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>

                  {/* Status Pill */}
                  <td className="px-5 py-3.5">
                    {row.status === 'present' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        Present
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                        Absent
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AttendanceTable;
