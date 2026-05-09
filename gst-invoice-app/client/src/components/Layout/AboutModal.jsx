import React from 'react';
import { X, Phone, Mail, Copy, Check } from 'lucide-react';

const TEAM = [
  {
    name: 'ANIKET KANSAL',
    role: 'Co-Founder',
    phone: '8126700718',
    email: 'aniketkansal3007@gmail.com',
    linkedin: 'https://www.linkedin.com/in/aniket-kansal-359664287/',
    github: 'https://github.com/aniketkansal30',
    initial: 'A',
  },
  {
    name: 'AKSHANSH MITTAL',
    role: 'Co-Founder',
    phone: '8766392706',
    email: 'akshanshmittal8@gmail.com',
    linkedin: 'https://www.linkedin.com/in/akshansh-mittal-3719b1289/',
    github: 'https://github.com/akshanshmittal81',
    initial: 'A',
  },
];

const LinkedInIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
);

export default function AboutModal({ onClose }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const text = `
ANIKET KANSAL — Co-Founder
Phone: 8126700718
Email: aniketkansal3007@gmail.com
LinkedIn: https://www.linkedin.com/in/aniket-kansal-359664287/
GitHub: https://github.com/aniketkansal30

AKSHANSH MITTAL — Co-Founder
Phone: 8766392706
Email: akshanshmittal8@gmail.com
LinkedIn: https://www.linkedin.com/in/akshansh-mittal-3719b1289/
GitHub: https://github.com/akshanshmittal81
    `.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-2xl w-full max-w-lg border border-ink-200 dark:border-ink-700">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 dark:border-ink-800">
          <div>
            <h2 className="font-display font-bold text-ink-800 dark:text-ink-100 text-lg">About Us</h2>
            <p className="text-xs text-ink-400 mt-0.5">Building smart GST tools for Indian businesses 🇮🇳</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Team Cards */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {TEAM.map((person) => (
              <div
                key={person.name}
                className="bg-ink-50 dark:bg-ink-800 rounded-2xl p-5 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-ink-800 dark:bg-amber-500 flex items-center justify-center text-white dark:text-ink-950 font-bold text-base shrink-0">
                    {person.initial}
                  </div>
                  <div>
                    <p className="font-bold text-ink-800 dark:text-ink-100 text-sm leading-tight">{person.name}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-ink-200 dark:bg-ink-700 text-ink-600 dark:text-ink-300">
                      {person.role}
                    </span>
                  </div>
                </div>

                <div className="border-t border-ink-200 dark:border-ink-700" />

                <div className="flex flex-col gap-2">
                  <a
                    href={`https://wa.me/91${person.phone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 hover:underline font-medium"
                  >
                    <Phone size={12} />
                    {person.phone}
                  </a>
                  <a
                    href={`mailto:${person.email}`}
                    className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400 hover:underline truncate"
                  >
                    <Mail size={12} />
                    <span className="truncate">{person.email}</span>
                  </a>
                </div>

                <div className="border-t border-ink-200 dark:border-ink-700" />

                <div className="flex gap-2">
                  <a
                    href={person.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-all"
                  >
                    <LinkedInIcon />
                    LinkedIn
                  </a>
                  <a
                    href={person.github}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-200 text-xs font-medium hover:bg-ink-200 dark:hover:bg-ink-600 transition-all"
                  >
                    <GitHubIcon />
                    GitHub
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
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
