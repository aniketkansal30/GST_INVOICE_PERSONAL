const express = require('express');
const router = express.Router();
const {
  getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, duplicateInvoice
} = require('../controllers/invoiceController');
const { auth } = require('../middleware/auth');

router.use(auth); // All invoice routes require auth

router.get('/', getInvoices);
router.post('/', createInvoice);
router.get('/:id', getInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);
router.post('/:id/duplicate', duplicateInvoice);

module.exports = router;
