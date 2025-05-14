import React from 'react';

const CampaignActions = ({ 
  campaign, 
  whatsappConnected, 
  handleAction, 
  executing 
}) => {
  if (!campaign) return null;

  // Determine which buttons to show based on campaign status
  const showExecute = !executing && ['draft', 'scheduled', 'completed'].includes(campaign.status);
  const showPause = !executing && campaign.status === 'in_progress';
  const showResume = !executing && campaign.status === 'paused';
  const showResendFailed = !executing && ['paused', 'in_progress', 'completed'].includes(campaign.status);

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Campaign Actions</h2>
      
      <div className="flex flex-wrap gap-3">
        {showExecute && (
          <button
            onClick={() => handleAction('execute')}
            disabled={!whatsappConnected || executing}
            className={`px-4 py-2 rounded-md ${
              whatsappConnected
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Execute Campaign
          </button>
        )}

        {showPause && (
          <button
            onClick={() => handleAction('pause')}
            disabled={executing}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md"
          >
            Pause Campaign
          </button>
        )}

        {showResume && (
          <button
            onClick={() => handleAction('resume')}
            disabled={!whatsappConnected || executing}
            className={`px-4 py-2 rounded-md ${
              whatsappConnected
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Resume Campaign
          </button>
        )}

        {showResendFailed && (
          <button
            onClick={() => handleAction('resendFailed')}
            disabled={!whatsappConnected || executing}
            className={`px-4 py-2 rounded-md ${
              whatsappConnected
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Resend Failed Messages
          </button>
        )}
      </div>
      
      {!whatsappConnected && (
        <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-md">
          <p>
            WhatsApp is not connected. Please set up WhatsApp before executing the campaign.
          </p>
          <button 
            onClick={() => handleAction('setupWhatsapp')}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Setup WhatsApp Connection
          </button>
        </div>
      )}
      
      {executing && (
        <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded-md flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing campaign action...
        </div>
      )}
    </div>
  );
};

export default CampaignActions; 