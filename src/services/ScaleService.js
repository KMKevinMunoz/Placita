// src/services/ScaleService.js

const supabase = require('../config/supabase');

class ScaleService {
  async getAll() {
    const { data, error } = await supabase.from('scales').select('*').order('department').order('name');
    if (error) throw new Error(error.message);
    return data;
  }

  async create({ name, unit, capacity, department, notes }) {
    const { data, error } = await supabase
      .from('scales').insert({ name, unit, capacity: capacity || null, department, notes: notes || null, active: true })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id, fields) {
    const { data, error } = await supabase.from('scales').update(fields).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id) {
    const { error } = await supabase.from('scales').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
}

module.exports = new ScaleService();
