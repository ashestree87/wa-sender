import { useState } from 'react';
import api from '../services/api';

/**
 * Hook for recipient management
 * @param {string} campaignId - Campaign ID
 * @param {Function} fetchCampaignDetails - Function to refresh campaign data
 * @param {Function} addToast - Toast notification function
 * @param {string} selectedConnectionId - Selected WhatsApp connection ID
 * @returns {Object} - Recipient management functions and state
 */
const useRecipientManagement = (campaignId, fetchCampaignDetails, addToast, selectedConnectionId) => {
  // Import state
  const [importMethod, setImportMethod] = useState('bulk');
  const [bulkInput, setBulkInput] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  // Modal state
  const [currentRecipient, setCurrentRecipient] = useState(null);
  const [editRecipientModalOpen, setEditRecipientModalOpen] = useState(false);
  const [deleteRecipientModalOpen, setDeleteRecipientModalOpen] = useState(false);
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);

  // Recipient actions
  const handleResendToRecipient = async (recipientId) => {
    try {
      const response = await api.post(`/campaigns/${campaignId}/recipients/${recipientId}/resend`, {
        connectionId: selectedConnectionId
      });
      
      addToast(response.data.message || 'Resending message', 'success');
      
      // Refresh recipients to get updated status
      await fetchCampaignDetails();
    } catch (error) {
      console.error('Error resending to recipient:', error);
      addToast(`Failed to resend message: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const handleSkipRecipient = async (recipientId) => {
    try {
      const response = await api.post(`/campaigns/${campaignId}/recipients/${recipientId}/skip`);
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
      const response = await api.post(`/campaigns/${campaignId}/recipients/${recipientId}/reset`);
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
      await api.put(`/campaigns/${campaignId}/recipients/${recipientId}`, data);
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
      await api.delete(`/campaigns/${campaignId}/recipients/${recipientId}`);
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

  // Process bulk input for recipient import
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

  // Import recipients
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
      
      const response = await api.post(`/campaigns/${campaignId}/recipients/import`, { 
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

  return {
    // Import state
    importMethod,
    bulkInput,
    importLoading,
    importError,
    setImportMethod,
    setBulkInput,
    setImportError,
    
    // Modal state
    currentRecipient,
    editRecipientModalOpen,
    deleteRecipientModalOpen,
    bulkImportModalOpen,
    setEditRecipientModalOpen,
    setDeleteRecipientModalOpen,
    setBulkImportModalOpen,
    
    // Functions
    handleResendToRecipient,
    handleSkipRecipient,
    handleResetRecipientStatus,
    handleUpdateRecipient, 
    handleDeleteRecipient,
    openEditRecipientModal,
    openDeleteRecipientModal,
    processBulkInput,
    importRecipients
  };
};

export default useRecipientManagement; 