import React, { useState, useEffect } from 'react';
import { ShieldCheck, Copy, CheckCircle, AlertCircle, Loader2, Lock } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Device Fingerprint ────────────────────────────────────────────────────────
function getDeviceFingerprint() {
  const nav = window.navigator;
  const scr = window.screen;
  const raw = [
    nav.userAgent,
    nav.language,
    scr.colorDepth,
    scr.width + 'x' + scr.height,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency || '?',
    nav.platform,
    nav.vendor || '',
  ].join('|');

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    hash = (hash << 5) - hash + c;
    hash = hash & hash;
  }
  return 'FP-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

// ── Main LicenseGate ──────────────────────────────────────────────────────────
export default function LicenseGate({ children }) {
  const [status, setStatus] = useState('checking'); // checking | locked | valid
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fingerprint] = useState(getDeviceFingerprint);

  useEffect(() => {
    const savedKey = localStorage.getItem('gst_license');
    const savedFP = localStorage.getItem('gst_fp');

    if (savedKey && savedFP === fingerprint) {
      silentVerify(savedKey, fingerprint);
    } else {
      setStatus('locked');
    }
  }, [fingerprint]);

  const silentVerify = async (key, fp) => {
    try {
      const res = await fetch(`${API}/license/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, deviceFingerprint: fp }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('valid');
      } else {
        localStorage.removeItem('gst_license');
        localStorage.removeItem('gst_fp');
        setStatus('locked');
      }
    } catch {
      setStatus('locked');
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/license/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: licenseKey.trim().toUpperCase(),
          deviceFingerprint: fingerprint,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('gst_license', licenseKey.trim().toUpperCase());
        localStorage.setItem('gst_fp', fingerprint);
        setStatus('valid');
      } else {
        setError(data.message || 'License invalid hai');
      }
    } catch {
      setError('Server se connect nahi ho paya');
    }
    setLoading(false);
  };

  const copyFP = () => {
    navigator.clipboard.writeText(fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Checking ────────────────────────────────────────────────────────────────
  if (status === 'checking')
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-ink-800 dark:text-amber-500" />
          <p className="text-sm text-ink-500 dark:text-ink-400 font-medium">License verify ho rahi hai...</p>
        </div>
      </div>
    );

  // ── Valid ───────────────────────────────────────────────────────────────────
  if (status === 'valid') return children;

  // ── Locked ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-950 p-4">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-xl border border-ink-100 dark:border-ink-800 overflow-hidden">

          {/* Top bar */}
          <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />

          <div className="p-8">
            {/* Icon + Title */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-ink-800 dark:bg-amber-500 flex items-center justify-center mb-4">
                <Lock size={28} className="text-amber-400 dark:text-ink-900" />
              </div>
              <h1 className="text-xl font-bold text-ink-800 dark:text-ink-100 tracking-tight">
                GST Invoice Manager
              </h1>
              <p className="text-sm text-ink-400 dark:text-ink-500 mt-1">
                License Required to Continue
              </p>
            </div>

            {/* Step 1 - Device ID */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-ink-800 dark:bg-amber-500 text-amber-400 dark:text-ink-900 text-xs font-bold flex items-center justify-center">1</span>
                <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">
                  Apna Device ID Admin ko bhejo
                </p>
              </div>

              <button
                onClick={copyFP}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-dashed border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/50 hover:border-amber-400 dark:hover:border-amber-500 transition-all group"
              >
                <span className="font-mono text-sm font-bold text-ink-700 dark:text-ink-200 tracking-widest">
                  {fingerprint}
                </span>
                <span className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${copied ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {copied
                    ? <><CheckCircle size={14} /> Copied!</>
                    : <><Copy size={14} /> Copy</>
                  }
                </span>
              </button>

              <p className="text-xs text-ink-400 dark:text-ink-500 mt-2 text-center">
                Yeh ID aur apna naam WhatsApp karo —{' '}
                <a href="https://wa.me/918126700718" target="_blank" rel="noreferrer"
                  className="text-amber-600 dark:text-amber-400 font-semibold hover:underline">
                  +91-8126700718
                </a>
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-ink-100 dark:bg-ink-800" />
              <span className="text-xs text-ink-400 dark:text-ink-600">then</span>
              <div className="flex-1 h-px bg-ink-100 dark:bg-ink-800" />
            </div>

            {/* Step 2 - Enter Key */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-ink-800 dark:bg-amber-500 text-amber-400 dark:text-ink-900 text-xs font-bold flex items-center justify-center">2</span>
                <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">
                  Admin se mili License Key daalo
                </p>
              </div>

              <input
                type="text"
                placeholder="GST-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleActivate()}
                className="w-full px-4 py-3 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-800 dark:text-ink-100 font-mono font-bold text-center tracking-widest text-sm outline-none focus:border-amber-400 dark:focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 transition-all"
              />

              {error && (
                <div className="flex items-center gap-2 mt-2 text-red-500 text-xs font-medium">
                  <AlertCircle size={13} />
                  {error}
                </div>
              )}
            </div>

            {/* Activate Button */}
            <button
              onClick={handleActivate}
              disabled={loading || !licenseKey.trim()}
              className="w-full py-3 rounded-xl bg-ink-800 dark:bg-amber-500 text-amber-400 dark:text-ink-900 font-bold text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-ink-700 dark:hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Verify ho raha hai...</>
                : <><ShieldCheck size={16} /> Activate Karo</>
              }
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-ink-400 dark:text-ink-600 mt-4">
          Unauthorized access is prohibited · GST Invoice Manager
        </p>
      </div>
    </div>
  );
}
