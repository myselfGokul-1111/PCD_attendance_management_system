import React, { useState } from 'react';
import { PCDEvent, PCDType, UserProfile } from '../types';
import { PCDStorageService } from '../services/storage';
import { ScannerView } from './ScannerView';
import {
  Calendar,
  Clock,
  MapPin,
  Mail,
  Plus,
  Trash2,
  Users,
  Copy,
  Check,
  ChevronRight,
  Send,
  X,
  AlertCircle,
} from 'lucide-react';

interface EventsViewProps {
  events: PCDEvent[];
  currentUser: UserProfile;
  onEventsChanged: () => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  currentUser,
  onEventsChanged,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) => {
  const [activeScanningEvent, setActiveScanningEvent] = useState<PCDEvent | null>(null);
  const [copiedLinkEventId, setCopiedLinkEventId] = useState<string | null>(null);

  // New Event form state
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [targetPcd, setTargetPcd] = useState<'ALL' | PCDType>('ALL');
  const [coordinatorsText, setCoordinatorsText] = useState('');
  const [autoNotifyCoords, setAutoNotifyCoords] = useState(true);

  // Email status feedback
  const [notifyingEventId, setNotifyingEventId] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const coords = coordinatorsText
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c.length > 0 && c.includes('@'));

    const createdEvent = PCDStorageService.addEvent({
      name: name.trim(),
      description: 'PCD Activity scheduled by admin.',
      venue: venue.trim() || 'SSN Campus',
      date,
      startTime,
      endTime,
      targetPcd,
      coordinators: coords,
    });

    // Auto-dispatch coordinator emails if requested
    if (autoNotifyCoords && coords.length > 0) {
      coords.forEach((coordEmail) => {
        const directLink = `${window.location.origin}?event=${createdEvent.id}&coordinator=${encodeURIComponent(coordEmail)}`;
        PCDStorageService.notifyCoordinator({
          coordinatorEmail: coordEmail,
          eventName: createdEvent.name,
          eventDate: createdEvent.date,
          startTime: createdEvent.startTime,
          endTime: createdEvent.endTime,
          venue: createdEvent.venue,
          directLink,
        });
      });
      setEmailNotice({
        type: 'success',
        message: `Event created! Assignment emails queued for ${coords.join(', ')} with direct scanner link, credentials & ${startTime}-${endTime} access duration.`,
      });
      setTimeout(() => setEmailNotice(null), 8000);
    }

    onEventsChanged();
    setIsCreateModalOpen(false);
    // Reset form
    setName('');
    setVenue('');
    setCoordinatorsText('');
  };

  const handleNotifyCoordinatorsForEvent = async (e: React.MouseEvent, evt: PCDEvent) => {
    e.stopPropagation();
    if (!evt.coordinators || evt.coordinators.length === 0) {
      setEmailNotice({
        type: 'info',
        message: 'No coordinator emails are assigned to this event.',
      });
      setTimeout(() => setEmailNotice(null), 4000);
      return;
    }

    setNotifyingEventId(evt.id);
    for (const coordEmail of evt.coordinators) {
      const directLink = `${window.location.origin}?event=${evt.id}&coordinator=${encodeURIComponent(coordEmail)}`;
      await PCDStorageService.notifyCoordinator({
        coordinatorEmail: coordEmail,
        eventName: evt.name,
        eventDate: evt.date,
        startTime: evt.startTime,
        endTime: evt.endTime,
        venue: evt.venue,
        directLink,
      });
    }
    setNotifyingEventId(null);
    setEmailNotice({
      type: 'success',
      message: `✓ Assignment emails sent to ${evt.coordinators.join(', ')} with login credentials, 1-click link, and ${evt.startTime}-${evt.endTime} time limits!`,
    });
    setTimeout(() => setEmailNotice(null), 7000);
  };

  const copyDirectLink = (e: React.MouseEvent, evt: PCDEvent, coordEmail?: string) => {
    e.stopPropagation();
    const origin = window.location.origin;
    const emailParam = coordEmail ? `&coordinator=${encodeURIComponent(coordEmail)}` : '';
    const link = `${origin}?event=${evt.id}${emailParam}`;
    navigator.clipboard.writeText(link);
    setCopiedLinkEventId(evt.id);
    setTimeout(() => setCopiedLinkEventId(null), 2000);
  };

  const handleDeleteEvent = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this event and its attendance?')) {
      PCDStorageService.deleteEvent(eventId);
      if (activeScanningEvent?.id === eventId) {
        setActiveScanningEvent(null);
      }
      onEventsChanged();
    }
  };

  // If an event is selected for scanning, render the live scanner directly inside this tab!
  if (activeScanningEvent) {
    return (
      <ScannerView
        event={activeScanningEvent}
        currentUser={currentUser}
        onBack={() => setActiveScanningEvent(null)}
        onAttendanceUpdated={onEventsChanged}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
            SSN PCD Activities
          </h1>
          <p className="text-xs text-neutral-500 font-medium">
            Schedule events, set coordinator scanning windows, and launch the live scanner.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors shrink-0 min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>Create Event</span>
        </button>
      </div>

      {/* Gmail notification feedback toast */}
      {emailNotice && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 shadow-xs transition-all ${
            emailNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : emailNotice.type === 'error'
              ? 'bg-red-50 text-red-900 border border-red-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{emailNotice.message}</span>
          </div>
          <button
            onClick={() => setEmailNotice(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <div className="bg-white border border-dashed border-neutral-300 rounded-xl p-8 sm:p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-neutral-800">
            No Events Scheduled Yet
          </h2>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            You're starting fresh! Click "Create Event" above to schedule your first PCD activity and assign coordinators.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Event</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => {
            const attCount = PCDStorageService.getAttendanceForEvent(evt.id).length;
            const timeCheck = PCDStorageService.checkCoordinatorTimeAccess(evt);

            return (
              <div
                key={evt.id}
                onClick={() => setActiveScanningEvent(evt)}
                className="bg-white border border-neutral-200 hover:border-red-400 rounded-xl p-3.5 sm:p-4 shadow-xs transition-all cursor-pointer group space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-neutral-900 group-hover:text-red-700 transition-colors">
                        {evt.name}
                      </h3>
                      <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                        {attCount} Scanned
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          timeCheck.allowed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {timeCheck.allowed ? 'Open for Scanning' : 'Time Locked'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                        {evt.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        {evt.startTime} - {evt.endTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        {evt.venue}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                    {/* Copy direct link */}
                    <button
                      onClick={(e) => copyDirectLink(e, evt, evt.coordinators[0])}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      title="Copy Coordinator Direct Link"
                    >
                      {copiedLinkEventId === evt.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    {/* Email coordinators assignment */}
                    {evt.coordinators && evt.coordinators.length > 0 && (
                      <button
                        onClick={(e) => handleNotifyCoordinatorsForEvent(e, evt)}
                        disabled={notifyingEventId === evt.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        title="Send assignment email with credentials & duration limit"
                      >
                        {notifyingEventId === evt.id ? (
                          <span className="text-neutral-500 animate-pulse">Sending...</span>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5 text-red-600" />
                            <span>Email Coords</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDeleteEvent(e, evt.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                      title="Delete Event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1 px-3 py-1.5 bg-red-600 group-hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs">
                      <span>Open Scanner</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Coordinators assigned */}
                {evt.coordinators && evt.coordinators.length > 0 && (
                  <div className="pt-2 border-t border-neutral-100 flex items-center gap-1.5 text-[11px] text-neutral-500 overflow-x-auto">
                    <Users className="w-3 h-3 text-neutral-400 shrink-0" />
                    <span className="font-semibold text-neutral-600 shrink-0">Coordinators:</span>
                    {evt.coordinators.map((c) => (
                      <span
                        key={c}
                        className="bg-neutral-50 border border-neutral-200 px-1.5 py-0.5 rounded font-mono text-[10px] text-neutral-700 whitespace-nowrap"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Event Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-base font-black text-neutral-900">Create New PCD Event</h2>
                <p className="text-xs text-neutral-500">
                  Assign date, time limit window, and coordinator emails.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">Event Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Blood Donation Camp 2026 / Coastal Clean-up"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Venue *</label>
                <input
                  type="text"
                  required
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. SSN Main Auditorium / Ground"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">End Time *</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Assigned Coordinator Emails (Comma separated)
                </label>
                <input
                  type="text"
                  value={coordinatorsText}
                  onChange={(e) => setCoordinatorsText(e.target.value)}
                  placeholder="e.g. gokul2470019@ssn.edu.in, coord2@ssn.edu.in"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 font-mono text-xs"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Coordinators get access to the live scanner strictly during the event time window ({startTime} - {endTime}).
                </p>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Target Wing</label>
                <select
                  value={targetPcd}
                  onChange={(e) => setTargetPcd(e.target.value as any)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
                >
                  <option value="ALL">ALL (YRC, NSS, NSO)</option>
                  <option value="YRC">YRC (Youth Red Cross)</option>
                  <option value="NSS">NSS (National Service Scheme)</option>
                  <option value="NSO">NSO (National Sports Org)</option>
                </select>
              </div>

              {/* Gmail Notification Option */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5 space-y-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoNotifyCoords}
                    onChange={(e) => setAutoNotifyCoords(e.target.checked)}
                    className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-neutral-800 block text-xs">
                      📧 Auto-email coordinators via Gmail
                    </span>
                    <span className="text-[11px] text-neutral-500 block leading-tight">
                      Dispatches direct 1-click scanner link, username, password (<code className="font-mono text-neutral-700">SSN@Coord2026</code>), and access time limits ({startTime} - {endTime}).
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100 rounded-lg font-bold text-neutral-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Create & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
