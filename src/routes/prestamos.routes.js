// src/routes/prestamos.routes.js

const express          = require('express');
const router           = express.Router();
const PrestamoService  = require('../services/PrestamoService');
const auth             = require('../middleware/auth.middleware');

router.use(auth);

// GET /api/prestamos/resumen → saldo neto entre socios
router.get('/resumen', async (req, res) => {
  try { res.json(await PrestamoService.getResumen()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/prestamos?soloActivos=true
router.get('/', async (req, res) => {
  try {
    const soloActivos = req.query.soloActivos === 'true';
    res.json(await PrestamoService.getAll({ soloActivos }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/prestamos/:id/cancelar → marcar como pagado
router.patch('/:id/cancelar', async (req, res) => {
  try {
    const row = await PrestamoService.cancelar(req.params.id, req.user.username);
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/prestamos/:id
router.delete('/:id', async (req, res) => {
  try { await PrestamoService.delete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
