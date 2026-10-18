import React, { useState, useEffect, useRef } from 'react';
import { AttendanceRecord, PCDEvent, Student, UserProfile } from '../types';
import { PCDStorageService } from '../services/storage';
import { playDuplicateWarningBeep, playErrorBeep, playSuccessBeep } from '../utils/audio';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  Clock,
  ArrowLeft,
  Tag,
  Lock,
  Calendar,
  MapPin,
  Users,
  Check,
  Send,
  Mail,
} from 'lucide-react';

interface ScannerViewProps {
  event: PCDEvent;
  currentUser: UserProfile;
  onBack?: () => void;
  onAttendanceUpdated?: () => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  event,
  currentUser,
  onBack,
  onAttendanceUpdated,
}) => {
  const isCoordinator = currentUser.role === 'coordinator';

  // Input & student state
  const [inputCode, setInputCode] = useState('');
  const [identifiedStudent, setIdentifiedStudent] = useState<Student | null>(null);
  const [duplicateRecord, setDuplicateRecord] = useState<AttendanceRecord | null>(null);
  const [remarks, setRemarks] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);

  // Time window status for coordinators
  const timeStatus = PCDStorageService.checkCoordinatorTimeAccess(event);
  const isLocked = isCoordinator && !timeStatus.allowed;

  // Attendance for this event
  const [records, setRecords] = useState<AttendanceRecord[]>(() =>
    PCDStorageService.getAttendanceForEvent(event.id)
  );

  const refreshRecords = () => {
    const list = PCDStorageService.getAttendanceForEvent(event.id);
    setRecords(list);
    if (onAttendanceUpdated) onAttendanceUpdated();
  };

  // Quick remarks options
  const quickRemarks = ['Volunteer Lead', 'Late Entry', 'Organizing Team', 'Special Duty', 'Medical Help'];

  // Barcode detector initialization
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      try {
        // @ts-ignore
        detectorRef.current = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'upc_a'],
        });
      } catch {
        // fallback
      }
    }
  }, []);

  // Camera stream handler
  const startCamera = async () => {
    if (isLocked) return;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setCameraPermission(true);
    } catch (err) {
      setCameraPermission(false);
      setFeedback({ type: 'error', message: 'Camera permission denied or camera unavailable.' });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Frame detection loop
  useEffect(() => {
    let animId: number;
    const scanFrame = async () => {
      if (isCameraActive && videoRef.current && detectorRef.current && videoRef.current.readyState >= 2) {
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0) {
            const rawVal = barcodes[0].rawValue;
            if (rawVal && rawVal !== inputCode) {
              handleCodeInput(rawVal);
            }
          }
        } catch {
          // ignore detection tick
        }
      }
      if (isCameraActive) {
        animId = requestAnimationFrame(scanFrame);
      }
    };

    if (isCameraActive) {
      animId = requestAnimationFrame(scanFrame);
    }
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isCameraActive, inputCode]);

  // Handle scanned or typed code
  const handleCodeInput = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    setInputCode(clean);
    setFeedback(null);

    // Check duplicate first
    const dup = PCDStorageService.checkDuplicateAttendance(event.id, clean);
    if (dup) {
      playDuplicateWarningBeep();
      setDuplicateRecord(dup);
      setIdentifiedStudent(null);
      setFeedback({
        type: 'warning',
        message: `⚠ Duplicate scan! Already recorded at ${new Date(dup.timestamp).toLocaleTimeString()}.`,
      });
      return;
    }

    setDuplicateRecord(null);
    // Instant fast local lookup
    const initialStudent = PCDStorageService.lookupStudent(clean);
    setIdentifiedStudent(initialStudent);

    // If local student has generic name and webhook exists, fetch live real name & wing from sheet
    if (initialStudent && initialStudent.name.startsWith('Student (') && PCDStorageService.getGasWebhookUrl()) {
      try {
        const enrichedStudent = await PCDStorageService.lookupStudentAsync(clean);
        if (enrichedStudent && !enrichedStudent.name.startsWith('Student (')) {
          setIdentifiedStudent(enrichedStudent);
        }
      } catch {
        // keep initialStudent
      }
    }
  };

  // Mark attendance
  const handleMarkAttendance = () => {
    if (isLocked) {
      setFeedback({ type: 'error', message: timeStatus.message });
      return;
    }

    if (!identifiedStudent) {
      handleCodeInput(inputCode);
      return;
    }

    const targetEmail =
      identifiedStudent.email && identifiedStudent.email.includes('@')
        ? identifiedStudent.email
        : identifiedStudent.registerNumber
        ? `${identifiedStudent.registerNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@ssn.edu.in`
        : '';

    const res = PCDStorageService.markAttendance({
      eventId: event.id,
      eventName: event.name,
      digitalId: identifiedStudent.digitalId,
      registerNumber: identifiedStudent.registerNumber,
      name: identifiedStudent.name,
      dept: identifiedStudent.dept,
      year: identifiedStudent.year,
      pcd: identifiedStudent.pcd,
      remarks: remarks.trim(),
      markedBy: currentUser.email,
      markedByName: currentUser.name,
      method: isCameraActive ? 'camera_scan' : 'manual_input',
      studentEmail: targetEmail,
    });

    if (res.success && res.record) {
      playSuccessBeep();
      setFeedback({
        type: 'success',
        message: `✓ Attendance marked: ${identifiedStudent.name} (${identifiedStudent.year} · ${identifiedStudent.pcd})${targetEmail ? ` — Digital receipt sent to ${targetEmail}` : ''}`,
      });
      setInputCode('');
      setIdentifiedStudent(null);
      setRemarks('');
      refreshRecords();
    } else {
      playErrorBeep();
      setFeedback({ type: 'warning', message: res.message });
    }
  };

  // PCD Badge styling
  const getPcdBadge = (pcd: string) => {
    if (pcd === 'YRC') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-red-600 text-white shadow-xs">
          YRC (Youth Red Cross)
        </span>
      );
    }
    if (pcd === 'NSS') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-blue-600 text-white shadow-xs">
          NSS (National Service Scheme)
        </span>
      );
    }
    if (pcd === 'NSO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
          NSO (National Sports Org)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-200 text-neutral-700">
        Not Registered
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Top Bar with Event Info */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && !isCoordinator && (
              <button
                onClick={onBack}
                className="p-1.5 sm:p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg cursor-pointer transition-colors"
                title="Back to Events"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
                  {event.name}
                </h1>
                <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 border border-neutral-200 px-2 py-0.5 rounded">
                  {records.length} Scanned
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  {event.date || 'Scheduled Date'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  {event.startTime || '09:00'} - {event.endTime || '17:00'}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  {event.venue || 'Campus Venue'}
                </span>
              </div>
            </div>
          </div>

          {/* Time access status indicator */}
          <div className="shrink-0">
            {timeStatus.allowed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Scanning Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                {timeStatus.status === 'upcoming' ? 'Locked (Upcoming)' : 'Closed'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lock Banner if Coordinator is outside time window */}
      {isLocked && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-amber-900">Attendance Scanner Locked</h2>
          <p className="text-xs text-amber-800 max-w-md mx-auto">{timeStatus.message}</p>
          <p className="text-[11px] text-amber-700">
            Coordinators can only scan during the event window set by the admin ({event.startTime || '09:00'} to {event.endTime || '17:00'}).
          </p>
        </div>
      )}

      {/* Active Scanner Layout (Disabled if locked) */}
      <div className={`space-y-4 ${isLocked ? 'opacity-40 pointer-events-none' : ''}`}>
        {/* Camera and Input Card */}
        <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Live Attendance Scanner
            </h2>
            <button
              onClick={() => (isCameraActive ? stopCamera() : startCamera())}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                isCameraActive
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800'
              }`}
            >
              {isCameraActive ? (
                <>
                  <CameraOff className="w-3.5 h-3.5" />
                  <span>Stop Camera</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan with Camera</span>
                </>
              )}
            </button>
          </div>

          {/* Camera Viewport */}
          {isCameraActive && (
            <div className="relative w-full max-w-md mx-auto aspect-video sm:aspect-4/3 bg-black rounded-xl overflow-hidden border-2 border-red-600 shadow-md">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Target Aim Box */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-32 sm:w-60 sm:h-40 border-2 border-red-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                  <div className="w-full h-0.5 bg-red-400 animate-pulse mt-14" />
                </div>
              </div>
              <div className="absolute bottom-2 inset-x-0 text-center">
                <span className="text-[10px] font-mono text-white/90 bg-black/60 px-2.5 py-1 rounded-full">
                  Align Barcode / QR Code inside box
                </span>
              </div>
            </div>
          )}

          {/* Manual / Barcode Gun Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-700 block">
              Scan Barcode or Enter Register Number / Digital ID:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCodeInput(inputCode);
                    }
                  }}
                  placeholder="e.g. 2410019 or 3122245001019"
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <button
                onClick={() => handleCodeInput(inputCode)}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Lookup
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : feedback.type === 'warning'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Identified Student Card */}
          {identifiedStudent && (
            <div className="border-2 border-red-200 bg-red-50/40 rounded-xl p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-red-100 pb-2">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900">
                    {identifiedStudent.name}
                  </h3>
                  <div className="text-xs font-mono text-neutral-600">
                    ID: {identifiedStudent.registerNumber || identifiedStudent.digitalId} · {identifiedStudent.dept}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Year Tag */}
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-900 text-white shadow-xs">
                    {identifiedStudent.year}
                  </span>

                  {/* PCD Tag (Red for YRC, Blue for NSS, Green for NSO, Gray for Not Registered) */}
                  {getPcdBadge(identifiedStudent.pcd)}
                </div>
              </div>

              {/* Optional Remarks Section */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-red-600" />
                  <span>Optional Remark (Logged to Sheet):</span>
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Volunteer Lead, Late Entry, Organizing Team..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {quickRemarks.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setRemarks(q)}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                        remarks === q
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      + {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confirm Mark Attendance Button */}
              <button
                onClick={handleMarkAttendance}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-colors min-h-[44px]"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Mark Attendance</span>
              </button>

              <p className="text-[10px] text-neutral-500 text-center flex items-center justify-center gap-1 pt-0.5">
                <Mail className="w-3 h-3 text-red-600 shrink-0" />
                <span>
                  Digital attendance receipt with confirmation code will be dispatched to{' '}
                  <code className="font-mono text-neutral-700">
                    {identifiedStudent.email || `${identifiedStudent.registerNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@ssn.edu.in`}
                  </code>
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Recent Attendance Scans for this Event */}
        <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Recent Event Attendance ({records.length})
            </h2>
            <button
              onClick={refreshRecords}
              className="text-xs text-neutral-500 hover:text-neutral-800 cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-xs">
              No attendance records yet for this event. Scan or enter a student ID above to begin!
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 max-h-[400px] overflow-y-auto">
              {records.slice(0, 50).map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-bold text-neutral-900">{r.name}</div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {r.registerNumber || r.digitalId} · {r.dept}
                      {r.remarks && (
                        <span className="ml-1 text-red-600 font-sans italic">
                          • {r.remarks}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded">
                      {r.year}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded text-white ${
                        r.pcd === 'YRC'
                          ? 'bg-red-600'
                          : r.pcd === 'NSS'
                          ? 'bg-blue-600'
                          : r.pcd === 'NSO'
                          ? 'bg-emerald-600'
                          : 'bg-neutral-500'
                      }`}
                    >
                      {r.pcd === 'NReg' ? 'Not Reg' : r.pcd}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline">
                      {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
