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
      
      if (response.data.connections) {
        // If the backend returns connections array, use it
        const connections = response.data.connections.map(conn => ({
          ...conn,
          qrCode: conn.qr_code || conn.qrCode, // Handle both formats
          needsReconnect: conn.needsReconnect || false,
          // Ensure we get the phone number from all possible sources
          phoneNumber: conn.phoneNumber || conn.phone_number || 'Unknown'
        }));
        
        setConnections(connections);
        console.log('Fetched connections:', connections);
      } else {
        // Fallback to creating a single connection from status
        const connection = {
          id: 'default',
          name: 'Default Connection',
          status: response.data.status,
          qrCode: response.data.qrCode,
          phoneNumber: response.data.phoneNumber || 'Unknown',
          needsReconnect: response.data.needsReconnect || false
        };
        
        setConnections([connection]);
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
      
      // Get the new connection ID from the response
      const newConnectionId = response.data.connectionId;
      
      // Immediately initialize the new connection to get QR code
      if (newConnectionId) {
        console.log(`Auto-initializing new connection: ${newConnectionId}`);
        try {
          await api.post('/whatsapp/initialize', { connectionId: newConnectionId });
        } catch (initErr) {
          console.error('Error auto-initializing new connection:', initErr);
        }
      }
      
      // Refresh connections after adding
      setTimeout(fetchConnections, 500);
    } catch (err) {
      console.error('Error adding WhatsApp connection:', err);
      setError('Failed to add connection: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsLoading(false);
    }
  };

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

  // Add a new function to handle force resetting a connection
  const handleForceReset = async (connectionId) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Call the backend to force reset the connection status
      await api.post(`/whatsapp/connections/${connectionId}/reset`, {
        status: 'not_initialized'
      });
      
      // Refresh connections after reset
      setTimeout(fetchConnections, 500);
    } catch (err) {
      console.error('Error resetting WhatsApp connection:', err);
      setError('Failed to reset connection: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get status display text
  const getStatusDisplay = (status, needsReconnect) => {
    if (status === 'authenticated' && needsReconnect) {
      return 'Connected (Needs Reconnect)';
    }
    
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
  const getStatusColor = (status, needsReconnect) => {
    if (status === 'authenticated' && needsReconnect) {
      return 'bg-yellow-100 text-yellow-800';
    }
    
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

  // Add a new function to handle connection status display with more detail
  const getConnectionStatusDetails = (connection) => {
    const { status, needsReconnect } = connection;
    
    // Default values
    let statusText = getStatusDisplay(status, needsReconnect);
    let statusColor = getStatusColor(status, needsReconnect);
    let statusIcon = null;
    let statusDescription = '';
    
    // Customize based on status
    switch (status) {
      case 'authenticated':
        statusIcon = '✅';
        statusDescription = needsReconnect 
          ? 'Your session needs to be refreshed. Click "Reconnect" to continue using WhatsApp.'
          : 'Your WhatsApp is connected and ready to send messages.';
        break;
      case 'awaiting_qr':
        statusIcon = '📱';
        statusDescription = 'Scan the QR code below with your WhatsApp mobile app to connect.';
        break;
      case 'initializing':
        statusIcon = '⏳';
        statusDescription = 'Setting up your WhatsApp connection. This may take a moment...';
        break;
      case 'not_initialized':
        statusIcon = '🔌';
        statusDescription = 'Click "Connect" to set up this WhatsApp connection.';
        break;
      default:
        statusIcon = '❓';
        statusDescription = `Status: ${status}`;
    }
    
    return { statusText, statusColor, statusIcon, statusDescription };
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">WhatsApp Connections</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Add Connection'}
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
          <p className="text-sm text-gray-600 mb-4">
            Enter a name for your WhatsApp connection. After adding, you'll be prompted to scan a QR code with your phone.
          </p>
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

      {isLoading && !showAddForm && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6 flex items-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700 mr-3"></div>
          <p className="text-blue-700">Processing your request...</p>
        </div>
      )}

      {connections.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-gray-500">No WhatsApp connections found. Please refresh or add a connection.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {connections.map(connection => {
            const { statusText, statusColor, statusIcon, statusDescription } = getConnectionStatusDetails(connection);
            
            return (
              <div key={connection.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{connection.name}</h2>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${statusColor}`}>
                      {statusIcon && <span className="mr-1">{statusIcon}</span>}
                      {statusText}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{statusDescription}</p>
                  </div>
                  
                  <div className="space-x-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => fetchConnections()}
                      disabled={isLoading}
                      className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 disabled:opacity-50 text-sm"
                    >
                      Refresh
                    </button>
                    
                    {/* Add Force Reset button for initializing state */}
                    {connection.status === 'initializing' && (
                      <button
                        onClick={() => handleForceReset(connection.id)}
                        disabled={isLoading}
                        className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 disabled:opacity-50 text-sm"
                      >
                        Force Reset
                      </button>
                    )}
                    
                    {/* Only show Connect button when not in awaiting_qr state */}
                    {connection.status !== 'authenticated' && connection.status !== 'awaiting_qr' && connection.status !== 'initializing' && (
                      <button
                        onClick={() => handleInitialize(connection.id)}
                        disabled={isLoading}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
                      >
                        Connect
                      </button>
                    )}
                    
                    {/* Show initializing state */}
                    {connection.status === 'initializing' && (
                      <button
                        disabled={true}
                        className="bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-70 text-sm flex items-center"
                      >
                        <span className="animate-spin h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full"></span>
                        Connecting...
                      </button>
                    )}
                    
                    {/* Show Reconnect button when authenticated but needs reconnect */}
                    {connection.status === 'authenticated' && connection.needsReconnect && (
                      <button
                        onClick={() => handleInitialize(connection.id)}
                        disabled={isLoading}
                        className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 disabled:opacity-50 text-sm"
                      >
                        Reconnect
                      </button>
                    )}
                    
                    {connection.status === 'authenticated' && !connection.needsReconnect && (
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

                {/* Show a loading indicator when initializing */}
                {connection.status === 'initializing' && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mr-3"></div>
                      <div>
                        <p className="font-medium text-blue-700">Initializing WhatsApp...</p>
                        <p className="text-sm text-blue-600">This may take a few moments. Please wait.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* QR code section with improved styling */}
                {(connection.qrCode || connection.qr_code) && connection.status === 'awaiting_qr' && (
                  <div className="mt-4 p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h3 className="text-md font-semibold mb-3 text-yellow-800">Scan this QR code with WhatsApp</h3>
                    
                    <div className="bg-white p-4 inline-block border rounded shadow-sm">
                      <img 
                        src={connection.qrCode || connection.qr_code} 
                        alt="WhatsApp QR Code" 
                        className="max-w-xs" 
                      />
                    </div>
                    
                    <div className="mt-3 text-sm text-yellow-700 bg-yellow-100 p-3 rounded">
                      <p className="font-medium">How to scan:</p>
                      <ol className="list-decimal ml-5 mt-1 space-y-1">
                        <li>Open WhatsApp on your phone</li>
                        <li>Tap Settings (or ⋮) {'>'} Linked Devices</li>
                        <li>Tap "Link a Device"</li>
                        <li>Point your phone camera at this QR code</li>
                      </ol>
                    </div>
                  </div>
                )}

                {connection.status === 'authenticated' && (
                  <div className="mt-4">
                    <div className={`p-3 ${connection.needsReconnect ? 'bg-yellow-50' : 'bg-green-50'} rounded`}>
                      <p className={connection.needsReconnect ? 'text-yellow-700' : 'text-green-700'}>
                        <span className="font-semibold">Connected as:</span> {connection.phoneNumber || 'Unknown'}
                      </p>
                      {connection.needsReconnect && (
                        <p className="text-sm text-yellow-600 mt-1">
                          Session needs to be reconnected. Click the "Reconnect" button above.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WhatsAppSetup; 