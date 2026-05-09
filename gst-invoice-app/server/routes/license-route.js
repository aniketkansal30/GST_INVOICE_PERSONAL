const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/licenseController');

router.post('/verify', licenseController.verify);
router.post('/create', licenseController.create);
router.post('/bind', licenseController.bind);
router.post('/reset', licenseController.reset);
router.post('/list', licenseController.list);

module.exports = router;