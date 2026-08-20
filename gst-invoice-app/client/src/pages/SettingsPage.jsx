import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Monitor, Save, User, Building2, Shield, CreditCard } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { INDIAN_STATES, DEFAULT_STORE_DETAILS } from '../utils/invoiceUtils';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const isLocked = user?.role !== 'admin';
  const { theme, changeTheme } = useTheme();
  const [profile, setProfile] = useState({
    name: user?.name || DEFAULT_STORE_DETAILS.companyName,
    email: user?.email || '',
    companyName: user?.companyName || DEFAULT_STORE_DETAILS.companyName,
    gstNumber: user?.gstNumber || DEFAULT_STORE_DETAILS.gstNumber,
    panNumber: user?.panNumber || DEFAULT_STORE_DETAILS.panNumber,
    address: user?.address || DEFAULT_STORE_DETAILS.address,
    contact: user?.contact || DEFAULT_STORE_DETAILS.contact,
    state: user?.state || DEFAULT_STORE_DETAILS.state,
  });
  const [passwords, setPasswords] = useState({ current: '', newPw: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', profile);
      updateUser(res.data.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (passwords.newPw !== passwords.confirm) return toast.error('Passwords do not match');
    if (passwords.newPw.length < 6) return toast.error('Password must be at least 6 characters');
    setSavingPw(true);
    try {
      await api.put('/auth/password', { currentPassword: passwords.current, newPassword: passwords.newPw });
      toast.success('Password changed!');
      setPasswords({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  const themeOptions = [
    { key: 'light', Icon: Sun, label: 'Light', desc: 'Always light mode' },
    { key: 'dark', Icon: Moon, label: 'Dark', desc: 'Always dark mode' },
    { key: 'system', Icon: Monitor, label: 'System', desc: 'Follow device setting' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-slide-up">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-800 dark:text-ink-100">Settings</h1>
        <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Theme */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
            <Monitor size={15} className="text-ink-600 dark:text-ink-300" />
          </div>
          <div>
            <p className="font-semibold text-ink-800 dark:text-ink-100 text-sm">Appearance</p>
            <p className="text-xs text-ink-400">Choose your preferred theme</p>
            {isLocked ? '🔒 Locked — contact admin to change store details' : 'Update your personal details'}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map(({ key, Icon, label, desc }) => (
            <button
              key={key}
              onClick={() => changeTheme(key)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${theme === key
                ? 'border-ink-800 dark:border-amber-500 bg-ink-50 dark:bg-amber-500/10'
                : 'border-ink-200 dark:border-ink-700 hover:border-ink-400 dark:hover:border-ink-600'
                }`}
            >
              <Icon size={20} className={theme === key ? 'text-ink-800 dark:text-amber-400' : 'text-ink-400'} />
              <p className={`text-sm font-semibold mt-2 ${theme === key ? 'text-ink-800 dark:text-amber-400' : 'text-ink-600 dark:text-ink-300'}`}>{label}</p>
              <p className="text-xs text-ink-400 mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Profile */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
            <User size={15} className="text-ink-600 dark:text-ink-300" />
          </div>
          <div>
            <p className="font-semibold text-ink-800 dark:text-ink-100 text-sm">Profile</p>
            <p className="text-xs text-ink-400">Update your personal details</p>
          </div>
        </div>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Owner Name</label>
              <input
                value={profile.name}
                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Ramesh Kumar"
                className="input"
                disabled={isLocked}
                required
              />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                value={profile.email}
                onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
                className="input"
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Clothing Shop / Store Name</label>
            <input
              value={profile.companyName}
              onChange={e => setProfile(p => ({ ...p, companyName: e.target.value }))}
              placeholder="e.g. Manish Enterprises"
              className="input font-semibold"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">GSTIN / GST Number</label>
              <input
                value={profile.gstNumber}
                onChange={e => {
                  const val = e.target.value.toUpperCase();
                  setProfile(p => {
                    // Auto-extract PAN from GSTIN if PAN is empty or matches previous GSTIN
                    const extractedPan = val.length >= 12 ? val.substring(2, 12) : p.panNumber;
                    return { ...p, gstNumber: val, panNumber: p.panNumber ? p.panNumber : extractedPan };
                  });
                }}
                placeholder="09AJTPK3679H1ZG"
                className="input font-mono uppercase"
              />
            </div>
            <div>
              <label className="label">PAN No.</label>
              <input
                value={profile.panNumber}
                onChange={e => setProfile(p => ({ ...p, panNumber: e.target.value.toUpperCase() }))}
                placeholder="AADFI0426M"
                maxLength={10}
                className="input font-mono uppercase"
              />
            </div>
            <div>
              <label className="label">Contact / Mobile Number</label>
              <input
                value={profile.contact}
                onChange={e => setProfile(p => ({ ...p, contact: e.target.value }))}
                placeholder="9719201802"
                className="input font-mono"
              />
            </div>
          </div>
          <div>
            <label className="label">Shop Address</label>
            <textarea
              value={profile.address}
              onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
              placeholder="Shop No 188 T, Abulane, Near Nishant Cinema, Meerut Cantt, Uttar Pradesh"
              className="input resize-none"
              rows={2}
            />
          </div>
          <div>
            <label className="label">State / Place of Supply</label>
            <select
              value={profile.state}
              onChange={e => setProfile(p => ({ ...p, state: e.target.value }))}
              className="input"
            >
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving || isLocked} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
              {isLocked ? 'Locked' : saving ? 'Saving...' : 'Save Store Details'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
            <Shield size={15} className="text-ink-600 dark:text-ink-300" />
          </div>
          <div>
            <p className="font-semibold text-ink-800 dark:text-ink-100 text-sm">Security</p>
            <p className="text-xs text-ink-400">Change your password</p>
          </div>
        </div>
        <form onSubmit={handlePasswordSave} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
              className="input" placeholder="Current password" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">New Password</label>
              <input type="password" value={passwords.newPw} onChange={e => setPasswords(p => ({ ...p, newPw: e.target.value }))}
                className="input" placeholder="New password" />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                className="input" placeholder="Repeat new password" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingPw} className="btn-primary">
              {savingPw ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Shield size={15} />}
              {savingPw ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      <div className="pb-8" />
    </div>
  );
}