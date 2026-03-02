// src/routes/sales.routes.js

const express     = require('express');
const router      = express.Router();
const SaleService = require('../services/SaleService');
const auth        = require('../middleware/auth.middleware');

router.use(auth);

// GET /api/sales/stats → estadísticas de ventas
router.get('/stats', async (req, res) => {
  try {
    const stats = await SaleService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sales?from=YYYY-MM-DD&to=YYYY-MM-DD → historial
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    const sales = await SaleService.getAll({ from, to });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sales → registrar venta
router.post('/', async (req, res) => {
  const { items, total, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'La venta debe tener al menos un ítem.' });

  if (total === undefined || isNaN(total))
    return res.status(400).json({ error: 'Total inválido.' });

  try {
    const sale = await SaleService.create(req.user.id, items, total, notes);
    res.status(201).json(sale);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
