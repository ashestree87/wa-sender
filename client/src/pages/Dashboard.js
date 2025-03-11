import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import DuplicateCampaignModal from '../components/DuplicateCampaignModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();
  const [filter, setFilter] = useState('all');
  
  // New state for the duplicate modal
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [campaignToDuplicate, setCampaignToDuplicate] = useState(null);
  
  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);

  // Wrap fetchCampaigns with useCallback
  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching campaigns...');
      const response = await api.get('/campaigns');
      console.log('Campaigns response:', response.data);
      
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      
      // More detailed error message
      let errorMessage = 'Failed to load campaigns';
      if (error.response) {
        console.error('Error response:', error.response);
        if (error.response.status === 401) {
          errorMessage = 'Your session has expired. Please log in again.';
        } else if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      setError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]); // Include dependencies of fetchCampaigns

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]); // Include fetchCampaigns in the dependency array

  const openDeleteModal = (campaign) => {
    setCampaignToDelete(campaign);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/campaigns/${campaignToDelete.id}`);
      setCampaigns(campaigns.filter(campaign => campaign.id !== campaignToDelete.id));
      addToast('Campaign deleted successfully', 'success');
      setDeleteModalOpen(false);
      setCampaignToDelete(null);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      
      // Show more specific error message
      let errorMessage = 'Failed to delete campaign';
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = 'Campaign not found. It may have been already deleted.';
        } else if (error.response.status === 403) {
          errorMessage = 'You are not authorized to delete this campaign.';
        } else if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      addToast(errorMessage, 'error');
    }
  };

  const openDuplicateModal = (campaign) => {
    setCampaignToDuplicate(campaign);
    setDuplicateModalOpen(true);
  };

  const handleDuplicate = async (newName) => {
    try {
      const response = await api.post(`/campaigns/${campaignToDuplicate.id}/duplicate`, { 
        name: newName 
      });
      const newCampaignId = response.data.id;
      addToast(`Campaign duplicated successfully with ID: ${newCampaignId}`, 'success');
      setDuplicateModalOpen(false);
      fetchCampaigns(); // Refresh the list
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      addToast('Failed to duplicate campaign', 'error');
    }
  };

  // Filter campaigns based on status
  const filteredCampaigns = filter === 'all' 
    ? campaigns 
    : campaigns.filter(campaign => campaign.status === filter);

  // Get counts for each status
  const statusCounts = campaigns.reduce((counts, campaign) => {
    const status = campaign.status || 'draft';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  if (loading) {
    return <div>Loading campaigns...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Campaigns</h1>
        <Link
          to="/campaigns/new"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Create New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-gray-600 mb-4">You don't have any campaigns yet.</p>
          <Link
            to="/campaigns/new"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Create Your First Campaign
          </Link>
        </div>
      ) : (
        <>
          {/* Status filter tabs */}
          <div className="mb-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setFilter('all')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === 'all'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Campaigns
                <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {campaigns.length}
                </span>
              </button>
              
              <button
                onClick={() => setFilter('draft')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === 'draft'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Drafts
                <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {statusCounts.draft || 0}
                </span>
              </button>
              
              <button
                onClick={() => setFilter('in_progress')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === 'in_progress'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                In Progress
                <span className="ml-2 bg-blue-100 text-blue-600 py-0.5 px-2 rounded-full text-xs">
                  {statusCounts.in_progress || 0}
                </span>
              </button>
              
              <button
                onClick={() => setFilter('completed')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === 'completed'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Completed
                <span className="ml-2 bg-green-100 text-green-600 py-0.5 px-2 rounded-full text-xs">
                  {statusCounts.completed || 0}
                </span>
              </button>
              
              <button
                onClick={() => setFilter('failed')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === 'failed'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Failed
                <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs">
                  {statusCounts.failed || 0}
                </span>
              </button>
            </nav>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <p className="text-gray-600">No campaigns match the selected filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCampaigns.map(campaign => (
                <div key={campaign.id} className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-2">{campaign.name}</h2>
                  <p className="text-gray-600 mb-4 h-12 overflow-hidden">
                    {campaign.description || 'No description'}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      campaign.status === 'completed' ? 'bg-green-100 text-green-800' :
                      campaign.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      campaign.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {campaign.status || 'draft'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="mt-4 flex justify-end space-x-2">
                    <Link 
                      to={`/campaigns/${campaign.id}`}
                      className="text-sm bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600"
                    >
                      View
                    </Link>
                    <Link 
                      to={`/campaigns/${campaign.id}/edit`}
                      className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => openDuplicateModal(campaign)}
                      className="text-sm bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => openDeleteModal(campaign)}
                      className="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add both modals at the end */}
      {campaignToDuplicate && (
        <DuplicateCampaignModal
          isOpen={duplicateModalOpen}
          onClose={() => {
            setDuplicateModalOpen(false);
            setCampaignToDuplicate(null);
          }}
          onConfirm={handleDuplicate}
          campaignName={campaignToDuplicate.name}
        />
      )}
      
      {campaignToDelete && (
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setCampaignToDelete(null);
          }}
          onConfirm={handleDelete}
          itemName={campaignToDelete.name}
        />
      )}
    </div>
  );
}

export default Dashboard; 