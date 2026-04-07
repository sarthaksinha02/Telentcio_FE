import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { Users, Briefcase, ChevronRight, Search, Clock, CheckCircle, TrendingUp, XCircle } from 'lucide-react';
import Skeleton from '../../components/Skeleton';
import { createCachePayload, isCacheFresh, readSessionCache } from '../../utils/cache';

const ClientSelection = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const CLIENT_CACHE_KEY = 'ta_client_selection_v1';
    const CLIENT_CACHE_TTL_MS = 60 * 1000;

    const filteredClients = clients.filter(client => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const fetchClients = async () => {
            const cached = readSessionCache(CLIENT_CACHE_KEY);
            if (cached) {
                setClients(cached.data || []);
                setLoading(false);
                if (isCacheFresh(cached, CLIENT_CACHE_TTL_MS)) return;
            }

            try {
                if (!cached) setLoading(true);
                const response = await api.get('/ta/clients');
                setClients(response.data);
                const fingerprint = (response.data || []).map(client => `${client.name}:${client.activePositions}:${client.pendingPositions}:${client.closedPositions}`).join('|');
                sessionStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify(createCachePayload(response.data, fingerprint)));
            } catch (error) {
                console.error('Error fetching TA clients:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchClients();
    }, []);

    const totalActive = clients.reduce((sum, c) => sum + (c.activePositions || 0), 0);
    const totalPending = clients.reduce((sum, c) => sum + (c.pendingPositions || 0), 0);
    const totalClosed = clients.reduce((sum, c) => sum + (c.closedPositions || 0), 0);

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Talent Acquisition</h1>
                        <p className="text-sm text-slate-500 font-medium text-slate-400">Manage client hiring requests and pipelines</p>
                    </div>
                    <div className="flex gap-3">
                         <Link
                            to="/ta/analysis"
                            className="bg-white border border-slate-300 hover:bg-blue-50 text-slate-700 hover:text-blue-700 hover:border-blue-200 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-wider shadow-sm"
                        >
                            <TrendingUp size={16} className="text-blue-600" /> Global Analysis
                        </Link>
                    </div>
                </div>
            </div>

            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md border-t-4 border-t-blue-500">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100/50 text-blue-600 rounded-xl">
                                <Users size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Clients</p>
                                <h3 className="text-2xl font-black text-slate-800">{clients.length}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md border-t-4 border-t-emerald-500">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-100/50 text-emerald-600 rounded-xl">
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</p>
                                <h3 className="text-2xl font-black text-slate-800">{totalActive}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md border-t-4 border-t-amber-500">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-100/50 text-amber-600 rounded-xl">
                                <Clock size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
                                <h3 className="text-2xl font-black text-slate-800">{totalPending}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md border-t-4 border-t-slate-400">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-slate-100 text-slate-400 rounded-xl">
                                <Search size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Closed</p>
                                <h3 className="text-2xl font-black text-slate-800">{totalClosed}</h3>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter & Search */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by client name..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden md:block">
                        Showing {filteredClients.length} Clients
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Client Name</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Active</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Pending</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Closed</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-6 py-4 leading-none"><div className="h-4 w-48 bg-slate-100 rounded"></div></td>
                                            <td className="px-6 py-4 text-center"><div className="h-4 w-12 bg-slate-50 rounded mx-auto"></div></td>
                                            <td className="px-6 py-4 text-center"><div className="h-4 w-12 bg-slate-50 rounded mx-auto"></div></td>
                                            <td className="px-6 py-4 text-center"><div className="h-4 w-12 bg-slate-50 rounded mx-auto"></div></td>
                                            <td className="px-6 py-4 text-right"><div className="h-8 w-20 bg-slate-100 rounded ml-auto"></div></td>
                                        </tr>
                                    ))
                                ) : filteredClients.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Users className="text-slate-200" size={48} />
                                                <p className="text-slate-400 font-medium">No clients found matching your search</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredClients.map((client) => (
                                        <tr 
                                            key={client.name}
                                            className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                                            onClick={() => navigate(`/ta/hiring-requests/${encodeURIComponent(client.name)}`)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                        <Briefcase size={18} />
                                                    </div>
                                                    <span className="font-bold text-slate-700 group-hover:text-blue-700 transition-colors">{client.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${client.activePositions > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                                    <CheckCircle size={10} /> {client.activePositions}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${client.pendingPositions > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                                                    <Clock size={10} /> {client.pendingPositions}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${client.closedPositions > 0 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-300'}`}>
                                                    <Search size={10} /> {client.closedPositions}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">
                                                    Details <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientSelection;
