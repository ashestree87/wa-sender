import React, { useState, useEffect } from 'react';
import api from '../services/api';

function WhatsAppSetup() {
  const [connections, setConnections] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConnectionName, setNewConnectionName] = useState('');

  useEffect(() => {
    fetchConnections();
    // Set up polling to check status every 10 seconds
    const intervalId = setInterval(fetchConnections, 10000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const fetchConnections = async () => {
    try {
      console.log('Fetching WhatsApp connections...');
      const response = await api.get('/whatsapp/status');
      console.log('WhatsApp connections response:', response.data);
      
      if (response.data.connections) {
        // If the backend returns connections array, use it
        // Make sure we're mapping the QR code correctly
        const connections = response.data.connections.map(conn => ({
          ...conn,
          qrCode: conn.qr_code || conn.qrCode // Handle both formats
        }));
        
        setConnections(connections);
        console.log('Connections set:', connections);
      } else {
        // Fallback to creating a single connection from status
        const connection = {
          id: 'default',
          name: 'Default Connection',
          status: response.data.status,
          qrCode: response.data.qrCode,
          phoneNumber: response.data.phoneNumber || 'Unknown'
        };
        
        setConnections([connection]);
        console.log('Single connection set:', connection);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching WhatsApp connections:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch WhatsApp connections';
      setError(`Error: ${errorMessage}`);
    }
  };

  const handleInitialize = async (connectionId) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Initializing WhatsApp for connection: ${connectionId}`);
      const response = await api.post('/whatsapp/initialize', { connectionId });
      console.log('Initialize response:', response.data);
      
      // If we get a QR code directly in the response, show it
      if (response.data.qrCode) {
        console.log('QR code received, updating connection');
        // Update the connection in our state with the QR code
        setConnections(prevConnections => 
          prevConnections.map(conn => 
            conn.id === connectionId 
              ? { ...conn, qrCode: response.data.qrCode, status: 'awaiting_qr' } 
              : conn
          )
        );
      } else {
        console.log('No QR code in response, refreshing connections');
        // If no QR code in the response, refresh connections to get the latest status
        fetchConnections();
      }
    } catch (err) {
      console.error('Error initializing WhatsApp:', err);
      setError('Failed to initialize WhatsApp: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async (connectionId) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await api.post('/whatsapp/logout', { connectionId });
      
      setTimeout(fetchConnections, 1000);
    } catch (err) {
      console.error('Error logging out of WhatsApp:', err);
      setError('Failed to logout: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Update the handleAddConnection function to match the backend API requirements
  const handleAddConnection = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      
      // Create a new connection
      const response = await api.post('/whatsapp/connections', {
        name: newConnectionName
      });
      
      setShowAddForm(false);
      setNewConnectionName('');
      
      // Refresh connections after adding
      setTimeout(fetchConnections, 1000);
    } catch (err) {
      console.error('Error adding WhatsApp connection:', err);
      setError('Failed to add connection: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Fix the handleDeleteConnection function to use the correct endpoint
  const handleDeleteConnection = async (connectionId) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      await api.delete(`/whatsapp/connections/${connectionId}`);
      
      // Refresh connections after deletion
      setTimeout(fetchConnections, 1000);
    } catch (err) {
      console.error('Error deleting WhatsApp connection:', err);
      setError('Failed to delete connection: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get status display text
  const getStatusDisplay = (status) => {
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
  const getStatusColor = (status) => {
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
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">WhatsApp Connections</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Add Connection
        </button>
      </div>
      
      {error && (
        <div className="mb-4 text-red-600 p-3 bg-red-50 rounded">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add New WhatsApp Connection</h2>
          <form onSubmit={handleAddConnection}>
            <div className="mb-4">
              <label htmlFor="connectionName" className="block text-sm font-medium text-gray-700 mb-1">
                Connection Name
              </label>
              <input
                type="text"
                id="connectionName"
                value={newConnectionName}
                onChange={(e) => setNewConnectionName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. Business WhatsApp"
                required
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Add Connection
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {connections.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-gray-500">No WhatsApp connections found. Please refresh or add a connection.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {connections.map(connection => (
            <div key={connection.id} className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{connection.name}</h2>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${getStatusColor(connection.status)}`}>
                    {getStatusDisplay(connection.status)}
                  </div>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => fetchConnections()}
                    disabled={isLoading}
                    className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 disabled:opacity-50 text-sm"
                  >
                    Refresh
                  </button>
                  
                  {/* Only show Connect button when not in awaiting_qr state */}
                  {connection.status !== 'authenticated' && connection.status !== 'awaiting_qr' && (
                    <button
                      onClick={() => handleInitialize(connection.id)}
                      disabled={isLoading}
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
                    >
                      Connect
                    </button>
                  )}
                  
                  {connection.status === 'authenticated' && (
                    <button
                      onClick={() => handleLogout(connection.id)}
                      disabled={isLoading}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-50 text-sm"
                    >
                      Disconnect
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDeleteConnection(connection.id)}
                    disabled={isLoading}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-50 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {(connection.qrCode || connection.qr_code) && connection.status === 'awaiting_qr' && (
                <div className="mt-4">
                  <h3 className="text-md font-semibold mb-2">Scan this QR code with WhatsApp</h3>
                  
                  <div className="bg-white p-4 inline-block border rounded">
                    <img 
                      src={connection.qrCode || connection.qr_code} 
                      alt="WhatsApp QR Code" 
                      className="max-w-xs" 
                    />
                  </div>
                  
                  <p className="mt-2 text-sm text-gray-600">
                    Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Link a Device
                  </p>
                </div>
              )}

              {connection.status === 'authenticated' && (
                <div className="mt-4">
                  <div className="p-3 bg-green-50 rounded">
                    <p className="text-green-700">
                      <span className="font-semibold">Connected as:</span> {connection.phoneNumber || 'Unknown'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WhatsAppSetup; 