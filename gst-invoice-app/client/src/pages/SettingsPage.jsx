import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Monitor, Save, User, Building2, Shield } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { INDIAN_STATES } from '../utils/invoiceUtils';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { theme, changeTheme } = useTheme();
  const [profile, setProfile] = useState({
    name: user?.name || '',
    companyName: user?.companyName || '',
    gstNumber: user?.gstNumber || '',
    address: user?.address || '',
    contact: user?.contact || '',
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
              <label className="label">Full Name</label>
              <input value={profile.name} readOnly className="input bg-ink-100 dark:bg-ink-900 cursor-not-allowed opacity-70" />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={user?.email} disabled className="input opacity-60 cursor-not-allowed" />
            </div>
          </div>
          <div>
            <label className="label">Company Name</label>
            <input value={profile.companyName} readOnly className="input bg-ink-100 dark:bg-ink-900 cursor-not-allowed opacity-70" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">GST Number</label>
              <input value={profile.gstNumber} readOnly className="input font-mono uppercase bg-ink-100 dark:bg-ink-900 cursor-not-allowed opacity-70" />
            </div>
            <div>
              <label className="label">Contact</label>
              <input value={profile.contact} readOnly className="input bg-ink-100 dark:bg-ink-900 cursor-not-allowed opacity-70" />
            </div>
          </div>
          <div>
            <label className="label">Company Address</label>
            <textarea value={profile.address} readOnly className="input resize-none bg-ink-100 dark:bg-ink-900 cursor-not-allowed opacity-70" rows={2} />
          </div>
          <div>
            <label className="label">State</label>
            <select
              value={profile.state}
              onChange={e => setProfile(p => ({ ...p, state: e.target.value }))}
              className="input"
            >
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div class="text-xs text-ink-400 italic mt-2">Contact admin to update company details.</div>
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
              {savingPw ? 'Savingâ€¦' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      <div className="pb-8" />
    </div>
  );
}


