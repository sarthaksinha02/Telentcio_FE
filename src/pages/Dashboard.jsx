import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Users, Clock, Calendar, Search, Bell, Menu, ChevronDown, Shield, Building, Briefcase, UserX, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const LocationLink = ({ location }) => {
    const [cityName, setCityName] = useState('Map...');




    
    useEffect(() => {
        if (!location || !location.lat || !location.lng) return;

        const fetchCity = async () => {
            try {
                // Using Nominatim API for reverse geocoding
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&zoom=10&addressdetails=1`);
                const data = await res.json();
                if (data && data.address) {
                    const city = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state_district || 'Map';
                    setCityName(city);
                } else {
                    setCityName('Map');
                }
            } catch (error) {
                console.error("Error fetching city name", error);
                setCityName('Map');
            }
        };

        fetchCity();
    }, [location]);

    if (!location || !location.lat) return <span className="text-[12px] text-slate-400 whitespace-nowrap">N/A</span>;

    return (
        <a href={`https://maps.google.com/?q=${location.lat},${location.lng}`} target="_blank" rel="noopener noreferrer" className="text-[12.5px] text-blue-600 hover:text-blue-800 hover:underline font-medium whitespace-nowrap" title="View Map">
            {cityName}
        </a>
    );
};

const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [projects, setProjects] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const res = await api.get('/dashboard');
                setStats(res.data.stats);
                setRecentActivity(res.data.recentActivity);
                setProjects(res.data.projects || []);
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    return (
        <div className="flex-1 flex flex-col font-sans">
            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}


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
                                {format(new Date(), 'EEEE, MMMM d, yyyy')}
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Total Employees */}
                            <div className="zoho-card p-5 border-t-4 border-t-blue-500">
                                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Total Employees</div>
                                <div className="mt-3 flex items-baseline space-x-2">
                                    {loading ? (
                                        <Skeleton className="h-8 w-16" />
                                    ) : (
                                        <span className="text-3xl font-bold text-slate-800">{stats?.totalEmployees || 0}</span>
                                    )}
                                    <span className="text-xs font-medium text-slate-400">Active</span>
                                </div>
                            </div>

                            {/* Present Today */}
                            <div className="zoho-card p-5 border-t-4 border-t-emerald-500">
                                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Present Today</div>
                                <div className="mt-3 flex items-baseline space-x-2">
                                    {loading ? (
                                        <Skeleton className="h-8 w-16" />
                                    ) : (
                                        <span className="text-3xl font-bold text-slate-800">{stats?.presentToday || 0}</span>
                                    )}
                                    {loading ? (
                                        <Skeleton className="h-4 w-12" />
                                    ) : (
                                        <span className="text-xs text-slate-400">/ {stats?.totalEmployees || 0}</span>
                                    )}
                                </div>
                            </div>

                            {/* Absent Today */}
                            <div className="zoho-card p-5 border-t-4 border-t-orange-500">
                                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Absent Today</div>
                                <div className="mt-3 flex items-baseline space-x-2">
                                    {loading ? (
                                        <Skeleton className="h-8 w-16" />
                                    ) : (
                                        <span className="text-3xl font-bold text-slate-800">{stats?.absentToday || 0}</span>
                                    )}
                                    {/* <span className="text-xs text-slate-400">Low</span> */}
                                </div>
                            </div>
                        </div>

                        {/* Tables Section - Side by Side */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                            {/* Recent Attendance */}
                            <div className="bg-white rounded-lg border border-slate-100 shadow-sm flex flex-col h-full">
                                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-lg">
                                    <h3 className="font-semibold text-slate-800 text-base">Todays Attendance</h3>
                                    {/* <Link to="/attendance" className="text-sm text-blue-600 hover:underline">View All</Link> */}
                                </div>
                                <div className="flex flex-col flex-1">
                                    <div className="flex items-center px-4 lg:px-6 py-4 bg-[#f8fafc] text-slate-600 font-semibold border-b border-slate-100 text-[13.5px]">
                                        <div className="flex-1 min-w-0 pr-2">Employee</div>
                                        <div className="w-20 shrink-0 flex-none text-left">Check In</div>
                                        <div className="w-[100px] shrink-0 flex-none text-left">Role</div>
                                        <div className="w-16 sm:w-[72px] shrink-0 flex-none text-right">Location</div>
                                    </div>
                                    <div className="divide-y divide-slate-100 bg-white">
                                        {loading ? (
                                            [1, 2, 3].map(i => (
                                                <div key={i} className="flex items-center px-4 lg:px-6 py-4">
                                                    <div className="flex-1 pr-4"><Skeleton className="h-10 w-full max-w-[180px]" /></div>
                                                    <div className="w-20"><Skeleton className="h-6 w-14" /></div>
                                                    <div className="w-[100px]"><Skeleton className="h-6 w-16" /></div>
                                                    <div className="w-16 sm:w-[72px]"><Skeleton className="h-6 w-12 ml-auto" /></div>
                                                </div>
                                            ))
                                        ) : recentActivity.filter(r => r.status === 'PRESENT').length > 0 ? (
                                            recentActivity.filter(r => r.status === 'PRESENT').map((record) => (
                                                <div key={record.id} className="flex items-center px-4 lg:px-6 py-3.5 hover:bg-slate-50/50 transition-colors">
                                                    <div className="flex-1 flex items-center min-w-0 pr-3 sm:pr-4 space-x-3.5">
                                                        <div className="h-9 w-9 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[14px] font-bold text-[#475569] shrink-0">
                                                            {record.user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-semibold text-slate-800 text-[14px] truncate">{record.user.name}</div>
                                                            <div className="text-[12.5px] text-slate-500 mt-0.5 truncate">{record.user.employmentType || 'Employee'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="w-20 shrink-0 flex-none text-left">
                                                        <span className="text-[13.5px] text-slate-600 font-medium whitespace-nowrap">
                                                            {record.time ? format(new Date(record.time), 'hh:mm a').toUpperCase() : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="w-[100px] shrink-0 flex-none text-left">
                                                        <span className="text-[13px] text-slate-600 truncate block">
                                                            {record.user.role}
                                                        </span>
                                                    </div>
                                                    <div className="w-16 sm:w-[72px] shrink-0 flex-none text-right">
                                                        <LocationLink location={record.location} />
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-6 py-10 text-center text-slate-500 flex flex-col items-center">
                                                <AlertCircle size={28} className="mb-3 text-slate-300" />
                                                <p className="text-sm">No positive attendance activity today.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Projects */}
                            <div className="zoho-card">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                                    <h3 className="font-semibold text-slate-800 text-sm">Projects</h3>
                                    <Link to="/projects" className="text-xs text-blue-600 hover:underline">View All</Link>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-3">Project Name</th>
                                                <th className="px-6 py-3">Status</th>
                                                <th className="px-6 py-3">Deadline</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {loading ? (
                                                <tr><td colSpan="3" className="px-6 py-4"><Skeleton className="h-6 w-full" /></td></tr>
                                            ) : projects.filter(p => p.status === 'Active').length > 0 ? (
                                                projects.filter(p => p.status === 'Active').slice(0, 5).map((project) => (
                                                    <tr
                                                        key={project._id}
                                                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                                        onClick={() => navigate('/projects')}
                                                    >
                                                        <td className="px-6 py-3 font-medium text-slate-800">{project.name}</td>
                                                        <td className="px-6 py-3">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                                project.status === 'Active' ? 'bg-blue-100 text-blue-800' :
                                                                project.status === 'On Hold' ? 'bg-orange-100 text-orange-800' :
                                                                project.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                                                'bg-slate-100 text-slate-800'
                                                                }`}>
                                                                {project.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-600">
                                                            {project.deadline ? format(new Date(project.deadline), 'MMM d, yyyy') : '-'}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="3" className="px-6 py-8 text-center text-slate-500">
                                                        No projects.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
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
