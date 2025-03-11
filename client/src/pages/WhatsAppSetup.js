import React, { useState, useEffect } from 'react';
import api from '../services/api';

function WhatsAppSetup() {
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      console.log('Checking WhatsApp status...');
      const response = await api.get('/whatsapp/status');
      console.log('WhatsApp status response:', response.data);
      setStatus(response.data.status);
      setError(null);
    } catch (err) {
      console.error('Error checking WhatsApp status:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to check WhatsApp status';
      setError(`Error: ${errorMessage}`);
    }
  };

  const handleInitialize = async () => {
    try {
      setStatus('initializing');
      setError(null);
      await api.post('/whatsapp/initialize');
      checkStatus();
    } catch (err) {
      console.error('Error initializing WhatsApp:', err);
      setError('Failed to initialize WhatsApp');
      setStatus('error');
    }
  };

  const handleLogout = async () => {
    try {
      setError(null);
      await api.post('/whatsapp/logout');
      setStatus('disconnected');
    } catch (err) {
      console.error('Error logging out of WhatsApp:', err);
      setError('Failed to logout');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">WhatsApp Setup</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Status</h2>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
            status === 'authenticated' ? 'bg-green-100 text-green-800' :
            status === 'initializing' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {status}
          </div>
        </div>

        {error && (
          <div className="mb-4 text-red-600">
            {error}
          </div>
        )}

        <div className="space-x-4">
          <button
            onClick={checkStatus}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Check Status
          </button>
          
          {status !== 'authenticated' && (
            <button
              onClick={handleInitialize}
              disabled={status === 'initializing'}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Initialize WhatsApp
            </button>
          )}

          {status === 'authenticated' && (
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default WhatsAppSetup; 