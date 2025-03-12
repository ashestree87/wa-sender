import React, { useState, useEffect } from 'react';
import api from '../services/api';

function WhatsAppSetup() {
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkStatus();
    // Set up polling to check status every 5 seconds
    const intervalId = setInterval(checkStatus, 5000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const checkStatus = async () => {
    try {
      console.log('Checking WhatsApp status...');
      const response = await api.get('/whatsapp/status');
      console.log('WhatsApp status response:', response.data);
      setStatus(response.data.status);
      
      // If there's a QR code, display it
      if (response.data.qrCode) {
        setQrCode(response.data.qrCode);
      } else if (status === 'awaiting_qr' && !response.data.qrCode) {
        // If we were waiting for QR but it's gone, check again soon
        setTimeout(checkStatus, 1000);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error checking WhatsApp status:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to check WhatsApp status';
      setError(`Error: ${errorMessage}`);
    }
  };

  const handleInitialize = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.post('/whatsapp/initialize');
      
      // If we get a QR code directly in the response, show it
      if (response.data.qrCode) {
        setQrCode(response.data.qrCode);
        setStatus('awaiting_qr');
      } else {
        setStatus(response.data.status || 'loading');
      }
      
      // Check status again after a short delay
      setTimeout(checkStatus, 1000);
    } catch (err) {
      console.error('Error initializing WhatsApp:', err);
      setError('Failed to initialize WhatsApp: ' + (err.response?.data?.message || err.message));
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await api.post('/whatsapp/logout');
      setStatus('not_initialized');
      setQrCode(null);
      setTimeout(checkStatus, 1000);
    } catch (err) {
      console.error('Error logging out of WhatsApp:', err);
      setError('Failed to logout: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get status display text
  const getStatusDisplay = () => {
    switch (status) {
      case 'authenticated':
        return 'Connected';
      case 'awaiting_qr':
        return 'Waiting for QR Code Scan';
      case 'not_initialized':
        return 'Not Connected';
      case 'loading':
        return 'Connecting...';
      default:
        return status;
    }
  };

  // Helper function to get status color
  const getStatusColor = () => {
    switch (status) {
      case 'authenticated':
        return 'bg-green-100 text-green-800';
      case 'awaiting_qr':
        return 'bg-yellow-100 text-yellow-800';
      case 'loading':
        return 'bg-blue-100 text-blue-800';
      case 'not_initialized':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">WhatsApp Setup</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Status</h2>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${getStatusColor()}`}>
            {getStatusDisplay()}
          </div>
        </div>

        {error && (
          <div className="mb-4 text-red-600 p-3 bg-red-50 rounded">
            {error}
          </div>
        )}

        <div className="space-x-4">
          <button
            onClick={checkStatus}
            disabled={isLoading}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Refresh Status
          </button>
          
          {status !== 'authenticated' && (
            <button
              onClick={handleInitialize}
              disabled={isLoading || status === 'awaiting_qr'}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {status === 'awaiting_qr' ? 'Scan QR Code' : 'Connect WhatsApp'}
            </button>
          )}

          {status === 'authenticated' && (
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
            >
              Disconnect
            </button>
          )}
        </div>

        {qrCode && status === 'awaiting_qr' && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Scan this QR code with WhatsApp</h3>
            <div className="bg-white p-4 inline-block border rounded">
              <img src={qrCode} alt="WhatsApp QR Code" className="max-w-xs" />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Link a Device
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default WhatsAppSetup; 