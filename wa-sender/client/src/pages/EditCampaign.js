import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

function EditCampaign() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState({
    name: '',
    description: '',
    messageTemplate: '',
    useAI: false,
    aiPrompt: '',
    scheduledStartTime: '',
    minDelaySeconds: 3,
    maxDelaySeconds: 5,
    dailyLimit: 0,
    timeWindowStart: '',
    timeWindowEnd: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchCampaign = useCallback(async () => {
    try {
      console.log('Fetching campaign for edit, ID:', id);
      const response = await api.get(`/campaigns/${id}`);
      console.log('Campaign data for edit:', response.data);
      
      // Log the raw date strings for debugging
      console.log('Raw created_at:', response.data.created_at);
      console.log('Raw scheduled_start_time:', response.data.scheduled_start_time);
      
      const campaignData = response.data;
      
      // Format date for input field - handle both dates consistently
      if (campaignData.scheduledStartTime || campaignData.scheduled_start_time) {
        const dateStr = campaignData.scheduledStartTime || campaignData.scheduled_start_time;
        console.log('Processing scheduled_start_time:', dateStr);
        
        // Get the date in UTC
        const utcDate = new Date(dateStr);
        console.log('UTC date object:', utcDate);
        
        // Convert to local timezone for the input
        const localDateStr = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        
        console.log('Converted local date string for input:', localDateStr);
        campaignData.scheduledStartTime = localDateStr;
      }
      
      // Map snake_case to camelCase
      setCampaign({
        name: campaignData.name || '',
        description: campaignData.description || '',
        messageTemplate: campaignData.messageTemplate || campaignData.message_template || '',
        useAI: campaignData.useAI || campaignData.use_ai || false,
        aiPrompt: campaignData.aiPrompt || campaignData.ai_prompt || '',
        scheduledStartTime: campaignData.scheduledStartTime || '',
        minDelaySeconds: campaignData.minDelaySeconds || campaignData.min_delay_seconds || 3,
        maxDelaySeconds: campaignData.maxDelaySeconds || campaignData.max_delay_seconds || 5,
        dailyLimit: campaignData.dailyLimit || campaignData.daily_limit || 0,
        timeWindowStart: campaignData.timeWindowStart || campaignData.time_window_start || '',
        timeWindowEnd: campaignData.timeWindowEnd || campaignData.time_window_end || '',
        id: campaignData.id,
        createdAt: campaignData.createdAt || campaignData.created_at,
        status: campaignData.status
      });
    } catch (error) {
      console.error('Error fetching campaign:', error);
      setError('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCampaign({
      ...campaign,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      
      // Create a copy of the campaign data for submission
      const campaignToSubmit = { ...campaign };
      
      // If there's a scheduled start time, ensure it's in the correct format and future
      if (campaignToSubmit.scheduledStartTime && campaignToSubmit.scheduledStartTime.trim() !== '') {
        const scheduledDate = new Date(campaignToSubmit.scheduledStartTime);
        const now = new Date();
        
        if (scheduledDate <= now) {
          throw new Error('Scheduled time must be in the future');
        }
        
        // The input value is in local time, but we need to send it as UTC
        campaignToSubmit.scheduledStartTime = scheduledDate.toISOString();
      } else {
        campaignToSubmit.scheduledStartTime = null;
      }
      
      // Convert numeric fields to numbers
      campaignToSubmit.minDelaySeconds = parseInt(campaignToSubmit.minDelaySeconds) || 3;
      campaignToSubmit.maxDelaySeconds = parseInt(campaignToSubmit.maxDelaySeconds) || 5;
      campaignToSubmit.dailyLimit = parseInt(campaignToSubmit.dailyLimit) || 0;
      
      // Ensure time windows are both set or both null
      if (!campaignToSubmit.timeWindowStart || campaignToSubmit.timeWindowStart.trim() === '') {
        campaignToSubmit.timeWindowStart = null;
      }
      
      if (!campaignToSubmit.timeWindowEnd || campaignToSubmit.timeWindowEnd.trim() === '') {
        campaignToSubmit.timeWindowEnd = null;
      }
      
      // If one is null, make both null
      if (campaignToSubmit.timeWindowStart === null || campaignToSubmit.timeWindowEnd === null) {
        campaignToSubmit.timeWindowStart = null;
        campaignToSubmit.timeWindowEnd = null;
      }
      
      console.log('Submitting campaign update:', campaignToSubmit);
      const response = await api.put(`/campaigns/${id}`, campaignToSubmit);
      console.log('Update response:', response.data);
      
      navigate(`/campaigns/${id}`);
    } catch (error) {
      console.error('Error updating campaign:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update campaign';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Loading campaign...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Campaign</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
            Campaign Name
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="name"
            type="text"
            name="name"
            value={campaign.name}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
            Description
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="description"
            name="description"
            value={campaign.description || ''}
            onChange={handleChange}
            rows="3"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="messageTemplate">
            Message Template
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="messageTemplate"
            name="messageTemplate"
            value={campaign.messageTemplate || ''}
            onChange={handleChange}
            rows="5"
            required
          />
          <p className="text-sm text-gray-600 mt-1">
            Use {'{name}'} to insert recipient's name
          </p>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center">
            <input
              id="useAI"
              type="checkbox"
              name="useAI"
              checked={campaign.useAI || false}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="useAI" className="ml-2 block text-sm text-gray-900">
              Use AI to enhance messages
            </label>
          </div>
        </div>
        
        {campaign.useAI && (
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="aiPrompt">
              AI Prompt
            </label>
            <textarea
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="aiPrompt"
              name="aiPrompt"
              value={campaign.aiPrompt || ''}
              onChange={handleChange}
              rows="3"
              placeholder="Instructions for AI to enhance the message"
            />
          </div>
        )}
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="scheduledStartTime">
            Schedule Start Time (optional)
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="scheduledStartTime"
            type="datetime-local"
            name="scheduledStartTime"
            value={campaign.scheduledStartTime || ''}
            onChange={handleChange}
          />
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Sending Controls</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="minDelaySeconds">
                Minimum Delay Between Messages (seconds)
              </label>
              <input
                type="number"
                id="minDelaySeconds"
                name="minDelaySeconds"
                min="1"
                max="300"
                value={campaign.minDelaySeconds || 3}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="maxDelaySeconds">
                Maximum Delay Between Messages (seconds)
              </label>
              <input
                type="number"
                id="maxDelaySeconds"
                name="maxDelaySeconds"
                min="1"
                max="300"
                value={campaign.maxDelaySeconds || 5}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="dailyLimit">
              Daily Message Limit (0 = no limit)
            </label>
            <input
              type="number"
              id="dailyLimit"
              name="dailyLimit"
              min="0"
              value={campaign.dailyLimit || 0}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
            <p className="text-sm text-gray-500 mt-1">
              Set a maximum number of messages to send per day
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="timeWindowStart">
                Sending Window Start Time
              </label>
              <input
                type="time"
                id="timeWindowStart"
                name="timeWindowStart"
                value={campaign.timeWindowStart || ''}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="timeWindowEnd">
                Sending Window End Time
              </label>
              <input
                type="time"
                id="timeWindowEnd"
                name="timeWindowEnd"
                value={campaign.timeWindowEnd || ''}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Optional: Only send messages during this time window (your local time)
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="button"
            onClick={() => navigate(`/campaigns/${id}`)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditCampaign; 