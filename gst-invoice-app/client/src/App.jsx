import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { InvoiceProvider } from './context/InvoiceContext';
import Layout from './components/Layout/Layout';

// Login/Signup load turant honi chahiye (pehla page jo dikhta hai) — normal import
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// Baaki sab pages lazy-load — sirf jab user unhe kholega tab download honge
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PosBillingPage = lazy(() => import('./pages/PosBillingPage'));
const InvoiceFormPage = lazy(() => import('./pages/InvoiceFormPage'));
const InvoicePreviewPage = lazy(() => import('./pages/InvoicePreviewPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const Report = lazy(() => import('./pages/Report'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));

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
  return !user ? children : <Navigate to="/pos" />;
};

// Lazy-loaded pages ke beech switch hote waqt dikhne wala chhota loader
const PageLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-8 h-8 border-2 border-ink-800 dark:border-amber-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <InvoiceProvider>
          <Router>
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'font-sans text-sm',
                style: { borderRadius: '10px', background: '#1c1c18', color: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.18)' },
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
                <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                  <Route index element={<Navigate to="/pos" />} />
                  <Route path="pos" element={<PosBillingPage />} />
                  <Route path="pos-billing" element={<PosBillingPage />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="invoices/:id/edit" element={<InvoiceFormPage />} />
                  <Route path="invoices/:id" element={<InvoicePreviewPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="invoice_details" element={<Report />} />
                  <Route path="gstr1" element={<Report />} />
                  <Route path="inventory" element={<InventoryPage />} />
                </Route>
              </Routes>
            </Suspense>
          </Router>
        </InvoiceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}