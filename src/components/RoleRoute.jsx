import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleRoute = ({ requiredPermissions = [], requiredRoles = [] }) => {
    const { user } = useAuth();
    
    if (!user) return <Navigate to="/login" />;

    const hasPermission = requiredPermissions.length === 0 || requiredPermissions.some(p => user.permissions?.includes(p));
    const hasRole = requiredRoles.length === 0 || requiredRoles.some(r => user.roles?.includes(r));

    // Fallback for logic: passing if EITHER role OR permission matches (or if both empty)
    // But if both provided, usually one match is enough for access?
    // Let's go with: If 'Admin' role always allow. Else check permissions.
    
    const isAdmin = user.roles?.includes('Admin');
    if (isAdmin) return <Outlet />;

    if ((requiredPermissions.length > 0 && !hasPermission) && (requiredRoles.length > 0 && !hasRole)) {
         return <Navigate to="/" />; // Redirect to dashboard if unauthorized
    }

    return <Outlet />;
};

export default RoleRoute;
