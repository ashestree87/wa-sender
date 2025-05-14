import React from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../StatusBadge';

const CampaignHeader = ({ campaign, handleAction, deleteModalOpen, setDeleteModalOpen }) => {
  if (!campaign) return null;

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold mb-2">{campaign.name}</h1>
          <div className="flex items-center space-x-3 mb-2">
            <StatusBadge status={campaign.status} />
            {campaign.createdAt && (
              <span className="text-gray-500 text-sm">
                Created {new Date(campaign.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
          {campaign.description && (
            <p className="text-gray-600 mb-4">{campaign.description}</p>
          )}
        </div>

        <div className="flex space-x-3">
          <Link
            to={`/campaigns/${campaign.id}/edit`}
            className="bg-blue-100 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-200 transition-colors"
          >
            Edit
          </Link>
          
          <button
            onClick={() => handleAction('duplicate')}
            className="bg-green-100 text-green-700 px-4 py-2 rounded-md hover:bg-green-200 transition-colors"
          >
            Duplicate
          </button>

          <button
            onClick={() => setDeleteModalOpen(true)}
            className="bg-red-100 text-red-700 px-4 py-2 rounded-md hover:bg-red-200 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignHeader; 