import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.companyName) {
      return toast.error('Please fill all fields');
    }
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password, form.companyName);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed');
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
            Start issuing<br />
            <span className="italic text-amber-400">GST invoices</span><br />
            in minutes
          </p>
          <div className="space-y-3">
            {['Auto GST calculation (CGST/SGST/IGST)', 'Professional A4 PDF export', 'Client & invoice management', 'Multi-user & dark mode support'].map(f => (
              <div key={f} className="flex items-center gap-3 text-sm text-ink-300">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-ink-500 text-xs font-mono">© 2024 GST Studio · All rights reserved</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-14 overflow-auto">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-lg bg-ink-800 dark:bg-amber-500 flex items-center justify-center">
              <FileText size={14} className="text-white dark:text-ink-950" />
            </div>
            <span className="font-display font-semibold text-ink-800 dark:text-ink-100">GST Studio</span>
          </div>

          <h1 className="font-display text-3xl font-semibold text-ink-800 dark:text-ink-100 mb-2">Create account</h1>
          <p className="text-ink-500 dark:text-ink-400 text-sm mb-8">Free forever. No credit card required.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Your Name</label>
              <input name="name" value={form.name} onChange={handle} className="input" placeholder="Rajesh Kumar" />
            </div>
            <div>
              <label className="label">Company Name</label>
              <input name="companyName" value={form.companyName} onChange={handle} className="input" placeholder="Acme Technologies Pvt. Ltd." />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input name="email" type="email" value={form.email} onChange={handle} className="input" placeholder="you@company.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handle}
                  className="input pr-10" placeholder="Min. 6 characters"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Create Account <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
            Already have an account?{' '}
            <Link to="/login" className="text-ink-800 dark:text-amber-400 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
