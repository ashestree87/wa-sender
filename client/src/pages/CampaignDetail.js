import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

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

  // Add a function to check WhatsApp status
  const checkWhatsappStatus = useCallback(async () => {
    try {
      setCheckingWhatsapp(true);
      const response = await api.get('/whatsapp/status');
      setWhatsappConnected(response.data.status === 'authenticated');
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
      setWhatsappConnected(false);
    } finally {
      setCheckingWhatsapp(false);
    }
  }, []);
  
  // Check WhatsApp status when component mounts
  useEffect(() => {
    checkWhatsappStatus();
  }, [checkWhatsappStatus]);

  const executeCampaign = async () => {
    try {
      setExecuting(true);
      setError(null);
      
      // First check if WhatsApp is connected
      const whatsappStatus = await api.get('/whatsapp/status');
      if (whatsappStatus.data.status !== 'authenticated') {
        throw new Error('WhatsApp is not connected. Please set up WhatsApp first.');
      }
      
      console.log('Attempting to execute campaign:', id);
      const response = await api.post(`/campaigns/${id}/execute`);
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

  // Add a function to initialize WhatsApp directly
  const initializeWhatsapp = async () => {
    try {
      setInitializingWhatsapp(true);
      setError(null);
      
      // Call the WhatsApp initialization endpoint
      const response = await api.post('/whatsapp/initialize');
      
      // Check if the response contains a success property or if the message indicates success
      if (response.data.success || 
          (response.data.message && 
           response.data.message.toLowerCase().includes('authenticated'))) {
        
        addToast('WhatsApp initialized successfully', 'success');
        // Check status again to update the UI
        await checkWhatsappStatus();
      } else {
        throw new Error(response.data.message || 'Failed to initialize WhatsApp');
      }
    } catch (error) {
      // Check if the error message actually indicates success
      if (error.response?.data?.message && 
          error.response.data.message.toLowerCase().includes('authenticated')) {
        
        addToast('WhatsApp initialized successfully', 'success');
        // Check status again to update the UI
        await checkWhatsappStatus();
      } else {
        console.error('Error initializing WhatsApp:', error);
        setError(`Failed to initialize WhatsApp: ${error.response?.data?.message || error.message}`);
        addToast(`Failed to initialize WhatsApp: ${error.response?.data?.message || error.message}`, 'error');
      }
    } finally {
      setInitializingWhatsapp(false);
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

  if (loading) {
    return <div>Loading campaign details...</div>;
  }

  if (!campaign) {
    return <div>Campaign not found</div>;
  }

  return (
    <div>
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
          
          {/* Campaign action buttons - moved here */}
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
        <h2 className="text-lg font-semibold mb-4">Recipients ({recipients.length})</h2>
        
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {recipient.status === 'pending' && (
                        <button
                          onClick={() => skipRecipient(recipient.id)}
                          className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 mr-2"
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
    </div>
  );
}

export default CampaignDetail; 