import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    console.log('PrivateRoute - User:', user, 'Loading:', loading);
    
    // Only redirect after a delay to allow console logs to be visible
    if (!loading && !user) {
      console.log('No user found, will redirect to login in 3 seconds...');
      const timer = setTimeout(() => {
        setShouldRedirect(true);
      }, 3000); // 3 second delay
      
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  if (loading) {
    return <div className="p-4">Loading user data...</div>;
  }

  if (!user && !shouldRedirect) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-700">
        <h2 className="text-lg font-bold">Authentication Error</h2>
        <p>Not authenticated. Redirecting to login page in a moment...</p>
        <p>Check the console for error details.</p>
      </div>
    );
  }

  return user ? children : (shouldRedirect ? <Navigate to="/login" /> : null);
};

export default PrivateRoute; 