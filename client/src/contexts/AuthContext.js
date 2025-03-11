import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      console.log('Fetching user data...');
      
      // For mock authentication, check if we have a mock token
      const token = localStorage.getItem('token');
      if (token === 'mock-jwt-token') {
        console.log('Using mock user data');
        // Use the same mock user as in mockLogin
        const mockUser = {
          id: '1',
          name: 'Test User',
          email: 'test@example.com'
        };
        setUser(mockUser);
      } else {
        // Try to get real user data from API
        const response = await api.get('/auth/me');
        console.log('User data received:', response.data);
        setUser(response.data);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const mockLogin = async (email, password) => {
    const mockUser = {
      id: '1',
      name: 'Test User',
      email: email
    };
    
    const mockToken = 'mock-jwt-token';
    
    localStorage.setItem('token', mockToken);
    setUser(mockUser);
    return mockUser;
  };

  const login = async (email, password) => {
    try {
      console.log('Attempting login with:', { email });
      
      // Make the actual API call to your backend
      const response = await api.post('/auth/login', { email, password });
      console.log('Login response:', response.data);
      
      // Store the token and user data
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (name, email, password) => {
    try {
      console.log('Attempting registration with:', { name, email });
      const response = await api.post('/auth/register', { name, email, password });
      console.log('Registration response:', response.data);
      
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = () => {
    console.log('Logging out');
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
}; 