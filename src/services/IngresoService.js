// src/services/IngresoService.js

const supabase        = require('../config/supabase');
const PrestamoService = require('./PrestamoService');

class IngresoService {
  async create(userId, data) {
    const { producto, departamento, cantidad, monto_total, pagador_1, monto_1, pagador_2, monto_2, notas, fecha } = data;
    const fechaReal = fecha || new Date().toISOString().split('T')[0];

    const { data: row, error } = await supabase.from('ingresos')
      .insert({
        user_id:      userId,
        fecha:        fechaReal,
        producto,
        departamento: departamento || 'verduras_granos',
        cantidad:     cantidad    || null,
        monto_total:  parseFloat(monto_total) || 0,
        pagador_1:    pagador_1   || null,
        monto_1:      monto_1     ? parseFloat(monto_1)  : null,
        pagador_2:    pagador_2   || null,
        monto_2:      monto_2     ? parseFloat(monto_2)  : null,
        notas:        notas       || null,
      })
      .select().single();
    if (error) throw new Error(error.message);

    // ── Detectar préstamos automáticamente ────────────────────
    // Si pagador_1 pagó en un área que no le pertenece → préstamo
    if (pagador_1 && parseFloat(monto_1) > 0) {
      await PrestamoService.registrarSiAplica({
        pagador:     pagador_1.toLowerCase().trim(),
        departamento,
        monto:       parseFloat(monto_1),
        ingresoId:   row.id,
        fecha:       fechaReal,
        notas:       `Ingreso: ${producto}`,
      }).catch(() => {}); // no bloquear si falla
    }
    if (pagador_2 && parseFloat(monto_2) > 0) {
      await PrestamoService.registrarSiAplica({
        pagador:     pagador_2.toLowerCase().trim(),
        departamento,
        monto:       parseFloat(monto_2),
        ingresoId:   row.id,
        fecha:       fechaReal,
        notas:       `Ingreso: ${producto}`,
      }).catch(() => {});
    }

    return row;
  }

  async getAll({ from, to, departamento } = {}) {
    let query = supabase.from('ingresos')
      .select('*, users!user_id(username)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    if (from)         query = query.gte('fecha', from);
    if (to)           query = query.lte('fecha', to);
    if (departamento) query = query.eq('departamento', departamento);
    const { data, error } = await query;
    if (error) {
      // fallback sin join si no hay FK configurada
      let q2 = supabase.from('ingresos').select('*')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (from)         q2 = q2.gte('fecha', from);
      if (to)           q2 = q2.lte('fecha', to);
      if (departamento) q2 = q2.eq('departamento', departamento);
      const { data: d2, error: e2 } = await q2;
      if (e2) throw new Error(e2.message);
      return d2;
    }
    return data;
  }

  async update(id, data) {
    const { producto, departamento, cantidad, monto_total, pagador_1, monto_1, pagador_2, monto_2, notas, fecha } = data;
    const { data: row, error } = await supabase.from('ingresos')
      .update({
        fecha, producto, departamento, cantidad,
        monto_total:  parseFloat(monto_total) || 0,
        pagador_1:    pagador_1   || null,
        monto_1:      monto_1     ? parseFloat(monto_1)  : null,
        pagador_2:    pagador_2   || null,
        monto_2:      monto_2     ? parseFloat(monto_2)  : null,
        notas:        notas       || null,
      })
      .eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return row;
  }

  async delete(id) {
    const { error } = await supabase.from('ingresos').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }

  async getStats() {
    const now   = new Date();
    const today = now.toISOString().split('T')[0];
    const dayOfWeek = now.getDay();
    const sunday    = new Date(now); sunday.setDate(now.getDate() - dayOfWeek);
    const weekStart = sunday.toISOString().split('T')[0];

    const [todayRes, weekRes, allRes] = await Promise.all([
      supabase.from('ingresos').select('monto_total, departamento').eq('fecha', today),
      supabase.from('ingresos').select('monto_total, departamento').gte('fecha', weekStart).lte('fecha', today),
      supabase.from('ingresos').select('monto_total, departamento'),
    ]);

    const sum  = rows => (rows || []).reduce((a, r) => a + parseFloat(r.monto_total || 0), 0);
    const dept = (rows, d) => (rows || []).filter(r => r.departamento === d).reduce((a, r) => a + parseFloat(r.monto_total || 0), 0);

    return {
      today: { total: sum(todayRes.data), count: todayRes.data?.length || 0,
        carniceria: dept(todayRes.data, 'carniceria'), verduras_granos: dept(todayRes.data, 'verduras_granos') },
      week:  { total: sum(weekRes.data),  count: weekRes.data?.length  || 0,
        carniceria: dept(weekRes.data,  'carniceria'), verduras_granos: dept(weekRes.data,  'verduras_granos') },
      all:   { total: sum(allRes.data),   count: allRes.data?.length   || 0 },
    };
  }
}

module.exports = new IngresoService();
