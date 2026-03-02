// src/routes/ingresos.routes.js

const express        = require('express');
const router         = express.Router();
const IngresoService = require('../services/IngresoService');
const auth           = require('../middleware/auth.middleware');

router.use(auth);

// GET /api/ingresos/stats
router.get('/stats', async (req, res) => {
  try { res.json(await IngresoService.getStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/ingresos
router.get('/', async (req, res) => {
  try {
    const { from, to, departamento } = req.query;
    res.json(await IngresoService.getAll({ from, to, departamento }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ingresos
router.post('/', async (req, res) => {
  const { producto, monto_total } = req.body;
  if (!producto)    return res.status(400).json({ error: 'El producto es obligatorio.' });
  if (monto_total === undefined || isNaN(parseFloat(monto_total)))
    return res.status(400).json({ error: 'Monto inválido.' });
  try { res.status(201).json(await IngresoService.create(req.user.id, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/ingresos/:id
router.put('/:id', async (req, res) => {
  try { res.json(await IngresoService.update(req.params.id, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/ingresos/:id
router.delete('/:id', async (req, res) => {
  try { await IngresoService.delete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
