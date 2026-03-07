import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import Skeleton from '../../components/Skeleton';
import { Briefcase, Users, FileCheck, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#06b6d4', '#ec4899', '#14b8a6'];

const StatCard = ({ title, value, subtitle, icon: Icon, colorClass }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 flex items-start space-x-4">
        <div className={`p-3 rounded-xl ${colorClass}`}>
            <Icon size={24} />
        </div>
        <div>


        
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
    </div>
);







const ClientTADashboard = ({ clientName }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedReqId, setSelectedReqId] = useState('All');

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!clientName) return;
            try {
                setLoading(true);
                const query = selectedReqId !== 'All' ? `?hiringRequestId=${selectedReqId}` : '';
                const res = await api.get(`/ta/analytics/client/${encodeURIComponent(clientName)}${query}`);
                if (res.data.success) {
                    setData(res.data.data);
                } else {
                    setError('Failed to load client TA metrics');
                }
            } catch (err) {
                console.error("Error fetching client TA analytics", err);
                const msg = err.response?.data?.message || err.message || 'Network error';
                setError(msg);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [clientName, selectedReqId]);

    if (loading && !data) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center space-x-3">
                <AlertTriangle size={20} />
                <span>{error}</span>
            </div>
        );
    }

    if (!data) return null;

    // Prepare Bar Chart Data for requested phases
    const barData = [
        { name: 'Sourced', value: data.totalSourced || 0, fill: '#3b82f6' },
        { name: 'Shortlisted in 2nd Phase', value: data.pipeline['Phase 2 Shortlisted / Interviews'] || 0, fill: '#8b5cf6' },
        { name: 'Joined', value: data.pipeline['Joined'] || 0, fill: '#10b981' }
    ];

    return (
        <div className="space-y-6 mt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Recruitment Overview for {clientName}</h3>
                    <p className="text-sm text-slate-500">Live metrics across {selectedReqId === 'All' ? 'all active and historic' : 'selected '} requisitions</p>
                </div>
                {data.requisitionsList && data.requisitionsList.length > 0 && (
                    <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-sm font-medium text-slate-600">Position:</span>
                        <select
                            value={selectedReqId}
                            onChange={(e) => setSelectedReqId(e.target.value)}
                            disabled={loading}
                            className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[250px] truncate"
                        >
                            <option value="All">All Positions</option>
                            {data.requisitionsList.map(req => (
                                <option key={req.id} value={req.id}>
                                    {req.title} {req.status === 'Closed' ? '(Closed)' : ''}
                                </option>
                            ))}
                        </select>
                        {loading && <div className="animate-spin h-4 w-4 border-2 border-indigo-500 rounded-full border-t-transparent"></div>}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Requisitions" 
                    value={data.totalReqs} 
                    subtitle={`${data.activeReqs} Active | ${data.closedReqs} Closed`}
                    icon={Briefcase} 
                    colorClass="bg-blue-50 text-blue-600" 
                />
                <StatCard 
                    title="Open Positions" 
                    value={data.totalOpenPositions} 
                    subtitle="Currently seeking"
                    icon={Users} 
                    colorClass="bg-purple-50 text-purple-600" 
                />
                <StatCard 
                    title="Total Hired" 
                    value={data.pipeline['Joined'] || 0} 
                    subtitle={`Hiring Ratio: ${data.hiringRatio}%`}
                    icon={FileCheck} 
                    colorClass="bg-emerald-50 text-emerald-600" 
                />
                <StatCard 
                    title="In Interviews" 
                    value={data.pipeline['Phase 2 Shortlisted / Interviews'] || 0} 
                    subtitle="Active pipeline"
                    icon={Users} 
                    colorClass="bg-amber-50 text-amber-600" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Pipeline Funnel */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h4 className="font-bold text-slate-700 mb-4">Key Pipeline Metrics</h4>
                    <div className="h-64 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                    formatter={(value) => [value, 'Candidates']}
                                />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                    {barData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Requirements / Summary */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h4 className="font-bold text-slate-700 mb-4">Pipeline Health Summary</h4>
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                            <p className="text-sm text-slate-600">
                                This client currently has <span className="font-bold text-slate-800">{data.activeReqs} active hiring requests</span> seeking to fill <span className="font-bold text-slate-800">{data.totalOpenPositions} positions</span>.
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                            <p className="text-sm text-slate-600">
                                The historic hiring ratio for this client is <span className="font-bold text-slate-800">{data.hiringRatio}%</span> (Hired vs Sourced).
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                             <p className="text-sm text-slate-600">
                                Current bottleneck check: There are <span className="font-bold text-slate-800">{data.pipeline['Phase 2 Shortlisted / Interviews'] || 0}</span> candidates actively interviewing/shortlisted across {selectedReqId === 'All' ? 'all requisitions' : 'this requisition'}.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ClientTADashboard;
