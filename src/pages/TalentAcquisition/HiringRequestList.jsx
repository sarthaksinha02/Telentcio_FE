import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Plus, Search, Filter, Briefcase, Clock, CheckCircle, XCircle, AlertCircle, Settings } from 'lucide-react';
import { format } from 'date-fns';
import Skeleton from '../../components/Skeleton';

const HiringRequestList = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('Approved'); // Default to Approved
    const navigate = useNavigate();

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const res = await api.get('/ta/hiring-request', {
                params: { status: filterStatus === 'All' ? '' : filterStatus }
            });
            setRequests(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [filterStatus]);

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
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-slate-800">Talent Acquisition</h1>
                    <div className="flex gap-3">
                        <Link
                            to="/ta/workflows"
                            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium text-sm"
                        >
                            <Settings size={18} /> Workflows
                        </Link>
                        {(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.create')) && (
                            <Link
                                to="/ta/create-request"
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium text-sm"
                            >
                                <Plus size={18} /> Raising Requisition
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto p-6">
                {/* Filter Section */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-6">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-slate-600">
                            <Filter size={16} />
                            <span className="text-sm font-medium">Filter by Status:</span>
                        </div>
                        <div className="flex gap-2">
                            {['All', 'Pending', 'Draft', 'Approved', 'Closed'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status === 'All' ? 'All' : status === 'Pending' ? 'Pending_Approval' : status)}
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
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
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
                                    <tr key={req._id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-slate-700">
                                            {req.requestId}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-blue-600">
                                            {req.client || '-'}
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
                                            <button
                                                onClick={() => navigate(`/ta/view/${req._id}`)}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                                            >
                                                View Details
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
    );
};

export default HiringRequestList;
