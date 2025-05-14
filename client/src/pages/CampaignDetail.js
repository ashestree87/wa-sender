import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import Papa from 'papaparse';

// Import our new components
import CampaignHeader from '../components/campaign/details/CampaignHeader';
import CampaignStats from '../components/campaign/details/CampaignStats';
import CampaignActions from '../components/campaign/details/CampaignActions';
import RecipientListTable from '../components/campaign/details/RecipientListTable';
import {
  EditRecipientModal,
  DeleteRecipientModal,
  BulkImportModal,
  WhatsAppSetupModal
} from '../components/campaign/details/RecipientModals';

function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  
  // Main state
  const [campaign, setCampaign] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI state
  const [executing, setExecuting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRecipients, setFilteredRecipients] = useState([]);
  
  // WhatsApp state
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [checkingWhatsapp, setCheckingWhatsapp] = useState(true);
  const [initializingWhatsapp, setInitializingWhatsapp] = useState(false);
  const [whatsappConnections, setWhatsappConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [newConnectionName, setNewConnectionName] = useState('');

  // Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editRecipientModalOpen, setEditRecipientModalOpen] = useState(false);
  const [currentRecipient, setCurrentRecipient] = useState(null);
  const [deleteRecipientModalOpen, setDeleteRecipientModalOpen] = useState(false);
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  
  // Import state
  const [importMethod, setImportMethod] = useState('bulk');
  const [bulkInput, setBulkInput] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  // Fetch campaign and recipients
  const fetchCampaignDetails = useCallback(async () => {
    try {
      const campaignResponse = await api.get(`/campaigns/${id}`);
      
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
      return true;
    } catch (error) {
      console.error('Error fetching campaign details:', error);
      setError('Failed to load campaign details');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [id]);

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
  const initializeWhatsapp = async (connectionId = selectedConnectionId) => {
    try {
      setInitializingWhatsapp(true);
      setError(null);
      
      const response = await api.post('/whatsapp/initialize', { 
        connectionId: connectionId || 'default'
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
        setError(`Failed to initialize WhatsApp: ${error.response?.data?.message || error.message}`);
        addToast(`Failed to initialize WhatsApp: ${error.response?.data?.message || error.message}`, 'error');
      }
    } finally {
      setInitializingWhatsapp(false);
    }
  };

  // Campaign actions
  const executeCampaign = async () => {
    try {
      setExecuting(true);
      setError(null);
      
      const response = await api.post(`/campaigns/${id}/execute`, {
        connectionId: selectedConnectionId
      });
      
      addToast(response.data.message || 'Campaign execution started', 'success');
      
      // Refresh campaign details to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error executing campaign:', error);
      setError(`Failed to execute campaign: ${error.response?.data?.message || error.message}`);
      addToast(`Failed to execute campaign: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const pauseCampaign = async () => {
    try {
      setExecuting(true);
      setError(null);
      
      const response = await api.post(`/campaigns/${id}/pause`);
      
      addToast(response.data.message || 'Campaign paused', 'success');
      
      // Refresh campaign details to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error pausing campaign:', error);
      setError(`Failed to pause campaign: ${error.response?.data?.message || error.message}`);
      addToast(`Failed to pause campaign: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const resumeCampaign = async () => {
    try {
      setExecuting(true);
      setError(null);
      
      const response = await api.post(`/campaigns/${id}/resume`, {
        connectionId: selectedConnectionId
      });
      
      addToast(response.data.message || 'Campaign resumed', 'success');
      
      // Refresh campaign details to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error resuming campaign:', error);
      setError(`Failed to resume campaign: ${error.response?.data?.message || error.message}`);
      addToast(`Failed to resume campaign: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const resendFailedMessages = async () => {
    try {
      setExecuting(true);
      setError(null);
      
      const response = await api.post(`/campaigns/${id}/resend-failed`, {
        connectionId: selectedConnectionId
      });
      
      addToast(response.data.message || 'Resending failed messages', 'success');
      
      // Refresh campaign details to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error resending failed messages:', error);
      setError(`Failed to resend messages: ${error.response?.data?.message || error.message}`);
      addToast(`Failed to resend messages: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const duplicateCampaign = async () => {
    try {
      const response = await api.post(`/campaigns/${id}/duplicate`);
      addToast('Campaign duplicated successfully', 'success');
      navigate(`/campaigns/${response.data.id}`);
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      addToast(`Failed to duplicate campaign: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/campaigns/${id}`);
      addToast('Campaign deleted successfully', 'success');
      navigate('/');
    } catch (error) {
      console.error('Error deleting campaign:', error);
      addToast(`Failed to delete campaign: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setDeleteModalOpen(false);
    }
  };

  // Recipient actions
  const handleResendToRecipient = async (recipientId) => {
    try {
      setExecuting(true);
      
      const response = await api.post(`/campaigns/${id}/recipients/${recipientId}/resend`, {
        connectionId: selectedConnectionId
      });
      
      addToast(response.data.message || 'Resending message', 'success');
      
      // Refresh recipients to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error resending to recipient:', error);
      addToast(`Failed to resend message: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const handleSkipRecipient = async (recipientId) => {
    try {
      const response = await api.post(`/campaigns/${id}/recipients/${recipientId}/skip`);
      addToast('Recipient skipped', 'success');
      
      // Refresh recipients to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error skipping recipient:', error);
      addToast(`Failed to skip recipient: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const handleResetRecipientStatus = async (recipientId) => {
    try {
      const response = await api.post(`/campaigns/${id}/recipients/${recipientId}/reset`);
      addToast('Recipient status reset to pending', 'success');
      
      // Refresh recipients to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error resetting recipient status:', error);
      addToast(`Failed to reset status: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const handleUpdateRecipient = async (recipientId, data) => {
    try {
      await api.put(`/campaigns/${id}/recipients/${recipientId}`, data);
      addToast('Recipient updated successfully', 'success');
      
      // Refresh recipients to get updated data
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error updating recipient:', error);
      addToast(`Failed to update recipient: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const handleDeleteRecipient = async (recipientId) => {
    try {
      await api.delete(`/campaigns/${id}/recipients/${recipientId}`);
      addToast('Recipient deleted successfully', 'success');
      
      // Refresh recipients to get updated list
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error deleting recipient:', error);
      addToast(`Failed to delete recipient: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Modal handlers
  const openEditRecipientModal = (recipient) => {
    setCurrentRecipient(recipient);
    setEditRecipientModalOpen(true);
  };

  const openDeleteRecipientModal = (recipient) => {
    setCurrentRecipient(recipient);
    setDeleteRecipientModalOpen(true);
  };

  // WhatsApp connection handlers
  const handleCreateConnection = async () => {
    try {
      if (!newConnectionName.trim()) return;
      
      const response = await api.post('/whatsapp/connection', {
        name: newConnectionName
      });
      
      addToast('WhatsApp connection created', 'success');
      setNewConnectionName('');
      
      // Refresh connections
      await fetchWhatsappConnections();
      
      // Set the new connection as selected
      if (response.data.id) {
        setSelectedConnectionId(response.data.id);
      }
    } catch (error) {
      console.error('Error creating WhatsApp connection:', error);
      addToast(`Failed to create connection: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const handleDeleteConnection = async (connectionId) => {
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

  const handleLogoutConnection = async (connectionId) => {
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

  // Import handlers
  const processBulkInput = () => {
    if (!bulkInput.trim()) {
      setImportError('Please enter recipient data');
      return [];
    }
    
    try {
      const lines = bulkInput.trim().split('\n');
      const recipients = lines.map(line => {
        const [name, phoneNumber] = line.split(',');
        return { name: name?.trim(), phoneNumber: phoneNumber?.trim() };
      }).filter(r => r.phoneNumber); // Filter out entries without phone numbers
      
      if (recipients.length === 0) {
        setImportError('No valid recipients found. Format should be "Name,PhoneNumber"');
        return [];
      }
      
      // Validate phone numbers
      const invalidRecipients = recipients.filter(r => !r.phoneNumber.match(/^[+]?[\d\s\-\(\)]+$/));
      
      if (invalidRecipients.length > 0) {
        setImportError(`${invalidRecipients.length} recipients have invalid phone numbers`);
        return [];
      }
      
      return recipients;
    } catch (error) {
      console.error('Error processing bulk input:', error);
      setImportError('Error processing input. Check format and try again.');
      return [];
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.error('CSV parsing errors:', results.errors);
          setImportError('Error parsing CSV file. Check format and try again.');
          return;
        }
        
        if (!results.data || results.data.length === 0) {
          setImportError('No data found in CSV file');
          return;
        }
        
        const recipients = results.data
          .filter(row => row.phoneNumber || row.phone || row['phone number'] || row['phone_number'])
          .map(row => ({
            name: row.name || row.Name || '',
            phoneNumber: row.phoneNumber || row.phone || row['phone number'] || row['phone_number'] || ''
          }));
        
        if (recipients.length === 0) {
          setImportError('No valid recipients found in CSV. Ensure it has name and phoneNumber columns.');
          return;
        }
        
        // Set bulk input with the parsed data
        const formattedInput = recipients
          .map(r => `${r.name || ''},${r.phoneNumber}`)
          .join('\n');
        
        setBulkInput(formattedInput);
        setImportError('');
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        setImportError('Error parsing CSV file. Check format and try again.');
      }
    });
  };

  const importRecipients = async () => {
    let recipients = [];
    
    if (importMethod === 'bulk') {
      recipients = processBulkInput();
      if (recipients.length === 0) return;
    } else {
      if (!bulkInput.trim()) {
        setImportError('Please upload and parse a CSV file first');
        return;
      }
      
      recipients = processBulkInput();
      if (recipients.length === 0) return;
    }
    
    try {
      setImportLoading(true);
      setImportError('');
      
      const response = await api.post(`/campaigns/${id}/recipients/import`, { 
        recipients 
      });
      
      addToast(`Successfully imported ${response.data.count} recipients`, 'success');
      
      // Reset form and close modal
      setBulkInput('');
      setBulkImportModalOpen(false);
      
      // Refresh recipients
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error importing recipients:', error);
      setImportError(`Failed to import recipients: ${error.response?.data?.message || error.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  // Handle campaign actions
  const handleAction = (action) => {
    switch (action) {
      case 'execute':
        executeCampaign();
        break;
      case 'pause':
        pauseCampaign();
        break;
      case 'resume':
        resumeCampaign();
        break;
      case 'resendFailed':
        resendFailedMessages();
        break;
      case 'duplicate':
        duplicateCampaign();
        break;
      case 'setupWhatsapp':
        setWhatsappModalOpen(true);
        break;
      default:
        console.warn(`Unknown action: ${action}`);
    }
  };

  // Filter recipients based on search term
  useEffect(() => {
    if (!recipients.length) {
      setFilteredRecipients([]);
      return;
    }
    
    if (!searchTerm) {
      setFilteredRecipients(recipients);
      return;
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = recipients.filter(recipient => 
      (recipient.name && recipient.name.toLowerCase().includes(lowerSearchTerm)) ||
      recipient.phoneNumber.toLowerCase().includes(lowerSearchTerm) ||
      recipient.status.toLowerCase().includes(lowerSearchTerm)
    );
    
    setFilteredRecipients(filtered);
  }, [recipients, searchTerm]);

  // Initial data fetch
  useEffect(() => {
    fetchCampaignDetails();
    checkWhatsappStatus();
    
    // Set up polling for WhatsApp status every 30 seconds
    const whatsappInterval = setInterval(checkWhatsappStatus, 30000);
    
    return () => {
      clearInterval(whatsappInterval);
    };
  }, [fetchCampaignDetails, checkWhatsappStatus]);

  // Polling for active campaigns
  useEffect(() => {
    let interval = null;
    
    if (campaign && ['in_progress', 'scheduled', 'paused'].includes(campaign.status)) {
      // Poll for updates every 3 seconds for active campaigns
      interval = setInterval(fetchCampaignDetails, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [campaign?.status, fetchCampaignDetails]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
        <strong className="font-bold">Error! </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-semibold">Campaign not found</h2>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Campaign Header */}
      <CampaignHeader 
        campaign={campaign}
        handleAction={handleAction}
        deleteModalOpen={deleteModalOpen}
        setDeleteModalOpen={setDeleteModalOpen}
      />

      {/* Campaign Stats */}
      <CampaignStats recipients={recipients} />

      {/* Campaign Actions */}
      <CampaignActions 
        campaign={campaign}
        whatsappConnected={whatsappConnected}
        handleAction={handleAction}
        executing={executing}
      />

      {/* Recipient List & Operations */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setBulkImportModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Import Recipients
        </button>
      </div>

      {/* Recipients Table */}
      <RecipientListTable 
        filteredRecipients={filteredRecipients}
        handleResendToRecipient={handleResendToRecipient}
        handleResetRecipientStatus={handleResetRecipientStatus}
        handleSkipRecipient={handleSkipRecipient}
        openEditRecipientModal={openEditRecipientModal}
        openDeleteRecipientModal={openDeleteRecipientModal}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        whatsappConnected={whatsappConnected}
      />

      {/* Delete Campaign Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Campaign"
        message={`Are you sure you want to delete the campaign "${campaign.name}"? This action cannot be undone.`}
      />

      {/* Edit Recipient Modal */}
      <EditRecipientModal
        isOpen={editRecipientModalOpen}
        onClose={() => setEditRecipientModalOpen(false)}
        recipient={currentRecipient}
        onSave={handleUpdateRecipient}
      />

      {/* Delete Recipient Modal */}
      <DeleteRecipientModal
        isOpen={deleteRecipientModalOpen}
        onClose={() => setDeleteRecipientModalOpen(false)}
        recipient={currentRecipient}
        onConfirm={handleDeleteRecipient}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={bulkImportModalOpen}
        onClose={() => {
          setBulkImportModalOpen(false);
          setBulkInput('');
          setImportError('');
        }}
        onImport={importRecipients}
        importMethod={importMethod}
        setImportMethod={setImportMethod}
        bulkInput={bulkInput}
        setBulkInput={setBulkInput}
        handleFileUpload={handleFileUpload}
        fileInputRef={fileInputRef}
        importLoading={importLoading}
        importError={importError}
      />

      {/* WhatsApp Setup Modal */}
      <WhatsAppSetupModal
        isOpen={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        whatsappConnections={whatsappConnections}
        loadingConnections={loadingConnections}
        selectedConnectionId={selectedConnectionId}
        setSelectedConnectionId={setSelectedConnectionId}
        newConnectionName={newConnectionName}
        setNewConnectionName={setNewConnectionName}
        handleCreateConnection={handleCreateConnection}
        handleDeleteConnection={handleDeleteConnection}
        handleLogoutConnection={handleLogoutConnection}
        initializeWhatsapp={initializeWhatsapp}
        initializingWhatsapp={initializingWhatsapp}
      />
    </div>
  );
}

export default CampaignDetail;