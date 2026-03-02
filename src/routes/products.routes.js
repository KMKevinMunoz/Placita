// src/routes/products.routes.js

const express        = require('express');
const router         = express.Router();
const ProductService = require('../services/ProductService');
const auth           = require('../middleware/auth.middleware');
const { requireAdmin } = auth;

// Todos los endpoints requieren autenticación
router.use(auth);

// GET /api/products — Cualquier usuario autenticado
router.get('/', async (req, res) => {
  try {
    const onlyActive   = req.query.active === 'true';
    const department   = req.query.department || null;
    res.json(await ProductService.getAll(onlyActive, department));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/products — Solo admin
router.post('/', requireAdmin, async (req, res) => {
  try { res.status(201).json(await ProductService.create(req.body)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/products/:id — Solo admin
router.put('/:id', requireAdmin, async (req, res) => {
  try { res.json(await ProductService.update(req.params.id, req.body)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/products/:id/price — Admin y cajero pueden cambiar precios
router.patch('/:id/price', async (req, res) => {
  const { price } = req.body;
  if (price === undefined || isNaN(price)) return res.status(400).json({ error: 'Precio inválido.' });
  try { res.json(await ProductService.updatePrice(req.params.id, price)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/products/:id/order — Solo admin
router.patch('/:id/order', requireAdmin, async (req, res) => {
  const { sort_order } = req.body;
  try { res.json(await ProductService.updateOrder(req.params.id, sort_order)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/products/:id — Solo admin
router.delete('/:id', requireAdmin, async (req, res) => {
  try { await ProductService.delete(req.params.id); res.json({ message: 'Eliminado.' }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
