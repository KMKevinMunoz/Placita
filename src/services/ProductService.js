// src/services/ProductService.js

const supabase = require('../config/supabase');

class ProductService {
  async getAll(onlyActive = false, department = null) {
    let query = supabase.from('products').select('*').order('department').order('sort_order').order('name');
    if (onlyActive)   query = query.eq('active', true);
    if (department)   query = query.eq('department', department);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  async create({ name, price, unit, category, department = 'verduras_granos', active = true, sort_order = 0, emoji = '📦', sold_by_weight = false, image_url = null }) {
    const { data, error } = await supabase.from('products')
      .insert({ name, price, unit, category: category || null, department, active, sort_order, emoji, sold_by_weight, image_url })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id, fields) {
    const { data, error } = await supabase.from('products').update(fields).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updatePrice(id, price) { return this.update(id, { price: parseFloat(price) }); }

  async updateOrder(id, sort_order) { return this.update(id, { sort_order }); }

  async delete(id) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
}

module.exports = new ProductService();
