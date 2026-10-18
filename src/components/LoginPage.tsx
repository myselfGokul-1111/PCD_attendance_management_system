import React, { useState } from 'react';
import { UserProfile, PCDEvent } from '../types';
import { PCDStorageService, SSN_ADMIN_CREDENTIALS } from '../services/storage';
import { PcdEmblem } from './PcdEmblem';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  QrCode,
  Calendar,
  Clock,
} from 'lucide-react';

interface LoginPageProps {
  onAdminLoginSuccess: (adminUser: UserProfile) => void;
  onCoordinatorDirectAccess: (coordinatorUser: UserProfile, targetEventId?: string) => void;
  events: PCDEvent[];
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onAdminLoginSuccess,
  onCoordinatorDirectAccess,
  events,
}) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'coordinator'>('admin');

  // Admin form state
  const [adminEmail, setAdminEmail] = useState(SSN_ADMIN_CREDENTIALS.email);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Coordinator form state
  const [coordEmail, setCoordEmail] = useState('');
  const [coordPassword, setCoordPassword] = useState('');
  const [showCoordPassword, setShowCoordPassword] = useState(false);
  const [coordError, setCoordError] = useState<string | null>(null);

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);

    const isValid = PCDStorageService.validateAdminLogin(adminEmail, adminPassword);
    if (isValid) {
      const adminProfile: UserProfile = {
        email: adminEmail.trim().toLowerCase(),
        name: 'SSN PCD Admin',
        role: 'admin',
        department: 'SSN PCD Wing',
      };
      PCDStorageService.setAuthSession(adminProfile);
      onAdminLoginSuccess(adminProfile);
    } else {
      setAdminError('Invalid email or password. Please verify credentials.');
    }
  };

  const handleCoordinatorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCoordError(null);

    const res = PCDStorageService.validateCoordinatorLogin(coordEmail, coordPassword);
    if (res.success && res.user) {
      PCDStorageService.setAuthSession(res.user);
      onCoordinatorDirectAccess(res.user);
    } else {
      setCoordError(res.error || 'Coordinator login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col justify-between p-3 sm:p-6 font-sans">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[450px] h-[450px] bg-red-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 max-w-4xl mx-auto w-full flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <PcdEmblem size={32} />
          <div>
            <div className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
              SSN PCD Activities
              <span className="text-[9px] font-mono font-bold bg-red-600/30 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded">
                Portal
              </span>
            </div>
            <div className="text-[10px] text-neutral-400 font-medium">
              SSN College of Engineering · Extra-Curricular Extension
            </div>
          </div>
        </div>

        <div className="text-[10px] sm:text-xs font-mono text-neutral-400">
          Academic Year 2026-27
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 max-w-md w-full mx-auto my-6">
        <div className="bg-neutral-800/80 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-7 shadow-2xl space-y-5">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-neutral-900/90 p-1 rounded-xl border border-white/5 text-xs font-bold">
            <button
              onClick={() => {
                setActiveTab('admin');
                setAdminError(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Login</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('coordinator');
                setCoordError(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'coordinator'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Coordinator</span>
            </button>
          </div>

          {/* ADMIN FORM */}
          {activeTab === 'admin' ? (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-neutral-900 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-9 py-2 text-xs font-mono bg-neutral-900 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {adminError && (
                <div className="p-2.5 rounded-lg text-xs bg-red-950/70 border border-red-800 text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{adminError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-2 transition-colors min-h-[42px]"
              >
                <span>Sign In as Admin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-[11px] text-center text-neutral-400 pt-1">
                Admin: <code className="text-neutral-300">ssnyrcofficial@gmail.com</code>
              </div>
            </form>
          ) : (
            /* COORDINATOR FORM */
            <form onSubmit={handleCoordinatorSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Coordinator Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="email"
                    required
                    value={coordEmail}
                    onChange={(e) => setCoordEmail(e.target.value)}
                    placeholder="your-email@ssn.edu.in"
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-neutral-900 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type={showCoordPassword ? 'text' : 'password'}
                    required
                    value={coordPassword}
                    onChange={(e) => setCoordPassword(e.target.value)}
                    placeholder="e.g. SSN@Coord2026"
                    className="w-full pl-9 pr-9 py-2 text-xs font-mono bg-neutral-900 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCoordPassword(!showCoordPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showCoordPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {coordError && (
                <div className="p-2.5 rounded-lg text-xs bg-red-950/70 border border-red-800 text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{coordError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-2 transition-colors min-h-[42px]"
              >
                <span>Access Assigned Scanner</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-[11px] text-center text-neutral-400 pt-1 space-y-1">
                <p>Standard coordinator password: <code className="text-neutral-200">SSN@Coord2026</code></p>
                <p className="text-[10px] text-neutral-500">
                  Tip: Coordinators who click their 1-click direct link in their email bypass this login completely!
                </p>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-4xl mx-auto w-full text-center text-[10px] sm:text-xs text-neutral-500 pt-4 border-t border-white/5">
        SSN College of Engineering · PCD Portal (YRC · NSS · NSO)
      </footer>
    </div>
  );
};
