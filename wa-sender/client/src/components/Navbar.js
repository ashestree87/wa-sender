import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">WhatsApp Campaigns</Link>
        
        {isAuthenticated ? (
          <div className="flex items-center space-x-4">
            <Link to="/" className="hover:text-gray-300">My Campaigns</Link>
            <Link to="/campaigns/new" className="hover:text-gray-300">New Campaign</Link>
            <Link to="/whatsapp-setup" className="hover:text-gray-300">WhatsApp Setup</Link>
            <button 
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            <Link to="/login" className="hover:text-gray-300">Login</Link>
            <Link to="/register" className="hover:text-gray-300">Register</Link>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar; 