import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { User, Calendar, Check, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const LeaveApprovals = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    const fetchApprovals = async () => {
        try {
            const res = await api.get('/leaves/approvals');
            setRequests(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load approvals');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApprovals();
    }, []);

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

    if (loading) return <div className="p-10 text-center text-slate-500">Loading Approvals...</div>;

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Leave Approvals</h1>
                        <p className="text-sm text-slate-500">Review and action leave requests from your team</p>
                    </div>
                </div>

                {/* Requests List */}
                <div className="grid grid-cols-1 gap-4">
                    {requests.length === 0 ? (
                        <div className="bg-white rounded-xl shadow p-10 text-center">
                            <div className="text-slate-400 mb-2"><Check size={48} className="mx-auto" /></div>
                            <h3 className="text-lg font-bold text-slate-700">All Caught Up!</h3>
                            <p className="text-slate-500">No pending leave requests to review.</p>
                        </div>
                    ) : (
                        requests.map(req => (
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
                                    <button
                                        onClick={() => handleAction(req._id, 'Rejected')}
                                        disabled={!!processingId}
                                        className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors flex items-center disabled:opacity-50"
                                    >
                                        <X size={18} className="mr-1" /> Reject
                                    </button>
                                    <button
                                        onClick={() => handleAction(req._id, 'Approved')}
                                        disabled={!!processingId}
                                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow transition-colors flex items-center disabled:opacity-50"
                                    >
                                        <Check size={18} className="mr-1" /> Approve
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
};

export default LeaveApprovals;
