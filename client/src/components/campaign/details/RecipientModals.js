import React, { useState } from 'react';

// Edit Recipient Modal
export const EditRecipientModal = ({ 
  isOpen, 
  onClose, 
  recipient, 
  onSave 
}) => {
  const [formData, setFormData] = useState({
    name: recipient?.name || '',
    phoneNumber: recipient?.phoneNumber || ''
  });

  if (!isOpen || !recipient) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(recipient.id, formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Edit Recipient</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input
              type="text"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Delete Recipient Modal
export const DeleteRecipientModal = ({ 
  isOpen, 
  onClose, 
  recipient, 
  onConfirm
}) => {
  if (!isOpen || !recipient) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">Delete Recipient</h3>
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete the recipient <span className="font-semibold">{recipient.name || recipient.phoneNumber}</span>? 
          This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(recipient.id);
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// Bulk Import Modal
export const BulkImportModal = ({ 
  isOpen, 
  onClose, 
  onImport, 
  importMethod, 
  setImportMethod, 
  bulkInput, 
  setBulkInput, 
  handleFileUpload, 
  fileInputRef, 
  importLoading, 
  importError
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-xl">
        <h3 className="text-lg font-semibold mb-4">Import Recipients</h3>
        
        <div className="mb-4">
          <div className="flex border-b">
            <button
              onClick={() => setImportMethod('bulk')}
              className={`px-4 py-2 text-sm font-medium ${
                importMethod === 'bulk'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Bulk Text
            </button>
            <button
              onClick={() => setImportMethod('csv')}
              className={`px-4 py-2 text-sm font-medium ${
                importMethod === 'csv'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              CSV File
            </button>
          </div>
        </div>
        
        {importMethod === 'bulk' && (
          <div className="mb-4">
            <label htmlFor="bulkInput" className="block text-sm font-medium text-gray-700 mb-2">
              Enter recipients (one per line, format: Name,PhoneNumber)
            </label>
            <textarea
              id="bulkInput"
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              rows={8}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="John Doe,+1234567890&#10;Jane Smith,+1987654321"
            />
            <p className="text-sm text-gray-500 mt-1">
              Separate each recipient with a new line. Format: Name,PhoneNumber
            </p>
          </div>
        )}
        
        {importMethod === 'csv' && (
          <div className="mb-4">
            <label htmlFor="csvInput" className="block text-sm font-medium text-gray-700 mb-2">
              Upload CSV file
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
              <input
                type="file"
                id="csvInput"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Select CSV File
              </button>
              <p className="mt-2 text-sm text-gray-500">
                The CSV file should have "name" and "phoneNumber" columns
              </p>
            </div>
          </div>
        )}
        
        {importError && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
            {importError}
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={onImport}
            disabled={importLoading || (importMethod === 'bulk' && !bulkInput.trim())}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
              importLoading || (importMethod === 'bulk' && !bulkInput.trim())
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {importLoading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
};

// WhatsApp Setup Modal
export const WhatsAppSetupModal = ({
  isOpen,
  onClose,
  whatsappConnections,
  loadingConnections,
  selectedConnectionId,
  setSelectedConnectionId,
  newConnectionName,
  setNewConnectionName,
  handleCreateConnection,
  handleDeleteConnection,
  handleLogoutConnection,
  initializeWhatsapp,
  initializingWhatsapp
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">WhatsApp Connections</h3>
        
        {loadingConnections ? (
          <div className="text-center py-8">
            <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-2 text-gray-600">Loading WhatsApp connections...</p>
          </div>
        ) : (
          <>
            {whatsappConnections.length > 0 ? (
              <div className="mb-6">
                <h4 className="text-md font-medium mb-2">Your Connections</h4>
                <div className="grid gap-4">
                  {whatsappConnections.map(connection => (
                    <div 
                      key={connection.id} 
                      className={`border rounded-lg p-4 ${
                        selectedConnectionId === connection.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center">
                            <h5 className="font-medium">{connection.name}</h5>
                            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                              connection.status === 'authenticated' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {connection.status === 'authenticated' ? 'Connected' : 'Disconnected'}
                            </span>
                          </div>
                          {connection.phoneNumber && (
                            <p className="text-sm text-gray-600 mt-1">Phone: {connection.phoneNumber}</p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setSelectedConnectionId(connection.id)}
                            className={`px-3 py-1 text-xs rounded-md ${
                              selectedConnectionId === connection.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {selectedConnectionId === connection.id ? 'Selected' : 'Select'}
                          </button>
                          
                          {connection.status === 'authenticated' && (
                            <button
                              onClick={() => handleLogoutConnection(connection.id)}
                              className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-md"
                            >
                              Logout
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleDeleteConnection(connection.id)}
                            className="px-3 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded-md"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      
                      {connection.status !== 'authenticated' && connection.qrCode && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                          <p className="mb-2 text-sm font-medium">Scan this QR code with WhatsApp</p>
                          <div className="flex justify-center">
                            <img 
                              src={connection.qrCode} 
                              alt="WhatsApp QR Code" 
                              className="max-w-full h-auto"
                              style={{ maxWidth: '200px' }} 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-6 p-6 bg-gray-50 rounded-lg text-center">
                <p className="text-gray-600">You don't have any WhatsApp connections yet.</p>
              </div>
            )}
            
            <div className="border-t pt-4">
              <h4 className="text-md font-medium mb-2">Create New Connection</h4>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newConnectionName}
                  onChange={(e) => setNewConnectionName(e.target.value)}
                  placeholder="Connection Name"
                  className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleCreateConnection}
                  disabled={!newConnectionName.trim() || initializingWhatsapp}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                    !newConnectionName.trim() || initializingWhatsapp
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Create
                </button>
              </div>
            </div>
          </>
        )}
        
        <div className="mt-6 flex justify-between items-center pt-4 border-t">
          <div>
            {selectedConnectionId && (
              <button
                onClick={() => initializeWhatsapp(selectedConnectionId)}
                disabled={initializingWhatsapp || loadingConnections}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  initializingWhatsapp || loadingConnections
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {initializingWhatsapp ? 'Initializing...' : 'Initialize Selected Connection'}
              </button>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}; 