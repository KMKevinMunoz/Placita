// src/services/PrestamoService.js

const supabase = require('../config/supabase');

// Dueños de cada área
const DUENOS = {
  verduras_granos: 'jose',
  carniceria:      'claudia'
};

class PrestamoService {

  // Detecta si un pago genera préstamo y lo crea
  // pagadorNombre: nombre del usuario que registró el ingreso
  // departamento: área del ingreso
  // monto: cuánto pagó ESA persona en ESA área
  // ingresoId: uuid del ingreso relacionado (opcional)
  async registrarSiAplica({ pagador, departamento, monto, ingresoId = null, fecha = null, notas = null }) {
    const dueno = DUENOS[departamento];
    if (!dueno) return null; // área desconocida, no aplica

    const pagadorLower = (pagador || '').toLowerCase().trim();

    // Si el que pagó NO es el dueño del área → genera préstamo
    // Ej: Jose paga en carnicería (de Claudia) → Jose le prestó a Claudia
    if (pagadorLower !== dueno && pagadorLower !== '') {
      const { data, error } = await supabase.from('prestamos').insert({
        pagador:      pagadorLower,
        departamento,
        beneficiario: dueno,
        monto:        parseFloat(monto),
        ingreso_id:   ingresoId || null,
        fecha:        fecha || new Date().toISOString().split('T')[0],
        notas:        notas || null,
      }).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    return null;
  }

  async getAll({ soloActivos = false } = {}) {
    let query = supabase.from('prestamos')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    if (soloActivos) query = query.eq('cancelado', false);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  async cancelar(id, username) {
    const { data, error } = await supabase.from('prestamos')
      .update({ cancelado: true, cancelado_at: new Date().toISOString(), cancelado_by: username })
      .eq('id', id)
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id) {
    const { error } = await supabase.from('prestamos').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }

  async getResumen() {
    // Todos los préstamos activos (no cancelados)
    const { data, error } = await supabase.from('prestamos')
      .select('pagador, beneficiario, monto, departamento')
      .eq('cancelado', false);
    if (error) throw new Error(error.message);

    const rows = data || [];

    // Deuda neta: cuánto debe cada uno al otro
    // prestamo.pagador pagó por prestamo.beneficiario
    // → beneficiario le debe monto al pagador

    const deudas = {
      jose_debe_a_claudia:    0,   // jose pagó en carnicería → claudia le debe a jose
      claudia_debe_a_jose:    0,   // claudia pagó en verduras → jose le debe a claudia
    };

    rows.forEach(r => {
      // r.pagador le prestó a r.beneficiario
      if (r.pagador === 'jose'    && r.beneficiario === 'claudia') deudas.claudia_debe_a_jose    += parseFloat(r.monto);
      if (r.pagador === 'claudia' && r.beneficiario === 'jose')    deudas.jose_debe_a_claudia    += parseFloat(r.monto);
    });

    // Saldo neto: si ambos se deben algo, se resta
    const netaJose    = deudas.claudia_debe_a_jose    - deudas.jose_debe_a_claudia;
    const netaClaudia = deudas.jose_debe_a_claudia    - deudas.claudia_debe_a_jose;

    return {
      detalle: {
        jose_pago_por_claudia:    deudas.claudia_debe_a_jose,    // jose cubrió área de claudia
        claudia_pago_por_jose:    deudas.jose_debe_a_claudia,    // claudia cubrió área de jose
      },
      neto: {
        // > 0 significa que esa persona le debe ese monto al otro
        jose_debe:    Math.max(0, -netaJose),
        claudia_debe: Math.max(0, -netaClaudia),
        saldo:        Math.abs(netaJose),
        quien_debe:   netaJose > 0 ? 'claudia' : netaJose < 0 ? 'jose' : null,
        monto_neto:   Math.abs(netaJose),
      },
      total_activos: rows.length,
    };
  }
}

module.exports = new PrestamoService();
