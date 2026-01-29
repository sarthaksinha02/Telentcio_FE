import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, Clock, Calendar, LogOut, Shield, Building, Briefcase } from 'lucide-react';

const Sidebar = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const isActive = (path) => location.pathname === path ? "zoho-sidebar-link-active" : "zoho-sidebar-link";

    return (
      <aside className="w-64 bg-[#1e293b] text-white flex-col hidden md:flex shadow-xl z-50 fixed inset-y-0 left-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-blue-600 rounded-md flex items-center justify-center font-bold text-white">H</div>
            <span className="text-lg font-semibold tracking-tight">HRCODE</span>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Main</div>
          <Link to="/" className={isActive('/')}>
            <Users size={18} />
            <span>Dashboard</span>
          </Link>
          <Link to="/attendance" className={isActive('/attendance')}>
            <Clock size={18} />
            <span>Attendance</span>
          </Link>
          <Link to="/timesheet" className={isActive('/timesheet')}>
            <Calendar size={18} />
            <span>Timesheet</span>
          </Link>
          
          <div className="px-3 mt-8 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Organization</div>
           <Link to="/users" className={isActive('/users')}>
            <Users size={18} />
            <span>Employees</span>
          </Link>

          {(user?.permissions?.includes('user.read') || user?.permissions?.includes('role.read') || user?.roles?.includes('Admin')) && (
                <>
                <div className="px-3 mt-8 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</div>
                
                {(user?.permissions?.includes('user.read') || user?.roles?.includes('Admin')) && (
                    <Link to="/users" className={isActive('/users') + (isActive('/users').includes('active') ? '' : ' hidden md:flex')}> 
                         {/* This link is technically redundant with Employees above but labeled Manage Users. 
                             We can keep it or hide it. Let's keep it for explicit Admin feel or remove. 
                             Actually, let's keep it as is from Dashboard but maybe de-duplicate in future.
                             For now, matching dashboard logic.
                         */}
                        <Users size={18} />
                        <span>Manage Users</span>
                    </Link>
                )}
                
                {(user?.permissions?.includes('role.read') || user?.roles?.includes('Admin')) && (
                    <Link to="/roles" className={isActive('/roles')}>
                        <Shield size={18} />
                        <span>Roles & Permissions</span>
                    </Link>
                )}
              </>
          )}

          {/* Project Management Section */}
          {(user?.roles?.includes('Admin') || 
            user?.permissions?.some(p => p.startsWith('project.') || p.startsWith('business_unit.') || p.startsWith('client.'))) && (
             <>
                 <div className="px-3 mt-8 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Project Management</div>
                 
                 {(user?.roles?.includes('Admin') || user?.permissions?.includes('business_unit.read')) && (
                    <Link to="/business-units" className={isActive('/business-units')}>
                        <Building size={18} />
                        <span>Business Units</span>
                    </Link>
                 )}

                 {(user?.roles?.includes('Admin') || user?.permissions?.includes('client.read')) && (
                    <Link to="/clients" className={isActive('/clients')}>
                        <Users size={18} />
                        <span>Clients</span>
                    </Link>
                 )}

                 {(user?.roles?.includes('Admin') || user?.permissions?.includes('project.read')) && (
                    <Link to="/projects" className={isActive('/projects')}>
                        <Briefcase size={18} />
                        <span>Projects</span>
                    </Link>
                 )}
             </>
          )}
        </div>

        <div className="p-4 border-t border-slate-700/50">
           <Link to="/profile" className="flex items-center space-x-3 hover:bg-slate-800/50 p-2 rounded-lg transition-colors group">
              <div className="h-9 w-9 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold group-hover:ring-2 ring-blue-400">
                  {user?.firstName?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{user?.firstName}</div>
                  <div className="text-xs text-slate-400 truncate">{user?.company}</div>
                  {user?.reportingManager && (
                      <div className="text-[10px] text-blue-400 truncate mt-0.5">
                          Reports to: {user.reportingManager.firstName}
                      </div>
                  )}
              </div>
           </Link>
           <button onClick={logout} className="mt-2 w-full flex items-center justify-center space-x-2 text-slate-400 hover:text-white py-1 transition-colors text-xs uppercase tracking-wider font-bold">
               <LogOut size={14} /> <span>Log Out</span>
           </button>

        </div>
      </aside>
    );
};

export default Sidebar;
