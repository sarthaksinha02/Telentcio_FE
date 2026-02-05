import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Calendar, Plus, Clock, FileText, CheckCircle, XCircle, AlertCircle, RefreshCw, User, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/Button';

const Leaves = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('my-leaves');

    // My Leaves State
    const [balances, setBalances] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Approvals State
    const [approvalRequests, setApprovalRequests] = useState([]);
    const [loadingApprovals, setLoadingApprovals] = useState(false);
    const [processingId, setProcessingId] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        leaveType: '',
        startDate: '',
        endDate: '',
        isHalfDay: false,
        halfDaySession: 'First Half',
        reason: ''
    });

    const hasApprovalAccess = user?.roles?.includes('Admin') || user?.directReportsCount > 0;

    const fetchData = async () => {
        setLoading(true);
        try {
            const [balanceRes, requestRes] = await Promise.all([
                api.get('/leaves/balance'),
                api.get('/leaves/requests')
            ]);
            setBalances(balanceRes.data);
            setRequests(requestRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load leave data');
        } finally {
            setLoading(false);
        }
    };

    const fetchApprovals = async () => {
        if (!hasApprovalAccess) return;
        setLoadingApprovals(true);
        try {
            const res = await api.get('/leaves/approvals');
            setApprovalRequests(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load approvals');
        } finally {
            setLoadingApprovals(false);
        }
    };

    useEffect(() => {
        fetchData();
        if (hasApprovalAccess) {
            fetchApprovals();
        }
    }, [hasApprovalAccess]);

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/leaves/apply', formData);
            toast.success('Leave Applied Successfully');
            setShowModal(false);
            setFormData({ leaveType: '', startDate: '', endDate: '', isHalfDay: false, halfDaySession: 'First Half', reason: '' }); // Reset
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Application Failed');
        }
    };

    const handleAction = async (id, status) => {
        if (!confirm(`Are you sure you want to ${status} this request?`)) return;

        let rejectionReason = '';
        if (status === 'Rejected') {
            rejectionReason = prompt('Enter Rejection Reason:');
            if (!rejectionReason) return; // Cancel if no reason
        }

        setProcessingId(id);
        try {
            await api.put(`/leaves/approve/${id}`, { status, rejectionReason });
            toast.success(`Request ${status} Successfully`);
            fetchApprovals();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action Failed');
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Approved': return 'bg-emerald-100 text-emerald-700';
            case 'Rejected': return 'bg-red-100 text-red-700';
            case 'Pending': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    if (loading && balances.length === 0) return <div className="p-10 text-center text-slate-500">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Leaves</h1>
                        <p className="text-sm text-slate-500">Manage your leave applications and approvals</p>
                    </div>
                    {activeTab === 'my-leaves' && (
                        <Button onClick={() => setShowModal(true)} className="flex items-center space-x-2 shadow transition-all">
                            <Plus size={18} /> <span>Apply Leave</span>
                        </Button>
                    )}
                </div>

                {/* Tabs */}
                {hasApprovalAccess && (
                    <div className="flex border-b border-slate-200 bg-white rounded-t-lg px-4 pt-2">
                        <button
                            onClick={() => setActiveTab('my-leaves')}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'my-leaves' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <User size={16} /> My Leaves
                        </button>
                        <button
                            onClick={() => setActiveTab('approvals')}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'approvals' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <CheckCircle size={16} /> Approvals <span className="bg-red-100 text-red-600 text-xs py-0.5 px-2 rounded-full ml-1">{approvalRequests.length}</span>
                        </button>
                    </div>
                )}

                {/* Content Area */}
                <div className={hasApprovalAccess ? "bg-white rounded-b-lg shadow-sm border border-t-0 border-slate-200 p-6 min-h-[500px]" : ""}>

                    {activeTab === 'my-leaves' && (
                        <div className="space-y-6">
                            {/* Balances Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {balances.map(balance => (
                                    <div key={balance.leaveType} className="bg-white rounded-xl shadow border border-slate-200 p-6 flex flex-col justify-between h-32 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <Calendar size={64} className="text-blue-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{balance.policyName} ({balance.leaveType})</h3>
                                            <div className="mt-2 flex items-baseline space-x-2">
                                                <span className="text-3xl font-bold text-slate-800">{balance.closingBalance}</span>
                                                <span className="text-sm text-slate-400">Available</span>
                                            </div>
                                        </div>
                                        <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
                                            {/* Simple progress bar simulation */}
                                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(balance.utilized / (balance.openingBalance + balance.accrued)) * 100}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Leave History */}
                            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 flex items-center">
                                        <Clock size={16} className="mr-2 text-slate-400" /> Recent Applications
                                    </h3>
                                    <button onClick={fetchData} className="text-slate-400 hover:text-slate-600"><RefreshCw size={14} /></button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-3">Type</th>
                                                <th className="px-6 py-3">Dates</th>
                                                <th className="px-6 py-3">Days</th>
                                                <th className="px-6 py-3">Reason</th>
                                                <th className="px-6 py-3">Applied On</th>
                                                <th className="px-6 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {requests.length === 0 ? (
                                                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-400 italic">No leave requests found</td></tr>
                                            ) : (
                                                requests.map(req => (
                                                    <tr key={req._id} className="hover:bg-slate-50/50">
                                                        <td className="px-6 py-3 font-medium text-slate-700">{req.leaveType}</td>
                                                        <td className="px-6 py-3 text-slate-600">
                                                            {new Date(req.startDate).toLocaleDateString()}
                                                            {req.startDate !== req.endDate && ` - ${new Date(req.endDate).toLocaleDateString()}`}
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-600">{req.daysCount}</td>
                                                        <td className="px-6 py-3 text-slate-600 truncate max-w-xs">{req.reason}</td>
                                                        <td className="px-6 py-3 text-slate-500 text-xs">{new Date(req.createdAt).toLocaleDateString()}</td>
                                                        <td className="px-6 py-3">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(req.status)}`}>
                                                                {req.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'approvals' && hasApprovalAccess && (
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-700">Pending Approvals</h3>
                                <button onClick={fetchApprovals} className="text-slate-400 hover:text-slate-600"><RefreshCw size={14} /></button>
                            </div>
                            {approvalRequests.length === 0 ? (
                                <div className="bg-white rounded-xl shadow p-10 text-center border border-slate-200">
                                    <div className="text-slate-400 mb-2"><Check size={48} className="mx-auto" /></div>
                                    <h3 className="text-lg font-bold text-slate-700">All Caught Up!</h3>
                                    <p className="text-slate-500">No pending leave requests to review.</p>
                                </div>
                            ) : (
                                approvalRequests.map(req => (
                                    <div key={req._id} className="bg-white rounded-xl shadow border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 relative overflow-hidden">
                                        {req.daysCount > 3 && <div className="absolute top-0 right-0 bg-orange-100 text-orange-600 px-3 py-1 text-xs font-bold rounded-bl-lg">Long Leave</div>}

                                        <div className="flex items-center space-x-4 w-full md:w-auto">
                                            <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                                                {req.user.firstName.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg">{req.user.firstName} {req.user.lastName}</h3>
                                                <div className="text-sm text-slate-500 flex items-center space-x-2">
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{req.user.employeeCode}</span>
                                                    <span>•</span>
                                                    <span className="text-blue-600 font-medium">{req.leaveType}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 px-4 md:px-10 border-l border-slate-100 mx-4">
                                            <div className="flex items-center space-x-2 text-slate-700 font-medium mb-1">
                                                <Calendar size={18} className="text-slate-400" />
                                                <span>{new Date(req.startDate).toLocaleDateString()}</span>
                                                <span className="text-slate-400">-</span>
                                                <span>{new Date(req.endDate).toLocaleDateString()}</span>
                                                <span className="text-xs bg-slate-100 text-slate-500 px-2 rounded-full">
                                                    {req.daysCount} Days {req.isHalfDay && '(Half Day)'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 italic">"{req.reason}"</p>
                                        </div>

                                        <div className="flex space-x-3 w-full md:w-auto justify-end">
                                            <div className="flex space-x-3 w-full md:w-auto justify-end">
                                                <Button
                                                    onClick={() => handleAction(req._id, 'Rejected')}
                                                    isLoading={processingId === req._id}
                                                    variant="danger"
                                                    className="px-4 py-2 border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg font-medium transition-colors flex items-center"
                                                >
                                                    <X size={18} className="mr-1" /> Reject
                                                </Button>
                                                <Button
                                                    onClick={() => handleAction(req._id, 'Approved')}
                                                    isLoading={processingId === req._id}
                                                    className="px-6 py-2 rounded-lg font-bold shadow transition-colors flex items-center"
                                                >
                                                    <Check size={18} className="mr-1" /> Approve
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Apply Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-blob">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="font-bold text-slate-800">Apply for Leave</h3>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="zoho-label">Leave Type</label>
                                    <select name="leaveType" value={formData.leaveType} onChange={handleChange} className="zoho-input" required>
                                        <option value="">Select Type</option>
                                        {balances.map(b => (
                                            <option key={b.leaveType} value={b.leaveType}>{b.policyName} (Bal: {b.closingBalance})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="zoho-label">From Date</label>
                                        <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="zoho-input" required />
                                    </div>
                                    <div>
                                        <label className="zoho-label">To Date</label>
                                        <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} className="zoho-input" required />
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 py-2">
                                    <input type="checkbox" name="isHalfDay" checked={formData.isHalfDay} onChange={handleChange} className="rounded text-blue-600 focus:ring-blue-500" />
                                    <span className="text-sm font-medium text-slate-700">Half Day?</span>
                                </div>

                                {formData.isHalfDay && (
                                    <div>
                                        <label className="zoho-label">Session</label>
                                        <select name="halfDaySession" value={formData.halfDaySession} onChange={handleChange} className="zoho-input">
                                            <option value="First Half">First Half</option>
                                            <option value="Second Half">Second Half</option>
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="zoho-label">Reason</label>
                                    <textarea name="reason" rows="3" value={formData.reason} onChange={handleChange} className="zoho-input" required placeholder="Reason for leave..."></textarea>
                                </div>

                                <div className="flex justify-end pt-2 space-x-2">
                                    <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="px-4 py-2">Cancel</Button>
                                    <Button type="submit" className="px-6 py-2 shadow">Submit Application</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Leaves;
