import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import Papa from 'papaparse';

function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  // Add delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Add a state for WhatsApp connection status
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [checkingWhatsapp, setCheckingWhatsapp] = useState(true);

  // Add a state for WhatsApp initialization
  const [initializingWhatsapp, setInitializingWhatsapp] = useState(false);
  
  // Simplify search functionality - remove searchCategory
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRecipients, setFilteredRecipients] = useState([]);

  // Add these new functions to handle recipient editing and deletion
  const [editRecipientModalOpen, setEditRecipientModalOpen] = useState(false);
  const [currentRecipient, setCurrentRecipient] = useState(null);
  const [deleteRecipientModalOpen, setDeleteRecipientModalOpen] = useState(false);
  
  // Add these new state variables for bulk import
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
  const [importMethod, setImportMethod] = useState('bulk'); // 'bulk' or 'csv'
  const [bulkInput, setBulkInput] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  // Add these new state variables for WhatsApp connections
  const [whatsappConnections, setWhatsappConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

  // Add this new state variable for the new connection name
  const [newConnectionName, setNewConnectionName] = useState('');

  // Consolidated fetch function
  const fetchCampaignDetails = useCallback(async () => {
    try {
      console.log('Fetching campaign details for ID:', id);
      const campaignResponse = await api.get(`/campaigns/${id}`);
      console.log('Campaign data received:', campaignResponse.data);
      
      // Map snake_case to camelCase
      const campaignData = {
        ...campaignResponse.data,
        messageTemplate: campaignResponse.data.messageTemplate || campaignResponse.data.message_template,
        useAI: campaignResponse.data.useAI || campaignResponse.data.use_ai,
        aiPrompt: campaignResponse.data.aiPrompt || campaignResponse.data.ai_prompt,
        createdAt: campaignResponse.data.createdAt || campaignResponse.data.created_at,
        scheduledStartTime: campaignResponse.data.scheduledStartTime || campaignResponse.data.scheduled_start_time
      };
      
      setCampaign(campaignData);
      
      const recipientsResponse = await api.get(`/campaigns/${id}/recipients`);
      console.log('Recipients data received:', recipientsResponse.data);
      
      // Map snake_case to camelCase for recipients
      const mappedRecipients = recipientsResponse.data.map(recipient => ({
        id: recipient.id,
        name: recipient.name,
        phoneNumber: recipient.phone_number,
        status: recipient.status,
        sentAt: recipient.sent_at,
        deliveredAt: recipient.delivered_at,
        failureReason: recipient.failure_reason,
        message: recipient.message,
        scheduledTime: recipient.scheduled_time
      }));
      
      setRecipients(mappedRecipients);
      return true; // Indicate success
    } catch (error) {
      console.error('Error fetching campaign details:', error);
      setError('Failed to load campaign details');
      setLoading(false);
      throw error; // Re-throw to handle in the useEffect
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Single useEffect for data fetching and polling
  useEffect(() => {
    let isMounted = true;
    let interval = null;
    
    // Initial fetch
    const initialFetch = async () => {
      try {
        await fetchCampaignDetails();
        
        // Only set up polling if the campaign is in progress or scheduled
        if (isMounted && campaign) {
          const shouldPoll = ['in_progress', 'scheduled', 'paused'].includes(campaign.status);
          
          if (shouldPoll) {
            // Set up polling interval
            interval = setInterval(async () => {
              if (isMounted) {
                await fetchCampaignDetails();
              }
            }, 3000); // Poll every 3 seconds for active campaigns
          }
        }
      } catch (error) {
        console.error('Error in initial fetch:', error);
      }
    };
    
    initialFetch();
    
    // Clean up interval on unmount
    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [fetchCampaignDetails, campaign?.status]);

  // Add a function to fetch WhatsApp connections
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

  // Update the checkWhatsappStatus function to use fetchWhatsappConnections
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

  // Now we can use checkWhatsappStatus in the useEffect
  useEffect(() => {
    checkWhatsappStatus();
    
    // Set up polling for WhatsApp status every 30 seconds
    const whatsappInterval = setInterval(checkWhatsappStatus, 30000);
    
    return () => {
      clearInterval(whatsappInterval);
    };
  }, [checkWhatsappStatus]);

  // Update the initializeWhatsapp function to use the selected connection
  const initializeWhatsapp = async (connectionId = selectedConnectionId) => {
    try {
      setInitializingWhatsapp(true);
      setError(null);
      
      // Call the WhatsApp initialization endpoint with the connection ID
      const response = await api.post('/whatsapp/initialize', { 
        connectionId: connectionId || 'default'
      });
      
      // Check if the response contains a success property or if the message indicates success
      if (response.data.success || 
          (response.data.message && 
           response.data.message.toLowerCase().includes('authenticated'))) {
        
        addToast('WhatsApp initialized successfully', 'success');
        // Check status again to update the UI
        await fetchWhatsappConnections();
      } else {
        throw new Error(response.data.message || 'Failed to initialize WhatsApp');
      }
    } catch (error) {
      // Check if the error message actually indicates success
      if (error.response?.data?.message && 
          error.response.data.message.toLowerCase().includes('authenticated')) {
        
        addToast('WhatsApp initialized successfully', 'success');
        // Check status again to update the UI
        await fetchWhatsappConnections();
      } else {
        console.error('Error initializing WhatsApp:', error);
        setError(`Failed to initialize WhatsApp: ${error.response?.data?.message || error.message}`);
        addToast(`Failed to initialize WhatsApp: ${error.response?.data?.message || error.message}`, 'error');
      }
    } finally {
      setInitializingWhatsapp(false);
    }
  };

  // Update the executeCampaign function to use the selected connection
  const executeCampaign = async () => {
    try {
      setExecuting(true);
      setError(null);
      
      // Check if a connection is selected
      if (!selectedConnectionId) {
        throw new Error('Please select a WhatsApp connection first');
      }
      
      // First check if the selected WhatsApp connection is connected
      const whatsappStatus = await api.get(`/whatsapp/status?connectionId=${selectedConnectionId}`);
      if (whatsappStatus.data.status !== 'authenticated') {
        throw new Error('Selected WhatsApp connection is not authenticated. Please connect first.');
      }
      
      console.log('Attempting to execute campaign:', id);
      const response = await api.post(`/campaigns/${id}/execute`, { connectionId: selectedConnectionId });
      console.log('Execute campaign response:', response.data);
      
      // The response doesn't have a success property, but it has a message and recipientCount
      if (response.data.recipientCount) {
        addToast(`Campaign execution started! ${response.data.recipientCount} messages will be sent.`, 'success');
        
        // Refresh campaign details to show updated status
        fetchCampaignDetails();
        return;
      } else {
        throw new Error(response.data.message || 'Failed to start campaign');
      }
    } catch (error) {
      console.error('Error executing campaign:', error);
      console.error('Error details:', error.response?.data);
      
      // Show a more detailed error message
      let errorMessage;
      if (error.response?.data?.error === 'Campaign.updateStatus is not a function') {
        errorMessage = 'There is a technical issue with the campaign execution system. Please contact the administrator.';
      } else if (error.response?.data?.error) {
        errorMessage = `Technical Error: ${error.response.data.error}. Please contact support.`;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = 'Failed to execute campaign';
      }
      
      setError(`Failed to execute campaign: ${errorMessage}`);
      addToast(`Failed to execute campaign: ${errorMessage}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  // Add a new function to resend messages to specific recipients
  const resendToRecipient = async (recipientId) => {
    try {
      await api.post(`/campaigns/${id}/recipients/${recipientId}/resend`);
      addToast(`Message resend initiated for this recipient.`, 'info');
      // Immediately fetch updated data to show new sent time
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error resending message:', error);
      addToast(`Failed to resend message: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Add a function to resend to all failed recipients
  const resendFailedMessages = async () => {
    try {
      const failedRecipients = recipients.filter(r => r.status === 'failed');
      if (failedRecipients.length === 0) {
        addToast('No failed messages to resend.', 'warning');
        return;
      }
      
      await api.post(`/campaigns/${id}/resend-failed`);
      addToast(`Resending messages to ${failedRecipients.length} recipients.`, 'info');
      // Use await to ensure the data is refreshed
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error resending failed messages:', error);
      addToast(`Failed to resend messages: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Add this function to duplicate a campaign
  const duplicateCampaign = async () => {
    try {
      const response = await api.post(`/campaigns/${id}/duplicate`);
      const newCampaignId = response.data.id;
      alert('Campaign duplicated successfully!');
      navigate(`/campaigns/${newCampaignId}`);
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      alert(`Failed to duplicate campaign: ${error.response?.data?.message || error.message}`);
    }
  };

  // Updated delete function
  const openDeleteModal = () => {
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/campaigns/${id}`);
      addToast('Campaign deleted successfully', 'success');
      navigate('/'); // Redirect to dashboard
    } catch (error) {
      console.error('Error deleting campaign:', error);
      addToast(`Failed to delete campaign: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Add this function to skip a recipient
  const skipRecipient = async (recipientId) => {
    try {
      await api.post(`/campaigns/${id}/recipients/${recipientId}/skip`);
      addToast('Recipient skipped successfully', 'success');
      fetchCampaignDetails(); // Refresh to show updated status
    } catch (error) {
      console.error('Error skipping recipient:', error);
      addToast(`Failed to skip recipient: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Update the pauseCampaign function
  const pauseCampaign = async () => {
    try {
      // Change this line to use the correct API call
      await api.post(`/campaigns/${id}/pause`);
      
      // Update the local state to reflect the paused status
      setCampaign(prev => ({ ...prev, status: 'paused' }));
      addToast('Campaign paused successfully', 'info');
      fetchCampaignDetails(); // Refresh to show updated status
    } catch (error) {
      console.error('Error pausing campaign:', error);
      addToast(`Failed to pause campaign: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const resumeCampaign = async () => {
    try {
      await api.post(`/campaigns/${id}/resume`);
      addToast('Campaign resumed successfully', 'success');
      fetchCampaignDetails(); // Refresh to show updated status
    } catch (error) {
      console.error('Error resuming campaign:', error);
      addToast(`Failed to resume campaign: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Add a function to calculate campaign progress
  const calculateProgress = useCallback(() => {
    if (!recipients || recipients.length === 0) return { fraction: '0/0', percentage: 0 };
    
    const total = recipients.length;
    const processed = recipients.filter(r => 
      ['sent', 'delivered', 'failed', 'skipped'].includes(r.status)
    ).length;
    
    const percentage = Math.round((processed / total) * 100);
    
    return {
      fraction: `${processed}/${total}`,
      percentage
    };
  }, [recipients]);

  // Simplified filter function that always searches all fields
  useEffect(() => {
    if (!recipients.length) {
      setFilteredRecipients([]);
      return;
    }
    
    if (!searchTerm.trim()) {
      setFilteredRecipients(recipients);
      return;
    }
    
    const lowerCaseSearch = searchTerm.toLowerCase();
    const filtered = recipients.filter(recipient => 
      recipient.name?.toLowerCase().includes(lowerCaseSearch) || 
      recipient.phoneNumber?.toLowerCase().includes(lowerCaseSearch) ||
      recipient.status?.toLowerCase().includes(lowerCaseSearch)
    );
    
    setFilteredRecipients(filtered);
  }, [searchTerm, recipients]);

  // Function to open the edit modal for a recipient
  const openEditRecipientModal = (recipient) => {
    setCurrentRecipient(recipient);
    setEditRecipientModalOpen(true);
  };

  // Function to open the delete modal for a recipient
  const openDeleteRecipientModal = (recipient) => {
    setCurrentRecipient(recipient);
    setDeleteRecipientModalOpen(true);
  };

  // Function to delete a recipient
  const deleteRecipient = async (recipientId) => {
    try {
      await api.delete(`/campaigns/${id}/recipients/${recipientId}`);
      addToast('Recipient deleted successfully', 'success');
      fetchCampaignDetails(); // Refresh to show updated list
    } catch (error) {
      console.error('Error deleting recipient:', error);
      addToast(`Failed to delete recipient: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setDeleteRecipientModalOpen(false);
      setCurrentRecipient(null);
    }
  };

  // Function to update a recipient
  const updateRecipient = async (recipientId, updatedData) => {
    try {
      await api.put(`/campaigns/${id}/recipients/${recipientId}`, updatedData);
      addToast('Recipient updated successfully', 'success');
      fetchCampaignDetails(); // Refresh to show updated data
    } catch (error) {
      console.error('Error updating recipient:', error);
      addToast(`Failed to update recipient: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setEditRecipientModalOpen(false);
      setCurrentRecipient(null);
    }
  };

  // Add this function to reset a recipient's status
  const resetRecipientStatus = async (recipientId) => {
    try {
      await api.post(`/campaigns/${id}/recipients/${recipientId}/reset`);
      addToast('Recipient status reset successfully', 'success');
      fetchCampaignDetails(); // Refresh to show updated status
    } catch (error) {
      console.error('Error resetting recipient status:', error);
      addToast(`Failed to reset recipient status: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Add this new function to handle bulk recipient import
  const importRecipients = async (recipientsData) => {
    try {
      setImportLoading(true);
      setImportError('');
      
      const response = await api.post(`/campaigns/${id}/recipients/import`, {
        recipients: recipientsData
      });
      
      addToast(`Successfully imported ${response.data.count} recipients`, 'success');
      await fetchCampaignDetails(); // Refresh the recipient list
      setBulkImportModalOpen(false); // Close the modal
      setBulkInput(''); // Clear the input
      setImportMethod('bulk'); // Reset to default
    } catch (error) {
      console.error('Error importing recipients:', error);
      setImportError(error.response?.data?.message || 'Failed to import recipients');
    } finally {
      setImportLoading(false);
    }
  };

  // Add this function to process bulk text input
  const processBulkInput = () => {
    if (!bulkInput.trim()) {
      return setImportError('Please enter recipient data');
    }

    try {
      // Split by lines
      const lines = bulkInput.trim().split('\n');
      const newRecipients = [];
      const errors = [];

      lines.forEach((line, index) => {
        // Skip empty lines
        if (!line.trim()) return;

        // Try to split by comma
        const parts = line.split(',').map(part => part.trim());
        
        if (parts.length < 2) {
          errors.push(`Line ${index + 1}: Not enough data (expected name, phone number)`);
          return;
        }

        const name = parts[0];
        const phoneNumber = parts[1];

        // Basic validation
        if (!name) {
          errors.push(`Line ${index + 1}: Missing name`);
          return;
        }

        if (!phoneNumber) {
          errors.push(`Line ${index + 1}: Missing phone number`);
          return;
        }

        newRecipients.push({ name, phoneNumber });
      });

      if (errors.length > 0) {
        setImportError(`Errors in bulk input:\n${errors.join('\n')}`);
        return;
      }

      if (newRecipients.length === 0) {
        setImportError('No valid recipients found in input');
        return;
      }

      // Import the recipients
      importRecipients(newRecipients);
    } catch (err) {
      setImportError('Error processing bulk input: ' + err.message);
    }
  };

  // Add this function to handle CSV file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Parse the CSV file
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setImportError(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`);
          return;
        }

        const newRecipients = [];
        const errors = [];

        results.data.forEach((row, index) => {
          // Look for name and phone number columns (case insensitive)
          const nameKey = Object.keys(row).find(key => 
            key.toLowerCase() === 'name' || 
            key.toLowerCase() === 'recipient' || 
            key.toLowerCase() === 'contact'
          );
          
          const phoneKey = Object.keys(row).find(key => 
            key.toLowerCase().includes('phone') || 
            key.toLowerCase().includes('number') || 
            key.toLowerCase().includes('mobile')
          );

          if (!nameKey) {
            errors.push(`Row ${index + 1}: Could not find name column`);
            return;
          }

          if (!phoneKey) {
            errors.push(`Row ${index + 1}: Could not find phone number column`);
            return;
          }

          const name = row[nameKey].trim();
          const phoneNumber = row[phoneKey].trim();

          if (!name) {
            errors.push(`Row ${index + 1}: Missing name`);
            return;
          }

          if (!phoneNumber) {
            errors.push(`Row ${index + 1}: Missing phone number`);
            return;
          }

          newRecipients.push({ name, phoneNumber });
        });

        if (errors.length > 0) {
          setImportError(`Errors in CSV file:\n${errors.join('\n')}`);
          return;
        }

        if (newRecipients.length === 0) {
          setImportError('No valid recipients found in CSV file');
          return;
        }

        // Import the recipients
        importRecipients(newRecipients);
      },
      error: (err) => {
        setImportError('Error parsing CSV file: ' + err.message);
      }
    });
  };

  // Add a function to create a new WhatsApp connection
  const createWhatsappConnection = async (name) => {
    try {
      setInitializingWhatsapp(true);
      const response = await api.post('/whatsapp/connections', { name });
      
      if (response.data.success && response.data.connectionId) {
        addToast(`WhatsApp connection "${name}" created`, 'success');
        
        // Initialize the new connection
        await initializeWhatsapp(response.data.connectionId);
        
        // Refresh connections
        await fetchWhatsappConnections();
        
        // Select the new connection
        setSelectedConnectionId(response.data.connectionId);
      } else {
        throw new Error(response.data.message || 'Failed to create WhatsApp connection');
      }
    } catch (error) {
      console.error('Error creating WhatsApp connection:', error);
      addToast(`Failed to create connection: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setInitializingWhatsapp(false);
    }
  };

  // Add a function to delete a WhatsApp connection
  const deleteWhatsappConnection = async (connectionId) => {
    if (!window.confirm('Are you sure you want to delete this WhatsApp connection?')) {
      return;
    }
    
    try {
      setLoadingConnections(true);
      await api.delete(`/whatsapp/connections/${connectionId}`);
      
      addToast('WhatsApp connection deleted', 'success');
      
      // Refresh connections
      await fetchWhatsappConnections();
      
      // If the deleted connection was selected, clear selection
      if (selectedConnectionId === connectionId) {
        setSelectedConnectionId(null);
      }
    } catch (error) {
      console.error('Error deleting WhatsApp connection:', error);
      addToast(`Failed to delete connection: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setLoadingConnections(false);
    }
  };

  // Add a function to logout from a WhatsApp connection
  const logoutWhatsappConnection = async (connectionId) => {
    try {
      setLoadingConnections(true);
      await api.post('/whatsapp/logout', { connectionId });
      
      addToast('Logged out from WhatsApp', 'success');
      
      // Refresh connections
      await fetchWhatsappConnections();
    } catch (error) {
      console.error('Error logging out from WhatsApp:', error);
      addToast(`Failed to logout: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setLoadingConnections(false);
    }
  };

  if (loading) {
    return <div>Loading campaign details...</div>;
  }

  if (!campaign) {
    return <div>Campaign not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{campaign.name}</h1>
        <div className="space-x-2">
          <Link
            to={`/campaigns/${id}/edit`}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Edit
          </Link>
          <button
            onClick={duplicateCampaign}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
          >
            Duplicate
          </button>
          <button
            onClick={openDeleteModal}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Delete
          </button>
          
          {/* Campaign action buttons */}
          {campaign.status === 'draft' && (
            whatsappConnected ? (
              <button
                onClick={executeCampaign}
                disabled={executing}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                {executing ? 'Starting...' : 'Execute Campaign'}
              </button>
            ) : (
              <button
                onClick={initializeWhatsapp}
                disabled={initializingWhatsapp || checkingWhatsapp}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-50"
              >
                {initializingWhatsapp ? 'Initializing WhatsApp...' : 
                 checkingWhatsapp ? 'Checking WhatsApp...' : 'Initialize WhatsApp'}
              </button>
            )
          )}
          
          {campaign.status === 'in_progress' && (
            <button
              onClick={pauseCampaign}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
            >
              Pause Campaign
            </button>
          )}
          
          {campaign.status === 'paused' && (
            <button
              onClick={resumeCampaign}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Resume Campaign
            </button>
          )}
          
          {recipients.some(r => r.status === 'failed') && (
            <button
              onClick={resendFailedMessages}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
            >
              Resend Failed Messages
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* WhatsApp Connection Selection - moved outside the button container */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">WhatsApp Connection</h2>
          <div className="space-x-2">
            <button
              onClick={() => fetchWhatsappConnections()}
              disabled={loadingConnections}
              className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 disabled:opacity-50 text-sm"
            >
              {loadingConnections ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={() => setWhatsappModalOpen(true)}
              className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
            >
              Manage Connections
            </button>
          </div>
        </div>
        
        {loadingConnections ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700 mr-3"></div>
            <p className="text-blue-700">Loading connections...</p>
          </div>
        ) : whatsappConnections.length === 0 ? (
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-yellow-700">No WhatsApp connections found.</p>
            <button
              onClick={() => setWhatsappModalOpen(true)}
              className="mt-2 bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm"
            >
              Set Up WhatsApp
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select WhatsApp Connection
              </label>
              <select
                value={selectedConnectionId || ''}
                onChange={(e) => setSelectedConnectionId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Select a connection --</option>
                {whatsappConnections.map(conn => (
                  <option 
                    key={conn.id} 
                    value={conn.id}
                    disabled={conn.status !== 'authenticated'}
                  >
                    {conn.name} - {conn.status === 'authenticated' 
                      ? `Connected (${conn.phoneNumber})` 
                      : conn.status === 'awaiting_qr' 
                        ? 'Waiting for QR scan' 
                        : 'Not connected'}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedConnectionId && (
              <div className="mt-2">
                {(() => {
                  const selectedConn = whatsappConnections.find(c => c.id === selectedConnectionId);
                  if (!selectedConn) return null;
                  
                  if (selectedConn.status === 'authenticated') {
                    return (
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-green-700 flex items-center">
                          <span className="mr-2">✅</span>
                          Connected as {selectedConn.phoneNumber}
                        </p>
                        {selectedConn.needsReconnect && (
                          <div className="mt-2">
                            <p className="text-yellow-600 text-sm">This connection needs to be refreshed.</p>
                            <button
                              onClick={() => initializeWhatsapp(selectedConn.id)}
                              disabled={initializingWhatsapp}
                              className="mt-1 bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 disabled:opacity-50 text-sm"
                            >
                              {initializingWhatsapp ? 'Reconnecting...' : 'Reconnect'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  } else if (selectedConn.status === 'awaiting_qr') {
                    return (
                      <div className="bg-yellow-50 p-3 rounded-lg">
                        <p className="text-yellow-700 mb-2">Scan the QR code to connect</p>
                        {selectedConn.qrCode || selectedConn.qr_code ? (
                          <div className="bg-white p-2 inline-block">
                            <img 
                              src={selectedConn.qrCode || selectedConn.qr_code} 
                              alt="WhatsApp QR Code" 
                              className="max-w-xs" 
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-yellow-600">QR code not available. Try refreshing.</p>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-gray-700 mb-2">This connection is not active</p>
                        <button
                          onClick={() => initializeWhatsapp(selectedConn.id)}
                          disabled={initializingWhatsapp}
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
                        >
                          {initializingWhatsapp ? 'Connecting...' : 'Connect'}
                        </button>
                      </div>
                    );
                  }
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Campaign Details</h2>
            <p><span className="font-medium">Description:</span> {campaign.description || 'No description'}</p>
            <p><span className="font-medium">Status:</span> 
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                campaign.status === 'completed' ? 'bg-green-100 text-green-800' :
                campaign.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {campaign.status || 'pending'}
              </span>
              
              {/* Add progress indicator for in_progress campaigns */}
              {campaign.status === 'in_progress' && (
                <span className="ml-2">
                  {calculateProgress().fraction} ({calculateProgress().percentage}%)
                </span>
              )}
            </p>
            
            {/* Add progress bar for in_progress campaigns */}
            {campaign.status === 'in_progress' && (
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${calculateProgress().percentage}%` }}
                ></div>
              </div>
            )}
            
            <p>
              <span className="font-medium">Created:</span> {campaign.createdAt ? new Date(campaign.createdAt).toLocaleString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              }) : 'Unknown'}
            </p>
            {campaign.scheduledStartTime && (
              <p>
                <span className="font-medium">Scheduled Start:</span> {new Date(campaign.scheduledStartTime).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short'
                })}
              </p>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Message Template</h2>
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <p className="whitespace-pre-wrap">{campaign.messageTemplate || 'No message template'}</p>
            </div>
            {campaign.useAI && (
              <div className="mt-2">
                <p><span className="font-medium">AI Prompt:</span> {campaign.aiPrompt || 'No AI prompt'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Sending Controls</h2>
        <p>
          <span className="font-medium">Message Delay:</span> {campaign.minDelaySeconds || campaign.min_delay_seconds || 3}-{campaign.maxDelaySeconds || campaign.max_delay_seconds || 5} seconds
        </p>
        
        {(campaign.dailyLimit || campaign.daily_limit) > 0 && (
          <p>
            <span className="font-medium">Daily Limit:</span> {campaign.dailyLimit || campaign.daily_limit} messages
          </p>
        )}
        
        {(campaign.timeWindowStart || campaign.time_window_start) && (campaign.timeWindowEnd || campaign.time_window_end) && (
          <p>
            <span className="font-medium">Sending Window:</span> {campaign.timeWindowStart || campaign.time_window_start} - {campaign.timeWindowEnd || campaign.time_window_end}
          </p>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Recipients ({recipients.length})</h2>
          <button
            onClick={() => setBulkImportModalOpen(true)}
            className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-sm"
          >
            Bulk Import
          </button>
        </div>
        
        {/* Full-width search with nicer design */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search recipients by name, phone number, or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                aria-label="Clear search"
              >
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {recipients.length === 0 ? (
          <p>No recipients added to this campaign.</p>
        ) : filteredRecipients.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No recipients match your search criteria.</p>
            <button 
              onClick={() => setSearchTerm('')}
              className="mt-2 text-blue-500 hover:text-blue-700"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivered</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecipients.map((recipient, index) => (
                  <tr key={recipient.id || index}>
                    <td className="px-6 py-4 whitespace-nowrap">{recipient.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipient.phoneNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-sm ${
                        recipient.status === 'sent' ? 'bg-green-100 text-green-800' :
                        recipient.status === 'failed' ? 'bg-red-100 text-red-800' :
                        recipient.status === 'skipped' ? 'bg-gray-100 text-gray-800' :
                        recipient.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {recipient.status || 'pending'}
                      </span>
                      {recipient.failureReason && (
                        <span className="ml-2 text-sm text-red-600" title={recipient.failureReason}>⚠️</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {recipient.sentAt ? new Date(recipient.sentAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZoneName: 'short'
                      }) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {recipient.deliveredAt ? new Date(recipient.deliveredAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZoneName: 'short'
                      }) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap flex space-x-2">
                      {recipient.status === 'pending' && (
                        <button
                          onClick={() => skipRecipient(recipient.id)}
                          className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                        >
                          Skip
                        </button>
                      )}
                      {recipient.status === 'failed' && (
                        <button
                          onClick={() => resendToRecipient(recipient.id)}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                        >
                          Resend
                        </button>
                      )}
                      {recipient.status === 'skipped' && (
                        <button
                          onClick={() => resetRecipientStatus(recipient.id)}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          Reset to Pending
                        </button>
                      )}
                      
                      {/* Add edit button */}
                      <button
                        onClick={() => openEditRecipientModal(recipient)}
                        className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                        title="Edit recipient"
                      >
                        Edit
                      </button>
                      
                      {/* Add delete button */}
                      <button
                        onClick={() => openDeleteRecipientModal(recipient)}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                        title="Delete recipient"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Search results summary */}
        {recipients.length > 0 && searchTerm && (
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredRecipients.length} of {recipients.length} recipients
          </div>
        )}
      </div>

      {/* Add the delete modal at the end */}
      {campaign && (
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDelete}
          itemName={campaign.name}
        />
      )}
      
      {/* Add recipient delete confirmation modal */}
      {currentRecipient && (
        <DeleteConfirmationModal
          isOpen={deleteRecipientModalOpen}
          onClose={() => {
            setDeleteRecipientModalOpen(false);
            setCurrentRecipient(null);
          }}
          onConfirm={() => deleteRecipient(currentRecipient.id)}
          itemName={`recipient ${currentRecipient.name}`}
          message="This will permanently remove this recipient from the campaign."
        />
      )}
      
      {/* Add recipient edit modal */}
      {currentRecipient && (
        <EditRecipientModal
          isOpen={editRecipientModalOpen}
          onClose={() => {
            setEditRecipientModalOpen(false);
            setCurrentRecipient(null);
          }}
          recipient={currentRecipient}
          onSave={(updatedData) => updateRecipient(currentRecipient.id, updatedData)}
        />
      )}

      {/* Bulk Import Modal */}
      <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${bulkImportModalOpen ? '' : 'hidden'}`}>
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Bulk Import Recipients</h2>
            <button
              onClick={() => {
                setBulkImportModalOpen(false);
                setImportError('');
                setBulkInput('');
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          {importError && (
            <div className="mb-4 bg-red-50 p-4 rounded-md">
              <p className="text-red-700 whitespace-pre-line">{importError}</p>
            </div>
          )}
          
          {/* Import method tabs */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              type="button"
              className={`py-2 px-4 font-medium ${
                importMethod === 'bulk' 
                  ? 'border-b-2 border-blue-500 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setImportMethod('bulk')}
            >
              Text Import
            </button>
            <button
              type="button"
              className={`py-2 px-4 font-medium ${
                importMethod === 'csv' 
                  ? 'border-b-2 border-blue-500 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setImportMethod('csv')}
            >
              CSV Upload
            </button>
          </div>
          
          {/* Bulk text input */}
          {importMethod === 'bulk' && (
            <div className="mb-4">
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="Enter recipients in format: Name, Phone Number (one per line)"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                rows="10"
              />
              <p className="text-sm text-gray-500 mt-1">
                Format: Name, Phone Number (one recipient per line)
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={processBulkInput}
                  disabled={importLoading}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                >
                  {importLoading ? 'Importing...' : 'Import Recipients'}
                </button>
              </div>
            </div>
          )}
          
          {/* CSV upload */}
          {importMethod === 'csv' && (
            <div className="mb-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  ref={fileInputRef}
                />
                <p className="mb-2 text-sm text-gray-500">
                  Upload a CSV file with columns for name and phone number
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Select CSV File
                </button>
              </div>
              {importLoading && (
                <div className="mt-4 text-center">
                  <p className="text-blue-600">Processing file...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Connection Management Modal */}
      <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${whatsappModalOpen ? '' : 'hidden'}`}>
        <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Manage WhatsApp Connections</h2>
            <button
              onClick={() => setWhatsappModalOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          {/* Add new connection form */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium mb-2">Add New Connection</h3>
            <div className="flex items-end gap-2">
              <div className="flex-grow">
                <label htmlFor="newConnectionName" className="block text-sm font-medium text-gray-700 mb-1">
                  Connection Name
                </label>
                <input
                  type="text"
                  id="newConnectionName"
                  value={newConnectionName}
                  onChange={(e) => setNewConnectionName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Business WhatsApp"
                />
              </div>
              <button
                onClick={() => {
                  if (newConnectionName.trim()) {
                    createWhatsappConnection(newConnectionName);
                    setNewConnectionName('');
                  } else {
                    addToast('Please enter a connection name', 'error');
                  }
                }}
                disabled={initializingWhatsapp || !newConnectionName.trim()}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                {initializingWhatsapp ? 'Creating...' : 'Add Connection'}
              </button>
            </div>
          </div>
          
          {/* Connection list */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Your Connections</h3>
            
            {loadingConnections ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700 mr-3"></div>
                <p className="text-blue-700">Loading connections...</p>
              </div>
            ) : whatsappConnections.length === 0 ? (
              <p className="text-gray-500 py-4 text-center">No WhatsApp connections found.</p>
            ) : (
              whatsappConnections.map(connection => (
                <div key={connection.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{connection.name}</h4>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        connection.status === 'authenticated' 
                          ? 'bg-green-100 text-green-800' 
                          : connection.status === 'awaiting_qr' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {connection.status === 'authenticated' 
                          ? 'Connected' 
                          : connection.status === 'awaiting_qr' 
                            ? 'Waiting for QR scan' 
                            : connection.status}
                      </div>
                      {connection.phoneNumber && (
                        <p className="text-sm text-gray-600 mt-1">
                          Phone: {connection.phoneNumber}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      {connection.status === 'authenticated' ? (
                        <button
                          onClick={() => logoutWhatsappConnection(connection.id)}
                          disabled={loadingConnections}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-50 text-sm"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => initializeWhatsapp(connection.id)}
                          disabled={initializingWhatsapp || connection.status === 'awaiting_qr'}
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
                        >
                          {initializingWhatsapp ? 'Connecting...' : 'Connect'}
                        </button>
                      )}
                      
                      <button
                        onClick={() => deleteWhatsappConnection(connection.id)}
                        disabled={loadingConnections}
                        className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 disabled:opacity-50 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  {/* Show QR code if awaiting scan */}
                  {connection.status === 'awaiting_qr' && (connection.qrCode || connection.qr_code) && (
                    <div className="mt-3 bg-yellow-50 p-3 rounded-lg">
                      <p className="text-sm text-yellow-700 mb-2">Scan this QR code with WhatsApp:</p>
                      <div className="bg-white p-2 inline-block">
                        <img 
                          src={connection.qrCode || connection.qr_code} 
                          alt="WhatsApp QR Code" 
                          className="max-w-xs" 
                        />
                      </div>
                      <div className="mt-2 text-xs text-yellow-600">
                        <p>1. Open WhatsApp on your phone</p>
                        <p>2. Tap Settings (or ⋮) &gt; Linked Devices</p>
                        <p>3. Tap "Link a Device"</p>
                        <p>4. Point your phone camera at this QR code</p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setWhatsappModalOpen(false)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add this component at the end of the file or in a separate file
function EditRecipientModal({ isOpen, onClose, recipient, onSave }) {
  const [formData, setFormData] = useState({
    name: recipient?.name || '',
    phoneNumber: recipient?.phoneNumber || ''
  });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Edit Recipient</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CampaignDetail; 