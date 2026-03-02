// src/routes/scales.routes.js

const express      = require('express');
const router       = express.Router();
const ScaleService = require('../services/ScaleService');
const auth         = require('../middleware/auth.middleware');

router.use(auth);

router.get('/',         async (req, res) => { try { res.json(await ScaleService.getAll()); } catch(e) { res.status(500).json({ error: e.message }); } });
router.post('/',        async (req, res) => { try { res.status(201).json(await ScaleService.create(req.body)); } catch(e) { res.status(400).json({ error: e.message }); } });
router.put('/:id',      async (req, res) => { try { res.json(await ScaleService.update(req.params.id, req.body)); } catch(e) { res.status(400).json({ error: e.message }); } });
router.delete('/:id',   async (req, res) => { try { await ScaleService.delete(req.params.id); res.json({ message: 'Pesa eliminada.' }); } catch(e) { res.status(400).json({ error: e.message }); } });

module.exports = router;
