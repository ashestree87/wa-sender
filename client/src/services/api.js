import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api'
});

// Add a request interceptor to include the token in all requests
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor (keep this disabled for now during development)
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    
    // Comment out the redirect logic for now
    /*
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    */
    
    return Promise.reject(error);
  }
);

export default api; 