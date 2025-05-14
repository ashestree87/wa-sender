import React from 'react';
import StatusBadge from '../../StatusBadge';

const RecipientListTable = ({
  filteredRecipients,
  handleResendToRecipient,
  handleResetRecipientStatus,
  handleSkipRecipient,
  openEditRecipientModal,
  openDeleteRecipientModal,
  searchTerm,
  setSearchTerm,
  whatsappConnected
}) => {
  if (!filteredRecipients) return null;

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Recipients</h2>
        <div className="flex space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search recipients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded-md py-2 px-3 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredRecipients.length === 0 ? (
        <p className="text-gray-500 text-center py-4">
          {searchTerm ? 'No recipients match your search' : 'No recipients added to this campaign yet'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-2 px-4 text-left text-gray-500 font-medium">Name</th>
                <th className="py-2 px-4 text-left text-gray-500 font-medium">Phone Number</th>
                <th className="py-2 px-4 text-left text-gray-500 font-medium">Status</th>
                <th className="py-2 px-4 text-left text-gray-500 font-medium">Sent At</th>
                <th className="py-2 px-4 text-left text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecipients.map((recipient) => (
                <tr key={recipient.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">{recipient.name || '-'}</td>
                  <td className="py-3 px-4">{recipient.phoneNumber}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={recipient.status} />
                    {recipient.failureReason && (
                      <div className="text-xs text-red-500 mt-1">
                        {recipient.failureReason}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {recipient.sentAt ? new Date(recipient.sentAt).toLocaleString() : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditRecipientModal(recipient)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit recipient"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      
                      {recipient.status === 'failed' && (
                        <button
                          onClick={() => handleResendToRecipient(recipient.id)}
                          disabled={!whatsappConnected}
                          className={`${whatsappConnected ? 'text-green-600 hover:text-green-800' : 'text-gray-400 cursor-not-allowed'}`}
                          title="Resend message"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                      
                      {['delivered', 'failed'].includes(recipient.status) && (
                        <button
                          onClick={() => handleResetRecipientStatus(recipient.id)}
                          className="text-yellow-600 hover:text-yellow-800"
                          title="Reset status"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L12.586 12l-2.293-2.293a1 1 0 011.414-1.414l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                      
                      {recipient.status === 'pending' && (
                        <button
                          onClick={() => handleSkipRecipient(recipient.id)}
                          className="text-orange-600 hover:text-orange-800"
                          title="Skip recipient"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                      
                      <button
                        onClick={() => openDeleteRecipientModal(recipient)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete recipient"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RecipientListTable; 