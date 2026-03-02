// src/routes/auth.routes.js

const express     = require('express');
const router      = express.Router();
const AuthService = require('../services/AuthService');
const auth        = require('../middleware/auth.middleware');

// POST /api/auth/register
// Solo admins pueden crear usuarios; o si no hay usuarios aún (primer usuario)
router.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !username.trim())
    return res.status(400).json({ error: 'El nombre de usuario es requerido.' });
  if (!password)
    return res.status(400).json({ error: 'La contraseña es requerida.' });
  if (password.length < 4)
    return res.status(400).json({ error: 'Mínimo 4 caracteres o dígitos.' });

  try {
    // El rol solo se puede asignar si quien llama es admin
    // Si no hay token, solo puede crear cajero (primer registro)
    const authHeader = req.headers['authorization'];
    let assignedRole = 'cajero';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const caller = AuthService.verifyToken(authHeader.split(' ')[1]);
        if (caller.role === 'admin') {
          assignedRole = role || 'cajero';
        }
      } catch (_) { /* token inválido, usar cajero */ }
    }

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

module.exports = router;
