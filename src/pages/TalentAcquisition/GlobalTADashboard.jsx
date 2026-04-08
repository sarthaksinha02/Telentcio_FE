import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, TrendingUp, Users, UserCheck, PieChart as PieIcon,
    BarChart3, RefreshCw, Briefcase, Filter, Calendar,
    Search, CheckSquare, Clock, AlertCircle, Inbox,
    ChevronDown, Download, ExternalLink, Award, PlayCircle
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    LineChart, Line, ComposedChart, Area, Funnel, FunnelChart, LabelList
} from 'recharts';
import Skeleton from '../../components/Skeleton';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#f43f5e', '#10b981', '#f59e0b', '#64748b'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-2xl">
                <p className="text-xs font-bold text-slate-800 mb-2">{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs py-1">
                        <div className="size-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                        <span className="text-slate-500">{entry.name}:</span>
                        <span className="font-bold text-slate-800">{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const GlobalTADashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [showFilters, setShowFilters] = useState(true);

    // Filters
    const [filters, setFilters] = useState({
        client: '',
        department: '',
        position: '',
        recruiter: '',
        startDate: '',
        endDate: '',
        phase: 'all',
        requisitionId: ''
    });

    const fetchAnalytics = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });

            const response = await api.get(`/ta/analytics/global?${params.toString()}`);
            setData(response.data.data);
        } catch (error) {
            console.error('Error fetching global analytics:', error);
            toast.error('Failed to load global analysis data');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchAnalytics();
        }, 500);
        return () => clearTimeout(timeout);
    }, [fetchAnalytics]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({ client: '', department: '', position: '', recruiter: '', startDate: '', endDate: '', phase: 'all', requisitionId: '' });
    };

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div className="h-8 bg-slate-200 rounded w-1/4 animate-pulse"></div>
                    <div className="h-10 bg-slate-200 rounded w-32 animate-pulse"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200 animate-pulse"></div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-[400px] bg-white rounded-2xl border border-slate-200 animate-pulse"></div>
                    <div className="h-[400px] bg-white rounded-2xl border border-slate-200 animate-pulse"></div>
                </div>
            </div>
        );
    }

    const {
        topMetrics, pipelineDistribution, recruitmentFunnel,
        departmentAnalysis, recruiterPerformance,
        positionPerformance, timeMetrics, sourceAnalysis, monthlyTrend,
        filterOptions // New: dynamic options for dropdowns
    } = data || {};

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-24">
            {/* Header Area */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-6 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <TrendingUp className="text-indigo-600" size={24} />
                                    Global Talent Acquisition Analytics
                                </h1>
                                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Enterprise Recruitment Intelligence</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Phase Switcher */}
                            <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                                {['all', '1', '2', '3'].map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setFilters(prev => ({ ...prev, phase: p }))}
                                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${filters.phase === p
                                                ? 'bg-white text-indigo-600 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        {p === 'all' ? 'Global' : `Phase ${p}`}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-bold ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                            >
                                <Filter size={16} />
                                {showFilters ? 'Hide Filters' : 'Show Filters'}
                            </button>
                            <button
                                onClick={fetchAnalytics}
                                className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100 group shadow-sm bg-white"
                                title="Refresh Data"
                            >
                                <RefreshCw size={18} className={`${loading ? 'animate-spin' : 'group-active:rotate-180 transition-transform'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Dynamic Filter Bar */}
                    {showFilters && (
                        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 animate-in slide-in-from-top-2 duration-300">
                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block px-1">Client</label>
                                <div className="relative">
                                    <select
                                        name="client" value={filters.client} onChange={handleFilterChange}
                                        className="w-full pl-9 pr-10 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">All Clients</option>
                                        {filterOptions?.clients?.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block px-1">Department</label>
                                <div className="relative">
                                    <select
                                        name="department" value={filters.department} onChange={handleFilterChange}
                                        className="w-full pl-9 pr-10 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">All Departments</option>
                                        {filterOptions?.departments?.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <Inbox className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block px-1">Position</label>
                                <div className="relative">
                                    <select
                                        name="position" value={filters.position} onChange={handleFilterChange}
                                        className="w-full pl-9 pr-10 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">All Roles</option>
                                        {filterOptions?.positions?.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block px-1">Recruiter</label>
                                <div className="relative">
                                    <select
                                        name="recruiter" value={filters.recruiter} onChange={handleFilterChange}
                                        className="w-full pl-9 pr-10 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">All Recruiters</option>
                                        {filterOptions?.recruiters?.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block px-1">Req / Version</label>
                                <div className="relative">
                                    <select
                                        name="requisitionId" value={filters.requisitionId} onChange={handleFilterChange}
                                        className="w-full pl-9 pr-10 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">All Versions</option>
                                        {filterOptions?.requisitions?.map(r => (
                                            <option key={r._id} value={r._id}>
                                                {r.title} {r.client ? `(${r.client})` : ''} - {r.status === 'Closed' ? 'Legacy' : 'Active'} ({new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })})
                                            </option>
                                        ))}
                                    </select>
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="relative col-span-2 lg:col-span-1 grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block px-1">From</label>
                                    <input
                                        type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange}
                                        className="w-full px-2 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block px-1">To</label>
                                    <input
                                        type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange}
                                        className="w-full px-2 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex items-end pb-0.5">
                                <button
                                    onClick={resetFilters}
                                    className="w-full py-2 text-xs font-extrabold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">

                {/* 1. TOP METRICS CARDS */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    <KpiCard label="Total Requisitions" val={topMetrics?.totalReqs} icon={<Briefcase />} color="indigo" />
                    <KpiCard label="Positions Open" val={topMetrics?.totalOpenPositions} icon={<TrendingUp />} color="emerald" />
                    <KpiCard
                        label={filters.phase === '1' ? "Total Sourced" : filters.phase === '2' ? "Pool from Ph 1" : filters.phase === '3' ? "Pool from Ph 2" : "Total Sourced"}
                        val={topMetrics?.totalSourced}
                        icon={<Users />}
                        color="blue"
                    />
                    <KpiCard label="Interviews Scheduled" val={topMetrics?.interviewsScheduled} icon={<Calendar />} color="purple" />
                    <KpiCard label="Offers Released" val={topMetrics?.offersReleased} icon={<Award />} color="amber" />
                    <KpiCard label="Total Joined" val={topMetrics?.totalJoined} icon={<UserCheck />} color="pink" />
                    <KpiCard label="Offer Acceptance Rate" val={`${topMetrics?.offerAcceptanceRate}%`} icon={<CheckSquare />} color="cyan" />
                    <KpiCard
                        label={filters.phase === 'all' ? "Joining Conv. Rate" : "Progression Rate"}
                        val={`${topMetrics?.conversionRate || topMetrics?.joiningConversionRate}%`}
                        icon={<TrendingUp />}
                        color="orange"
                    />
                    <KpiCard label="Avg Time to Hire" val={`${topMetrics?.avgTimeToHire} Days`} icon={<Clock />} color="slate" />
                    <KpiCard label="Avg Time to Fill" val={`${topMetrics?.avgTimeToFill} Days`} icon={<Calendar />} color="red" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 2. PIPELINE DISTRIBUTION (Donut) */}
                    <DashboardCard title="Pipeline Distribution" sub="Candidate spread across stages" icon={<PieIcon />} color="indigo" className="lg:col-span-1">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pipelineDistribution}
                                        cx="50%" cy="50%"
                                        innerRadius={70} outerRadius={110}
                                        paddingAngle={4} dataKey="value"
                                    >
                                        {pipelineDistribution?.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </DashboardCard>

                    {/* 3. RECRUITMENT FUNNEL */}
                    <DashboardCard title="Recruitment Funnel" sub="Conversion efficiency through levels" icon={<Filter />} color="emerald" className="lg:col-span-2">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={recruitmentFunnel} margin={{ top: 10, right: 60, left: 20, bottom: 10 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} width={80} />
                                    <Tooltip cursor={{ fill: '#f1f5f9' }} content={<CustomTooltip />} />
                                    <Bar dataKey="value" fill="#10b981" radius={[0, 12, 12, 0]} barSize={34}>
                                        <LabelList dataKey="value" position="right" style={{ fontSize: '11px', fontWeight: 800, fill: '#334155' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-4 px-4">
                            {recruitmentFunnel?.slice(1).map((step, i) => {
                                const prev = recruitmentFunnel[i].value;
                                const conv = prev > 0 ? ((step.value / prev) * 100).toFixed(1) : 0;
                                return (
                                    <div key={i} className="text-center">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{step.name} Conv.</div>
                                        <div className="text-xs font-extrabold text-emerald-600 bg-emerald-50 py-1 rounded-lg">{conv}%</div>
                                    </div>
                                );
                            })}
                        </div>
                    </DashboardCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 4. DEPARTMENT HIRING ANALYSIS */}
                    <DashboardCard title="Department Analysis" sub="Hiring volume by functional area" icon={<Inbox />} color="blue">
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={departmentAnalysis} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend iconType="circle" />
                                    <Bar dataKey="sourced" name="Sourced" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={12} />
                                    <Bar dataKey="interviewed" name="Interviewed" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={12} />
                                    <Bar dataKey="offered" name="Offered" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={12} />
                                    <Bar dataKey="joined" name="Joined" fill="#10b981" radius={[6, 6, 0, 0]} barSize={12} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </DashboardCard>

                    {/* 10. MONTHLY HIRING TREND */}
                    <DashboardCard title="Hiring Trend" sub="Month-over-month performance" icon={<TrendingUp />} color="pink">
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={monthlyTrend}>
                                    <defs>
                                        <linearGradient id="colorSourced" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="sourced" name="Sourced" stroke="#6366f1" fillOpacity={1} fill="url(#colorSourced)" strokeWidth={3} />
                                    <Line type="monotone" dataKey="joined" name="Joined" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </DashboardCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 5. RECRUITER PERFORMANCE */}
                    <DashboardCard title="Recruiter Productivity" sub="Efficiency ranking for sourcing team" icon={<Award />} color="purple">
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Recruiter</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Source</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Intv.</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Offer</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Join</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Conv. %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recruiterPerformance?.map((rec, i) => (
                                        <tr key={i} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0 font-medium">
                                            <td className="px-4 py-3 text-slate-800 font-bold">{rec.name}</td>
                                            <td className="px-4 py-3 text-center text-slate-600">{rec.sourced}</td>
                                            <td className="px-4 py-3 text-center text-slate-600">{rec.interviews}</td>
                                            <td className="px-4 py-3 text-center text-slate-600">{rec.offers}</td>
                                            <td className="px-4 py-3 text-center text-emerald-600 font-bold">{rec.joined}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 font-extrabold">{rec.conversion}%</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </DashboardCard>

                    {/* 6. POSITION PERFORMANCE */}
                    <DashboardCard title="Position Insights" sub="Individual requisition progress" icon={<Briefcase />} color="amber">
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Position</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Open</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Intv.</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Join</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Health %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {positionPerformance?.slice(0, 10).map((pos, i) => {
                                        const health = pos.open > 0 ? (pos.joined / pos.open) * 100 : 0;
                                        return (
                                            <tr key={i} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0 font-medium">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-800">{pos.title}</div>
                                                    <div className="text-[10px] text-slate-400 font-semibold">{pos.client}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-slate-600">{pos.open}</td>
                                                <td className="px-4 py-3 text-center text-slate-600">{pos.interviewed}</td>
                                                <td className="px-4 py-3 text-center text-emerald-600 font-bold">{pos.joined}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden min-w-[60px]">
                                                        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${Math.min(100, health)}%` }}></div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </DashboardCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 7. TIME METRICS */}
                    <DashboardCard title="Time to Hire" sub="Processing speeds (Avg Days)" icon={<Clock />} color="slate">
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={timeMetrics} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="value" name="Avg Days" fill="#64748b" radius={[8, 8, 8, 8]} barSize={40}>
                                        <LabelList dataKey="value" position="top" style={{ fontSize: '12px', fontWeight: 800, fill: '#1e293b' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </DashboardCard>

                    {/* 8. SOURCE ANALYSIS */}
                    <DashboardCard title="Sourcing Effectiveness" sub="High-yield channels" icon={<Users />} color="cyan">
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={sourceAnalysis} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="sourced" name="Sourced" fill="#06b6d4" radius={[6, 6, 0, 0]} barSize={20} />
                                    <Line type="monotone" dataKey="joined" name="Joined" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </DashboardCard>

                    {/* 9. JOINING EFFICIENCY METRIC */}
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[32px] p-8 text-white shadow-xl flex flex-col justify-between relative overflow-hidden h-full min-h-[350px]">
                        <div className="relative z-10">
                            <div className="p-3 bg-white/10 w-fit rounded-2xl mb-6">
                                <TrendingUp size={24} />
                            </div>
                            <h3 className="text-2xl font-black mb-4 tracking-tight leading-tight">Joining Efficiency<br />Metric</h3>
                            <p className="text-indigo-100 text-sm font-medium leading-relaxed mb-8 opacity-80">
                                Sourced to Joined conversion ratio highlights the ROI of your recruitment sourcing machinery.
                            </p>

                            <div className="space-y-6">
                                <div className="flex items-end gap-3">
                                    <span className="text-6xl font-black leading-none">{topMetrics?.totalSourced}</span>
                                    <span className="text-indigo-300 font-bold mb-1 opacity-60">Sourced Candidates</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex-grow h-3 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-300 shadow-[0_0_20px_rgba(165,180,252,0.5)] transition-all duration-1000"
                                            style={{ width: `${topMetrics?.joiningConversionRate}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xl font-black">{topMetrics?.joiningConversionRate}%</span>
                                </div>
                                <div className="bg-white/10 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
                                    <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-[2px] mb-1">Efficiency Ratio</div>
                                    <div className="text-3xl font-black italic">100 : {((topMetrics?.totalJoined / (topMetrics?.totalSourced || 1)) * 100).toFixed(0)}</div>
                                </div>
                            </div>
                        </div>
                        <TrendingUp className="absolute -right-16 -bottom-16 size-80 text-white opacity-[0.05]" />
                    </div>
                </div>

            </div>
        </div>
    );
};

// HELPER COMPONENTS

const KpiCard = ({ label, val, icon, color }) => {
    const colorMap = {
        indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        blue: 'text-blue-600 bg-blue-50 border-blue-100',
        purple: 'text-purple-600 bg-purple-50 border-purple-100',
        amber: 'text-amber-600 bg-amber-50 border-amber-100',
        pink: 'text-pink-600 bg-pink-50 border-pink-100',
        cyan: 'text-cyan-600 bg-cyan-50 border-cyan-100',
        orange: 'text-orange-600 bg-orange-50 border-orange-100',
        slate: 'text-slate-600 bg-slate-50 border-slate-200',
        red: 'text-red-600 bg-red-50 border-red-100'
    };

    return (
        <div className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden`}>
            <div className="flex flex-col gap-3 relative z-10">
                <div className={`p-2 w-fit rounded-xl ${colorMap[color]}`}>
                    {React.cloneElement(icon, { size: 18 })}
                </div>
                <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{label}</div>
                    <div className="text-2xl font-black text-slate-800 tracking-tight">{val}</div>
                </div>
            </div>
            <div className={`absolute -right-4 -bottom-4 opacity-[0.03] transition-transform group-hover:scale-110 duration-500`}>
                {React.cloneElement(icon, { size: 96 })}
            </div>
        </div>
    );
};

const DashboardCard = ({ title, sub, icon, color, children, className = '' }) => {
    const colorMap = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600',
        amber: 'bg-amber-50 text-amber-600',
        pink: 'bg-pink-50 text-pink-600',
        cyan: 'bg-cyan-50 text-cyan-600',
        slate: 'bg-slate-50 text-slate-600'
    };

    return (
        <div className={`bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col ${className}`}>
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${colorMap[color]}`}>
                        {React.cloneElement(icon, { size: 22 })}
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 leading-tight">{title}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{sub}</p>
                    </div>
                </div>
                <button className="p-2 text-slate-300 hover:text-slate-500 transition-colors">
                    <Download size={20} />
                </button>
            </div>
            <div className="flex-grow">
                {children}
            </div>
        </div>
    );
};

export default GlobalTADashboard;
