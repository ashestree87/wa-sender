import React, { useState } from 'react';

const DuplicateCampaignModal = ({ isOpen, onClose, onConfirm, campaignName }) => {
  const [newName, setNewName] = useState(`${campaignName} (Copy)`);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Duplicate Campaign</h2>
        
        <p className="mb-4 text-gray-600">
          Create a copy of "{campaignName}" with a new name:
        </p>
        
        <div className="mb-4">
          <label htmlFor="campaign-name" className="block text-sm font-medium text-gray-700 mb-1">
            New Campaign Name
          </label>
          <input
            type="text"
            id="campaign-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (newName.trim()) {
                onConfirm(newName.trim());
              }
            }}
            disabled={!newName.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            Duplicate
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateCampaignModal; 