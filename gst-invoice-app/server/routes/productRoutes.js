const express = require('express');
const router = express.Router();
const {
  getProducts, getProductByBarcode, createProduct, updateProduct, deleteProduct,
  addStock, getStockHistory, getInventoryReport, getLowStockProducts
} = require('../controllers/productController');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/report/inventory', getInventoryReport);
router.get('/report/low-stock', getLowStockProducts);
router.get('/barcode/:barcode', getProductByBarcode);
router.get('/', getProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/:id/add-stock', addStock);
router.get('/:id/history', getStockHistory);

module.exports = router;
