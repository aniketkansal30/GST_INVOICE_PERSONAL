const express = require('express');
const router = express.Router();
const {
  getDebitNotes, createDebitNote, deleteDebitNote
} = require('../controllers/debitNoteController');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/', getDebitNotes);
router.post('/', createDebitNote);
router.delete('/:id', deleteDebitNote);

module.exports = router;