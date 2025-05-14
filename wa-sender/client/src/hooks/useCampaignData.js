import { useState, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook for fetching and managing campaign data
 * @param {string} campaignId - The ID of the campaign
 * @returns {Object} - Campaign data and functions
 */
const useCampaignData = (campaignId) => {
  const [campaign, setCampaign] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteredRecipients, setFilteredRecipients] = useState([]);

  // Fetch campaign details
  const fetchCampaignDetails = useCallback(async () => {
    try {
      const campaignResponse = await api.get(`/campaigns/${campaignId}`);
      
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
      
      const recipientsResponse = await api.get(`/campaigns/${campaignId}/recipients`);
      
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
  }, [campaignId]);

  // Filter recipients based on search term
  const filterRecipients = (searchTerm) => {
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
  };

  return {
    campaign,
    recipients,
    filteredRecipients,
    loading,
    error,
    fetchCampaignDetails,
    filterRecipients,
    setCampaign,
    setRecipients,
    setLoading,
    setError,
    setFilteredRecipients
  };
};

export default useCampaignData; 