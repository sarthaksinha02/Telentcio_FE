import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Users, Clock, Calendar, Search, Bell, Menu, ChevronDown, Shield, Building, Briefcase, UserCheck, UserX, AlertCircle, ArrowUpRight, TrendingUp, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { createCachePayload, isCacheFresh, readSessionCache } from '../utils/cache';
import { motion, AnimatePresence } from 'framer-motion';

// Simple global cache for location lookups to avoid redundant API hits across polls
const locationCache = {};
const DASHBOARD_CACHE_TTL_MS = 15 * 1000;
const MotionDiv = motion.div;

const LocationLink = ({ location }) => {
    const coordsKey = location ? `${location.lat},${location.lng}` : null;
    const [cityName, setCityName] = useState(() => (
        coordsKey && locationCache[coordsKey] ? locationCache[coordsKey] : '...'
    ));

    useEffect(() => {
        if (!coordsKey) return;
        if (locationCache[coordsKey]) return;

        const fetchCity = async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&zoom=10&addressdetails=1`, {
                    headers: { 'Accept-Language': 'en-US,en;q=0.9' }
                });
                const data = await res.json();
                if (data && data.address) {
                    const city = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state_district || 'Map';
                    locationCache[coordsKey] = city;
                    setCityName(city);
                } else {
                    setCityName('Map view');
                }
            } catch {
                setCityName('Map view');
            }
        };
        fetchCity();
    }, [coordsKey, location?.lat, location?.lng]);

    if (!location || !location.lat) return <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">Unknown</span>;

    return (
        <a
            href={`https://maps.google.com/?q=${location.lat},${location.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-blue-100 transition-all group"
            title={cityName}
        >
            <MapPin size={10} className="shrink-0" />
            <span className="truncate max-w-[80px]">{cityName}</span>
        </a>
    );
};

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [projects, setProjects] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const initialFetchDoneRef = useRef(false);

    useEffect(() => {
        if (initialFetchDoneRef.current) return;
        initialFetchDoneRef.current = true;

        // Cache key: date-scoped so it auto-invalidates at midnight
        const CACHE_KEY = `dashboard_${new Date().toISOString().slice(0, 10)}`;

        const readCache = () => {
            const parsed = readSessionCache(CACHE_KEY);
            const data = parsed?.data || parsed;
            if (!data || !data.stats) {
                sessionStorage.removeItem(CACHE_KEY);
                return null;
            }
            return parsed;
        };

        const writeCache = (data, fingerprint) => {
            try {
                // Minimal data for caching
                const minimalActivity = (data.recentActivity || []).map(r => ({
                    id: r.id,
                    user: r.user ? { name: r.user.name, role: r.user.role, employmentType: r.user.employmentType } : null,
                    time: r.time,
                    status: r.status,
                    location: r.location
                }));

                const minimalProjects = (data.projects || []).map(p => ({
                    _id: p._id,
                    name: p.name,
                    status: p.status,
                    deadline: p.deadline
                }));

                const payload = createCachePayload({
                    stats: data.stats,
                    recentActivity: minimalActivity,
                    projects: minimalProjects
                }, fingerprint);

                sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
            } catch {
                // sessionStorage unavailable or full — silently skip
            }
        };

        // Lightweight fingerprint: tracks every attendance record's
        // id + status + clockIn so any change (new clock-in, status update) is detected
        const buildFingerprint = (data) => {
            const payload = data?.data || data;
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
            if (!skipCache && cached) {
                applyData(cached.data || cached);
                setLoading(false);
                if (isCacheFresh(cached, DASHBOARD_CACHE_TTL_MS)) return;
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
        <div className="flex-1 flex flex-col bg-[#f8f9fa] font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <MotionDiv
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    className="flex-1 overflow-auto p-4 sm:p-5"
                >
                    <div className="max-w-6xl mx-auto space-y-5">
                        {/* Header Section */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Executive Overview</h1>
                                <p className="text-[11px] text-slate-500 font-medium italic">
                                    Welcome back, {user?.firstName} 👋
                                </p>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200/60 rounded-lg shadow-sm text-[11px] font-bold text-slate-600">
                                <Calendar size={14} className="text-blue-600" />
                                {format(new Date(), 'MMM d, yyyy')}
                            </div>
                        </div>

                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                {
                                    label: 'Total Workforce',
                                    value: stats?.totalEmployees - 1 || 0,
                                    icon: Users,
                                    color: 'blue',
                                    trend: 'Active',
                                    bgColor: 'bg-blue-50',
                                    textColor: 'text-blue-600'
                                },
                                {
                                    label: 'Present Today',
                                    value: stats?.presentToday || 0,
                                    total: stats?.totalEmployees || 0,
                                    icon: UserCheck,
                                    color: 'emerald',
                                    trend: 'Verified',
                                    progress: (stats?.presentToday / (stats?.totalEmployees || 1)) * 100,
                                    bgColor: 'bg-emerald-50',
                                    textColor: 'text-emerald-600'
                                },
                                {
                                    label: 'Absent Personnel',
                                    value: stats?.absentToday || 0,
                                    icon: UserX,
                                    color: 'orange',
                                    trend: 'Tracked',
                                    bgColor: 'bg-orange-50',
                                    textColor: 'text-orange-600'
                                }
                            ].map((kpi, idx) => (
                                <MotionDiv
                                    key={kpi.label}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="premium-card p-4 bg-white"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`p-2 rounded-lg ${kpi.bgColor} ${kpi.textColor}`}>
                                            <kpi.icon size={16} />
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${kpi.bgColor} ${kpi.textColor}`}>
                                            {kpi.trend}
                                        </span>
                                    </div>
                                    <div className="space-y-0.5">
                                        <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{kpi.label}</h3>
                                        <div className="flex items-baseline gap-1.5">
                                            {loading && !stats ? (
                                                <Skeleton className="h-8 w-16" />
                                            ) : (
                                                <span className="text-3xl font-black text-slate-900 tracking-tighter">
                                                    {kpi.value}
                                                </span>
                                            )}
                                            {kpi.total && (
                                                <span className="text-[11px] font-bold text-slate-400">/ {kpi.total}</span>
                                            )}
                                        </div>
                                    </div>
                                    {kpi.progress !== undefined && (
                                        <div className="mt-4 space-y-1.5">
                                            <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                                                <span>Attendance Rate</span>
                                                <span>{Math.round(kpi.progress)}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                <MotionDiv
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${kpi.progress}%` }}
                                                    transition={{ duration: 1, delay: 0.5 }}
                                                    className={`h-full ${kpi.label === 'Present Today' ? 'bg-emerald-500' : 'bg-blue-500'} rounded-full`}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </MotionDiv>
                            ))}
                        </div>

                        {/* Tables Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                            {/* Attendance Table */}
                            <div className="lg:col-span-8 premium-card bg-white overflow-hidden flex flex-col">
                                <div className="px-5 py-3.5 flex justify-between items-center border-b border-slate-50 bg-[#fcfcfc]">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                                        <h2 className="text-base font-bold text-slate-900 tracking-tight">Recent Attendance</h2>
                                    </div>
                                    <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Live Updates</span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-slate-50/50">
                                                <th className="px-5 py-2.5 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Employee</th>
                                                <th className="px-5 py-2.5 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Clock In</th>
                                                <th className="px-5 py-2.5 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                                                <th className="px-5 py-2.5 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Location</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {loading ? (
                                                [1, 2, 3, 4, 5].map(i => (
                                                    <tr key={i}><td colSpan="4" className="px-5 py-2.5"><Skeleton className="h-10 w-full" /></td></tr>
                                                ))
                                            ) : recentActivity.filter(r => r.status === 'PRESENT').length > 0 ? (
                                                recentActivity.filter(r => r.status === 'PRESENT').map((record) => (
                                                    <tr key={record.id} className="group hover:bg-slate-50/30 transition-colors border-b border-slate-50 last:border-0">
                                                        <td className="px-5 py-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200/50 group-hover:scale-105 transition-transform">
                                                                    {record.user.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="text-[13px] font-bold text-slate-900 leading-none mb-0.5">{record.user.name}</div>
                                                                    <div className="text-[9px] font-bold text-slate-400 text-left">{record.user.role || 'Personnel'}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <div className="flex items-center gap-1 text-slate-700 font-bold">
                                                                <Clock size={10} className="text-slate-400" />
                                                                <span className="text-[11px] uppercase">
                                                                    {record.time ? format(new Date(record.time), 'hh:mm a') : '--:--'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <span className="px-2 py-0.5 rounded-md bg-blue-50/50 text-blue-600 text-[9px] font-black uppercase tracking-tight border border-blue-100/30">
                                                                {record.user.employmentType || 'FT'}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 text-right">
                                                            <LocationLink location={record.location} />
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="px-6 py-10 text-center">
                                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                                            <AlertCircle size={24} strokeWidth={1.5} />
                                                            <p className="text-xs font-medium italic">No attendance records found for today.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Projects Table */}
                            {user?.company?.enabledModules?.includes('projectManagement') && (
                                <div className="lg:col-span-4 premium-card bg-white overflow-hidden flex flex-col">
                                    <div className="px-5 py-3.5 flex justify-between items-center border-b border-slate-50 bg-[#fcfcfc]">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-1 h-5 bg-purple-600 rounded-full"></div>
                                            <h2 className="text-base font-bold text-slate-900 tracking-tight">Active Projects</h2>
                                        </div>
                                        <Link to="/projects" className="text-[9px] font-black text-blue-600 bg-blue-50/80 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors uppercase tracking-widest">
                                            View Data
                                        </Link>
                                    </div>
                                    <div className="p-0">
                                        <div className="divide-y divide-slate-50">
                                            {loading ? (
                                                [1, 2, 3].map(i => <div key={i} className="p-4"><Skeleton className="h-10 w-full" /></div>)
                                            ) : projects.filter(p => p.status === 'Active').length > 0 ? (
                                                projects.filter(p => p.status === 'Active').slice(0, 5).map((project) => (
                                                    <div
                                                        key={project._id}
                                                        onClick={() => navigate('/projects')}
                                                        className="px-5 py-3.5 hover:bg-slate-50/30 cursor-pointer transition-all group"
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h3 className="font-bold text-slate-900 text-[13px] group-hover:text-blue-600 transition-colors leading-tight">
                                                                {project.name}
                                                            </h3>
                                                            <span className="text-[8px] font-black bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md uppercase tracking-widest border border-blue-100/50">
                                                                {project.status}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1 text-slate-400">
                                                                <Calendar size={10} />
                                                                <span className="text-[10px] font-bold">
                                                                    {project.deadline ? format(new Date(project.deadline), 'MMM d, yy') : 'No Deadline'}
                                                                </span>
                                                            </div>
                                                            <ArrowUpRight size={12} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-10 text-center text-slate-400 italic text-xs">
                                                    No active projects listed.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </MotionDiv>
            </main>
        </div>
    );
};

export default Dashboard;
