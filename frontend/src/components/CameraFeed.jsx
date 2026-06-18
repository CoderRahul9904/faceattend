import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Camera, RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * CameraFeed Component
 * 
 * Props:
 *   onPermissionStatus - optional callback when camera permission changes (true/false)
 */
const CameraFeed = forwardRef(({ onPermissionStatus }, ref) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [permissionError, setPermissionError] = useState('');
  const [loading, setLoading] = useState(true);

  // Initialize camera stream
  const startCamera = async () => {
    setLoading(true);
    setPermissionError('');
    
    // Stop any existing streams first
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setLoading(false);
      if (onPermissionStatus) onPermissionStatus(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setPermissionError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera access denied. Please allow camera permissions in your browser settings to continue.'
          : 'Could not access camera. Please make sure no other application is using it.'
      );
      setLoading(false);
      if (onPermissionStatus) onPermissionStatus(false);
    }
  };

  // Start camera on mount and clean up tracks on unmount
  useEffect(() => {
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Expose captureFrame method to parent
  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      return new Promise((resolve) => {
        if (!videoRef.current || !canvasRef.current || !stream) {
          resolve(null);
          return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // Use video element's natural video width/height
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Mirror image for natural user preview
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, width, height);
          
          // Convert to jpeg blob
          canvas.toBlob(
            (blob) => {
              resolve(blob);
            },
            'image/jpeg',
            0.95
          );
        } else {
          resolve(null);
        }
      });
    }
  }));

  return (
    <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-inner border border-gray-800 flex flex-col items-center justify-center">
      {/* Hidden canvas for drawing frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-400 gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#3B5BDB]" />
          <p className="text-xs font-semibold uppercase tracking-wider">Starting camera stream...</p>
        </div>
      )}

      {/* Permission/Error State */}
      {permissionError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 p-6 text-center text-gray-300 gap-4">
          <div className="p-3 bg-red-950/40 text-red-400 rounded-full border border-red-900/30">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div className="max-w-sm">
            <h3 className="text-sm font-bold text-white mb-1">Camera Permission Required</h3>
            <p className="text-xs text-gray-400 leading-relaxed">{permissionError}</p>
          </div>
          <button
            onClick={startCamera}
            className="flex items-center gap-2 px-4 py-2 bg-[#3B5BDB] hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:ring-offset-2 focus:ring-offset-gray-950"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry Camera Access
          </button>
        </div>
      )}

      {/* Live Video element */}
      {!loading && !permissionError && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]" // mirror display for user
        />
      )}

      {/* Overlay indicator */}
      {!loading && !permissionError && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-bold text-gray-300 select-none">
          <Camera className="h-3.5 w-3.5 text-[#00C9A7]" />
          <span>LIVE CAMERA FEED</span>
        </div>
      )}
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';

export default CameraFeed;
