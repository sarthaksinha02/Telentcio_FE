import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { LogOut, Users, Clock, Calendar, Search, Bell, Menu, ChevronDown, Shield, Building, Briefcase } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex-1 flex flex-col font-sans">
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-10">
          <div className="flex items-center">
            <button className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-md mr-2">
                <Menu size={20} />
            </button>
            <div className="relative hidden sm:block">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search employees, actions..." 
                    className="pl-10 pr-4 py-1.5 w-64 bg-slate-100 border-none rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
             <button className="flex items-center space-x-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors">
                <span>Quick Actions</span>
                <ChevronDown size={14} />
             </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Page Title */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-1">Overview of your organization's performance</p>
                </div>
                <div className="text-sm text-slate-500">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="zoho-card p-5 border-t-4 border-t-blue-500">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Total Employees</div>
                    <div className="mt-3 flex items-baseline space-x-2">
                        <span className="text-3xl font-bold text-slate-800">24</span>
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">+8%</span>
                    </div>
                </div>
                
                <div className="zoho-card p-5 border-t-4 border-t-emerald-500">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide">On Time Today</div>
                    <div className="mt-3 flex items-baseline space-x-2">
                        <span className="text-3xl font-bold text-slate-800">18</span>
                        <span className="text-xs text-slate-400">/ 24</span>
                    </div>
                </div>

                <div className="zoho-card p-5 border-t-4 border-t-orange-500">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Pending Leaves</div>
                    <div className="mt-3 flex items-baseline space-x-2">
                        <span className="text-3xl font-bold text-slate-800">3</span>
                        <div className="flex -space-x-1 ml-2">
                           {/* Tiny placeholder avatars */}
                           <div className="h-5 w-5 rounded-full bg-slate-300 border border-white"></div>
                           <div className="h-5 w-5 rounded-full bg-slate-400 border border-white"></div>
                           <div className="h-5 w-5 rounded-full bg-slate-300 border border-white"></div>
                        </div>
                    </div>
                </div>
                
                <div className="zoho-card p-5 border-t-4 border-t-purple-500">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Upcoming Holidays</div>
                    <div className="mt-3">
                        <span className="text-lg font-bold text-slate-800">Deepavali</span>
                        <div className="text-xs text-slate-500">Nov 12th (Friday)</div>
                    </div>
                </div>
            </div>

            {/* Tables Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Main Table */}
                 <div className="lg:col-span-2 zoho-card">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                        <h3 className="font-semibold text-slate-800 text-sm">Recent Attendance</h3>
                        <a href="#" className="text-xs text-blue-600 hover:underline">View All</a>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">Employee</th>
                                    <th className="px-6 py-3">Check In</th>
                                    <th className="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[1,2,3].map((i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center space-x-3">
                                                <div className="h-8 w-8 rounded-full bg-slate-200"></div>
                                                <div>
                                                    <div className="font-medium text-slate-800">Employee {i}</div>
                                                    <div className="text-xs text-slate-500">Product Designer</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">09:0{i} AM</td>
                                        <td className="px-6 py-3">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                                                Present
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 </div>

                 {/* Side Widget */}
                 <div className="zoho-card">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                        <h3 className="font-semibold text-slate-800 text-sm">Quick Links</h3>
                    </div>
                    <div className="p-2">
                        <a href="#" className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-md group transition-colors">
                            <span className="text-sm text-slate-600 group-hover:text-blue-600">Apply for Leave</span>
                            <ChevronDown size={14} className="text-slate-300 -rotate-90" />
                        </a>
                        <a href="#" className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-md group transition-colors">
                            <span className="text-sm text-slate-600 group-hover:text-blue-600">Log Timesheet</span>
                            <ChevronDown size={14} className="text-slate-300 -rotate-90" />
                        </a>
                        <a href="#" className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-md group transition-colors">
                            <span className="text-sm text-slate-600 group-hover:text-blue-600">Employee Policy</span>
                            <ChevronDown size={14} className="text-slate-300 -rotate-90" />
                        </a>
                    </div>
                 </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
