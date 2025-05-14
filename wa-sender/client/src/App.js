import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewCampaign from './pages/NewCampaign';
import WhatsAppSetup from './pages/WhatsAppSetup';
import CampaignDetail from './pages/CampaignDetail';
import EditCampaign from './pages/EditCampaign';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-gray-100">
            <Navbar />
            <div className="container mx-auto px-4 py-8">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* Use PrivateRoute for protected routes */}
                <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/campaigns/new" element={<PrivateRoute><NewCampaign /></PrivateRoute>} />
                <Route path="/whatsapp-setup" element={<PrivateRoute><WhatsAppSetup /></PrivateRoute>} />
                <Route path="/campaigns/:id" element={<PrivateRoute><CampaignDetail /></PrivateRoute>} />
                <Route path="/campaigns/:id/edit" element={<PrivateRoute><EditCampaign /></PrivateRoute>} />
              </Routes>
            </div>
          </div>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
