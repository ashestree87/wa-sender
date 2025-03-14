import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
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

// Add response interceptor to handle errors
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;

// Remove this export as it's causing conflicts
// export const pauseCampaign = async (campaignId) => {
//   try {
//     const response = await axios.put(`/api/campaigns/${campaignId}/pause`);
//     return response.data;
//   } catch (error) {
//     console.error("API Error:", error);
//     throw error;
//   }
// }; 