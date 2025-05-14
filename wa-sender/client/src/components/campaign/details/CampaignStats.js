import React from 'react';

const CampaignStats = ({ recipients }) => {
  if (!recipients || !recipients.length) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Campaign Statistics</h2>
        <p className="text-gray-500">No recipients added to this campaign yet.</p>
      </div>
    );
  }

  // Calculate stats
  const total = recipients.length;
  const pending = recipients.filter(r => r.status === 'pending').length;
  const inProgress = recipients.filter(r => r.status === 'in_progress').length;
  const delivered = recipients.filter(r => r.status === 'delivered').length;
  const failed = recipients.filter(r => r.status === 'failed').length;
  const skipped = recipients.filter(r => r.status === 'skipped').length;

  // Success rate calculation
  const successRate = total > 0 
    ? Math.round((delivered / total) * 100) 
    : 0;

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Campaign Statistics</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-sm">Total</p>
          <p className="text-2xl font-bold">{total}</p>
        </div>
        
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-blue-600 text-sm">Pending</p>
          <p className="text-2xl font-bold text-blue-700">{pending}</p>
        </div>
        
        <div className="p-4 bg-yellow-50 rounded-lg">
          <p className="text-yellow-600 text-sm">In Progress</p>
          <p className="text-2xl font-bold text-yellow-700">{inProgress}</p>
        </div>
        
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-green-600 text-sm">Delivered</p>
          <p className="text-2xl font-bold text-green-700">{delivered}</p>
        </div>
        
        <div className="p-4 bg-red-50 rounded-lg">
          <p className="text-red-600 text-sm">Failed</p>
          <p className="text-2xl font-bold text-red-700">{failed}</p>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-sm">Success Rate</p>
          <p className="text-2xl font-bold">{successRate}%</p>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mt-6">
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-green-500 h-2.5 rounded-full" 
            style={{ width: `${successRate}%` }}
          ></div>
        </div>
        <div className="flex justify-between mt-1 text-sm text-gray-500">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
};

export default CampaignStats; 