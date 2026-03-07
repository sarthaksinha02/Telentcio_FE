import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';

import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Timesheet from './pages/Timesheet';
import Users from './pages/Users';
import Roles from './pages/Roles';
import BusinessUnits from './pages/BusinessUnits';
import Clients from './pages/Clients';
import ClientForm from './pages/ClientForm';
import ClientView from './pages/ClientView';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Profile from './pages/Profile';
import Holidays from './pages/Holidays';
import LeaveConfig from './pages/LeaveConfig';
import Leaves from './pages/Leaves';
import EmployeeDossier from './pages/EmployeeDossier';
import HiringRequestList from './pages/TalentAcquisition/HiringRequestList';
import CreateHiringRequest from './pages/TalentAcquisition/CreateHiringRequest';
import HiringRequestDetails from './pages/TalentAcquisition/HiringRequestDetails';
import WorkflowSettings from './pages/TalentAcquisition/WorkflowSettings';
import CandidateForm from './pages/TalentAcquisition/CandidateForm';
import CandidateDetails from './pages/TalentAcquisition/CandidateDetails';
import Phase1Candidates from './pages/TalentAcquisition/Phase1Candidates';
import UserTADashboard from './pages/TalentAcquisition/UserTADashboard';
import Meetings from './pages/Meetings';
import MeetingForm from './pages/MeetingForm';
import MeetingDetails from './pages/MeetingDetails';
import HelpDesk from './pages/HelpDesk';
import QueryDetails from './pages/QueryDetails';
import Discussions from './pages/Discussions';

import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import SystemRoute from './components/SystemRoute';
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <ErrorBoundary>
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
                <Route path="/leaves" element={<Leaves />} />

                <Route path="/leaves" element={<Leaves />} />
                <Route path="/dossier/:userId" element={<EmployeeDossier />} />

                {/* Talent Acquisition */}
                <Route path="/ta" element={<HiringRequestList />} />
                <Route path="/ta/workflows" element={<WorkflowSettings />} />
                <Route path="/ta/create-request" element={<CreateHiringRequest />} />
                <Route path="/ta/edit-request/:id" element={<CreateHiringRequest />} />
                <Route path="/ta/view/:id" element={<HiringRequestDetails />} />
                <Route path="/ta/hiring-request/:hiringRequestId/add-candidate" element={<CandidateForm />} />
                <Route path="/ta/hiring-request/:hiringRequestId/candidate/:candidateId/edit" element={<CandidateForm />} />
                <Route path="/ta/hiring-request/:hiringRequestId/candidate/:candidateId/view" element={<CandidateDetails />} />
                <Route path="/ta/hiring-request/:hiringRequestId/phase1" element={<Phase1Candidates />} />
                <Route path="/ta/user-dashboard/:userName" element={<UserTADashboard />} />

                <Route path="/profile" element={<Profile />} />
                <Route path="/holidays" element={<Holidays />} />

                {/* MoM Routes */}
                <Route path="/meetings" element={<Meetings />} />
                <Route path="/meetings/new" element={<MeetingForm />} />
                <Route path="/meetings/:id/edit" element={<MeetingForm />} />
                <Route path="/meetings/:id" element={<MeetingDetails />} />

                {/* Help Desk Routes */}
                <Route path="/helpdesk" element={<HelpDesk />} />
                <Route path="/helpdesk/:id" element={<QueryDetails />} />

                {/* Discussion Routes */}
                <Route path="/discussions" element={<Discussions />} />

                {/* Project Management Routes */}
                <Route element={<RoleRoute requiredPermissions={['project.read', 'project.create']} requiredRoles={['Admin']} />}>
                  <Route path="/business-units" element={<BusinessUnits />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/clients/new" element={<ClientForm />} />
                  <Route path="/clients/:id/edit" element={<ClientForm />} />
                  <Route path="/clients/:id/view" element={<ClientView />} />
                </Route>

                {/* Accessible to all (backend filtered) */}
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetails />} />

                {/* Admin or All Permissions Routes */}
                <Route element={<RoleRoute requiredPermissions={['role.read']} requiredRoles={['Admin']} allowAllPermissions={true} />}>
                  <Route path="/roles" element={<Roles />} />
                  <Route path="/leave-config" element={<LeaveConfig />} />
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
        </ErrorBoundary>
      </AuthProvider>
    </Router>
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
