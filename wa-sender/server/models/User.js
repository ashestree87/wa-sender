const bcrypt = require('bcryptjs');
const db = require('../config/database');

class User {
  static async create(userData) {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Insert the user and return the inserted data
      const { data, error } = await db.insert('users', {
        name: userData.name,
        email: userData.email,
        password: hashedPassword
      });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Failed to create user');
      }

      const user = data[0];
      
      // Return only necessary fields
      return {
        id: user.id,
        name: user.name,
        email: user.email
      };
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const { data, error } = await db.getOne('users', {
        email: email
      });

      if (error) {
        console.error('Database error:', error);
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
      const { data, error } = await db.getOne('users', {
        id: id
      });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      if (!data) {
        return null;
      }

      // Return only necessary fields
      return {
        id: data.id,
        name: data.name,
        email: data.email
      };
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