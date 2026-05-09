const express = require('express');
const router = express.Router();
const {
  getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, duplicateInvoice,
  getClients, getProducts
} = require('../controllers/invoiceController');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/meta/clients', getClients);
router.get('/meta/products', getProducts);
router.get('/', getInvoices);
router.post('/', createInvoice);
router.get('/:id', getInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);
router.post('/:id/duplicate', duplicateInvoice);

module.exports = router;
