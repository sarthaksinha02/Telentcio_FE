import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SystemRoute = ({ children }) => {
    const { user } = useAuth();

    // Check for System Roles (Admin or isSystem: true)
    const hasSystemRole = user?.roles?.some(r => r === 'Admin' || r.name === 'Admin' || r?.isSystem === true);

    if (!hasSystemRole) {
        return <Navigate to="/attendance" replace />;
    }

    return children;
};

export default SystemRoute;
