import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import CameraFeed from '../components/CameraFeed';
import {
  Clock,
  Play,
  Square,
  ChevronLeft,
  RefreshCw,
  AlertCircle,
  Activity,
  CheckCircle,
  HelpCircle,
  XCircle,
  UserCheck
} from 'lucide-react';

const SessionPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Refs
  const cameraRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // State
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [scanResults, setScanResults] = useState({}); // student_id -> { detected, confidence }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Timer & Counters
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [scanCount, setScanCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [scanError, setScanError] = useState('');

  // Dialog State
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [stoppingSession, setStoppingSession] = useState(false);

  // Fetch session and student info on mount
  const fetchSessionAndStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sessionsRes, studentsRes] = await Promise.all([
        client.get('/sessions/'),
        client.get('/students')
      ]);

      const foundSession = sessionsRes.data.find(s => s.id === Number(sessionId));
      
      if (!foundSession) {
        setError('Session not found.');
        return;
      }

      if (foundSession.status === 'completed') {
        alert('This session has already been completed.');
        navigate('/teacher/dashboard');
        return;
      }

      setSession(foundSession);
      setStudents(studentsRes.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to fetch session metadata.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, navigate]);

  useEffect(() => {
    fetchSessionAndStudents();
  }, [fetchSessionAndStudents]);

  // Elapsed Timer effect
  useEffect(() => {
    if (!session || session.status !== 'active') return;

    // start_time from API is UTC, we parse it
    const start = new Date(session.start_time).getTime();

    const intervalId = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, now - start);

      const secs = Math.floor(diff / 1000) % 60;
      const mins = Math.floor(diff / 60000) % 60;
      const hrs = Math.floor(diff / 3600000);

      const formatted = [
        hrs > 0 ? String(hrs).padStart(2, '0') : null,
        String(mins).padStart(2, '0'),
        String(secs).padStart(2, '0')
      ].filter(Boolean).join(':');

      setElapsedTime(formatted);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [session]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  // Trigger one scan tick
  const triggerScan = async () => {
    if (!cameraRef.current) return;
    setScanError('');

    try {
      const blob = await cameraRef.current.captureFrame();
      if (!blob) {
        setScanError('Failed to capture frame from webcam. Checking feed...');
        return;
      }

      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      const response = await client.post(`/sessions/${sessionId}/scan`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Parse results: list of { student_id, student_name, detected, confidence }
      const newResults = {};
      response.data.forEach(item => {
        newResults[item.student_id] = {
          detected: item.detected,
          confidence: item.confidence
        };
      });

      setScanResults(newResults);
      setScanCount(prev => prev + 1);
      setLastScanTime(new Date());
    } catch (err) {
      console.error('Scan error:', err);
      setScanError(err.response?.data?.detail || 'Scan processing failed. Retrying on next interval...');
      // We do NOT stop the interval because a temporary network glitch or missing face 
      // in one frame should not crash the lecture attendance flow.
    }
  };

  // Start scanning interval loop
  const startScanning = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanError('');
    
    // Trigger first scan immediately
    triggerScan();

    // Set up recurring interval
    const intervalMs = session.scan_interval_seconds * 1000;
    scanIntervalRef.current = setInterval(() => {
      triggerScan();
    }, intervalMs);
  };

  // Stop scanning interval loop
  const stopScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
  };

  // Stop Session API handler
  const handleStopSession = async () => {
    setStoppingSession(true);
    stopScanning(); // make sure scanner is stopped

    try {
      await client.post('/sessions/stop', {
        session_id: Number(sessionId)
      });
      
      // Close confirmation dialog
      setShowStopConfirm(false);
      
      // Redirect with alert or custom message
      alert('Session stopped successfully. Final attendance has been computed!');
      navigate('/teacher/dashboard');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to stop session properly.');
      setStoppingSession(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500 gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-[#3B5BDB]" />
        <p className="text-sm font-semibold">Loading session details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4 text-center">
        <div className="p-3 bg-red-50 text-red-500 rounded-full inline-block">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-800">Error Loading Session</h3>
          <p className="text-xs text-gray-500 mt-1">{error}</p>
        </div>
        <button
          onClick={() => navigate('/teacher/dashboard')}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#3B5BDB] hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors mx-auto shadow-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar / Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isScanning) {
                if (confirm('Scanning is active. Are you sure you want to exit to the dashboard? Scanning will stop.')) {
                  stopScanning();
                  navigate('/teacher/dashboard');
                }
              } else {
                navigate('/teacher/dashboard');
              }
            }}
            className="p-2 border border-gray-100 hover:bg-gray-50 hover:border-[#3B5BDB] hover:text-[#3B5BDB] rounded-lg transition-all text-gray-500"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <div>
            <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
              LIVE SESSION #{session?.id}
            </span>
            <h1 className="text-lg font-extrabold text-gray-800 mt-1">
              {session?.subject_name}
            </h1>
          </div>
        </div>

        {/* Dynamic Stats Row */}
        <div className="flex items-center gap-4 flex-wrap text-sm text-gray-600">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg">
            <Clock className="h-4 w-4 text-[#3B5BDB]" />
            <div>
              <p className="text-[9px] text-gray-400 font-bold uppercase leading-none">ELAPSED TIME</p>
              <p className="font-mono font-bold text-gray-700 mt-0.5">{elapsedTime}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg">
            <Activity className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-[9px] text-gray-400 font-bold uppercase leading-none">SCANS RUN</p>
              <p className="font-mono font-bold text-gray-700 mt-0.5">{scanCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg">
            <UserCheck className="h-4 w-4 text-emerald-500" />
            <div>
              <p className="text-[9px] text-gray-400 font-bold uppercase leading-none">INTERVAL RATE</p>
              <p className="font-mono font-bold text-gray-700 mt-0.5">{session?.scan_interval_seconds}s</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Camera stream + Controls */}
        <div className="lg:col-span-2 space-y-4">
          <CameraFeed ref={cameraRef} />
          
          {/* Controls Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm">
              {isScanning ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 border border-red-100 rounded-full text-xs font-bold">
                  <span className="h-2 w-2 bg-red-600 rounded-full animate-ping" />
                  LIVE SCANNING ACTIVE
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 text-gray-500 border border-gray-200 rounded-full text-xs font-bold">
                  <span className="h-2 w-2 bg-gray-400 rounded-full" />
                  SCANNER PAUSED
                </div>
              )}

              {lastScanTime && (
                <span className="text-xs text-gray-400 font-medium">
                  Last Checked: {lastScanTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {!isScanning ? (
                <button
                  onClick={startScanning}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2.5 px-5 bg-[#3B5BDB] hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Start Scanning
                </button>
              ) : (
                <button
                  onClick={stopScanning}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2.5 px-5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  <Square className="h-4 w-4 fill-current" />
                  Pause Scanning
                </button>
              )}
              
              <button
                onClick={() => setShowStopConfirm(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2.5 px-5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                <XCircle className="h-4 w-4" />
                End Session
              </button>
            </div>
          </div>

          {/* Sub Scan errors (like frame failed/no face found alerts) */}
          {scanError && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl text-xs">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
              <p className="font-medium">{scanError}</p>
            </div>
          )}
        </div>

        {/* Live Scan Results panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-[500px]">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              <Activity className="h-4.5 w-4.5 text-[#3B5BDB]" />
              Live Scan Results
            </h2>
            <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
              {students.length} students
            </span>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
            {students.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs">
                No students registered in database.
              </div>
            ) : (
              students.map(student => {
                const result = scanResults[student.student_id];
                
                // Indicators logic:
                // - Gray: no scans run yet (result is undefined)
                // - Green: detected is true
                // - Red: detected is false
                let dotColor = 'bg-gray-300';
                let textColor = 'text-gray-400 bg-gray-50 border-gray-200';
                let statusLabel = 'Not Scanned';
                
                if (result) {
                  if (result.detected) {
                    dotColor = 'bg-emerald-500 animate-pulse';
                    textColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                    statusLabel = `Detected (${Math.round(result.confidence * 100)}%)`;
                  } else {
                    dotColor = 'bg-red-500';
                    textColor = 'text-red-600 bg-red-50 border-red-100';
                    statusLabel = 'Not Detected';
                  }
                }

                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 border border-gray-100 hover:border-gray-200 rounded-xl transition-all duration-150"
                  >
                    <div>
                      <h4 className="font-bold text-gray-700 text-xs">{student.name}</h4>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{student.student_id}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${textColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* End Session Confirmation Modal */}
      {showStopConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 text-red-600">
              <AlertCircle className="h-6 w-6 shrink-0 mt-0.5 text-red-500" />
              <div>
                <h3 className="font-extrabold text-gray-800 text-lg">Stop Lecture Session?</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Ending the session will stop camera scanning, compute final student present/absent statuses, and save the attendance ledger.
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-[11px] text-yellow-800 leading-relaxed font-semibold">
              Warning: This action is permanent. You will not be able to resume scanning for this session code once stopped.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStopConfirm(false)}
                disabled={stoppingSession}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleStopSession}
                disabled={stoppingSession}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
              >
                {stoppingSession && <RefreshCw className="h-3 w-3 animate-spin" />}
                Stop & Save Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionPage;
