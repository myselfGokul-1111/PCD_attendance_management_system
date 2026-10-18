import React, { useState, useEffect } from 'react';
import { PCDType, Student, StudentYear, getYearFromId } from '../types';
import { PCDStorageService } from '../services/storage';
import {
  Search,
  Plus,
  Filter,
  Users,
  Check,
  X,
  UploadCloud,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';

export const DatabaseView: React.FC = () => {
  const [students, setStudents] = useState<Student[]>(() => PCDStorageService.getStudents());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedPcd, setSelectedPcd] = useState<string>('ALL');

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Live Sheet search state
  const [isSearchingSheet, setIsSearchingSheet] = useState(false);

  // Add Student Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  // Form states for manual student add
  const [newReg, setNewReg] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('CSE');
  const [newPcd, setNewPcd] = useState<PCDType>('YRC');

  const webhookUrl = PCDStorageService.getGasWebhookUrl();

  const refreshStudents = () => {
    setStudents(PCDStorageService.getStudents());
  };

  // Sync from Google Sheet
  const handleSyncFromGoogleSheet = async () => {
    if (!webhookUrl) {
      setSyncStatus({
        type: 'error',
        message: 'Google Sheet Webhook URL is not configured. Click the gear icon at the top to configure it.',
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatus({
      type: 'info',
      message: 'Connecting to your Google Sheet to pull student records...',
    });

    const res = await PCDStorageService.syncStudentsFromGoogleSheet();
    setIsSyncing(false);

    if (res.success) {
      refreshStudents();
      setSyncStatus({
        type: 'success',
        message: res.message,
      });
    } else {
      setSyncStatus({
        type: 'error',
        message: res.message,
      });
    }
  };

  // Auto-sync if student list is empty but webhook is available
  useEffect(() => {
    if (students.length === 0 && webhookUrl) {
      handleSyncFromGoogleSheet();
    }
  }, []);

  // Live search in Google Sheet
  const handleLiveSearchInSheet = async () => {
    if (!searchQuery.trim() || !webhookUrl) return;

    setIsSearchingSheet(true);
    const found = await PCDStorageService.searchStudentFromGoogleSheet(searchQuery.trim());
    setIsSearchingSheet(false);

    if (found) {
      refreshStudents();
      setSyncStatus({
        type: 'success',
        message: `Found student "${found.name}" (${found.registerNumber}) in your Google Sheet!`,
      });
    } else {
      setSyncStatus({
        type: 'info',
        message: `No record matching "${searchQuery}" found in your Google Sheet.`,
      });
    }
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReg.trim()) return;

    const studentYear = getYearFromId(newReg);

    const student: Student = {
      digitalId: newReg.trim(),
      registerNumber: newReg.trim(),
      name: newName.trim() || `Student (${newReg.trim()})`,
      dept: newDept.toUpperCase(),
      pcd: newPcd,
      year: studentYear,
      email: `${newReg.trim()}@ssn.edu.in`,
    };

    PCDStorageService.addOrUpdateStudent(student);
    refreshStudents();
    setIsAddModalOpen(false);
    setNewReg('');
    setNewName('');
  };

  // Bulk import (format: RegisterNumber, Name, Dept, PCD)
  const handleBulkImport = () => {
    if (!importText.trim()) return;
    const lines = importText.split('\n');
    let addedCount = 0;

    lines.forEach((line) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      if (parts[0]) {
        const reg = parts[0];
        const name = parts[1] || `Student ${reg}`;
        const dept = parts[2] || 'Engineering';
        let pcd: PCDType = 'NReg';
        const pcdCandidate = (parts[3] || '').toUpperCase();
        if (pcdCandidate.includes('YRC')) pcd = 'YRC';
        else if (pcdCandidate.includes('NSS')) pcd = 'NSS';
        else if (pcdCandidate.includes('NSO')) pcd = 'NSO';

        PCDStorageService.addOrUpdateStudent({
          digitalId: reg,
          registerNumber: reg,
          name,
          dept,
          pcd,
          year: getYearFromId(reg),
          email: `${reg}@ssn.edu.in`,
        });
        addedCount++;
      }
    });

    refreshStudents();
    setIsImportModalOpen(false);
    setImportText('');
  };

  const handleDeleteStudent = (digitalId: string) => {
    const list = students.filter((s) => s.digitalId !== digitalId);
    PCDStorageService.saveStudents(list);
    refreshStudents();
  };

  // Filter students
  const filtered = students.filter((s) => {
    const matchesSearch =
      s.registerNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.dept.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesYear = selectedYear === 'ALL' || s.year === selectedYear;
    const matchesPcd = selectedPcd === 'ALL' || s.pcd === selectedPcd;

    return matchesSearch && matchesYear && matchesPcd;
  });

  const getPcdBadge = (pcd: PCDType) => {
    if (pcd === 'YRC') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-xs">
          YRC
        </span>
      );
    }
    if (pcd === 'NSS') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white shadow-xs">
          NSS
        </span>
      );
    }
    if (pcd === 'NSO') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-xs">
          NSO
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-300">
        Not Registered
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
              Student Database
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
              {students.length} Total
            </span>
          </div>
          <p className="text-xs text-neutral-500 font-medium">
            Directory of students across 2nd, 3rd, and 4th years linked to your Google Sheet.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sync Button */}
          <button
            onClick={handleSyncFromGoogleSheet}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            title="Fetch all students from your master Google Sheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync from Google Sheet'}</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold cursor-pointer transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Paste CSV</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
            syncStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : syncStatus.type === 'error'
              ? 'bg-red-50 text-red-900 border border-red-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : syncStatus.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            )}
            <span>{syncStatus.message}</span>
          </div>
          <button
            onClick={() => setSyncStatus(null)}
            className="text-neutral-400 hover:text-neutral-700 cursor-pointer p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLiveSearchInSheet();
              }}
              placeholder="Search by Register No (e.g. 2410019) or Name..."
              className="w-full pl-9 pr-24 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={handleLiveSearchInSheet}
                disabled={isSearchingSheet}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-[10px] font-bold cursor-pointer disabled:opacity-50"
              >
                {isSearchingSheet ? 'Searching...' : 'Search Sheet'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-2.5 py-2 text-xs border border-neutral-300 rounded-lg bg-white font-medium"
            >
              <option value="ALL">All Years</option>
              <option value="4th Year">4th Year (231/237)</option>
              <option value="3rd Year">3rd Year (241/247)</option>
              <option value="2nd Year">2nd Year (251/257)</option>
              <option value="1st Year">1st Year (261/267)</option>
            </select>

            <select
              value={selectedPcd}
              onChange={(e) => setSelectedPcd(e.target.value)}
              className="px-2.5 py-2 text-xs border border-neutral-300 rounded-lg bg-white font-medium"
            >
              <option value="ALL">All Wings</option>
              <option value="YRC">YRC (Red)</option>
              <option value="NSS">NSS (Blue)</option>
              <option value="NSO">NSO (Green)</option>
              <option value="NReg">Not Registered</option>
            </select>
          </div>
        </div>

        {/* Counts summary */}
        <div className="flex items-center gap-4 text-xs text-neutral-500 pt-1 border-t border-neutral-100 flex-wrap">
          <span>Showing: <b>{filtered.length}</b> of {students.length} students</span>
          <span className="flex items-center gap-1 font-semibold text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-600" /> YRC: {students.filter((s) => s.pcd === 'YRC').length}
          </span>
          <span className="flex items-center gap-1 font-semibold text-blue-700">
            <span className="w-2 h-2 rounded-full bg-blue-600" /> NSS: {students.filter((s) => s.pcd === 'NSS').length}
          </span>
          <span className="flex items-center gap-1 font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-600" /> NSO: {students.filter((s) => s.pcd === 'NSO').length}
          </span>
        </div>
      </div>

      {/* Student List */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4 text-neutral-500 text-xs space-y-3">
            <Users className="w-10 h-10 mx-auto text-neutral-300" />
            <div>
              <p className="font-bold text-neutral-700 text-sm">
                {students.length === 0 ? 'No Student Records Loaded Yet' : 'No Students Matching Search'}
              </p>
              <p className="text-neutral-500 max-w-md mx-auto mt-1">
                {students.length === 0
                  ? 'Connect your Google Sheet to pull your student roster, or click "Sync from Google Sheet".'
                  : `No students match your query "${searchQuery}".`}
              </p>
            </div>

            {students.length === 0 && (
              <div className="pt-2">
                <button
                  onClick={handleSyncFromGoogleSheet}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Connecting...' : 'Sync Students from Google Sheet Now'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
            {filtered.map((s) => (
              <div
                key={s.digitalId}
                className="p-3 sm:p-4 hover:bg-neutral-50 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                      {s.registerNumber}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-neutral-800 truncate">
                      {s.name}
                    </span>
                    {getPcdBadge(s.pcd)}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-medium">
                    <span className="font-bold text-neutral-700">{s.year}</span>
                    <span>·</span>
                    <span>{s.dept}</span>
                    <span>·</span>
                    <span className="truncate">{s.email}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteStudent(s.digitalId)}
                  className="p-1.5 text-neutral-300 hover:text-red-600 rounded-lg cursor-pointer transition-colors"
                  title="Remove from local cache"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Add Student */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm sm:text-base font-black text-neutral-900">
                Add Student to Database
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Register Number:
                </label>
                <input
                  type="text"
                  required
                  value={newReg}
                  onChange={(e) => setNewReg(e.target.value)}
                  placeholder="e.g. 2410019"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-neutral-400 mt-0.5 block">
                  Year is calculated automatically (231/237=4th, 241/247=3rd, 251/257=2nd).
                </span>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Student Name:
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Gokul S"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Department:
                  </label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white"
                  >
                    <option value="CSE">CSE</option>
                    <option value="IT">IT</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="MECH">MECH</option>
                    <option value="CIVIL">CIVIL</option>
                    <option value="BME">BME</option>
                    <option value="CHEM">CHEM</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    PCD Wing:
                  </label>
                  <select
                    value={newPcd}
                    onChange={(e) => setNewPcd(e.target.value as PCDType)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white font-bold"
                  >
                    <option value="YRC">YRC (Red)</option>
                    <option value="NSS">NSS (Blue)</option>
                    <option value="NSO">NSO (Green)</option>
                    <option value="NReg">Not Registered</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 border border-neutral-300 rounded-lg font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Import */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm sm:text-base font-black text-neutral-900">
                Paste Roster from Excel / Sheets
              </h2>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-neutral-600">
                Copy columns from your Excel or Google Sheet (Format: <code>RegisterNumber, Name, Department, PCD (YRC/NSS/NSO)</code>) and paste below:
              </p>

              <textarea
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"2410019, Gokul S, CSE, YRC\n2310052, Anita R, ECE, NSS\n2510088, Rajesh M, IT, NSO"}
                className="w-full p-3 font-mono text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-2 border border-neutral-300 rounded-lg font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkImport}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Import Records</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
