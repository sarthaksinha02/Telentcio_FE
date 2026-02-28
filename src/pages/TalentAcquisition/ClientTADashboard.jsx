import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import Skeleton from '../../components/Skeleton';
import { Briefcase, Users, FileCheck, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

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

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!clientName) return;
            try {
                setLoading(true);
                const res = await api.get(`/ta/analytics/client/${encodeURIComponent(clientName)}`);
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
    }, [clientName]);

    if (loading) {
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

    // Prepare Pie Chart Data
    const pieData = Object.keys(data.pipeline)
        .filter(key => data.pipeline[key] > 0)
        .map(key => ({
            name: key,
            value: data.pipeline[key]
        }));

    return (
        <div className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Recruitment Overview for {clientName}</h3>
                    <p className="text-sm text-slate-500">Live metrics across all active and historic requisitions</p>
                </div>
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
                    value={data.pipeline['Hired'] || 0} 
                    subtitle={`Hiring Ratio: ${data.hiringRatio}%`}
                    icon={FileCheck} 
                    colorClass="bg-emerald-50 text-emerald-600" 
                />
                <StatCard 
                    title="In Interviews" 
                    value={data.pipeline['In Interviews'] || 0} 
                    subtitle="Active pipeline"
                    icon={Users} 
                    colorClass="bg-amber-50 text-amber-600" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Pipeline Funnel */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h4 className="font-bold text-slate-700 mb-4">Candidate Pipeline Breakdown</h4>
                    {pieData.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(value, name) => [value, name]}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-wrap justify-center gap-4 mt-2">
                                {pieData.map((entry, index) => (
                                    <div key={entry.name} className="flex items-center space-x-2 text-xs text-slate-600">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                                        <span>{entry.name} ({entry.value})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-slate-400">
                            No candidate data available in the pipeline.
                        </div>
                    )}
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
                                Current bottleneck check: There are <span className="font-bold text-slate-800">{data.pipeline['In Interviews'] || 0}</span> candidates actively interviewing across all requisitions.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ClientTADashboard;
