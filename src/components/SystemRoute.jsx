import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SystemRoute = ({ children }) => {
    const { user } = useAuth();

    // Check for System Roles (Admin) or All Permissions (Wildcards like *, all, admin)
    const hasAdminPermission = user?.permissions?.some(p => p === '*' || p === 'all' || p === 'admin');
    const hasSystemRole = user?.roles?.some(r => r === 'Admin' || r === 'admin' || r?.name === 'Admin' || r?.isSystem === true);
    const hasAllAccess = hasSystemRole || hasAdminPermission || user?.hasAllPermissions;

    if (!hasAllAccess) {
        return <Navigate to="/attendance" replace />;
    }

    return children;
};

export default SystemRoute;
