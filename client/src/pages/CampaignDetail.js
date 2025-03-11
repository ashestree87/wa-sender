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
  const [pollingInterval, setPollingInterval] = useState(null);
  const { addToast } = useToast();
  
  // Add delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const fetchCampaignDetails = useCallback(async () => {
    try {
      console.log('Fetching campaign details for ID:', id);
      const campaignResponse = await api.get(`/campaigns/${id}`);
      console.log('Campaign data received:', campaignResponse.data);
      
      // Log the raw date strings for debugging
      console.log('Raw created_at:', campaignResponse.data.created_at);
      console.log('Raw scheduled_start_time:', campaignResponse.data.scheduled_start_time);
      
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
    } catch (error) {
      console.error('Error fetching campaign details:', error);
      setError('Failed to load campaign details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCampaignDetails();
  }, [fetchCampaignDetails]);

  useEffect(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    if (campaign && campaign.status === 'in_progress') {
      const interval = setInterval(() => {
        fetchCampaignDetails();
      }, 3000);
      
      setPollingInterval(interval);
    }
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [campaign, fetchCampaignDetails]);

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
      const response = await api.post(`/campaigns/${id}/recipients/${recipientId}/resend`);
      addToast(`Message resend initiated for this recipient.`, 'info');
      fetchCampaignDetails(); // Refresh to show updated status
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
      
      const response = await api.post(`/campaigns/${id}/resend-failed`);
      addToast(`Resending messages to ${failedRecipients.length} recipients.`, 'info');
      fetchCampaignDetails(); // Refresh to show updated status
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
          {campaign.status !== 'completed' && campaign.status !== 'in_progress' && (
            <button
              onClick={executeCampaign}
              disabled={executing}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
            >
              {executing ? 'Starting...' : 'Execute Campaign'}
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
            </p>
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
        
        {recipients.length === 0 ? (
          <p>No recipients added to this campaign.</p>
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
                {recipients.map((recipient, index) => (
                  <tr key={recipient.id || index}>
                    <td className="px-6 py-4 whitespace-nowrap">{recipient.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{recipient.phoneNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-sm ${
                        recipient.status === 'sent' ? 'bg-green-100 text-green-800' :
                        recipient.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {recipient.status || 'pending'}
                      </span>
                      {recipient.failureReason && (
                        <span className="ml-2 text-sm text-red-600" title={recipient.failureReason}>⚠️</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {recipient.sentAt ? new Date(recipient.sentAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {recipient.deliveredAt ? new Date(recipient.deliveredAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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