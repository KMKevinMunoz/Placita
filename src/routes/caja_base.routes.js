const express         = require('express');
const router          = express.Router();
const CajaBaseService = require('../services/CajaBaseService');
const auth            = require('../middleware/auth.middleware');
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { fecha, from, to } = req.query;
    if (fecha) res.json(await CajaBaseService.getResumenDia(fecha));
    else       res.json(await CajaBaseService.getAll({ from, to }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { fecha, verduras_granos, carniceria, general } = req.body;
    if (!fecha) return res.status(400).json({ error: 'fecha requerida' });
    const [v, c, g] = await Promise.all([
      CajaBaseService.upsert(fecha, 'verduras_granos', verduras_granos||0, req.user.username),
      CajaBaseService.upsert(fecha, 'carniceria',      carniceria||0,      req.user.username),
      CajaBaseService.upsert(fecha, 'general',         general||0,         req.user.username),
    ]);
    res.json({ verduras: v, carniceria: c, general: g });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
