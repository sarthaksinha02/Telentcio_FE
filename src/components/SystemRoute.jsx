import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SystemRoute = ({ children }) => {
    const { user } = useAuth();

    // Check for System Roles (Currently identified as 'Admin')
    // Can be expanded to include other system-level roles if defined
    const hasSystemRole = user?.roles?.includes('Admin');

    if (!hasSystemRole) {
        return <Navigate to="/attendance" replace />;
    }

    return children;
};

export default SystemRoute;
