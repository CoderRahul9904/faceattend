import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { Camera, Upload, AlertCircle, CheckCircle, RefreshCw, ArrowRight, Loader2, CameraOff } from 'lucide-react';

const FaceRegistration = () => {
  const { user, setFaceRegistered } = useAuth();
  const navigate = useNavigate();

  const [activeSlot, setActiveSlot] = useState(0);
  const [slots, setSlots] = useState([null, null, null, null, null]);
  const [method, setMethod] = useState('webcam'); // 'webcam' or 'upload'

  const [cameraError, setCameraError] = useState('');
  const [cameraLoading, setCameraLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const instructions = [
    'Look straight ahead',
    'Turn slightly left',
    'Turn slightly right',
    'Tilt up',
    'Tilt down',
  ];

  // Start webcam stream
  const startCamera = async () => {
    setCameraError('');
    setCameraLoading(true);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraLoading(false);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError('Webcam access was denied or is unavailable on this device. Please check permissions or use the file upload method below.');
      setCameraLoading(false);
    }
  };

  // Stop camera stream helper
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (method === 'webcam') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [method]);

  // Capture photo snapshot
  const capturePhoto = () => {
    if (!videoRef.current || cameraLoading || cameraError) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext('2d');
    // Mirror the captured image to match the mirrored live preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const previewUrl = canvas.toDataURL('image/jpeg');

    canvas.toBlob((blob) => {
      if (!blob) return;

      const newSlots = [...slots];
      newSlots[activeSlot] = {
        previewUrl,
        blob: new File([blob], `capture_${activeSlot + 1}.jpg`, { type: 'image/jpeg' }),
      };
      setSlots(newSlots);

      // Advance to the next empty slot
      const nextEmptyIndex = newSlots.findIndex((slot) => slot === null);
      if (nextEmptyIndex !== -1) {
        setActiveSlot(nextEmptyIndex);
      }
    }, 'image/jpeg');
  };

  // Handle multi-file select input
  const handleFileChange = (e) => {
    setSubmitError('');
    const files = Array.from(e.target.files);
    
    if (files.length !== 5) {
      setSubmitError('Please select exactly 5 images.');
      return;
    }

    const newSlots = files.map((file, idx) => ({
      previewUrl: URL.createObjectURL(file),
      blob: file
    }));

    setSlots(newSlots);
    setSubmitError('');
  };

  // Submit all 5 images to backend
  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitLoading(true);

    const isAllFilled = slots.every((slot) => slot !== null);
    if (!isAllFilled) {
      setSubmitError('All 5 slots must be filled before submitting.');
      setSubmitLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      slots.forEach((slot) => {
        formData.append('files', slot.blob);
      });

      // Submit face encodings
      await client.post('/face/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update state in context & localStorage
      setFaceRegistered(true);
      localStorage.setItem('faceRegistered', 'true');

      // Stop camera tracks before redirect
      stopCamera();

      // Redirect to student dashboard
      navigate('/student/dashboard');
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        setSubmitError(err.response.data.detail);
      } else {
        setSubmitError('Failed to upload face photos. Please ensure your face is clearly visible and try again.');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const isComplete = slots.every((slot) => slot !== null);

  return (
    <div className="min-h-screen bg-[#F8F9FD] py-12 px-4 flex flex-col justify-center items-center">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-md border border-gray-100 p-8">
        
        {/* Header */}
        <div className="text-center mb-8 border-b border-gray-100 pb-6">
          <span className="text-xs bg-blue-50 text-[#3B5BDB] px-3 py-1 rounded-full font-bold uppercase tracking-wider">
            Step 2 of 2: Profile Validation
          </span>
          <h1 className="text-3xl font-extrabold text-gray-800 mt-3">Register Face Profile</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Face registration is mandatory. Complete the 5 guided snapshots or upload 5 files to activate your student account.
          </p>
        </div>

        {/* Errors / Statuses */}
        {submitError && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm animate-shake">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div>
              <span className="font-semibold">Upload failed: </span>
              {submitError}
            </div>
          </div>
        )}

        {/* Mode Selector */}
        <div className="flex gap-4 justify-center mb-8">
          <button
            onClick={() => setMethod('webcam')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
              method === 'webcam'
                ? 'bg-[#3B5BDB] text-white border-transparent shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Camera className="h-4.5 w-4.5" />
            Live Webcam Capture
          </button>
          <button
            onClick={() => setMethod('upload')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
              method === 'upload'
                ? 'bg-[#3B5BDB] text-white border-transparent shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Upload className="h-4.5 w-4.5" />
            File Uploader Fallback
          </button>
        </div>

        {/* Main Work Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Video / Capture Control */}
          <div className="lg:col-span-7 flex flex-col items-center">
            {method === 'webcam' ? (
              <div className="w-full">
                {/* Webcam Panel */}
                <div className="relative aspect-[4/3] w-full rounded-2xl bg-black overflow-hidden shadow-inner border border-gray-200">
                  {cameraLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-[#3B5BDB]" />
                      <span className="text-xs">Initializing webcam stream...</span>
                    </div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-gray-400 gap-3">
                      <CameraOff className="h-10 w-10 text-red-400" />
                      <span className="text-sm font-medium text-red-500">{cameraError}</span>
                    </div>
                  )}

                  {!cameraLoading && !cameraError && (
                    <>
                      {/* Video element - mirrored for intuitive local interaction */}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                      
                      {/* Dashed centering guide oval overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[50%] h-[70%] border-[3px] border-dashed border-white/60 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"></div>
                      </div>

                      {/* Floating Prompt Overlays */}
                      <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold py-2 px-3 rounded-lg text-center border border-white/10">
                        Active Slot {activeSlot + 1}: <span className="text-[#00C9A7] font-bold">{instructions[activeSlot]}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Capture Trigger */}
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={cameraLoading || !!cameraError}
                  className="w-full py-3.5 mt-4 bg-[#3B5BDB] hover:bg-[#2F4BB2] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Camera className="h-5 w-5" />
                  Capture: {instructions[activeSlot]}
                </button>
              </div>
            ) : (
              /* File Upload Panel */
              <div className="w-full border-2 border-dashed border-gray-200 hover:border-[#3B5BDB] rounded-2xl p-10 text-center transition-all bg-gray-50/50">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-base font-semibold text-gray-700">Fallback Photo Upload</h3>
                <p className="text-xs text-gray-400 mt-1 mb-6">
                  Select exactly 5 photos corresponding to each angle
                </p>
                <input
                  type="file"
                  id="file-input"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="file-input"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-xl cursor-pointer shadow-sm transition-all"
                >
                  Choose 5 Images
                </label>
              </div>
            )}
          </div>

          {/* Right: Guided Progress / Slot Thumbnails */}
          <div className="lg:col-span-5 flex flex-col h-full justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span>Capture Positions</span>
                <span className="text-xs font-normal text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                  {slots.filter(s => s !== null).length} / 5 completed
                </span>
              </h3>

              {/* Slot List */}
              <div className="space-y-3">
                {instructions.map((inst, idx) => {
                  const isSlotFilled = slots[idx] !== null;
                  const isActive = activeSlot === idx && method === 'webcam';

                  return (
                    <div
                      key={inst}
                      onClick={() => method === 'webcam' && setActiveSlot(idx)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-150 ${
                        isActive
                          ? 'border-[#3B5BDB] bg-blue-50/30 ring-2 ring-blue-50'
                          : isSlotFilled
                          ? 'border-emerald-100 bg-emerald-50/10'
                          : 'border-gray-100 bg-white hover:bg-gray-50/50'
                      } ${method === 'webcam' ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center ${
                          isSlotFilled
                            ? 'bg-emerald-500 text-white'
                            : isActive
                            ? 'bg-[#3B5BDB] text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{inst}</p>
                          <p className="text-[10px] text-gray-400">
                            {isSlotFilled ? 'Ready' : 'Pending Capture'}
                          </p>
                        </div>
                      </div>

                      {/* Slot preview thumbnail */}
                      {isSlotFilled ? (
                        <div className="relative h-11 w-11 rounded-lg overflow-hidden border border-emerald-200">
                          <img
                            src={slots[idx].previewUrl}
                            alt={inst}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-11 w-11 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                          <Camera className="h-4.5 w-4.5 text-gray-300" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isComplete || submitLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#00C9A7] hover:bg-[#00B294] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing and Registering...
                  </>
                ) : (
                  <>
                    Activate Account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              
              <p className="text-[10px] text-center text-gray-400 mt-2.5">
                Note: All 5 slots must be populated with clear images before account activation.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default FaceRegistration;
