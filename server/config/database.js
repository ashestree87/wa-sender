const { D1Database } = require('@cloudflare/workers-types');
const { connect } = require('@databases/sqlite');
const dotenv = require('dotenv');

dotenv.config();

// Determine if we're in development or production
const isDev = process.env.NODE_ENV !== 'production';

let db;

if (isDev) {
  // Use SQLite for local development
  const path = require('path');
  const dbPath = path.join(__dirname, '../../', process.env.DEV_DB_PATH || 'wa_sender.db');
  db = connect(`file:${dbPath}`);
} else {
  // In production we'll use Cloudflare D1
  // The actual binding will be set by Cloudflare Workers environment
  // This code is a placeholder that will be replaced at runtime
  db = process.env.DB;
}

/**
 * Database client that abstracts away differences between SQLite and D1
 */
class Database {
  constructor(client) {
    this.client = client;
  }

  /**
   * Execute a query with parameters
   * @param {string} query - SQL query
   * @param {Object} params - Parameters for the query
   * @returns {Promise<Object>} - Query result
   */
  async query(query, params = {}) {
    try {
      if (isDev) {
        // Local SQLite
        const result = await this.client.query(query, params);
        return { data: result, error: null };
      } else {
        // Cloudflare D1
        const prepared = this.client.prepare(query);
        
        // Bind parameters
        Object.entries(params).forEach(([key, value]) => {
          prepared.bind(key, value);
        });
        
        const result = await prepared.all();
        return { data: result.results, error: null };
      }
    } catch (error) {
      console.error('Database query error:', error);
      return { data: null, error };
    }
  }

  /**
   * Get a single row from a table
   * @param {string} table - Table name
   * @param {Object} conditions - WHERE conditions
   * @returns {Promise<Object>} - Query result
   */
  async getOne(table, conditions = {}) {
    const conditionKeys = Object.keys(conditions);
    
    if (conditionKeys.length === 0) {
      return { data: null, error: new Error('No conditions provided for getOne') };
    }

    const whereClauses = conditionKeys.map(key => `${key} = :${key}`).join(' AND ');
    const query = `SELECT * FROM ${table} WHERE ${whereClauses} LIMIT 1`;

    const { data, error } = await this.query(query, conditions);
    
    return {
      data: data && data.length > 0 ? data[0] : null,
      error
    };
  }

  /**
   * Get multiple rows from a table
   * @param {string} table - Table name
   * @param {Object} conditions - WHERE conditions
   * @param {Object} options - Additional options like orderBy, limit, etc.
   * @returns {Promise<Object>} - Query result
   */
  async getMany(table, conditions = {}, options = {}) {
    const conditionKeys = Object.keys(conditions);
    let query = `SELECT * FROM ${table}`;
    
    if (conditionKeys.length > 0) {
      const whereClauses = conditionKeys.map(key => `${key} = :${key}`).join(' AND ');
      query += ` WHERE ${whereClauses}`;
    }
    
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy.column} ${options.orderBy.direction || 'ASC'}`;
    }
    
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    return await this.query(query, conditions);
  }

  /**
   * Insert data into a table
   * @param {string} table - Table name
   * @param {Object|Array} data - Data to insert
   * @returns {Promise<Object>} - Query result
   */
  async insert(table, data) {
    if (Array.isArray(data)) {
      // Bulk insert
      if (data.length === 0) {
        return { data: [], error: null };
      }
      
      const columns = Object.keys(data[0]);
      const placeholders = data.map((_, index) => {
        return `(${columns.map(col => `:${col}_${index}`).join(', ')})`;
      }).join(', ');
      
      const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders} RETURNING *`;
      
      // Create params object with indexed parameters
      const params = {};
      data.forEach((item, index) => {
        columns.forEach(col => {
          params[`${col}_${index}`] = item[col];
        });
      });
      
      return await this.query(query, params);
    } else {
      // Single insert
      const columns = Object.keys(data);
      const placeholders = columns.map(col => `:${col}`).join(', ');
      
      const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      
      return await this.query(query, data);
    }
  }

  /**
   * Update data in a table
   * @param {string} table - Table name
   * @param {Object} data - Data to update
   * @param {Object} conditions - WHERE conditions
   * @returns {Promise<Object>} - Query result
   */
  async update(table, data, conditions) {
    const conditionKeys = Object.keys(conditions);
    const dataKeys = Object.keys(data);
    
    if (conditionKeys.length === 0) {
      return { data: null, error: new Error('No conditions provided for update') };
    }
    
    if (dataKeys.length === 0) {
      return { data: null, error: new Error('No data provided for update') };
    }
    
    const setClauses = dataKeys.map(key => `${key} = :${key}`).join(', ');
    const whereClauses = conditionKeys.map(key => `${key} = :c_${key}`).join(' AND ');
    
    const query = `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses} RETURNING *`;
    
    // Prepare params with prefixed condition keys to avoid name collisions
    const params = { ...data };
    conditionKeys.forEach(key => {
      params[`c_${key}`] = conditions[key];
    });
    
    return await this.query(query, params);
  }

  /**
   * Delete data from a table
   * @param {string} table - Table name
   * @param {Object} conditions - WHERE conditions
   * @returns {Promise<Object>} - Query result
   */
  async delete(table, conditions) {
    const conditionKeys = Object.keys(conditions);
    
    if (conditionKeys.length === 0) {
      return { data: null, error: new Error('No conditions provided for delete') };
    }
    
    const whereClauses = conditionKeys.map(key => `${key} = :${key}`).join(' AND ');
    const query = `DELETE FROM ${table} WHERE ${whereClauses}`;
    
    return await this.query(query, conditions);
  }
}

module.exports = new Database(db); 