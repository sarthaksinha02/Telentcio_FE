import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Users, Clock, Calendar, Search, Bell, Menu, ChevronDown, Shield, Building, Briefcase, UserCheck, UserX, AlertCircle, ArrowUpRight, TrendingUp, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// Simple global cache for location lookups to avoid redundant API hits across polls
const locationCache = {};

const LocationLink = ({ location }) => {
    const [cityName, setCityName] = useState('Map...');
    const coordsKey = location ? `${location.lat},${location.lng}` : null;





    useEffect(() => {
        if (!coordsKey) return;

        // 1. Check cache first
        if (locationCache[coordsKey]) {
            setCityName(locationCache[coordsKey]);
            return;
        }

        const fetchCity = async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&zoom=10&addressdetails=1`);
                const data = await res.json();
                if (data && data.address) {
                    const city = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state_district || 'Map';
                    locationCache[coordsKey] = city; // Store in cache
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
    }, [coordsKey]);

    if (!location || !location.lat) return <span className="text-[11px] font-bold text-slate-300 uppercase tracking-tighter">Not Found</span>;

    return (
        <a
            href={`https://maps.google.com/?q=${location.lat},${location.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[11px] font-black uppercase tracking-tight hover:bg-blue-100 transition-all border border-blue-100 shadow-sm group max-w-full overflow-hidden"
            title={cityName}
        >
            <MapPin size={10} className="shrink-0 group-hover:scale-110 transition-transform" />
            <span className="truncate">{cityName}</span>
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
    const attSettings = user?.company?.settings?.attendance || {};
    const showLocation = attSettings.requireLocationCheckIn || attSettings.requireLocationCheckOut || attSettings.locationCheck;

    useEffect(() => {
        // Cache key: date-scoped so it auto-invalidates at midnight
        const CACHE_KEY = `dashboard_${new Date().toISOString().slice(0, 10)}`;

        const readCache = () => {
            try {
                const raw = sessionStorage.getItem(CACHE_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed?.data?.stats) {
                    sessionStorage.removeItem(CACHE_KEY);
                    return null;
                }
                return parsed; // returns { data, fingerprint }
            } catch {
                return null;
            }
        };

        const writeCache = (data, fingerprint) => {
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, fingerprint }));
            } catch {
                // sessionStorage unavailable or full — silently skip
            }
        };

        // Lightweight fingerprint: tracks every attendance record's
        // id + status + clockIn so any change (new clock-in, status update) is detected
        const buildFingerprint = (payload) => {
            if (!payload) return '';
            const activityPart = payload.recentActivity?.map(r => `${r.id}:${r.status}:${r.time ?? ''}`).join('|') || '';
            const statsPart = `${payload.stats?.totalEmployees || 0}:${payload.stats?.presentToday || 0}`;
            const projPart = payload.projects?.length || 0;
            return `${activityPart}#${statsPart}#${projPart}`;
        };

        const applyData = (payload) => {
            if (!payload?.stats) return;
            setStats(payload.stats);
            setRecentActivity(payload.recentActivity || []);
            setProjects(payload.projects || []);
        };

        const fetchDashboardData = async (skipCache = false) => {
            const cached = skipCache ? null : readCache();

            // 1. Show cached data instantly on first mount (no loading delay)
            if (!skipCache && cached?.data) {
                applyData(cached.data);
                setLoading(false);
            }

            // 2. Always fetch fresh data in background
            try {
                const res = await api.get('/dashboard');
                const payload = res.data;
                if (!payload?.stats) return;

                const freshFingerprint = buildFingerprint(payload);
                const cachedFingerprint = cached?.fingerprint ?? (readCache()?.fingerprint || '');

                if (freshFingerprint !== cachedFingerprint) {
                    // Data changed — update UI and overwrite cache
                    applyData(payload);
                    writeCache(payload, freshFingerprint);
                } else {
                    // Data unchanged — only refresh the cache entry (keep UI stable)
                    writeCache(payload, freshFingerprint);
                }
            } catch (error) {
                console.error('Failed to fetch dashboard data', error);
            } finally {
                setLoading(false);
            }
        };

        // Initial fetch
        fetchDashboardData();

        // 3. Continuously hit API for real-time updates (Polling every 10s)
        // Pass true to skip setting cache to UI again during interval
        const pollInterval = setInterval(() => fetchDashboardData(true), 10000);

        return () => clearInterval(pollInterval);
    }, []);

    return (
        <div className="flex-1 flex flex-col font-sans">
            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Scrollable Content */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex-1 overflow-auto p-2 sm:p-4"
                >
                    <div className="max-w-6xl mx-auto space-y-4">

                        {/* Page Title */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
                            <div>
                                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
                                <p className="text-[12px] text-slate-500 mt-0 font-medium italic">Welcome back, {user?.firstName} 👋</p>
                            </div>
                            <div className="px-2.5 py-1 bg-white/50 backdrop-blur-sm border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 shadow-sm flex items-center gap-1.5">
                                <Calendar size={12} className="text-blue-500" />
                                {format(new Date(), 'MMM d, yyyy')}
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Total Employees */}
                            <motion.div
                                whileHover={{ y: -2 }}
                                className="premium-card p-3 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-1.5 opacity-10 group-hover:opacity-15 transition-opacity">
                                    <Users size={45} className="text-blue-900" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                                        <Users size={14} />
                                    </div>
                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total</span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-1">
                                    {loading && !stats ? (
                                        <Skeleton className="h-6 w-12" />
                                    ) : (
                                        <span className="text-2xl font-black text-slate-900 tracking-tighter">{stats?.totalEmployees || 0}</span>
                                    )}
                                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded-md flex items-center gap-0.5">
                                        <TrendingUp size={8} /> Active
                                    </span>
                                </div>
                            </motion.div>

                            {/* Present Today */}
                            <motion.div
                                whileHover={{ y: -2 }}
                                className="premium-card p-3 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-1.5 opacity-10 group-hover:opacity-15 transition-opacity">
                                    <UserCheck size={45} className="text-emerald-900" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
                                        <UserCheck size={14} />
                                    </div>
                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Present</span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-1">
                                    {loading && !stats ? (
                                        <Skeleton className="h-6 w-12" />
                                    ) : (
                                        <span className="text-2xl font-black text-slate-900 tracking-tighter">{stats?.presentToday || 0}</span>
                                    )}
                                    <span className="text-slate-400 font-bold text-[10px]">/ {stats?.totalEmployees || 0}</span>
                                </div>
                                <div className="mt-3">
                                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(stats?.presentToday / (stats?.totalEmployees || 1)) * 100}%` }}
                                            className="h-full premium-gradient-emerald rounded-full"
                                        />
                                    </div>
                                </div>
                            </motion.div>

                            {/* Absent Today */}
                            <motion.div
                                whileHover={{ y: -2 }}
                                className="premium-card p-3 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-1.5 opacity-10 group-hover:opacity-15 transition-opacity">
                                    <UserX size={45} className="text-orange-900" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="p-1.5 rounded-md bg-orange-50 text-orange-600">
                                        <UserX size={14} />
                                    </div>
                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Absent</span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-1">
                                    {loading && !stats ? (
                                        <Skeleton className="h-6 w-12" />
                                    ) : (
                                        <span className="text-2xl font-black text-slate-900 tracking-tighter">{stats?.absentToday || 0}</span>
                                    )}
                                    <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1 py-0.5 rounded-md">Log</span>
                                </div>
                            </motion.div>
                        </div>

                        {/* Tables Section - Optimized Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Recent Attendance (Wider) */}
                            <div className="lg:col-span-7 premium-card flex flex-col h-full overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-white">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                                        <h3 className="font-bold text-slate-800 text-base tracking-tight">Attendance</h3>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1.5 py-0.5 bg-slate-50 rounded-md">Live</span>
                                </div>
                                <div className="flex flex-col flex-1">
                                    <div className="flex items-center px-4 py-3 bg-[#f8fafc] text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-50">
                                        <div className="flex-1 min-w-0 pr-4">Employee</div>
                                        <div className="w-20 shrink-0 flex-none text-left pl-2">Time In</div>
                                        <div className="w-24 shrink-0 flex-none text-left">Type</div>
                                        {showLocation && <div className="w-32 shrink-0 flex-none text-right pr-2">Location</div>}
                                    </div>
                                    <div className="divide-y divide-slate-100 bg-white">
                                        {loading ? (
                                            [1, 2, 3].map(i => (
                                                <div key={i} className="flex items-center px-4 py-4">
                                                    <div className="flex-1 pr-4"><Skeleton className="h-10 w-full max-w-[180px]" /></div>
                                                    <div className="w-20 pl-2"><Skeleton className="h-6 w-14" /></div>
                                                    <div className="w-24"><Skeleton className="h-6 w-16" /></div>
                                                    {showLocation && <div className="w-32 pr-2"><Skeleton className="h-6 w-20 ml-auto" /></div>}
                                                </div>
                                            ))
                                        ) : recentActivity.filter(r => r.status === 'PRESENT').length > 0 ? (
                                            recentActivity.filter(r => r.status === 'PRESENT').map((record) => (
                                                <div key={record.id} className="flex items-center px-4 py-3 hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                                                    <div className="flex-1 flex items-center min-w-0 pr-2 space-x-2.5">
                                                        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0 border border-slate-200">
                                                            {record.user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-800 text-[13px] truncate leading-tight">{record.user.name}</div>
                                                            <div className="text-[11px] text-slate-400 font-medium truncate">{record.user.role || 'Personnel'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="w-20 shrink-0 flex-none text-left pl-2">
                                                        <span className="text-[12px] text-slate-600 font-bold whitespace-nowrap">
                                                            {record.time ? format(new Date(record.time), 'hh:mm a').toUpperCase() : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="w-24 shrink-0 flex-none text-left">
                                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-md border border-blue-100/50 truncate inline-block">
                                                            {record.user.employmentType || 'FT'}
                                                        </span>
                                                    </div>
                                                    {showLocation && (
                                                        <div className="w-32 shrink-0 flex-none text-right pr-2 overflow-hidden">
                                                            <LocationLink location={record.location} />
                                                        </div>
                                                    )}
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

                            {/* Projects (Narrower but Compact) */}
                            {user?.company?.enabledModules?.includes('projectManagement') && (
                                <div className="lg:col-span-5 premium-card h-full overflow-hidden flex flex-col">
                                    <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-white">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
                                            <h3 className="font-bold text-slate-800 text-base tracking-tight">Active Projects</h3>
                                        </div>
                                        <Link to="/projects" className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors">View All</Link>
                                    </div>
                                    <div className="overflow-x-auto flex-1">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-[#f8fafc] text-slate-500 font-bold text-[10.5px] uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-5 py-3">Name</th>
                                                    <th className="px-5 py-3">Status</th>
                                                    <th className="px-5 py-3 text-right">End</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {loading ? (
                                                    <tr><td colSpan="3" className="px-5 py-6"><Skeleton className="h-5 w-full" /></td></tr>
                                                ) : projects.filter(p => p.status === 'Active').length > 0 ? (
                                                    projects.filter(p => p.status === 'Active').slice(0, 5).map((project) => (
                                                        <tr
                                                            key={project._id}
                                                            className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                                                            onClick={() => navigate('/projects')}
                                                        >
                                                            <td className="px-5 py-3.5 font-bold text-slate-800 group-hover:text-blue-600 transition-colors text-[13px]">{project.name}</td>
                                                            <td className="px-5 py-3.5">
                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight ${project.status === 'Active' ? 'bg-blue-50 text-blue-700' :
                                                                    project.status === 'On Hold' ? 'bg-orange-50 text-orange-700' :
                                                                        project.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                                                                            'bg-slate-50 text-slate-700'
                                                                    }`}>
                                                                    {project.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3.5 text-slate-500 font-bold text-[12px] text-right">
                                                                {project.deadline ? format(new Date(project.deadline), 'MMM d, yy') : '-'}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="3" className="px-6 py-12 text-center text-slate-400 font-medium italic">
                                                            No active projects currently listed.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default Dashboard;
