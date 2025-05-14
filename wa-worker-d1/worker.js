import app from '../wa-sender/server/app';

// Worker for handling requests with D1 database
export default {
  async fetch(request, env) {
    // Attach the D1 database
    const db = env.DB;
    const url = new URL(request.url);
    
    // Set CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    // Handle OPTIONS requests for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    
    // Handle API routes
    if (url.pathname.startsWith('/api')) {
      try {
        // Parse JSON body if present
        let body = null;
        if (request.method !== 'GET' && request.headers.get('content-type')?.includes('application/json')) {
          body = await request.json();
        }
        
        // Health check endpoint
        if (url.pathname === '/api/health') {
          return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Direct SQL query endpoint (protected, needs authentication in production)
        if (url.pathname === '/api/query' && request.method === 'POST') {
          if (!body || !body.query) {
            return new Response(JSON.stringify({ error: 'Query is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const result = await db.prepare(body.query)
            .bind(...(body.params || []))
            .all();
          
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Generic table API endpoints
        const tableMatch = url.pathname.match(/^\/api\/([^\/]+)(?:\/([^\/]+))?$/);
        
        if (tableMatch) {
          const tableName = tableMatch[1];
          const recordId = tableMatch[2];
          
          // GET /api/{table} - List records
          if (request.method === 'GET' && !recordId) {
            // Get URL parameters for filtering
            const params = {};
            for (const [key, value] of url.searchParams.entries()) {
              params[key] = value;
            }
            
            // Build WHERE clause from params
            const whereConditions = [];
            const whereParams = [];
            
            for (const [key, value] of Object.entries(params)) {
              whereConditions.push(`${key} = ?`);
              whereParams.push(value);
            }
            
            const whereClause = whereConditions.length > 0
              ? `WHERE ${whereConditions.join(' AND ')}`
              : '';
            
            // Execute query
            const result = await db.prepare(`SELECT * FROM ${tableName} ${whereClause}`)
              .bind(...whereParams)
              .all();
            
            return new Response(JSON.stringify(result.results), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // GET /api/{table}/{id} - Get record by ID
          if (request.method === 'GET' && recordId) {
            const result = await db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
              .bind(recordId)
              .first();
            
            if (!result) {
              return new Response(JSON.stringify({ error: 'Record not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // POST /api/{table} - Create record
          if (request.method === 'POST' && !recordId) {
            if (!body) {
              return new Response(JSON.stringify({ error: 'Request body is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            const columns = Object.keys(body);
            const values = Object.values(body);
            const placeholders = columns.map(() => '?').join(', ');
            
            const result = await db.prepare(
              `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`
            )
              .bind(...values)
              .first();
            
            return new Response(JSON.stringify(result), {
              status: 201,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // PUT /api/{table}/{id} - Update record
          if (request.method === 'PUT' && recordId) {
            if (!body) {
              return new Response(JSON.stringify({ error: 'Request body is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            const setClause = Object.keys(body).map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(body), recordId];
            
            const result = await db.prepare(
              `UPDATE ${tableName} SET ${setClause} WHERE id = ? RETURNING *`
            )
              .bind(...values)
              .first();
            
            if (!result) {
              return new Response(JSON.stringify({ error: 'Record not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // DELETE /api/{table}/{id} - Delete record
          if (request.method === 'DELETE' && recordId) {
            await db.prepare(`DELETE FROM ${tableName} WHERE id = ?`)
              .bind(recordId)
              .run();
            
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        
        // Default 404 response for unhandled API routes
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error(error);
        // Handle errors
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // For non-API paths, return a simple JSON response
    return new Response(JSON.stringify({ 
      message: 'WhatsApp Sender API - D1 Worker' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}; 