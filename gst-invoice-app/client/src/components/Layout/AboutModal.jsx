import React from 'react';
import { X, Phone, Mail, MapPin, Globe, Copy, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const TEAM = [
  {
    name: 'ANIKET KANSAL',
    role: 'Owner',
    phone: '8126700718',
    email: 'aniketkansal3007@gmail.com',
  },
  {
    name: 'AKSHANSH MITTAL',
    role: 'Partner',
    phone: '8766392706',
    email: 'akshanshmittal8@gmail.com',
  },
];

export default function AboutModal({ onClose }) {
  const { user } = useAuth();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const text = `
NEW TECH ENTERPRISES
GSTIN: ${user?.gstNumber || 'N/A'}
Address: ${user?.address || 'N/A'}

--- Team ---
Owner: ANIKET KANSAL
Phone: 8126700718
Email: aniketkansal3007@gmail.com

Partner: AKSHANSH MITTAL
Phone: 8766392706
Email: akshanshmittal8@gmail.com
    `.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-2xl w-full max-w-md border border-ink-200 dark:border-ink-700">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 dark:border-ink-800">
          <div>
            <h2 className="font-display font-bold text-ink-800 dark:text-ink-100 text-lg">About Us</h2>
            <p className="text-xs text-ink-400 mt-0.5">{user?.companyName || 'NEW TECH ENTERPRISES'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Team Cards */}
          <div className="grid grid-cols-2 gap-3">
            {TEAM.map((person) => (
              <div
                key={person.name}
                className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4 flex flex-col gap-2"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-ink-800 dark:bg-amber-500 flex items-center justify-center text-white dark:text-ink-950 font-bold text-sm">
                  {person.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-ink-800 dark:text-ink-100 text-sm leading-tight">{person.name}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-ink-200 dark:bg-ink-700 text-ink-600 dark:text-ink-300">
                    {person.role}
                  </span>
                </div>
                {/* WhatsApp */}
                <a
                  href={`https://wa.me/91${person.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 hover:underline"
                >
                  <Phone size={11} />
                  {person.phone}
                </a>
                {/* Email */}
                <a
                  href={`mailto:${person.email}`}
                  className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400 hover:underline truncate"
                >
                  <Mail size={11} />
                  <span className="truncate">{person.email}</span>
                </a>
              </div>
            ))}
          </div>

          {/* Business Details */}
          <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4 space-y-2.5">
            {user?.gstNumber && (
              <div className="flex items-start gap-2.5 text-sm">
                <span className="text-ink-400 mt-0.5 font-mono text-xs">GST</span>
                <span className="text-ink-700 dark:text-ink-200 font-mono text-xs">{user.gstNumber}</span>
              </div>
            )}
            {user?.address && (
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin size={13} className="text-ink-400 mt-0.5 shrink-0" />
                <span className="text-ink-600 dark:text-ink-300 text-xs">{user.address}</span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm">
              <Globe size={13} className="text-ink-400 shrink-0" />
              <span className="text-ink-400 text-xs italic">Website coming soon</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-ink-800 dark:bg-amber-500 text-white dark:text-ink-950 text-sm font-medium hover:opacity-90 transition-all"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy Contact Info'}
          </button>
        </div>
      </div>
    </div>
  );
}
