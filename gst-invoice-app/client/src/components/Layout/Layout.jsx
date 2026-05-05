import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  LayoutDashboard, FileText, Plus, Settings, LogOut,
  Moon, Sun, Monitor, Menu, X, ChevronDown
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/invoices/new', icon: Plus, label: 'New Invoice' },
  { to: '/gstr1', icon: FileText, label: 'Report' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, changeTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const themeIcon = { light: Sun, dark: Moon, system: Monitor }[theme];
  const ThemeIcon = themeIcon;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-ink-50 dark:bg-ink-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-30 h-full w-64 bg-white dark:bg-ink-900
        border-r border-ink-200 dark:border-ink-800 flex flex-col
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-ink-100 dark:border-ink-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ink-800 dark:bg-amber-500 flex items-center justify-center">
              <FileText size={16} className="text-white dark:text-ink-950" />
            </div>
            <div>
              <p className="font-display font-semibold text-ink-800 dark:text-ink-100 text-sm leading-none">GST Studio</p>
              <p className="text-[10px] text-ink-400 mt-0.5 font-mono">Invoice Manager</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-ink-400 hover:text-ink-600">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-ink-800 dark:bg-amber-500 text-white dark:text-ink-950'
                  : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'
                }
              `}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Theme toggle */}
        <div className="px-3 py-2 border-t border-ink-100 dark:border-ink-800">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-ink-50 dark:bg-ink-800">
            <span className="text-xs font-medium text-ink-500 dark:text-ink-400 flex items-center gap-2">
              <ThemeIcon size={13} /> Theme
            </span>
            <div className="flex gap-1">
              {[
                { key: 'light', Icon: Sun },
                { key: 'dark', Icon: Moon },
                { key: 'system', Icon: Monitor },
              ].map(({ key, Icon }) => (
                <button
                  key={key}
                  onClick={() => changeTheme(key)}
                  className={`p-1.5 rounded transition-all ${
                    theme === key
                      ? 'bg-ink-800 dark:bg-amber-500 text-white dark:text-ink-950'
                      : 'text-ink-400 hover:text-ink-600 dark:hover:text-ink-200'
                  }`}
                >
                  <Icon size={12} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* User */}
        <div className="px-3 py-4 border-t border-ink-100 dark:border-ink-800">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-ink-200 dark:bg-ink-700 flex items-center justify-center text-sm font-bold text-ink-600 dark:text-ink-300">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{user?.name}</p>
              <p className="text-xs text-ink-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all font-medium"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-600 dark:text-ink-300">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-ink-800 dark:bg-amber-500 flex items-center justify-center">
              <FileText size={12} className="text-white dark:text-ink-950" />
            </div>
            <span className="font-display font-semibold text-ink-800 dark:text-ink-100 text-sm">GST Studio</span>
          </div>
          <div className="w-8" />
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
