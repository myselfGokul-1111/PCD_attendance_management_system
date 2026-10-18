import React from 'react';
import { UserProfile } from '../types';
import { PcdEmblem } from './PcdEmblem';
import { Calendar, Database, BarChart3, LogOut, Settings2, Plus, Clock } from 'lucide-react';

interface NavbarProps {
  currentTab: 'events' | 'database' | 'analytics';
  setCurrentTab: (tab: 'events' | 'database' | 'analytics') => void;
  currentUser: UserProfile;
  activeEventName?: string;
  onOpenNewEvent: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  activeEventName,
  onOpenNewEvent,
  onOpenSettings,
  onLogout,
}) => {
  const isCoordinator = currentUser.role === 'coordinator';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-xs">
      {/* Top PCD colored accent line: Red (YRC), Blue (NSS), Green (NSO) */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-blue-600 to-emerald-600 w-full" />

      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <PcdEmblem size={28} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-extrabold tracking-tight text-neutral-900 whitespace-nowrap">
                  SSN PCD Activities
                </span>
                <span className="hidden xs:inline-flex text-[9px] font-mono font-bold bg-neutral-100 text-neutral-700 border border-neutral-200 px-1.5 py-0.5 rounded">
                  {isCoordinator ? 'Coordinator' : 'Admin'}
                </span>
              </div>
              <div className="text-[10px] text-neutral-500 font-medium truncate max-w-[160px] sm:max-w-none">
                {isCoordinator ? (activeEventName || 'Event Attendance Scanner') : 'YRC · NSS · NSO · NReg'}
              </div>
            </div>
          </div>

          {/* Center Tabs: Admin only */}
          {!isCoordinator ? (
            <nav className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setCurrentTab('events')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[38px] ${
                  currentTab === 'events'
                    ? 'bg-red-50 text-red-700 font-bold border border-red-200'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-red-600" />
                <span>Events</span>
              </button>

              <button
                onClick={() => setCurrentTab('database')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[38px] ${
                  currentTab === 'database'
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-blue-600" />
                <span>Database</span>
              </button>

              <button
                onClick={() => setCurrentTab('analytics')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[38px] ${
                  currentTab === 'analytics'
                    ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Analytics</span>
              </button>
            </nav>
          ) : (
            <div className="flex items-center gap-1 text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 px-2 py-1 rounded-md">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="font-mono text-[11px] truncate max-w-[120px] sm:max-w-none">
                {currentUser.email}
              </span>
            </div>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {!isCoordinator && (
              <>
                <button
                  onClick={onOpenNewEvent}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer min-h-[36px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Event</span>
                </button>

                <button
                  onClick={onOpenSettings}
                  title="Google Sheets Webhook & Settings"
                  className="p-2 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-2 text-neutral-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
