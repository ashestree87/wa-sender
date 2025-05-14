const axios = require('axios');

/**
 * Service to interact with the Cloudflare Worker with D1 database
 */
class DatabaseService {
  constructor() {
    // The base URL of the Cloudflare Worker
    this.baseUrl = process.env.WORKER_API_URL || 'https://wa-worker-d1.your-account.workers.dev';
    
    // Create HTTP client with default config
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
  }

  /**
   * Execute a database query
   * @param {string} query - SQL query to execute
   * @param {Array<any>} params - Query parameters
   * @returns {Promise<any>} - Query results
   */
  async query(query, params = []) {
    try {
      const response = await this.client.post('/api/query', {
        query,
        params
      });
      
      return response.data;
    } catch (error) {
      console.error('Database query error:', error.message);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * Get a record by ID
   * @param {string} table - Table name
   * @param {number|string} id - Record ID
   * @returns {Promise<any>} - Record data
   */
  async getById(table, id) {
    try {
      const response = await this.client.get(`/api/${table}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get ${table} record:`, error.message);
      throw new Error(`Failed to get ${table} record: ${error.message}`);
    }
  }

  /**
   * Get multiple records
   * @param {string} table - Table name
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array<any>>} - Array of records
   */
  async getRecords(table, filters = {}) {
    try {
      const response = await this.client.get(`/api/${table}`, {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to get ${table} records:`, error.message);
      throw new Error(`Failed to get ${table} records: ${error.message}`);
    }
  }

  /**
   * Create a new record
   * @param {string} table - Table name
   * @param {Object} data - Record data
   * @returns {Promise<any>} - Created record
   */
  async create(table, data) {
    try {
      const response = await this.client.post(`/api/${table}`, data);
      return response.data;
    } catch (error) {
      console.error(`Failed to create ${table} record:`, error.message);
      throw new Error(`Failed to create ${table} record: ${error.message}`);
    }
  }

  /**
   * Update an existing record
   * @param {string} table - Table name
   * @param {number|string} id - Record ID
   * @param {Object} data - Updated data
   * @returns {Promise<any>} - Updated record
   */
  async update(table, id, data) {
    try {
      const response = await this.client.put(`/api/${table}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(`Failed to update ${table} record:`, error.message);
      throw new Error(`Failed to update ${table} record: ${error.message}`);
    }
  }

  /**
   * Delete a record
   * @param {string} table - Table name
   * @param {number|string} id - Record ID
   * @returns {Promise<boolean>} - Success status
   */
  async delete(table, id) {
    try {
      await this.client.delete(`/api/${table}/${id}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete ${table} record:`, error.message);
      throw new Error(`Failed to delete ${table} record: ${error.message}`);
    }
  }

  /**
   * Check database connection
   * @returns {Promise<boolean>} - Connection status
   */
  async checkConnection() {
    try {
      const response = await this.client.get('/api/health');
      return response.data.status === 'ok';
    } catch (error) {
      console.error('Database connection check failed:', error.message);
      return false;
    }
  }
}

module.exports = new DatabaseService(); 