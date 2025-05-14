import React from 'react';

const StatusBadge = ({ status }) => {
  // Define colors based on status
  const getStatusColor = (status) => {
    const statusMap = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      paused: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      
      // Recipient statuses
      pending: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-teal-100 text-teal-800',
      delivered: 'bg-green-100 text-green-800',
      skipped: 'bg-purple-100 text-purple-800'
    };
    
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };
  
  // Format status label
  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    
    // Replace underscores with spaces and capitalize each word
    return status
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {formatStatus(status)}
    </span>
  );
};

export default StatusBadge; 