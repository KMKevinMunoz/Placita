// src/services/SaleService.js
// Colombia = UTC-5 (no tiene horario de verano)
// Supabase guarda timestamps en UTC. Para filtrar por fecha local hay que
// desplazar los rangos: lo que el usuario ve como "hoy 00:00" es UTC 05:00.

const supabase  = require('../config/supabase');
const TZ_OFFSET = 5; // Colombia = UTC-5

function localDayStart(localDate) {
  // "2026-02-23" + Colombia 00:00 = UTC 05:00 del mismo día
  return `${localDate}T${String(TZ_OFFSET).padStart(2,'0')}:00:00.000Z`;
}

function localDayEnd(localDate) {
  // Colombia 23:59:59 del localDate = UTC 05:00 del día SIGUIENTE
  const d = new Date(`${localDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(TZ_OFFSET, 0, 0, 0);
  return d.toISOString();
}

function localToday() {
  const local = new Date(Date.now() - TZ_OFFSET * 3600 * 1000);
  return local.toISOString().split('T')[0];
}

class SaleService {
  async create(userId, items, total, notes) {
    const { data: sale, error: saleError } = await supabase.from('sales')
      .insert({ user_id: userId, total, notes: notes || null }).select().single();
    if (saleError) throw new Error(saleError.message);

    const saleItems = items.map(item => ({
      sale_id:      sale.id,
      product_id:   item.productId,
      product_name: item.name,
      quantity:     item.quantity,
      unit_price:   item.price,
      subtotal:     parseFloat((item.price * item.quantity).toFixed(2)),
      department:   item.department || 'verduras_granos'
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
    if (itemsError) throw new Error(itemsError.message);
    return sale;
  }

  async getAll({ from, to } = {}) {
    let query = supabase.from('sales')
      .select('*, sale_items(product_name, quantity, unit_price, subtotal, department)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (from) query = query.gte('created_at', localDayStart(from));
    if (to)   query = query.lt('created_at',  localDayEnd(to));

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  async getStats() {
    const today    = localToday();
    const todayUTC = localDayStart(today);

    const nowLocal = new Date(Date.now() - TZ_OFFSET * 3600 * 1000);
    const sunday   = new Date(nowLocal);
    sunday.setUTCDate(nowLocal.getUTCDate() - nowLocal.getUTCDay());
    const weekUTC  = localDayStart(sunday.toISOString().split('T')[0]);
    const monthUTC = localDayStart(today.slice(0, 7) + '-01');

    const [todayRes, weekRes, monthRes, allRes] = await Promise.all([
      supabase.from('sales').select('total, sale_items(subtotal, department)').gte('created_at', todayUTC),
      supabase.from('sales').select('total, sale_items(subtotal, department)').gte('created_at', weekUTC),
      supabase.from('sales').select('total, sale_items(subtotal, department)').gte('created_at', monthUTC),
      supabase.from('sales').select('total'),
    ]);

    const sum  = rows => (rows || []).reduce((a, r) => a + parseFloat(r.total || 0), 0);
    const dept = (sales, d) => (sales || [])
      .flatMap(s => s.sale_items || [])
      .filter(i => d === 'carniceria' ? i.department === 'carniceria' : i.department !== 'carniceria')
      .reduce((a, i) => a + parseFloat(i.subtotal || 0), 0);

    return {
      today: { total: sum(todayRes.data), count: todayRes.data?.length || 0,
               carniceria: dept(todayRes.data,'carniceria'), verduras_granos: dept(todayRes.data,'verduras_granos') },
      week:  { total: sum(weekRes.data),  count: weekRes.data?.length  || 0,
               carniceria: dept(weekRes.data,'carniceria'),  verduras_granos: dept(weekRes.data,'verduras_granos') },
      month: { total: sum(monthRes.data), count: monthRes.data?.length || 0,
               carniceria: dept(monthRes.data,'carniceria'), verduras_granos: dept(monthRes.data,'verduras_granos') },
      all:   { total: sum(allRes.data),   count: allRes.data?.length   || 0 },
    };
  }
}

module.exports = new SaleService();
