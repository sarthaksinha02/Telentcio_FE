import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Plus, Search, Filter, Briefcase, Clock, CheckCircle, XCircle, AlertCircle, Settings, TrendingUp, ChevronRight, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import Skeleton from '../../components/Skeleton';

const HiringRequestList = () => {
    const { user } = useAuth();
    const { clientName } = useParams();
    const [requests, setRequests] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('Approved'); // Default to Approved
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const navigate = useNavigate();

    const fetchRequests = useCallback(async () => {
        try {
            setLoading(true);
            const [reqRes, clientRes] = await Promise.all([
                api.get('/ta/hiring-request', {
                    params: {
                        status: filterStatus === 'All' ? '' : filterStatus,
                        page,
                        limit: 10,
                        client: clientName ? decodeURIComponent(clientName) : ''
                    }
                }),
                api.get('/projects/clients')
            ]);
            // Backend now returns an object with requests and totalPages
            setRequests(reqRes.data.requests ? reqRes.data.requests : reqRes.data);
            if (reqRes.data.totalPages) {
                setTotalPages(reqRes.data.totalPages);
            } else {
                setTotalPages(1); // Fallback if backend hasn't updated immediately
            }
            setClients(clientRes.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [clientName, filterStatus, page]);

    const handleFilterChange = (status) => {
        setFilterStatus(status === 'All' ? 'All' : status === 'Pending' ? 'Pending_Approval' : status);
        setPage(1);
    };

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const getClientIdByName = (name) => {
        const client = clients.find(c => c.name === name);
        return client ? client._id : null;
    };

    const getStatusBadge = (status) => {
        const styles = {
            'Draft': 'bg-slate-100 text-slate-600',
            'Submitted': 'bg-blue-50 text-blue-600',
            'Pending_L1': 'bg-amber-50 text-amber-600',
            'Pending_Approval': 'bg-amber-50 text-amber-600',
            'Pending_Final': 'bg-purple-50 text-purple-600',
            'Approved': 'bg-emerald-50 text-emerald-600',
            'Rejected': 'bg-red-50 text-red-600',
            'Closed': 'bg-gray-100 text-gray-600',
            'On_Hold': 'bg-gray-200 text-gray-600'
        };
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles['Draft']}`}>
                {status?.replace('_', ' ')}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Sticky Top Navbar */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/ta')}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                            title="Go back"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                                <Link to="/ta" className="hover:text-blue-600 transition-colors">Talent Acquisition</Link>
                                <ChevronRight size={14} />
                                <span className="font-medium text-slate-800">{clientName ? decodeURIComponent(clientName) : 'All Positions'}</span>
                            </div>
                            <h1 className="text-xl font-bold text-slate-800">
                                {clientName ? `${decodeURIComponent(clientName)} Positions` : 'Talent Acquisition'}
                            </h1>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                        <Link
                            to="/ta/workflows"
                            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium text-sm"
                        >
                            <Settings size={18} /> Workflows
                        </Link>
                        <Link
                            to="/ta/analysis"
                            className="bg-white border border-slate-300 hover:bg-blue-50 text-slate-700 hover:text-blue-700 hover:border-blue-200 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium text-sm shadow-sm"
                        >
                            <TrendingUp size={18} /> Global Analysis
                        </Link>
                        {(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.create')) && (
                            <Link
                                to="/ta/create-request"
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium text-sm shadow-sm"
                            >
                                <Plus size={18} /> Raising Requisition
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Filter Section */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2 text-slate-600 whitespace-nowrap">
                            <Filter size={16} />
                            <span className="text-sm font-medium">Filter by Status:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {['All', 'Pending', 'Draft', 'Approved', 'Closed'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => handleFilterChange(status)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${(filterStatus === status ||
                                        (status === 'Pending' && filterStatus === 'Pending_Approval') ||
                                        (status === 'All' && filterStatus === 'All'))
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[900px]">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Request ID</th>
                                <th className="px-6 py-4">Client</th>
                                <th className="px-6 py-4">Role & Dept</th>
                                <th className="px-6 py-4">Created On</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan="6" className="p-4"><Skeleton className="h-8 w-full" /></td>
                                    </tr>
                                ))
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500">
                                        No hiring requests found for the selected filter.
                                    </td>
                                </tr>
                            ) : (
                                requests.map(req => (
                                    <tr 
                                        key={req._id} 
                                        className="hover:bg-slate-50 transition-colors group cursor-pointer"
                                        onClick={() => navigate(`/ta/view/${req._id}${(req.status === 'Approved' || req.status === 'Closed') ? '?tab=applications' : ''}`)}
                                    >
                                        <td className="px-6 py-4 font-medium text-slate-700">
                                            {req.requestId}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-blue-600">
                                            {req.client ? (
                                                (() => {
                                                    const clientId = getClientIdByName(req.client);
                                                    return clientId ? (
                                                        <Link
                                                            to={`/clients/${clientId}/view?tab=ta`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="hover:text-blue-800 hover:underline transition-colors"
                                                            title="View Client TA Dashboard"
                                                        >
                                                            {req.client}
                                                        </Link>
                                                    ) : (
                                                        <span>{req.client}</span>
                                                    );
                                                })()
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-800">{req.roleDetails.title}</div>
                                            <div className="text-xs text-slate-500">{req.roleDetails.department} • {req.roleDetails.employmentType}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {format(new Date(req.createdAt), 'dd MMM yyyy')}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/ta/view/${req._id}${(req.status === 'Approved' || req.status === 'Closed') ? '?tab=applications' : ''}`);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {!loading && (
                    <div className="flex justify-end items-center mt-6 gap-4 pr-4">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        >
                            Previous
                        </button>
                        <span className="text-sm font-medium text-slate-600 min-w-[100px] text-center">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HiringRequestList;
