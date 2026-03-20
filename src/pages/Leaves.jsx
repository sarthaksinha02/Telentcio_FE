import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
    Calendar, Plus, RefreshCw, User, CheckCircle, XCircle,
    Check, X, Infinity, ChevronDown, Clock, AlertCircle, Layers,
    Eye, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/Button';
import { format } from 'date-fns';

// ─── Donut Chart for Balance Card ────────────────────────────────────────────
const DonutChart = ({ utilized, total, isUnlimited }) => {
    const r = 28;
    const circ = 2 * Math.PI * r;
    const pct = isUnlimited ? 0 : Math.min((utilized / (total || 1)) * 100, 100);
    const offset = circ - (pct / 100) * circ;
    const available = isUnlimited ? '∞' : Math.max(total - utilized, 0);

    return (
        <div className="relative flex items-center justify-center w-20 h-20">
            <svg className="-rotate-90 w-20 h-20" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r={r} stroke="#EFF0F3" strokeWidth="7" fill="none" />
                <circle
                    cx="36" cy="36" r={r}
                    stroke={isUnlimited ? '#22c55e' : pct > 80 ? '#ef4444' : '#1a73e8'}
                    strokeWidth="7" fill="none"
                    strokeDasharray={circ}
                    strokeDashoffset={isUnlimited ? circ : offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold text-gray-800 leading-none">{available}</span>
                <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide mt-0.5">Left</span>
            </div>
        </div>
    );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const styles = {
        Approved: 'bg-green-50 text-green-700 border border-green-200',
        Rejected: 'bg-red-50 text-red-600 border border-red-200',
        Pending: 'bg-amber-50 text-amber-700 border border-amber-200',
        Cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
    };
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] || styles.Cancelled}`}>
            {status === 'Approved' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
            {status === 'Pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />}
            {status === 'Rejected' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
            {status === 'Cancelled' && <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />}
            {status}
        </span>
    );
};

// ─── Leaves Page ──────────────────────────────────────────────────────────────
const Leaves = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('my-leaves');

    const [balances, setBalances] = useState([]);
    const [requests, setRequests] = useState([]);
    const [requestsPagination, setRequestsPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const [approvalRequests, setApprovalRequests] = useState([]);
    const [loadingApprovals, setLoadingApprovals] = useState(false);
    const [approvalsLoaded, setApprovalsLoaded] = useState(false);
    const [approvalStatusFilter, setApprovalStatusFilter] = useState('Pending');
    const [processingId, setProcessingId] = useState(null);
    const [cancellingId, setCancellingId] = useState(null);
    const [formData, setFormData] = useState({
        leaveType: '', startDate: '', endDate: '',
        isHalfDay: false, halfDaySession: 'First Half', reason: ''
    });
    const [expandedRows, setExpandedRows] = useState([]);

    const toggleRowExpansion = (id) => {
        setExpandedRows(prev => 
            prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
        );
    };

    const [proofFile, setProofFile] = useState(null);

    const isAdminUser = user?.roles?.some(r => (typeof r === 'string' ? r : r?.name) === 'Admin')
        || user?.permissions?.includes('*');
    const isManager = (user?.directReportsCount ?? user?.directReports?.length ?? 0) > 0;
    const hasApprovalAccess = isAdminUser || isManager;


    const fetchData = async (page = 1, skipCache = false) => {
        // Cache Key: Scoped by User and Date
        const CACHE_KEY = `leaves_${user?._id}_${new Date().toISOString().slice(0, 10)}`;

        const readCache = () => {
            try {
                const raw = sessionStorage.getItem(CACHE_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed?.data?.balances) {
                    sessionStorage.removeItem(CACHE_KEY);
                    return null;
                }
                return parsed;
            } catch { return null; }
        };

        const writeCache = (data, fingerprint) => {
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, fingerprint }));
            } catch { /* Silently fail if storage full */ }
        };

        const buildFingerprint = (data) => {
            if (!data) return '';
            const balPart = data.balances?.map(b => `${b.leaveType}:${b.utilized}:${b.closingBalance}`).join('|') || '';
            const reqPart = data.requests?.map(r => `${r._id}:${r.status}`).join('|') || '';
            return `${balPart}#${reqPart}`;
        };

        const applyData = (data) => {
            if (data.balances) setBalances(data.balances);
            if (data.requests) setRequests(data.requests);
            if (data.pagination) setRequestsPagination(data.pagination);
        };

        const cached = skipCache ? null : readCache();

        // 1. Show cached data instantly if available
        if (!skipCache && cached?.data && page === 1) {
            applyData(cached.data);
            setLoading(false);
        } else {
            setLoading(true);
        }

        // 2. Fetch fresh data
        try {
            const [balRes, reqRes] = await Promise.all([
                api.get('/leaves/balance'),
                api.get(`/leaves/requests?page=${page}&limit=10`)
            ]);

            const payload = {
                balances: balRes.data,
                requests: reqRes.data.data,
                pagination: reqRes.data.pagination
            };

            const freshFingerprint = buildFingerprint(payload);
            const cachedFingerprint = cached?.fingerprint || (readCache()?.fingerprint || '');

            if (freshFingerprint !== cachedFingerprint || page !== 1) {
                applyData(payload);
                if (page === 1) writeCache(payload, freshFingerprint);
            } else {
                // Refresh cache entry even if fingerprint same to keep it alive
                writeCache(payload, freshFingerprint);
            }
        } catch (err) {
            console.error('Failed to load leave data', err);
            if (!cached?.data) toast.error('Failed to load leave data');
        } finally {
            setLoading(false);
        }
    };

    const fetchOnlyRequests = async (page = 1) => {
        setLoading(true);
        try {
            const reqRes = await api.get(`/leaves/requests?page=${page}&limit=10`);
            setRequests(reqRes.data.data);
            setRequestsPagination(reqRes.data.pagination);
        } catch { toast.error('Failed to load leave history'); }
        finally { setLoading(false); }
    };

    const fetchApprovals = async (force = false, status = approvalStatusFilter) => {
        if (!hasApprovalAccess || (approvalsLoaded && !force && status === approvalStatusFilter)) return;
        setLoadingApprovals(true);
        try {
            const url = status === 'All' ? '/leaves/approvals?status=All' : `/leaves/approvals?status=${status}`;
            const res = await api.get(url);
            setApprovalRequests(res.data);
            setApprovalsLoaded(true);
            setApprovalStatusFilter(status);
        } catch { toast.error('Failed to load approvals'); }
        finally { setLoadingApprovals(false); }
    };

    useEffect(() => {
        if (user?._id) {
            fetchData(1);

            // Add background polling for real-time leave status updates
            const pollInterval = setInterval(() => fetchData(1, true), 30000);
            return () => clearInterval(pollInterval);
        }
    }, [user?._id]);

    const handleChange = (e) => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData(prev => ({ ...prev, [e.target.name]: val }));
    };

    const handleFileChange = (e) => {
        setProofFile(e.target.files[0] || null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setProcessingId('apply');
        try {
            const submitData = { ...formData };

            // Upload proof document if selected
            if (proofFile) {
                const uploadData = new FormData();
                uploadData.append('file', proofFile);
                const uploadRes = await api.post('/upload', uploadData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                submitData.documents = [uploadRes.data.url];
            }

            await api.post('/leaves/apply', submitData);
            toast.success('Leave applied successfully');
            setShowModal(false);
            setFormData({ leaveType: '', startDate: '', endDate: '', isHalfDay: false, halfDaySession: 'First Half', reason: '' });
            setProofFile(null);
            fetchData(1);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Application failed');
        } finally {
            setProcessingId(null);
        }
    };

    const handleAction = async (id, status) => {
        if (!confirm(`Are you sure you want to ${status} this request?`)) return;
        let rejectionReason = '';
        if (status === 'Rejected') {
            rejectionReason = prompt('Enter rejection reason:');
            if (!rejectionReason) return;
        }
        setProcessingId(id);
        try {
            await api.put(`/leaves/approve/${id}`, { status, rejectionReason });
            toast.success(`Request ${status}`);
            fetchApprovals(true); // Force refresh after action
        } catch (err) { toast.error(err.response?.data?.message || 'Action failed'); }
        finally { setProcessingId(null); }
    };

    const handleCancel = async (id) => {
        if (!confirm('Cancel this leave request?')) return;
        setCancellingId(id);
        try {
            await api.put(`/leaves/cancel/${id}`);
            toast.success('Leave cancelled');
            fetchData(requestsPagination.page);
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to cancel'); }
        finally { setCancellingId(null); }
    };

    if (loading && balances.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">Loading leave data…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f4f5f8] font-sans">
            {/* ── Top Bar ── */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 tracking-tight">Leave Management</h1>
                    <p className="text-xs text-gray-400 mt-0.5">Apply and manage your leave requests</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            fetchData(1);
                            if (activeTab === 'approvals') fetchApprovals(true);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={15} />
                    </button>
                    {activeTab === 'my-leaves' && (
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
                        >
                            <Plus size={15} /> Apply Leave
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tab Bar ── */}
            {hasApprovalAccess && (
                <div className="bg-white border-b border-gray-200 px-6 flex gap-1">
                    {[
                        { id: 'my-leaves', label: 'My Leaves', icon: <User size={14} /> },
                        { id: 'approvals', label: 'Team Approvals', icon: <CheckCircle size={14} />, badge: approvalRequests.length },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                if (tab.id === 'approvals') fetchApprovals();
                            }}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-[#1a73e8] text-[#1a73e8]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab.icon} {tab.label}
                            {tab.badge > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">

                {/* ════════════ MY LEAVES TAB ════════════ */}
                {activeTab === 'my-leaves' && (
                    <>
                        {/* ── Balance Cards ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {balances.map(b => {
                                const total = b.openingBalance + b.accrued;
                                const available = b.policyAccrualAmount === 0 ? '∞' : Math.max(total - b.utilized, 0);
                                const isUnlim = b.policyAccrualAmount === 0;
                                const pct = isUnlim ? 0 : Math.min((b.utilized / (total || 1)) * 100, 100);
                                const accentColor = isUnlim
                                    ? 'border-l-green-500'
                                    : pct > 80
                                        ? 'border-l-red-400'
                                        : 'border-l-[#1a73e8]';

                                return (
                                    <div
                                        key={b.leaveType}
                                        className={`bg-white rounded-xl border border-gray-200 border-l-4 ${accentColor} p-5 flex items-center justify-between hover:shadow-md transition-shadow`}
                                    >
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">{b.policyName}</span>
                                            <span className="text-xs text-gray-400 font-mono">{b.leaveType}</span>
                                            {!isUnlim && (
                                                <div className="mt-2 space-y-0.5">
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span className="w-16 text-gray-400">Allocated</span>
                                                        <span className="font-semibold text-gray-700">{total}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span className="w-16 text-gray-400">Used</span>
                                                        <span className="font-semibold text-gray-700">{b.utilized}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="w-16 text-gray-400">Available</span>
                                                        <span className={`font-bold ${pct > 80 ? 'text-red-500' : 'text-[#1a73e8]'}`}>{available}</span>
                                                    </div>
                                                </div>
                                            )}
                                            {isUnlim && (
                                                <span className="mt-2 text-xs text-green-600 font-semibold">Unlimited</span>
                                            )}
                                        </div>
                                        <DonutChart utilized={b.utilized} total={total} isUnlimited={isUnlim} />
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── Leave History Table ── */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Layers size={16} className="text-gray-400" />
                                    <h2 className="text-sm font-bold text-gray-700">My Leave History</h2>
                                    <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">{requestsPagination.total}</span>
                                </div>
                            </div>

                            {requests.length === 0 ? (
                                <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
                                    <Calendar size={40} className="text-gray-300" />
                                    <p className="text-sm font-medium">No leave requests found</p>
                                    <p className="text-xs text-gray-300">Click "Apply Leave" to submit your first request</p>
                                </div>
                            ) : (
                                <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100">
                                                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">From</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">To</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Days</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Reason</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Applied On</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {requests.map(req => (
                                                <tr key={req._id} className="hover:bg-gray-50 transition-colors group">
                                                    <td className="px-6 py-3.5">
                                                        <span className="inline-block bg-blue-50 text-[#1a73e8] text-xs font-bold px-2 py-1 rounded border border-blue-100">
                                                            {req.leaveType}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-gray-700 font-medium whitespace-nowrap">
                                                        {format(new Date(req.startDate), 'dd MMM yyyy')}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap">
                                                        {format(new Date(req.endDate), 'dd MMM yyyy')}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-gray-700">
                                                        <span className="font-semibold">{req.daysCount}</span>
                                                        <span className="text-gray-400 text-xs ml-1">{req.isHalfDay ? '(½)' : 'd'}</span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-gray-500 w-[200px] min-w-[200px] max-w-[200px]">
                                                        {expandedRows.includes(req._id) ? (
                                                            <div className="bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap break-words animate-fade-in">
                                                                {req.reason}
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs truncate" title={req.reason}>
                                                                {req.reason.length > 60 ? `${req.reason.substring(0, 60)}...` : req.reason}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">
                                                        {format(new Date(req.createdAt), 'dd MMM yyyy')}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <StatusBadge status={req.status} />
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {req.status === 'Pending' && (
                                                                <button
                                                                    onClick={() => handleCancel(req._id)}
                                                                    disabled={cancellingId === req._id}
                                                                    className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700 font-semibold transition-all disabled:opacity-40"
                                                                >
                                                                    {cancellingId === req._id ? 'Cancelling…' : 'Cancel'}
                                                                </button>
                                                            )}
                                                            <button 
                                                                onClick={() => toggleRowExpansion(req._id)}
                                                                className={`p-1 rounded transition-colors ${expandedRows.includes(req._id) ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-50'}`}
                                                                title="Toggle Reason"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                                    <span className="text-xs text-gray-500 font-medium">
                                        Showing page <span className="text-gray-900 font-bold">{requestsPagination.page}</span> of <span className="text-gray-900 font-bold">{requestsPagination.totalPages}</span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => fetchOnlyRequests(requestsPagination.page - 1)}
                                            disabled={requestsPagination.page === 1}
                                            className="px-3 py-1 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => fetchOnlyRequests(requestsPagination.page + 1)}
                                            disabled={requestsPagination.page === requestsPagination.totalPages}
                                            className="px-3 py-1 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                                </>
                            )}
                        </div>

                    </>
                )}

                {/* ════════════ APPROVALS TAB ════════════ */}
                {activeTab === 'approvals' && hasApprovalAccess && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold text-gray-700">Team Requests & History</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Review and track leave requests across your team</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center p-1 bg-gray-100 rounded-lg">
                                    {['Pending', 'Approved', 'Rejected', 'All'].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => fetchApprovals(true, s)}
                                            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${approvalStatusFilter === s
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-400 hover:text-gray-600'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => fetchApprovals(true)} 
                                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                                >
                                    <RefreshCw size={12} className={loadingApprovals ? 'animate-spin' : ''} /> Refresh
                                </button>
                            </div>
                        </div>

                        {loadingApprovals ? (
                            <div className="bg-white rounded-xl border border-gray-200 py-16 flex justify-center">
                                <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : approvalRequests.length === 0 ? (
                            <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 flex flex-col items-center gap-3 text-gray-400">
                                <CheckCircle size={40} className="text-green-300" />
                                <p className="text-sm font-semibold text-gray-600">All caught up!</p>
                                <p className="text-xs">No pending leave requests from your team.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Duration</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Days</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Reason</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                            <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {approvalRequests.map(req => (
                                            <tr key={req._id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                            {req.user.firstName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-800 text-sm">{req.user.firstName} {req.user.lastName}</p>
                                                            <p className="text-xs text-gray-400 font-mono">{req.user.employeeCode}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="bg-blue-50 text-[#1a73e8] text-xs font-bold px-2 py-1 rounded border border-blue-100">
                                                        {req.leaveType}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-gray-600 text-xs whitespace-nowrap">
                                                    <div>{format(new Date(req.startDate), 'dd MMM')}</div>
                                                    <div className="text-gray-400">→ {format(new Date(req.endDate), 'dd MMM yyyy')}</div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className={`inline-flex items-center gap-1 font-bold text-sm ${req.daysCount > 3 ? 'text-orange-600' : 'text-gray-700'}`}>
                                                        {req.daysCount}d
                                                        {req.daysCount > 3 && <AlertCircle size={12} className="text-orange-400" />}
                                                    </span>
                                                    {req.isHalfDay && <span className="text-xs text-gray-400 block">(Half day)</span>}
                                                </td>
                                                <td className="px-4 py-4 text-gray-500 w-[180px] min-w-[180px] max-w-[180px]">
                                                    {expandedRows.includes(req._id) ? (
                                                        <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/30 text-[11px] leading-relaxed text-gray-600 whitespace-pre-wrap break-words animate-fade-in shadow-inner">
                                                            {req.reason}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[11px] truncate" title={req.reason}>
                                                            {req.reason.length > 60 ? `${req.reason.substring(0, 60)}...` : req.reason}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <StatusBadge status={req.status} />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => toggleRowExpansion(req._id)}
                                                            className={`p-1 rounded transition-colors ${expandedRows.includes(req._id) ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-50'}`}
                                                            title="Toggle Reason"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        {req.status === 'Pending' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleAction(req._id, 'Rejected')}
                                                                    disabled={processingId === req._id}
                                                                    className="flex items-center gap-1 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                                                >
                                                                    <X size={13} /> Reject
                                                                </button>
                                                                <button
                                                                    onClick={() => handleAction(req._id, 'Approved')}
                                                                    disabled={processingId === req._id}
                                                                    className="flex items-center gap-1 text-xs font-semibold text-white bg-[#1a73e8] hover:bg-[#1557b0] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                                                                >
                                                                    <Check size={13} /> Approve
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ════════════ APPLY MODAL ════════════ */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                        {/* Modal Header */}
                        <div className="bg-[#1a73e8] px-6 py-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-white font-bold text-base">Apply for Leave</h3>
                                    <p className="text-blue-200 text-xs mt-0.5">Fill in your leave request details</p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-blue-200 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Leave Type */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Leave Type</label>
                                <select
                                    name="leaveType" value={formData.leaveType} onChange={handleChange}
                                    required
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/30 focus:border-[#1a73e8] transition bg-white"
                                >
                                    <option value="">— Select leave type —</option>
                                    {balances.map(b => (
                                        <option key={b.leaveType} value={b.leaveType}>
                                            {b.policyName} — Balance: {b.policyAccrualAmount === 0 ? 'Unlimited' : `${b.closingBalance} days`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">From Date</label>
                                    <input
                                        type="date" name="startDate" value={formData.startDate} onChange={handleChange} required
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/30 focus:border-[#1a73e8] transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">To Date</label>
                                    <input
                                        type="date" name="endDate" value={formData.endDate} onChange={handleChange} required
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/30 focus:border-[#1a73e8] transition"
                                    />
                                </div>
                            </div>

                            {/* Half Day Toggle */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div
                                    onClick={() => setFormData(p => ({ ...p, isHalfDay: !p.isHalfDay }))}
                                    className={`relative w-9 h-5 rounded-full cursor-pointer transition-colors ${formData.isHalfDay ? 'bg-[#1a73e8]' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${formData.isHalfDay ? 'left-[18px]' : 'left-0.5'}`} />
                                </div>
                                <span className="text-sm font-medium text-gray-700">Half Day Leave</span>
                            </div>

                            {formData.isHalfDay && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Session</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['First Half', 'Second Half'].map(s => (
                                            <button
                                                key={s} type="button"
                                                onClick={() => setFormData(p => ({ ...p, halfDaySession: s }))}
                                                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${formData.halfDaySession === s ? 'bg-[#e8f0fe] border-[#1a73e8] text-[#1a73e8]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Optional / Required Document Upload */}
                            {(() => {
                                const policy = balances.find(b => b.leaveType === formData.leaveType);
                                if (!policy || !policy.proofRequiredAbove) return null;

                                let daysCount = 0;
                                if (formData.startDate && formData.endDate) {
                                    const s = new Date(formData.startDate);
                                    const e = new Date(formData.endDate);
                                    if (s <= e) {
                                        if (formData.isHalfDay) {
                                            daysCount = 0.5;
                                        } else {
                                            // Rough client-side check (backend validates properly)
                                            let d = new Date(s);
                                            while (d <= e) {
                                                if (d.getDay() !== 0 && d.getDay() !== 6) daysCount++;
                                                d.setDate(d.getDate() + 1);
                                            }
                                        }
                                    }
                                }

                                const isRequired = daysCount > policy.proofRequiredAbove;
                                if (daysCount > 0) {
                                    return (
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex justify-between">
                                                <span>Proof Document</span>
                                                {isRequired ? <span className="text-red-500 font-bold">* Required</span> : <span className="text-gray-400">Optional</span>}
                                            </label>
                                            <input
                                                type="file" accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={handleFileChange}
                                                required={isRequired}
                                                className="w-full text-sm text-gray-500 border border-gray-200 rounded-lg p-2
                                                file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                                                file:text-sm file:font-semibold file:bg-blue-50 file:text-[#1a73e8] hover:file:bg-blue-100 transition"
                                            />
                                            {isRequired && (
                                                <p className="text-[10px] text-red-500 mt-1.5 font-medium">
                                                    You requested {daysCount} days. A medical certificate or proof is required for {policy.leaveType} exceeding {policy.proofRequiredAbove} days.
                                                </p>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Reason */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Reason</label>
                                <textarea
                                    name="reason" rows="3" value={formData.reason} onChange={handleChange}
                                    required placeholder="Briefly describe your reason for leave…"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/30 focus:border-[#1a73e8] transition"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                                <button
                                    type="button" onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={processingId === 'apply'}
                                    className="px-5 py-2 text-sm font-semibold text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {processingId === 'apply' ? 'Processing...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Leaves;
