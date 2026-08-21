api.get('/products/report/low-stock')
  .then(res => setLowStock(res.data))
  .catch(() => {});