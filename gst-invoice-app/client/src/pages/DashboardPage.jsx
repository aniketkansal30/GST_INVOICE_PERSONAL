import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../context/InvoiceContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/invoiceUtils';
import {
  Plus, Search, Eye, Edit2, Trash2, Copy, FileText,
  ChevronLeft, ChevronRight, TrendingUp, IndianRupee, Clock, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const StatusBadge = ({ status }) => {
  const styles = {
    draft: 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400',
    sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    paid: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    overdue: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${styles[status] || styles.draft}`}>
      {status || 'draft'}
    </span>
  );
};

export default function DashboardPage() {
  const { invoices, loading, pagination, fetchInvoices, deleteInvoice, duplicateInvoice } = useInvoices();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchInvoices({ search, page, limit: 10 });
  }, [search, page]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deleteInvoice(id);
    } finally {
      setDeleting(null);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const dup = await duplicateInvoice(id);
      toast.success('Invoice duplicated');
      fetchInvoices({ search, page, limit: 10 });
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  // Summary stats
  const totalAmount = invoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0);
  const paidCount = invoices.filter(i => i.status === 'paid').length;
  const draftCount = invoices.filter(i => i.status === 'draft' || !i.status).length;

  const stats = [
    { label: 'Total Invoices', value: pagination.total, icon: FileText, color: 'bg-ink-800 dark:bg-amber-500' },
    { label: 'Total Amount', value: formatCurrency(totalAmount), icon: IndianRupee, color: 'bg-emerald-600' },
    { label: 'Paid', value: paidCount, icon: CheckCircle, color: 'bg-blue-600' },
    { label: 'Drafts', value: draftCount, icon: Clock, color: 'bg-amber-500' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-800 dark:text-ink-100">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span className="italic">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">{user?.companyName} · GST Invoice Manager</p>
        </div>
        <button onClick={() => navigate('/invoices/new')} className="btn-primary">
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
                <Icon size={15} className="text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-ink-800 dark:text-ink-100 font-mono">{value}</p>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Invoices table */}
      <div className="card overflow-hidden">
        {/* Table header */}
        <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by client or invoice #..."
              className="input pl-9 h-9"
            />
          </div>
          <p className="text-xs text-ink-400 dark:text-ink-500 ml-auto font-mono">{pagination.total} invoices</p>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-ink-800 dark:border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
              <FileText size={28} className="text-ink-300 dark:text-ink-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-ink-600 dark:text-ink-300">No invoices yet</p>
              <p className="text-sm text-ink-400 mt-1">Create your first invoice to get started</p>
            </div>
            <button onClick={() => navigate('/invoices/new')} className="btn-primary">
              <Plus size={15} /> Create Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-800 text-left">
                  {['Invoice #', 'Client', 'Date', 'Due Date', 'Amount', 'Status', ''].map(h => (
                    <th key={h} className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50 dark:divide-ink-800">
                {invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono font-semibold text-ink-700 dark:text-ink-200">{inv.invoiceNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{inv.buyer?.clientName}</p>
                      <p className="text-xs text-ink-400">{inv.buyer?.state}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-500 dark:text-ink-400">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-6 py-4 text-sm text-ink-500 dark:text-ink-400">{formatDate(inv.dueDate)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-ink-800 dark:text-ink-100 font-mono">{formatCurrency(inv.grandTotal)}</span>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={inv.status} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/invoices/${inv._id}`)}
                          className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-all" title="View">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => navigate(`/invoices/${inv._id}/edit`)}
                          className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-all" title="Edit">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => handleDuplicate(inv._id)}
                          className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-all" title="Duplicate">
                          <Copy size={15} />
                        </button>
                        <button onClick={() => handleDelete(inv._id)} disabled={deleting === inv._id}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-ink-400 hover:text-red-600 transition-all" title="Delete">
                          {deleting === inv._id
                            ? <div className="w-3.5 h-3.5 border border-red-500 border-t-transparent rounded-full animate-spin" />
                            : <Trash2 size={15} />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-ink-100 dark:border-ink-800 flex items-center justify-between">
            <p className="text-xs text-ink-400 font-mono">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
