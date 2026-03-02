// src/routes/auth.routes.js

const express     = require('express');
const router      = express.Router();
const AuthService = require('../services/AuthService');
const auth        = require('../middleware/auth.middleware');

// POST /api/auth/register — SOLO ADMINS pueden crear usuarios
router.post('/register', auth, async (req, res) => {
  // Verificar que quien llama es admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores pueden crear usuarios.' });
  }

  const { username, password, role } = req.body;

  if (!username || !username.trim())
    return res.status(400).json({ error: 'El nombre de usuario es requerido.' });
  if (!password)
    return res.status(400).json({ error: 'La contraseña es requerida.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mínimo 6 caracteres.' });

  try {
    const assignedRole = role || 'cajero';
    const result = await AuthService.register(username, password, assignedRole);
    res.status(201).json({ message: 'Usuario creado.', ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });

  try {
    const result = await AuthService.login(username, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// GET /api/auth/users — Lista usuarios (para pantalla de bloqueo)
// Solo usuarios autenticados pueden ver la lista
router.get('/users', auth, async (req, res) => {
  try {
    const users = await AuthService.getUsers();
    // No devolver contraseñas
    res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/auth/users/:id — Solo admins pueden eliminar usuarios
router.delete('/users/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Solo los administradores pueden eliminar usuarios.' });
  if (req.user.id === req.params.id)
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });
  try {
    await AuthService.deleteUser(req.params.id);
    res.json({ message: 'Usuario eliminado.' });
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
