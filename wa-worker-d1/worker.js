import app from '../wa-sender/server/app';

// Create a fetch event handler for the Worker
export default {
  async fetch(request, env) {
    // Attach the D1 database to the environment
    env.DB = env.DB || null;
    
    // Set environment variables
    process.env.DB = env.DB;
    process.env.NODE_ENV = 'production';
    process.env.CLOUDFLARE_WORKER = 'true';
    
    // Create a new URL object so we can modify the pathname
    const url = new URL(request.url);
    
    // Handle API requests
    if (url.pathname.startsWith('/api')) {
      // Let the Express app handle the request
      return app(request, env);
    }
    
    // For other paths, return a simple JSON response
    return new Response(JSON.stringify({ 
      message: 'WhatsApp Sender API' 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}; 