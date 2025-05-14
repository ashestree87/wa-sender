import { useState, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook for managing WhatsApp connections
 * @param {Function} addToast - Toast notification function
 * @returns {Object} - WhatsApp connection state and functions
 */
const useWhatsAppConnections = (addToast) => {
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [checkingWhatsapp, setCheckingWhatsapp] = useState(true);
  const [initializingWhatsapp, setInitializingWhatsapp] = useState(false);
  const [whatsappConnections, setWhatsappConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [newConnectionName, setNewConnectionName] = useState('');

  // Fetch WhatsApp connections
  const fetchWhatsappConnections = useCallback(async () => {
    try {
      setLoadingConnections(true);
      const response = await api.get('/whatsapp/status');
      
      if (response.data.connections) {
        setWhatsappConnections(response.data.connections);
        
        // If there's an authenticated connection, select it by default
        const authenticatedConnection = response.data.connections.find(
          conn => conn.status === 'authenticated' && !conn.needsReconnect
        );
        
        if (authenticatedConnection) {
          setSelectedConnectionId(authenticatedConnection.id);
          setWhatsappConnected(true);
        } else {
          setWhatsappConnected(false);
        }
      } else {
        // Handle legacy single connection format
        const connection = {
          id: 'default',
          name: 'Default Connection',
          status: response.data.status,
          qrCode: response.data.qrCode,
          phoneNumber: response.data.phoneNumber || 'Unknown'
        };
        setWhatsappConnections([connection]);
        
        if (connection.status === 'authenticated') {
          setSelectedConnectionId('default');
          setWhatsappConnected(true);
        } else {
          setWhatsappConnected(false);
        }
      }
    } catch (error) {
      console.error('Error fetching WhatsApp connections:', error);
      setWhatsappConnections([]);
      setWhatsappConnected(false);
    } finally {
      setLoadingConnections(false);
      setCheckingWhatsapp(false);
    }
  }, []);

  // Check WhatsApp status
  const checkWhatsappStatus = useCallback(async () => {
    try {
      setCheckingWhatsapp(true);
      await fetchWhatsappConnections();
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
      setWhatsappConnected(false);
    } finally {
      setCheckingWhatsapp(false);
    }
  }, [fetchWhatsappConnections]);

  // Initialize WhatsApp
  const initializeWhatsapp = async (connectionId) => {
    try {
      setInitializingWhatsapp(true);
      
      const response = await api.post('/whatsapp/initialize', { 
        connectionId: connectionId || selectedConnectionId || 'default'
      });
      
      if (response.data.success || 
          (response.data.message && 
           response.data.message.toLowerCase().includes('authenticated'))) {
        
        addToast('WhatsApp initialized successfully', 'success');
        await fetchWhatsappConnections();
      } else {
        throw new Error(response.data.message || 'Failed to initialize WhatsApp');
      }
    } catch (error) {
      if (error.response?.data?.message && 
          error.response.data.message.toLowerCase().includes('authenticated')) {
        
        addToast('WhatsApp initialized successfully', 'success');
        await fetchWhatsappConnections();
      } else {
        console.error('Error initializing WhatsApp:', error);
        addToast(`Failed to initialize WhatsApp: ${error.response?.data?.message || error.message}`, 'error');
      }
    } finally {
      setInitializingWhatsapp(false);
    }
  };

  // Create WhatsApp connection
  const createWhatsAppConnection = async (name) => {
    try {
      if (!name.trim()) return;
      
      const response = await api.post('/whatsapp/connection', { name });
      
      addToast('WhatsApp connection created', 'success');
      
      // Refresh connections
      await fetchWhatsappConnections();
      
      // Set the new connection as selected
      if (response.data.id) {
        setSelectedConnectionId(response.data.id);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error creating WhatsApp connection:', error);
      addToast(`Failed to create connection: ${error.response?.data?.message || error.message}`, 'error');
      throw error;
    }
  };

  // Delete WhatsApp connection
  const deleteWhatsAppConnection = async (connectionId) => {
    try {
      await api.delete(`/whatsapp/connection/${connectionId}`);
      addToast('WhatsApp connection deleted', 'success');
      
      // Refresh connections
      await fetchWhatsappConnections();
      
      // Clear selected connection if it was deleted
      if (selectedConnectionId === connectionId) {
        setSelectedConnectionId(null);
      }
    } catch (error) {
      console.error('Error deleting WhatsApp connection:', error);
      addToast(`Failed to delete connection: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Logout WhatsApp connection
  const logoutWhatsAppConnection = async (connectionId) => {
    try {
      await api.post(`/whatsapp/connection/${connectionId}/logout`);
      addToast('Logged out from WhatsApp', 'success');
      
      // Refresh connections
      await fetchWhatsappConnections();
    } catch (error) {
      console.error('Error logging out from WhatsApp:', error);
      addToast(`Failed to logout: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  return {
    whatsappConnected,
    checkingWhatsapp,
    initializingWhatsapp,
    whatsappConnections,
    loadingConnections,
    selectedConnectionId,
    newConnectionName,
    setNewConnectionName,
    setSelectedConnectionId,
    fetchWhatsappConnections,
    checkWhatsappStatus,
    initializeWhatsapp,
    createWhatsAppConnection,
    deleteWhatsAppConnection,
    logoutWhatsAppConnection
  };
};

export default useWhatsAppConnections; 