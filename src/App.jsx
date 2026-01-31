import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';

import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Timesheet from './pages/Timesheet';
import Users from './pages/Users';
import Roles from './pages/Roles';
import BusinessUnits from './pages/BusinessUnits';
import Clients from './pages/Clients';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Profile from './pages/Profile';
import Holidays from './pages/Holidays';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import SystemRoute from './components/SystemRoute';
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />


          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={
                <SystemRoute>
                  <Dashboard />
                </SystemRoute>
              } />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/timesheet" element={<Timesheet />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/holidays" element={<Holidays />} />

              {/* Project Management Routes */}
              <Route element={<RoleRoute requiredPermissions={['project.read', 'project.create']} requiredRoles={['Admin']} />}>
                <Route path="/business-units" element={<BusinessUnits />} />
                <Route path="/clients" element={<Clients />} />
              </Route>

              {/* Accessible to all (backend filtered) */}
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetails />} />

              {/* Admin Only Routes */}
              <Route element={<RoleRoute requiredPermissions={['role.read']} requiredRoles={['Admin']} />}>
                <Route path="/roles" element={<Roles />} />
              </Route>

              {/* Users Management (Internal access control) */}
              {/* Users Management */}
              <Route path="/users" element={<UsersAccessWrapper />} />

              <Route path="/unauthorized" element={<Unauthorized />} />
            </Route>
          </Route>

          {/* Catch all redirect */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </Router >
  );
}

export default App;

const UsersAccessWrapper = () => {
  const { user } = useAuth();

  if (!user) return null;

  const canAccess = user.roles?.includes('Admin') ||
    user.permissions?.includes('user.read') ||
    user.directReportsCount > 0;

  return canAccess ? <Users /> : <Navigate to="/unauthorized" />;
};
