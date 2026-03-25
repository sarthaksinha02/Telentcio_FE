import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ModuleRoute = ({ moduleName }) => {
  const { user, hasModule } = useAuth();
  
  if (!user) return null;

  const isEnabled = hasModule(moduleName);

  return isEnabled ? <Outlet /> : <Navigate to="/" />;
};

export default ModuleRoute;
