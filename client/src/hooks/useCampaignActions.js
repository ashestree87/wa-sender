import { useState } from 'react';
import api from '../services/api';

/**
 * Hook for campaign actions
 * @param {string} campaignId - Campaign ID
 * @param {Function} fetchCampaignDetails - Function to refresh campaign data
 * @param {Function} addToast - Toast notification function
 * @param {string} selectedConnectionId - Selected WhatsApp connection ID
 * @returns {Object} - Campaign actions and state
 */
const useCampaignActions = (campaignId, fetchCampaignDetails, addToast, selectedConnectionId) => {
  const [executing, setExecuting] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Execute a campaign
  const executeCampaign = async () => {
    try {
      setExecuting(true);
      setActionError(null);
      
      const response = await api.post(`/campaigns/${campaignId}/execute`, {
        connectionId: selectedConnectionId
      });
      
      addToast(response.data.message || 'Campaign execution started', 'success');
      
      // Refresh campaign details to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error executing campaign:', error);
      setActionError(`Failed to execute campaign: ${error.response?.data?.message || error.message}`);
      addToast(`Failed to execute campaign: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  // Pause a campaign
  const pauseCampaign = async () => {
    try {
      setExecuting(true);
      setActionError(null);
      
      const response = await api.post(`/campaigns/${campaignId}/pause`);
      
      addToast(response.data.message || 'Campaign paused', 'success');
      
      // Refresh campaign details to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error pausing campaign:', error);
      setActionError(`Failed to pause campaign: ${error.response?.data?.message || error.message}`);
      addToast(`Failed to pause campaign: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  // Resume a campaign
  const resumeCampaign = async () => {
    try {
      setExecuting(true);
      setActionError(null);
      
      const response = await api.post(`/campaigns/${campaignId}/resume`, {
        connectionId: selectedConnectionId
      });
      
      addToast(response.data.message || 'Campaign resumed', 'success');
      
      // Refresh campaign details to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error resuming campaign:', error);
      setActionError(`Failed to resume campaign: ${error.response?.data?.message || error.message}`);
      addToast(`Failed to resume campaign: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  // Resend failed messages
  const resendFailedMessages = async () => {
    try {
      setExecuting(true);
      setActionError(null);
      
      const response = await api.post(`/campaigns/${campaignId}/resend-failed`, {
        connectionId: selectedConnectionId
      });
      
      addToast(response.data.message || 'Resending failed messages', 'success');
      
      // Refresh campaign details to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error resending failed messages:', error);
      setActionError(`Failed to resend messages: ${error.response?.data?.message || error.message}`);
      addToast(`Failed to resend messages: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  // Duplicate a campaign
  const duplicateCampaign = async (navigate) => {
    try {
      const response = await api.post(`/campaigns/${campaignId}/duplicate`);
      addToast('Campaign duplicated successfully', 'success');
      
      if (navigate) {
        navigate(`/campaigns/${response.data.id}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      addToast(`Failed to duplicate campaign: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Delete a campaign
  const deleteCampaign = async (navigate) => {
    try {
      await api.delete(`/campaigns/${campaignId}`);
      addToast('Campaign deleted successfully', 'success');
      
      if (navigate) {
        navigate('/');
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting campaign:', error);
      addToast(`Failed to delete campaign: ${error.response?.data?.message || error.message}`, 'error');
      return false;
    }
  };

  // Handle all campaign actions
  const handleAction = (action, navigate) => {
    switch (action) {
      case 'execute':
        return executeCampaign();
      case 'pause':
        return pauseCampaign();
      case 'resume':
        return resumeCampaign();
      case 'resendFailed':
        return resendFailedMessages();
      case 'duplicate':
        return duplicateCampaign(navigate);
      case 'delete':
        return deleteCampaign(navigate);
      default:
        console.warn(`Unknown action: ${action}`);
        return null;
    }
  };

  return {
    executing,
    actionError,
    executeCampaign,
    pauseCampaign,
    resumeCampaign,
    resendFailedMessages,
    duplicateCampaign,
    deleteCampaign,
    handleAction
  };
};

export default useCampaignActions; 