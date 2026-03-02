// src/middleware/auth.middleware.js
// Valida JWT generado por nuestro propio servidor.

const AuthService = require('../services/AuthService');

// ── Middleware básico: cualquier usuario autenticado ──────────
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    req.user = AuthService.verifyToken(token); // { id, username, role }
    next();
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
}

// ── Middleware de admin: solo rol 'admin' ─────────────────────
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Acceso denegado. Solo los administradores pueden realizar esta acción.'
    });
  }
  next();
}

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
