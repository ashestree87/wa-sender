import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import DuplicateCampaignModal from '../components/DuplicateCampaignModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [campaignProgress, setCampaignProgress] = useState({});
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

  const mountedRef = useRef(false);

  // Add a ref for tracking in-progress campaign IDs
  const campaignIdsRef = useRef([]);

  // Add a ref to track if polling is set up
  const pollingSetupRef = useRef(false);

  // Add a ref to track which campaigns we've fetched progress for
  const fetchedProgressRef = useRef(new Set());

  // Add a function to calculate campaign progress
  const calculateProgress = (campaign) => {
    if (!campaignProgress[campaign.id]) {
      return { fraction: '0/0', percentage: 0 };
    }
    
    const { total, processed } = campaignProgress[campaign.id];
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    return {
      fraction: `${processed}/${total}`,
      percentage
    };
  };

  // Function to fetch progress for in-progress campaigns
  const fetchCampaignProgress = async (campaignId) => {
    try {
      console.log(`Fetching progress for campaign ${campaignId}`);
      
      // Check if the campaign still exists in our state
      const campaignExists = campaigns.some(c => c.id === campaignId);
      if (!campaignExists) {
        console.log(`Campaign ${campaignId} no longer exists in state, skipping progress fetch`);
        return;
      }
      
      // Fetch recipients to calculate progress
      const recipientsResponse = await api.get(`/campaigns/${campaignId}/recipients`);
      
      if (recipientsResponse.data && recipientsResponse.data.length > 0) {
        // Log recipient statuses to debug
        const statusCounts = recipientsResponse.data.reduce((acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, {});
        
        const total = recipientsResponse.data.length;
        const processed = recipientsResponse.data.filter(r => 
          ['sent', 'delivered', 'failed', 'skipped'].includes(r.status)
        ).length;
        
        console.log(`Campaign ${campaignId} progress: ${processed}/${total} (${Math.round((processed/total)*100)}%)`);
        console.log(`Status counts:`, statusCounts);
        
        // Update progress state
        setCampaignProgress(prev => ({
          ...prev,
          [campaignId]: { total, processed }
        }));
      }
    } catch (error) {
      console.error(`Error fetching progress for campaign ${campaignId}:`, error);
      
      // If we get a 404 or 500 error, the campaign might have been deleted
      // Remove it from the progress tracking
      if (error.response && (error.response.status === 404 || error.response.status === 500)) {
        console.log(`Campaign ${campaignId} appears to be deleted or inaccessible, removing from progress tracking`);
        
        // Remove this campaign from progress state
        setCampaignProgress(prev => {
          const newState = { ...prev };
          delete newState[campaignId];
          return newState;
        });
        
        // Also check if it's still in our campaigns list and remove it if needed
        const campaignExists = campaigns.some(c => c.id === campaignId);
        if (campaignExists) {
          console.log(`Removing deleted campaign ${campaignId} from campaigns list`);
          setCampaigns(prevCampaigns => 
            prevCampaigns.filter(campaign => campaign.id !== campaignId)
          );
        }
      }
    }
  };

  // Main useEffect for initial data loading
  useEffect(() => {
    // Skip the second invocation in StrictMode
    if (mountedRef.current) return;
    mountedRef.current = true;
    
    // Define fetchCampaigns inside useEffect
    const fetchCampaigns = async () => {
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
    };

    fetchCampaigns();
  }, [addToast]);
  
  // Simplify the polling mechanism to ensure progress updates work
  useEffect(() => {
    // Only run if we have campaigns and we're not loading
    if (campaigns.length === 0 || loading) return;
    
    // Find in-progress campaigns
    const inProgressCampaigns = campaigns.filter(
      campaign => campaign.status === 'in_progress'
    );
    
    if (inProgressCampaigns.length === 0) {
      console.log('No in-progress campaigns to poll');
      return;
    }
    
    console.log(`Setting up polling for ${inProgressCampaigns.length} in-progress campaigns`);
    
    // Do an initial poll for all in-progress campaigns
    inProgressCampaigns.forEach(campaign => {
      fetchCampaignProgress(campaign.id);
    });
    
    // Set up polling interval
    const progressInterval = setInterval(() => {
      console.log(`Polling progress at ${new Date().toLocaleTimeString()}`);
      
      // Re-check which campaigns are in progress (using the current state)
      const currentInProgressCampaigns = campaigns.filter(
        campaign => campaign.status === 'in_progress'
      );
      
      if (currentInProgressCampaigns.length === 0) {
        console.log('No more in-progress campaigns, clearing interval');
        clearInterval(progressInterval);
        return;
      }
      
      // Poll each in-progress campaign
      currentInProgressCampaigns.forEach(campaign => {
        // Skip campaigns that might have been deleted
        if (campaign && campaign.id) {
          fetchCampaignProgress(campaign.id);
        }
      });
    }, 30000); // Poll every 30 seconds
    
    // Clean up interval on unmount or when campaigns change
    return () => {
      console.log('Cleaning up campaign progress polling');
      clearInterval(progressInterval);
    };
  }, [campaigns, loading]); // Re-run when campaigns or loading state changes

  const openDeleteModal = (campaign) => {
    setCampaignToDelete(campaign);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      // First check if the campaign is active
      if (campaignToDelete.status === 'in_progress' || campaignToDelete.status === 'scheduled' || campaignToDelete.status === 'paused') {
        // Show toast to indicate we're preparing the campaign for deletion
        addToast('Preparing campaign for deletion...', 'info');
        
        try {
          // Pause the campaign first to prevent processing errors (if not already paused)
          if (campaignToDelete.status !== 'paused') {
            await api.post(`/campaigns/${campaignToDelete.id}/pause`);
            
            // Update the campaign status locally to show it's paused
            setCampaignToDelete(prev => ({...prev, status: 'paused'}));
            
            // Also update in the main campaigns list
            setCampaigns(prevCampaigns => 
              prevCampaigns.map(campaign => 
                campaign.id === campaignToDelete.id 
                  ? { ...campaign, status: 'paused' } 
                  : campaign
              )
            );
            
            addToast('Campaign paused. Waiting for server to process...', 'info');
          }
          
          // Wait for server to process the pause
          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (pauseError) {
          console.error('Error pausing campaign before deletion:', pauseError);
          addToast('Could not pause campaign, proceeding with deletion anyway', 'warning');
        }
      }
      
      // Now delete the campaign
      addToast('Deleting campaign...', 'info');
      
      try {
        await api.delete(`/campaigns/${campaignToDelete.id}`);
        
        // Update the campaigns state directly instead of fetching again
        setCampaigns(prevCampaigns => 
          prevCampaigns.filter(campaign => campaign.id !== campaignToDelete.id)
        );
        
        // Also remove from progress tracking
        setCampaignProgress(prev => {
          const newState = { ...prev };
          delete newState[campaignToDelete.id];
          return newState;
        });
        
        addToast('Campaign deleted successfully', 'success');
      } catch (deleteError) {
        console.error('Error deleting campaign:', deleteError);
        
        // If we get a 404, the campaign is already gone
        if (deleteError.response && deleteError.response.status === 404) {
          // Update the campaigns state to remove it
          setCampaigns(prevCampaigns => 
            prevCampaigns.filter(campaign => campaign.id !== campaignToDelete.id)
          );
          
          // Also remove from progress tracking
          setCampaignProgress(prev => {
            const newState = { ...prev };
            delete newState[campaignToDelete.id];
            return newState;
          });
          
          addToast('Campaign deleted successfully', 'success');
        } else {
          // For other errors, show the error message
          let errorMessage = 'Failed to delete campaign';
          if (deleteError.response && deleteError.response.data && deleteError.response.data.message) {
            errorMessage = deleteError.response.data.message;
          }
          addToast(errorMessage, 'error');
          
          // Return early to keep the modal open
          return;
        }
      }
      
      // Close the modal and reset state
      setDeleteModalOpen(false);
      setCampaignToDelete(null);
      
    } catch (error) {
      console.error('Unexpected error in delete process:', error);
      addToast('An unexpected error occurred', 'error');
    }
  };

  const openDuplicateModal = (campaign) => {
    setCampaignToDuplicate(campaign);
    setDuplicateModalOpen(true);
  };

  const refreshCampaigns = async () => {
    try {
      console.log('Refreshing campaigns list...');
      const response = await api.get('/campaigns');
      console.log('Refreshed campaigns response:', response.data);
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error refreshing campaigns:', error);
    }
  };

  const handleDuplicate = async (newName) => {
    try {
      const response = await api.post(`/campaigns/${campaignToDuplicate.id}/duplicate`, { 
        name: newName 
      });
      
      // Add the new campaign to the state directly
      if (response.data && response.data.id) {
        // Create a new campaign object based on the duplicated one
        const newCampaign = {
          ...campaignToDuplicate,
          id: response.data.id,
          name: newName,
          created_at: new Date().toISOString(),
          status: 'draft'
        };
        
        // Update the campaigns state by adding the new campaign
        setCampaigns(prevCampaigns => [...prevCampaigns, newCampaign]);
        
        addToast(`Campaign duplicated successfully`, 'success');
      } else {
        // If we don't get the expected response, do a full refresh
        refreshCampaigns();
        addToast(`Campaign duplicated successfully`, 'success');
      }
      
      setDuplicateModalOpen(false);
      setCampaignToDuplicate(null);
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

  // Add a useEffect to periodically refresh campaigns
  useEffect(() => {
    // Only set up refresh if not already set up
    if (!mountedRef.current) return;
    
    console.log('Setting up campaign refresh interval');
    
    // Initial refresh
    refreshCampaigns();
    
    // Set up refresh interval
    const refreshInterval = setInterval(() => {
      console.log('Refreshing campaigns...');
      refreshCampaigns();
    }, 30000); // Refresh every 30 seconds
    
    // Clean up interval on unmount
    return () => {
      console.log('Cleaning up campaign refresh interval');
      clearInterval(refreshInterval);
    };
  }, []); // Empty dependency array - only run once on mount

  // Add these new functions to handle pause and resume actions
  const pauseCampaign = async (campaignId, event) => {
    // Prevent the click from bubbling up to parent elements
    event.stopPropagation();
    
    try {
      await api.post(`/campaigns/${campaignId}/pause`);
      
      // Update the campaign status locally
      setCampaigns(prevCampaigns => 
        prevCampaigns.map(campaign => 
          campaign.id === campaignId 
            ? { ...campaign, status: 'paused' } 
            : campaign
        )
      );
      
      addToast('Campaign paused successfully', 'info');
    } catch (error) {
      console.error('Error pausing campaign:', error);
      addToast(`Failed to pause campaign: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const resumeCampaign = async (campaignId, event) => {
    // Prevent the click from bubbling up to parent elements
    event.stopPropagation();
    
    try {
      await api.post(`/campaigns/${campaignId}/resume`);
      
      // Update the campaign status locally
      setCampaigns(prevCampaigns => 
        prevCampaigns.map(campaign => 
          campaign.id === campaignId 
            ? { ...campaign, status: 'in_progress' } 
            : campaign
        )
      );
      
      addToast('Campaign resumed successfully', 'success');
    } catch (error) {
      console.error('Error resuming campaign:', error);
      addToast(`Failed to resume campaign: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

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
              
              <button
                onClick={() => setFilter('paused')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === 'paused'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Paused
                <span className="ml-2 bg-yellow-100 text-yellow-600 py-0.5 px-2 rounded-full text-xs">
                  {statusCounts.paused || 0}
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
                      campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                      campaign.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {campaign.status || 'draft'}
                      
                      {/* Add progress indicator for in_progress, paused, and completed campaigns */}
                      {(campaign.status === 'in_progress' || campaign.status === 'paused') && campaignProgress[campaign.id] && (
                        <span className="ml-1">
                          {calculateProgress(campaign).fraction}
                        </span>
                      )}
                      {campaign.status === 'completed' && (
                        <span className="ml-1">
                          {campaignProgress[campaign.id] 
                            ? `${campaignProgress[campaign.id].total}/${campaignProgress[campaign.id].total}` 
                            : 'Complete'}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {/* Add progress bar for in_progress and completed campaigns */}
                  {(campaign.status === 'in_progress' || campaign.status === 'completed') && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${campaign.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'}`}
                        style={{ 
                          width: campaign.status === 'completed' 
                            ? '100%' 
                            : (campaignProgress[campaign.id] 
                                ? `${calculateProgress(campaign).percentage}%` 
                                : '0%')
                        }}
                      ></div>
                    </div>
                  )}
                  
                  <div className="mt-4 flex justify-end space-x-2">
                    <Link 
                      to={`/campaigns/${campaign.id}`}
                      className="text-sm bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600"
                    >
                      View
                    </Link>
                    
                    {/* Only show Edit button for draft campaigns */}
                    {campaign.status === 'draft' && (
                      <Link 
                        to={`/campaigns/${campaign.id}/edit`}
                        className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                      >
                        Edit
                      </Link>
                    )}
                    
                    {/* Add pause button for in-progress campaigns */}
                    {campaign.status === 'in_progress' && (
                      <button
                        onClick={(e) => pauseCampaign(campaign.id, e)}
                        className="text-sm bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                      >
                        Pause
                      </button>
                    )}
                    
                    {/* Add resume button for paused campaigns */}
                    {campaign.status === 'paused' && (
                      <button
                        onClick={(e) => resumeCampaign(campaign.id, e)}
                        className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                      >
                        Resume
                      </button>
                    )}
                    
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