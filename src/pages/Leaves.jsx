import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, Plus, Clock, FileText, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const Leaves = () => {
    const [balances, setBalances] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        leaveType: '',
        startDate: '',
        endDate: '',
        isHalfDay: false,
        halfDaySession: 'First Half',
        reason: ''
    });

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

    useEffect(() => {
        fetchData();
    }, []);

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

    const getStatusColor = (status) => {
        switch (status) {
            case 'Approved': return 'bg-emerald-100 text-emerald-700';
            case 'Rejected': return 'bg-red-100 text-red-700';
            case 'Pending': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    if (loading && balances.length === 0) return <div className="p-10 text-center text-slate-500">Loading Leaves...</div>;

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">My Leaves</h1>
                        <p className="text-sm text-slate-500">Manage your leave applications and balances</p>
                    </div>
                    <button onClick={() => setShowModal(true)} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-all">
                        <Plus size={18} /> <span>Apply Leave</span>
                    </button>
                </div>

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

                                <div className="flex justify-end pt-2">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded mr-2">Cancel</button>
                                    <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow">Submit Application</button>
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
