import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { InvoiceProvider } from './context/InvoiceContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import InvoiceFormPage from './pages/InvoiceFormPage';
import InvoicePreviewPage from './pages/InvoicePreviewPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout/Layout';
import Report from './pages/Report';
import PaymentsPage from './pages/PaymentsPage';
import InventoryPage from './pages/InventoryPage';
import LicenseGate from './components/LicenseGate';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-ink-800 dark:border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-ink-500 dark:text-ink-400 font-medium">Loading...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? children : <Navigate to="/dashboard" />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LicenseGate>
          <InvoiceProvider>
            <Router>
              <Toaster
                position="top-right"
                toastOptions={{
                  className: 'font-sans text-sm',
                  style: { borderRadius: '10px', background: '#18181600', color: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.18)' },
                  success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                  error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                }}
              />
              <Routes>
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
                <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                  <Route index element={<Navigate to="/dashboard" />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="invoices/new" element={<InvoiceFormPage />} />
                  <Route path="invoices/:id/edit" element={<InvoiceFormPage />} />
                  <Route path="invoices/:id" element={<InvoicePreviewPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="invoice_details" element={<Report />} />
                  <Route path="gstr1" element={<Report />} />
                  <Route path="payments" element={<PaymentsPage />} />
                  <Route path="inventory" element={<InventoryPage />} />
                </Route>
              </Routes>
            </Router>
          </InvoiceProvider>
        </LicenseGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
