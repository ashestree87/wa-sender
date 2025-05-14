const campaignBaseController = require('./base');
const campaignRecipientController = require('./recipients');
const campaignExecutionController = require('./execution');

// Export all controller methods combined
module.exports = {
  ...campaignBaseController,
  ...campaignRecipientController,
  ...campaignExecutionController
}; 