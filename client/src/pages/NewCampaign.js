import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function NewCampaign() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    messageTemplate: '',
    useAI: false,
    aiPrompt: '',
    scheduledStartTime: '',
    recipients: [],
    minDelaySeconds: 3,
    maxDelaySeconds: 5,
    dailyLimit: 0,
    timeWindowStart: '',
    timeWindowEnd: ''
  });
  const [recipientInput, setRecipientInput] = useState({ name: '', phoneNumber: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleRecipientChange = (e) => {
    const { name, value } = e.target;
    setRecipientInput({
      ...recipientInput,
      [name]: value
    });
  };

  const addRecipient = () => {
    if (!recipientInput.name || !recipientInput.phoneNumber) {
      return setError('Recipient name and phone number are required');
    }

    setFormData({
      ...formData,
      recipients: [...formData.recipients, { ...recipientInput }]
    });
    setRecipientInput({ name: '', phoneNumber: '' });
    setError('');
  };

  const removeRecipient = (index) => {
    const updatedRecipients = [...formData.recipients];
    updatedRecipients.splice(index, 1);
    setFormData({ ...formData, recipients: updatedRecipients });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.recipients.length === 0) {
      return setError('Please add at least one recipient');
    }
    
    try {
      setLoading(true);
      
      // Process time windows
      let timeWindowStart = formData.timeWindowStart;
      let timeWindowEnd = formData.timeWindowEnd;
      
      if (!timeWindowStart || timeWindowStart.trim() === '') {
        timeWindowStart = null;
      }
      
      if (!timeWindowEnd || timeWindowEnd.trim() === '') {
        timeWindowEnd = null;
      }
      
      // If one is null, make both null
      if (timeWindowStart === null || timeWindowEnd === null) {
        timeWindowStart = null;
        timeWindowEnd = null;
      }
      
      // Create campaign with the new fields
      const campaignResponse = await api.post('/campaigns', {
        name: formData.name,
        description: formData.description,
        messageTemplate: formData.messageTemplate,
        useAI: formData.useAI,
        aiPrompt: formData.aiPrompt,
        scheduledStartTime: formData.scheduledStartTime || null,
        minDelaySeconds: parseInt(formData.minDelaySeconds) || 3,
        maxDelaySeconds: parseInt(formData.maxDelaySeconds) || 5,
        dailyLimit: parseInt(formData.dailyLimit) || 0,
        timeWindowStart: timeWindowStart,
        timeWindowEnd: timeWindowEnd
      });
      
      const campaignId = campaignResponse.data.id;
      
      // Add recipients
      await api.post(`/campaigns/${campaignId}/recipients`, {
        recipients: formData.recipients
      });
      
      navigate('/');
    } catch (err) {
      setError('Failed to create campaign');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Campaign</h1>
      
      {error && (
        <div className="mb-4 bg-red-50 p-4 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
            Campaign Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            rows="3"
          ></textarea>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="messageTemplate">
            Message Template
          </label>
          <textarea
            id="messageTemplate"
            name="messageTemplate"
            value={formData.messageTemplate}
            onChange={handleChange}
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            rows="4"
            placeholder="Hello {name}, this is a message from our company..."
          ></textarea>
          <p className="text-sm text-gray-500 mt-1">
            Use {'{name}'} to include the recipient's name in your message.
          </p>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="useAI"
              name="useAI"
              checked={formData.useAI}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-gray-700 text-sm font-bold" htmlFor="useAI">
              Enhance messages with AI
            </label>
          </div>
        </div>
        
        {formData.useAI && (
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="aiPrompt">
              AI Instructions
            </label>
            <textarea
              id="aiPrompt"
              name="aiPrompt"
              value={formData.aiPrompt}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              rows="3"
              placeholder="Make the message more friendly and casual..."
            ></textarea>
          </div>
        )}
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="scheduledStartTime">
            Schedule Start Time (Optional)
          </label>
          <input
            type="datetime-local"
            id="scheduledStartTime"
            name="scheduledStartTime"
            value={formData.scheduledStartTime}
            onChange={handleChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
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
                value={formData.minDelaySeconds}
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
                value={formData.maxDelaySeconds}
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
              value={formData.dailyLimit}
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
                value={formData.timeWindowStart}
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
                value={formData.timeWindowEnd}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Optional: Only send messages during this time window (your local time)
          </p>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Recipients</h3>
          
          <div className="flex flex-wrap -mx-2 mb-4">
            <div className="px-2 w-full md:w-1/2">
              <input
                type="text"
                name="name"
                value={recipientInput.name}
                onChange={handleRecipientChange}
                placeholder="Recipient Name"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <div className="px-2 w-full md:w-1/2 mt-3 md:mt-0">
              <div className="flex">
                <input
                  type="text"
                  name="phoneNumber"
                  value={recipientInput.phoneNumber}
                  onChange={handleRecipientChange}
                  placeholder="Phone Number"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
                <button
                  type="button"
                  onClick={addRecipient}
                  className="ml-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
          
          {formData.recipients.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="font-medium mb-2">Added Recipients:</h4>
              <ul className="divide-y divide-gray-200">
                {formData.recipients.map((recipient, index) => (
                  <li key={index} className="py-2 flex justify-between items-center">
                    <div>
                      <span className="font-medium">{recipient.name}</span>
                      <span className="ml-3 text-gray-600">{recipient.phoneNumber}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRecipient(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mr-4 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {loading ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewCampaign; 