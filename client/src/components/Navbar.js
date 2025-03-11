import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Only render the navbar if the user is logged in
  if (!user) return null;

  return (
    <nav className="bg-white shadow">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-xl font-bold text-gray-800">
            WhatsApp Sender
          </Link>
          
          <div className="flex items-center space-x-4">
            <Link to="/whatsapp-setup" className="text-gray-600 hover:text-gray-800">
              WhatsApp Setup
            </Link>
            <Link to="/campaigns/new" className="text-gray-600 hover:text-gray-800">
              New Campaign
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-800"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar; 