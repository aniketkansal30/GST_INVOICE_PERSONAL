import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Please fill all fields');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-ink-50 dark:bg-ink-950">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-ink-800 dark:bg-ink-900 flex-col justify-between p-14">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
            <FileText size={18} className="text-ink-950" />
          </div>
          <span className="font-display font-semibold text-white text-lg">GST Studio</span>
        </div>
        <div>
          <p className="font-display text-5xl font-light text-white leading-tight mb-6">
            Professional<br />
            <span className="italic text-amber-400">invoicing</span><br />
            made simple
          </p>
          <p className="text-ink-300 text-sm leading-relaxed max-w-xs">
            Generate GST-compliant invoices with automatic tax calculations, professional PDF export, and complete audit trails.
          </p>
        </div>
        <p className="text-ink-500 text-xs font-mono">Â© 2024 GST Studio Â· All rights reserved</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-14">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-lg bg-ink-800 dark:bg-amber-500 flex items-center justify-center">
              <FileText size={14} className="text-white dark:text-ink-950" />
            </div>
            <span className="font-display font-semibold text-ink-800 dark:text-ink-100">GST Studio</span>
          </div>

          <h1 className="font-display text-3xl font-semibold text-ink-800 dark:text-ink-100 mb-2">Welcome back</h1>
          <p className="text-ink-500 dark:text-ink-400 text-sm mb-8">Sign in to your account to continue</p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <input
                name="email" type="email" value={form.email} onChange={handle}
                className="input" placeholder="you@company.com"
              />
            </div>
            <div>
              <div className="mb-1.5"><label className="label mb-0">Password</label></div>
              <div className="relative">
                <input
                  name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handle}
                  className="input pr-10" placeholder="Your password"
                />
                <button
                  type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          
        </div>
      </div>
    </div>
  );
}



