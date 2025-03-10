const bcrypt = require('bcryptjs');
const supabase = require('../config/database');

class User {
  static async create(userData) {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Insert the user and return the inserted data
      const { data, error } = await supabase
        .from('users')
        .insert({
          name: userData.name,
          email: userData.email,
          password: hashedPassword
        })
        .select('id, name, email')
        .maybeSingle();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Failed to create user');
      }

      return data;
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('Find by email error:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('Find by id error:', error);
      throw error;
    }
  }

  static async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }
}

module.exports = User; 