import React, { useState } from 'react';
import { PCDStorageService } from '../services/storage';
import {
  Settings,
  Link,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  FileSpreadsheet,
  Mail,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [webhookUrl, setWebhookUrl] = useState(() => PCDStorageService.getGasWebhookUrl());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const handleSaveAndTest = async () => {
    if (!webhookUrl.trim()) {
      setTestStatus('error');
      setTestMsg('Please enter a valid Google Apps Script Web App URL.');
      return;
    }

    PCDStorageService.setGasWebhookUrl(webhookUrl.trim());
    setTestStatus('testing');
    setTestMsg('Connecting to Google Apps Script...');

    const res = await PCDStorageService.testGasWebhook(webhookUrl.trim());
    if (res.success) {
      setTestStatus('success');
      setTestMsg(res.message);
      // Automatically pull students into database
      const syncRes = await PCDStorageService.syncStudentsFromGoogleSheet();
      if (syncRes.success) {
        setTestMsg(`${res.message} (Synced ${syncRes.count} students into your database!)`);
      }
    } else {
      setTestStatus('error');
      setTestMsg(res.message);
    }
  };

  const copyAppsScript = () => {
    // Basic snippet instructions
    const snippet = `/**
 * Deploy as Web App with Execute as: "Me" and Who has access: "Anyone"
 * See full google-apps-script.js in project files.
 */`;
    navigator.clipboard.writeText(snippet);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-black text-neutral-900">
              Google Sheet Webhook Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          <p className="text-neutral-600 leading-relaxed">
            Connect your master Google Spreadsheet. When attendance is marked, a dedicated sheet tab will be created automatically for each event with remarks and student receipts.
          </p>

          <div className="space-y-1.5">
            <label className="font-bold text-neutral-700 block">
              Google Apps Script Web App URL:
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3 py-2 text-xs font-mono border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>

          {testStatus !== 'idle' && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                testStatus === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : testStatus === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              {testStatus === 'testing' ? (
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              ) : testStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{testMsg}</span>
            </div>
          )}

          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-1.5 text-[11px] text-neutral-600">
            <div className="font-bold text-neutral-800 flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>How your sheet is automatically updated:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-neutral-500">
              <li>Each event creates a new sheet tab: <b>PCD - [Event Name]</b></li>
              <li>Columns: Timestamp, ID, Name, Dept, Year, PCD Wing, Remark, Marked By</li>
              <li>Duplicates on Register Number are blocked automatically</li>
            </ul>
          </div>

          <div className="bg-red-50/60 border border-red-200/80 rounded-lg p-3 space-y-1.5 text-[11px] text-neutral-600">
            <div className="font-bold text-red-900 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-red-600" />
              <span>Gmail Integration (Built-in via Google Apps Script):</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-neutral-600">
              <li>
                <b>To Coordinators:</b> Dispatches direct 1-click scanner link, username/password (<code className="font-mono text-red-700">SSN@Coord2026</code>), event details, and allowed scanning time window.
              </li>
              <li>
                <b>To Participants (Students):</b> Dispatches instant verified attendance receipts with PCD Category (🔴 YRC, 🔵 NSS, 🟢 NSO), confirmation code, and remarks.
              </li>
              <li>
                <b>Zero extra setup:</b> Sends directly through your authorized Google / SSN account with no 3rd-party email service needed!
              </li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100 rounded-lg font-bold text-neutral-700 cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleSaveAndTest}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save & Verify</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
