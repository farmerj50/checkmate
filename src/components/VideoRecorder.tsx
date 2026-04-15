import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Square, Trash2, Upload, X, AlertCircle, Mic, MicOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  isUploading?: boolean;
}

export default function VideoRecorder({ onRecordingComplete, isUploading }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [_hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize camera
  const initCamera = async () => {
    try {
      setRecordingError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 1920 },
          facingMode: 'user',
        },
        audio: true,
      });
      streamRef.current = stream;
      setHasPermission(true);
      setCameraActive(true);
    } catch (err: any) {
      const message = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Enable it in settings and try again.'
        : 'Unable to access camera. Make sure it\'s not in use.';
      setRecordingError(message);
      setHasPermission(false);
      toast.error(message);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setIsRecording(false);
    setRecordingTime(0);
  };

  // Start recording
  const startRecording = async () => {
    if (!streamRef.current) {
      setRecordingError('Camera not initialized yet. Tap the button to enable camera first.');
      return;
    }

    try {
      setRecordingError(null);
      chunksRef.current = [];
      setRecordingTime(0);

      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp8,opus',
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      // Timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => {
          if (t >= 59) {
            mediaRecorder.stop();
            setIsRecording(false);
            toast.error('Max recording time (60s) reached');
            return t;
          }
          return t + 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error('Failed to start recording');
      setRecordingError(err.message);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setAudioEnabled(!audioEnabled);
    }
  };

  // Clear recording
  const clearRecording = () => {
    setRecordedBlob(null);
    setRecordingTime(0);
  };

  // Upload recording
  const uploadRecording = () => {
    if (recordedBlob) {
      onRecordingComplete(recordedBlob);
      clearRecording();
    }
  };

  // Attach stream to video after camera is activated
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {
        // Browser may block autoplay without user gesture in some cases
      });
    }
  }, [cameraActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const sec = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {/* Camera preview or setup button */}
      {!cameraActive ? (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={initCamera}
          disabled={isUploading}
          className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-3xl border-2 border-dashed border-blue-500/40 hover:border-blue-500/60 bg-blue-500/5 transition-colors disabled:opacity-50"
        >
          <Camera className="w-6 h-6 text-blue-400" />
          <span className="text-sm font-semibold text-blue-200">Open camera to record</span>
          <span className="text-xs text-blue-100/80">Tap to enable your camera and prepare a video clip.</span>
        </motion.button>
      ) : (
        <div className="space-y-3">
          {/* Video preview */}
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-96">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Recording indicator */}
            {isRecording && (
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute top-3 left-3 w-2.5 h-2.5 bg-red-500 rounded-full"
              />
            )}

            {/* Timer */}
            {isRecording && (
              <div className="absolute top-3 left-10 text-red-500 font-mono font-bold text-sm bg-black/60 px-2.5 py-1 rounded-full">
                {formatTime(recordingTime)}
              </div>
            )}
          </div>

          {/* Recording controls */}
          {!recordedBlob ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleAudio}
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {audioEnabled ? (
                    <Mic className="w-4 h-4" />
                  ) : (
                    <MicOff className="w-4 h-4" />
                  )}
                  {audioEnabled ? 'Mic on' : 'Mic off'}
                </motion.button>

                {!isRecording ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startRecording}
                    disabled={isUploading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    Start recording
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={stopRecording}
                    disabled={isUploading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white hover:bg-white/90 text-black font-semibold transition-colors disabled:opacity-50"
                  >
                    <Square className="w-4 h-4" />
                    Stop recording
                  </motion.button>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={stopCamera}
                disabled={isUploading || isRecording}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Turn camera off
              </motion.button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Preview recorded video */}
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-48">
                <video
                  src={URL.createObjectURL(recordedBlob)}
                  controls
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Upload vs retake */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={clearRecording}
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 hover:border-white/40 text-white/70 hover:text-white font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Retake
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={uploadRecording}
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </motion.button>
              </div>

              <p className="text-xs text-white/40 text-center">
                Video size: {(recordedBlob.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      <AnimatePresence>
        {recordingError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{recordingError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info message */}
      {cameraActive && (
        <p className="text-xs text-white/40 text-center">
          {isRecording
            ? 'Recording now — tap Stop recording when finished.'
            : 'Camera is live. Tap Start recording to capture a clip, or Turn camera off to close it.'}
        </p>
      )}
    </div>
  );
}
