const supabase = require('../config/supabase');

class CajaBaseService {
  async getByFecha(fecha) {
    const { data, error } = await supabase.from('caja_base').select('*').eq('fecha', fecha);
    if (error) throw new Error(error.message);
    return data || [];
  }

  async getAll({ from, to } = {}) {
    let q = supabase.from('caja_base').select('*').order('fecha', { ascending: false });
    if (from) q = q.gte('fecha', from);
    if (to)   q = q.lte('fecha', to);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async upsert(fecha, departamento, monto, username) {
    const { data, error } = await supabase.from('caja_base')
      .upsert({ fecha, departamento, monto: parseFloat(monto)||0,
                registrado_por: username||null, updated_at: new Date().toISOString() },
               { onConflict: 'fecha,departamento' })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getResumenDia(fecha) {
    const rows = await this.getByFecha(fecha);
    const base = { verduras_granos:0, carniceria:0, general:0, registrado_por:null, created_at:null };
    rows.forEach(r => {
      const m = parseFloat(r.monto)||0;
      if (r.departamento === 'verduras_granos') { base.verduras_granos = m; base.registrado_por = r.registrado_por; base.created_at = r.created_at; }
      if (r.departamento === 'carniceria') base.carniceria = m;
      if (r.departamento === 'general')   base.general    = m;
    });
    base.total     = base.verduras_granos + base.carniceria + base.general;
    base.registrada = rows.length > 0;
    return base;
  }
}

module.exports = new CajaBaseService();
