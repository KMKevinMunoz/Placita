// src/services/AuthService.js

const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const supabase = require('../config/supabase');

const JWT_SECRET  = process.env.JWT_SECRET || 'cambia_esto_en_produccion';
const JWT_EXPIRES = '7d';

class AuthService {

  async register(username, password, role = 'cajero') {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase().trim())
      .maybeSingle();

    if (existing) throw new Error('Este usuario ya existe.');

    const hashedPassword = await bcrypt.hash(password, 10);

    // Solo un admin puede crear otro admin (validar en la ruta)
    const safeRole = ['admin', 'cajero'].includes(role) ? role : 'cajero';

    const { data, error } = await supabase
      .from('users')
      .insert({
        username: username.toLowerCase().trim(),
        password: hashedPassword,
        role: safeRole
      })
      .select('id, username, role')
      .single();

    if (error) throw new Error(error.message);
    return { userId: data.id, username: data.username, role: data.role };
  }

  async login(username, password) {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password, role')
      .eq('username', username.toLowerCase().trim())
      .maybeSingle();

    if (error || !user) throw new Error('Usuario o contraseña incorrectos.');

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) throw new Error('Usuario o contraseña incorrectos.');

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return {
      token,
      user: { id: user.id, username: user.username, role: user.role }
    };
  }

  // Obtener lista de usuarios (para la pantalla de bloqueo)
  async getUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role')
      .order('username');
    if (error) throw new Error(error.message);
    return data;
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      throw new Error('Token inválido o expirado. Inicia sesión de nuevo.');
    }
  }
}

module.exports = new AuthService();
