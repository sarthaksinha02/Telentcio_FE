import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
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
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/timesheet" element={<Timesheet />} />
                <Route path="/profile" element={<Profile />} />
                
                {/* Project Management Routes */}
                <Route element={<RoleRoute requiredPermissions={['project.read', 'project.create']} requiredRoles={['Admin']} />}>
                    <Route path="/business-units" element={<BusinessUnits />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/projects/:id" element={<ProjectDetails />} />
                </Route>

                {/* Admin Only Routes */}
                <Route element={<RoleRoute requiredPermissions={['role.read']} requiredRoles={['Admin']} />}>
                    <Route path="/roles" element={<Roles />} />
                </Route>

                {/* Users Management (Internal access control) */}
                 <Route path="/users" element={<Users />} />
              </Route>
          </Route>

          {/* Catch all redirect */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
