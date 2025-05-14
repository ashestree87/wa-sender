{campaigns.map(campaign => (
  <div key={campaign.id} className="bg-white shadow rounded-lg p-6 mb-4">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-semibold text-gray-800">
        {campaign.name}
      </h2>
      <div className="space-x-2">
        <Link
          to={`/campaigns/${campaign.id}/edit`}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
        >
          Edit
        </Link>
        <Link
          to={`/campaigns/${campaign.id}`}
          className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
        >
          View
        </Link>
      </div>
    </div>
    <p className="text-gray-600 mt-2">{campaign.description || 'No description'}</p>
    <div className="mt-4 flex justify-between items-center">
      <div>
        <span className={`px-2 py-1 rounded text-xs ${
          campaign.status === 'completed' ? 'bg-green-100 text-green-800' :
          campaign.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {campaign.status || 'draft'}
        </span>
        <span className="ml-2 text-sm text-gray-500">
          Created: {new Date(campaign.created_at).toLocaleDateString()}
        </span>
      </div>
      <Link 
        to={`/campaigns/${campaign.id}`}
        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
      >
        View Details →
      </Link>
    </div>
  </div>
))} 