import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedPermissions }) => {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If no specific permissions are required, just auth is enough
  if (!allowedPermissions || allowedPermissions.length === 0) {
    return <Outlet />;
  }

  // Check permissions (assuming user.roles contains strings of permissions or roles with permissions)
  // Our backend sends: user.roles as ["RoleName"], but our simple login doesn't send permissions list yet.
  // For this demo, we can just check if user exists. 
  // TODO: Enhance backend to send flattened permissions list on login.
  
  return <Outlet />;
};

export default ProtectedRoute;
