import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const InvoiceContext = createContext(null);

export const InvoiceProvider = ({ children }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const fetchInvoices = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await api.get('/invoices', { params });
      setInvoices(res.data.invoices);
      setPagination({ page: res.data.page, pages: res.data.pages, total: res.data.total });
    } catch (err) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  const createInvoice = useCallback(async (data) => {
    const res = await api.post('/invoices', data);
    toast.success('Invoice created!');
    return res.data;
  }, []);

  const updateInvoice = useCallback(async (id, data) => {
  const res = await api.put(`/invoices/${id}`, data);
  setInvoices(prev => prev.map(inv => inv._id === id ? res.data : inv));
  toast.success('Invoice updated!');
  return res.data;
}, []);

  const deleteInvoice = useCallback(async (id) => {
    await api.delete(`/invoices/${id}`);
    setInvoices(prev => prev.filter(inv => inv._id !== id));
    toast.success('Invoice deleted');
  }, []);

  const duplicateInvoice = useCallback(async (id) => {
    const res = await api.post(`/invoices/${id}/duplicate`);
    toast.success('Invoice duplicated!');
    return res.data;
  }, []);

  const getInvoice = useCallback(async (id) => {
    const res = await api.get(`/invoices/${id}`);
    return res.data;
  }, []);

  return (
    <InvoiceContext.Provider value={{
      invoices, loading, pagination,
      fetchInvoices, createInvoice, updateInvoice,
      deleteInvoice, duplicateInvoice, getInvoice,
    }}>
      {children}
    </InvoiceContext.Provider>
  );
};

export const useInvoices = () => {
  const ctx = useContext(InvoiceContext);
  if (!ctx) throw new Error('useInvoices must be used within InvoiceProvider');
  return ctx;
};
