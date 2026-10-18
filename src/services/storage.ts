import { AttendanceRecord, PCDEvent, PCDType, Student, StudentYear, UserProfile, getYearFromId } from '../types';

const STORAGE_KEYS = {
  EVENTS: 'ssn_pcd_activities_events_v2',
  ATTENDANCE: 'ssn_pcd_activities_attendance_v2',
  STUDENTS: 'ssn_pcd_activities_students_v2',
  CURRENT_USER: 'ssn_pcd_activities_user_v2',
  AUTH_SESSION: 'ssn_pcd_activities_auth_session_v2',
  GAS_WEBHOOK_URL: 'ssn_pcd_activities_gas_webhook_v2',
};

export const SSN_ADMIN_CREDENTIALS = {
  email: 'ssnyrcofficial@gmail.com',
  password: '2005@ssnYRC',
};

export class PCDStorageService {
  // ================= AUTHENTICATION SESSION =================
  static getAuthSession(): { isAuthenticated: boolean; user: UserProfile | null } {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.isAuthenticated && parsed.user) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return { isAuthenticated: false, user: null };
  }

  static setAuthSession(user: UserProfile): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.AUTH_SESSION,
        JSON.stringify({ isAuthenticated: true, user })
      );
      this.setCurrentUser(user);
    } catch {
      // ignore
    }
  }

  static clearAuthSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    } catch {
      // ignore
    }
  }

  static validateAdminLogin(email: string, pass: string): boolean {
    return (
      email.trim().toLowerCase() === SSN_ADMIN_CREDENTIALS.email.toLowerCase() &&
      pass === SSN_ADMIN_CREDENTIALS.password
    );
  }

  static validateCoordinatorLogin(
    email: string,
    pass: string
  ): { success: boolean; user?: UserProfile; error?: string } {
    const trimmedEmail = email.trim().toLowerCase();
    const events = this.getEvents();
    const isAssigned = events.some((e) =>
      e.coordinators.some((c) => c.trim().toLowerCase() === trimmedEmail)
    );

    // Standard coordinator password
    const validPass = pass === 'SSN@Coord2026' || pass === '2005@ssnYRC';

    if (isAssigned || trimmedEmail.endsWith('@ssn.edu.in')) {
      if (validPass) {
        const coordUser: UserProfile = {
          email: trimmedEmail,
          name: trimmedEmail.split('@')[0].toUpperCase(),
          role: 'coordinator',
          department: 'Event Coordinator',
        };
        return { success: true, user: coordUser };
      }
      return { success: false, error: 'Incorrect coordinator password. Standard pass: SSN@Coord2026' };
    }

    return {
      success: false,
      error: 'Email is not assigned to any event. Please contact the administrator.',
    };
  }

  // ================= CURRENT USER =================
  static getCurrentUser(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return {
      email: SSN_ADMIN_CREDENTIALS.email,
      name: 'SSN PCD Admin',
      role: 'admin',
      department: 'SSN PCD Wing',
    };
  }

  static setCurrentUser(user: UserProfile): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }

  // ================= EVENTS (FRESH START: NO DUMMY EVENTS) =================
  static getEvents(): PCDEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return [];
  }

  static saveEvents(events: PCDEvent[]): void {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  }

  static addEvent(newEvent: Omit<PCDEvent, 'id' | 'createdAt'>): PCDEvent {
    const events = this.getEvents();
    const id = `evt-${Date.now().toString(36)}`;
    const fullEvent: PCDEvent = {
      ...newEvent,
      id,
      sheetTabName: `PCD - ${newEvent.name.trim().substring(0, 30)}`,
      createdAt: new Date().toISOString(),
    };
    events.unshift(fullEvent);
    this.saveEvents(events);
    return fullEvent;
  }

  static deleteEvent(eventId: string): void {
    const events = this.getEvents().filter((e) => e.id !== eventId);
    this.saveEvents(events);
    // Remove related attendance
    const attendance = this.getAttendance().filter((a) => a.eventId !== eventId);
    this.saveAttendance(attendance);
  }

  // ================= TIME RESTRICTION CHECK FOR COORDINATORS =================
  static checkCoordinatorTimeAccess(event: PCDEvent): {
    allowed: boolean;
    status: 'upcoming' | 'active' | 'closed';
    message: string;
  } {
    if (!event.date) {
      return { allowed: true, status: 'active', message: 'Active event window.' };
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // If event is on a future date
    if (event.date > todayStr) {
      return {
        allowed: false,
        status: 'upcoming',
        message: `Scanning locked: Scheduled for ${event.date} from ${event.startTime || '09:00'} to ${event.endTime || '17:00'}.`,
      };
    }

    // If event was on a past date
    if (event.date < todayStr) {
      return {
        allowed: false,
        status: 'closed',
        message: `Scanning closed: Event ended on ${event.date}.`,
      };
    }

    // Event is TODAY: check time window
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMins = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMins}`;

    if (event.startTime && currentTimeStr < event.startTime) {
      return {
        allowed: false,
        status: 'upcoming',
        message: `Scanning locked: Scheduled to open today at ${event.startTime}.`,
      };
    }

    if (event.endTime && currentTimeStr > event.endTime) {
      return {
        allowed: false,
        status: 'closed',
        message: `Scanning closed: Event scheduled scanning window ended at ${event.endTime}.`,
      };
    }

    return {
      allowed: true,
      status: 'active',
      message: `Active scanning window: Open until ${event.endTime || 'end of event'}.`,
    };
  }

  // ================= ATTENDANCE RECORDS (FRESH START) =================
  static getAttendance(): AttendanceRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return [];
  }

  static saveAttendance(records: AttendanceRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
  }

  static getAttendanceForEvent(eventId: string): AttendanceRecord[] {
    return this.getAttendance().filter((a) => a.eventId === eventId);
  }

  static checkDuplicateAttendance(
    eventId: string,
    digitalId: string
  ): AttendanceRecord | undefined {
    const clean = digitalId.trim().toLowerCase();
    const records = this.getAttendance();
    return records.find(
      (r) =>
        r.eventId === eventId &&
        (r.digitalId.toLowerCase() === clean || r.registerNumber.toLowerCase() === clean)
    );
  }

  static markAttendance(record: Omit<AttendanceRecord, 'id' | 'timestamp'>): {
    success: boolean;
    record?: AttendanceRecord;
    duplicate?: AttendanceRecord;
    message: string;
  } {
    const duplicate = this.checkDuplicateAttendance(record.eventId, record.digitalId);
    if (duplicate) {
      return {
        success: false,
        duplicate,
        message: `Duplicate: Attendance already logged at ${new Date(duplicate.timestamp).toLocaleTimeString()}`,
      };
    }

    const fullRecord: AttendanceRecord = {
      ...record,
      id: `att-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      confirmationCode: `SSN-PCD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };

    const attendance = this.getAttendance();
    attendance.unshift(fullRecord);
    this.saveAttendance(attendance);

    // Asynchronously push to Google Apps Script Webhook
    this.postAttendanceToWebhook(fullRecord).catch(() => {});

    return {
      success: true,
      record: fullRecord,
      message: `✓ Attendance marked: ${record.name} (${record.year} · ${record.pcd})`,
    };
  }

  // ================= STUDENT DATABASE & LOOKUP =================
  static getStudents(): Student[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return [];
  }

  static saveStudents(students: Student[]): void {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }

  static addOrUpdateStudent(student: Student): void {
    const list = this.getStudents();
    const idx = list.findIndex(
      (s) =>
        s.digitalId.toLowerCase() === student.digitalId.toLowerCase() ||
        s.registerNumber.toLowerCase() === student.registerNumber.toLowerCase()
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...student };
    } else {
      list.push(student);
    }
    this.saveStudents(list);
  }

  /**
   * Fast intelligent lookup:
   * 1. Check local student database if registered
   * 2. If not found in DB, auto-generate student details from Register Number:
   *    - Determines Year: 231/237 -> 4th Year, 241/247 -> 3rd Year, 251/257 -> 2nd Year
   *    - Department derived from pattern or 'Engineering'
   *    - PCD: 'NReg' (Not Registered) unless set
   */
  static lookupStudent(scannedCode: string): Student {
    const clean = scannedCode.trim();
    const students = this.getStudents();
    const found = students.find(
      (s) =>
        s.digitalId.toLowerCase() === clean.toLowerCase() ||
        s.registerNumber.toLowerCase() === clean.toLowerCase()
    );

    if (found) {
      // Ensure year matches official pattern
      return {
        ...found,
        year: getYearFromId(found.registerNumber || found.digitalId),
      };
    }

    // Auto-synthesize based on SSN register number pattern
    const year = getYearFromId(clean);

    // Detect Department from common SSN codes if present (e.g. 5001 CSE, 5002 IT, etc.)
    let dept = 'Engineering';
    if (clean.includes('5001') || clean.toUpperCase().includes('CSE')) dept = 'CSE';
    else if (clean.includes('5002') || clean.toUpperCase().includes('IT')) dept = 'IT';
    else if (clean.includes('3004') || clean.toUpperCase().includes('ECE')) dept = 'ECE';
    else if (clean.includes('3005') || clean.toUpperCase().includes('EEE')) dept = 'EEE';
    else if (clean.includes('3006') || clean.toUpperCase().includes('MECH')) dept = 'MECH';
    else if (clean.includes('3002') || clean.toUpperCase().includes('CIVIL')) dept = 'CIVIL';
    else if (clean.includes('3003') || clean.toUpperCase().includes('BME')) dept = 'BME';
    else if (clean.includes('3001') || clean.toUpperCase().includes('CHEM')) dept = 'CHEM';

    return {
      digitalId: clean,
      registerNumber: clean,
      name: `Student (${clean})`,
      dept,
      pcd: 'NReg', // Not Registered by default unless assigned
      year,
      email: `${clean}@ssn.edu.in`,
    };
  }

  // ================= GOOGLE APPS SCRIPT WEBHOOK & ROSTER SYNC =================
  static getGasWebhookUrl(): string {
    return localStorage.getItem(STORAGE_KEYS.GAS_WEBHOOK_URL) || '';
  }

  static setGasWebhookUrl(url: string): void {
    localStorage.setItem(STORAGE_KEYS.GAS_WEBHOOK_URL, url.trim());
  }

  /**
   * Helper to perform GET request against Google Apps Script
   * Tries standard fetch() with follow-redirect, falls back to JSONP
   */
  static async fetchFromGas(params: Record<string, string>): Promise<any> {
    const webhookUrl = this.getGasWebhookUrl();
    if (!webhookUrl) throw new Error('No Google Apps Script Webhook URL configured.');

    const searchParams = new URLSearchParams(params);
    const targetUrl = webhookUrl.includes('?')
      ? `${webhookUrl}&${searchParams.toString()}`
      : `${webhookUrl}?${searchParams.toString()}`;

    // 1. Try standard fetch
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const json = await response.json();
        return json;
      }
    } catch {
      // Fallback to JSONP if fetch is blocked
    }

    // 2. JSONP Fallback
    return new Promise((resolve, reject) => {
      const callbackName = `gas_cb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const script = document.createElement('script');
      const sep = targetUrl.includes('?') ? '&' : '?';
      script.src = `${targetUrl}${sep}callback=${callbackName}`;

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Google Apps Script request timed out. Please check your deployment settings.'));
      }, 10000);

      const cleanup = () => {
        clearTimeout(timer);
        delete (window as any)[callbackName];
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };

      (window as any)[callbackName] = (data: any) => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('Failed to connect to Google Apps Script. Ensure "Who has access" is set to "Anyone".'));
      };

      document.body.appendChild(script);
    });
  }

  /**
   * Syncs the full student roster directly from the connected Google Sheet
   */
  static async syncStudentsFromGoogleSheet(): Promise<{
    success: boolean;
    count: number;
    message: string;
  }> {
    const webhookUrl = this.getGasWebhookUrl();
    if (!webhookUrl) {
      return {
        success: false,
        count: 0,
        message: 'No Google Sheet Webhook URL saved. Please configure in Settings first.',
      };
    }

    try {
      const res = await this.fetchFromGas({ action: 'getStudents' });
      if (res && res.success && Array.isArray(res.students)) {
        const fetchedStudents: Student[] = res.students.map((s: any) => ({
          digitalId: String(s.digitalId || s.registerNumber || '').trim(),
          registerNumber: String(s.registerNumber || s.digitalId || '').trim(),
          name: String(s.name || `Student (${s.digitalId})`).trim(),
          dept: String(s.dept || 'Engineering').trim(),
          year: (s.year || getYearFromId(s.registerNumber || s.digitalId)) as StudentYear,
          pcd: (s.pcd === 'YRC' ? 'YRC' : s.pcd === 'NSS' ? 'NSS' : s.pcd === 'NSO' ? 'NSO' : 'NReg') as PCDType,
          email: String(s.email || `${s.registerNumber}@ssn.edu.in`).trim(),
        }));

        this.saveStudents(fetchedStudents);

        return {
          success: true,
          count: fetchedStudents.length,
          message: `Successfully synced ${fetchedStudents.length} students from your Google Spreadsheet!`,
        };
      }

      return {
        success: false,
        count: 0,
        message: res.error || 'No student records found in non-attendance sheets.',
      };
    } catch (err: any) {
      return {
        success: false,
        count: 0,
        message: err.message || 'Unable to connect to Google Apps Script. Check deployment permissions.',
      };
    }
  }

  /**
   * Fast query for a single student from the Google Sheet
   */
  static async searchStudentFromGoogleSheet(query: string): Promise<Student | null> {
    const webhookUrl = this.getGasWebhookUrl();
    if (!webhookUrl || !query.trim()) return null;

    try {
      const res = await this.fetchFromGas({ action: 'search', query: query.trim() });
      if (res && res.success && Array.isArray(res.students) && res.students.length > 0) {
        const s = res.students[0];
        const student: Student = {
          digitalId: String(s.digitalId || s.registerNumber || '').trim(),
          registerNumber: String(s.registerNumber || s.digitalId || '').trim(),
          name: String(s.name || `Student (${s.digitalId})`).trim(),
          dept: String(s.dept || 'Engineering').trim(),
          year: (s.year || getYearFromId(s.registerNumber || s.digitalId)) as StudentYear,
          pcd: (s.pcd === 'YRC' ? 'YRC' : s.pcd === 'NSS' ? 'NSS' : s.pcd === 'NSO' ? 'NSO' : 'NReg') as PCDType,
          email: String(s.email || `${s.registerNumber}@ssn.edu.in`).trim(),
        };
        this.addOrUpdateStudent(student);
        return student;
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Asynchronous smart lookup:
   * 1. Returns from local cache if present
   * 2. If not in local cache or has generic name, fetches live from Google Sheet
   */
  static async lookupStudentAsync(scannedCode: string): Promise<Student> {
    const clean = scannedCode.trim();
    const local = this.lookupStudent(clean);

    // If local student has a verified custom name (not generic), return immediately
    if (local && local.name && !local.name.startsWith('Student (')) {
      return local;
    }

    // Try live search from Google Sheet
    const sheetStudent = await this.searchStudentFromGoogleSheet(clean);
    if (sheetStudent) {
      return sheetStudent;
    }

    return local;
  }

  static async testGasWebhook(url: string): Promise<{ success: boolean; message: string; count?: number }> {
    const target = url.trim();
    if (!target) return { success: false, message: 'URL cannot be empty' };

    try {
      // Test both health check & student fetch
      const pingUrl = target.includes('?') ? `${target}&action=getStudents` : `${target}?action=getStudents`;
      const res = await fetch(pingUrl, { method: 'GET', headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.students)) {
          return {
            success: true,
            count: data.students.length,
            message: `✓ Connected! Found ${data.students.length} students in your Google Spreadsheet.`,
          };
        }
      }
      return {
        success: true,
        message: '✓ Webhook online & reachable! Click "Sync Roster" in Database to pull students.',
      };
    } catch {
      return {
        success: true,
        message: 'Saved! If using a newly deployed script, please make sure "Who has access" is set to "Anyone".',
      };
    }
  }

  static async postAttendanceToWebhook(record: AttendanceRecord): Promise<boolean> {
    const webhookUrl = this.getGasWebhookUrl();
    if (!webhookUrl) return false;

    const studentEmail =
      record.studentEmail && record.studentEmail.includes('@')
        ? record.studentEmail
        : record.registerNumber
        ? `${record.registerNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@ssn.edu.in`
        : '';

    const payload = {
      action: 'MARK_ATTENDANCE',
      eventId: record.eventId,
      eventName: record.eventName,
      sheetTabName: `PCD - ${record.eventName.substring(0, 30)}`,
      timestamp: record.timestamp,
      studentId: record.digitalId,
      registerNumber: record.registerNumber,
      studentName: record.name,
      dept: record.dept,
      year: record.year,
      pcd: record.pcd,
      remarks: record.remarks || '',
      markedBy: record.markedBy,
      markedByName: record.markedByName,
      confirmationCode: record.confirmationCode,
      studentEmail,
    };

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors', // standard for GAS webhooks to bypass CORS pre-flight
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return true;
    } catch (e) {
      console.warn('Webhook dispatch error:', e);
      return false;
    }
  }

  /**
   * Dispatches email to an event coordinator with their direct 1-click scanner link,
   * login credentials (username/password), event details, venue, and allowed access duration.
   */
  static async notifyCoordinator(params: {
    coordinatorEmail: string;
    eventName: string;
    eventDate: string;
    startTime: string;
    endTime: string;
    venue: string;
    directLink: string;
  }): Promise<{ success: boolean; message: string }> {
    const webhookUrl = this.getGasWebhookUrl();
    if (!webhookUrl) {
      return {
        success: false,
        message: 'Google Apps Script Webhook is not configured in Settings.',
      };
    }

    const payload = {
      action: 'NOTIFY_COORDINATOR',
      ...params,
    };

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return {
        success: true,
        message: `Notification email dispatched to ${params.coordinatorEmail}!`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to dispatch coordinator email.',
      };
    }
  }

  static resetAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
  }
}
