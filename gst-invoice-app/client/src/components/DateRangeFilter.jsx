import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

const PRESET_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  this_month: 'This Month',
  this_year: 'This Year',
  all_time: 'All Time',
  custom: 'Custom Range',
};

export default function DateRangeFilter({ preset, customFrom, customTo, onChange }) {
  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(customFrom || '');
  const [tempTo, setTempTo] = useState(customTo || '');

  const selectPreset = (p) => {
    if (p === 'custom') { setOpen(true); return; }
    onChange({ preset: p, customFrom: '', customTo: '' });
    setOpen(false);
  };

  const applyCustom = () => {
    if (!tempFrom || !tempTo) return;
    onChange({ preset: 'custom', customFrom: tempFrom, customTo: tempTo });
    setOpen(false);
  };

  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(o => !o)} className="input text-xs flex items-center gap-2 px-3 py-2 cursor-pointer">
        <Calendar size={14} className="text-ink-400" />
        <span className="font-semibold">
          {preset === 'custom' && customFrom && customTo
            ? `${customFrom} to ${customTo}`
            : PRESET_LABELS[preset] || 'All Time'}
        </span>
        <ChevronDown size={14} className="text-ink-400" />
      </button>

      {open && (
        <div className="absolute z-[100] mt-1 left-0 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl shadow-xl p-3 w-64 space-y-1">
          {Object.entries(PRESET_LABELS).filter(([k]) => k !== 'custom').map(([k, label]) => (
            <button
              key={k}
              onClick={() => selectPreset(k)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                preset === k ? 'bg-ink-900 text-white dark:bg-amber-500 dark:text-ink-950' : 'hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="pt-2 border-t border-ink-100 dark:border-ink-800 space-y-2">
            <p className="text-[11px] font-semibold text-ink-500">Custom Range</p>
            <input type="date" value={tempFrom} onChange={e => setTempFrom(e.target.value)} className="input text-xs py-1.5 w-full" />
            <input type="date" value={tempTo} onChange={e => setTempTo(e.target.value)} className="input text-xs py-1.5 w-full" />
            <button onClick={applyCustom} className="btn-primary text-xs w-full py-1.5">Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}