import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Settings, Edit2, Shield, Plus, Check, X, AlertCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';

const LeaveConfig = () => {
    const { user } = useAuth();
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPolicy, setEditingPolicy] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const [formData, setFormData] = useState({
        leaveType: '', name: '', description: '', isPaid: true,
        accrualType: 'Monthly', accrualAmount: 0,
        maxLimitPerYear: 0, carryForward: false, maxCarryForward: 0,
        sandwichRule: false, allowNegativeBalance: false,
        allowBackdated: true, proRata: true, proofRequiredAbove: 0
    });

    const fetchPolicies = async () => {
        try {
            const cacheKey = `leave_config_data_${user?._id}`;
            const cachedData = sessionStorage.getItem(cacheKey);
            
            if (cachedData) {
                setPolicies(JSON.parse(cachedData).policies);
                setLoading(false);
            }

            const res = await api.get('/leaves/config');
            const policiesData = res.data;

            // Fingerprint check
            const newFingerprint = JSON.stringify({ l: policiesData.length, lp: policiesData[0]?._id });
            const oldFingerprint = cachedData ? JSON.parse(cachedData).fingerprint : null;

            if (newFingerprint !== oldFingerprint) {
                setPolicies(policiesData);
                sessionStorage.setItem(cacheKey, JSON.stringify({ 
                    policies: policiesData, 
                    fingerprint: newFingerprint 
                }));
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load policies');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicies();
    }, []);

    const handleCreate = () => {
        setEditingPolicy(null);
        setFormData({
            leaveType: '', name: '', description: '', isPaid: true,
            employeeTypes: [],
            accrualType: 'Monthly', accrualAmount: 0,
            maxLimitPerYear: 0, carryForward: false, maxCarryForward: 0,
            sandwichRule: false, allowNegativeBalance: false,
            allowBackdated: true, proRata: true, proofRequiredAbove: 0
        });
        setShowModal(true);
    };

    const handleEdit = (policy) => {
        setEditingPolicy(policy);
        setFormData({
            leaveType: policy.leaveType,
            name: policy.name,
            description: policy.description || '',
            employeeTypes: policy.employeeTypes?.filter(t => t !== 'All') || [],
            isPaid: policy.isPaid,
            accrualType: policy.accrualType,
            accrualAmount: policy.accrualAmount,
            maxLimitPerYear: policy.maxLimitPerYear,
            carryForward: policy.carryForward,
            maxCarryForward: policy.maxCarryForward,
            sandwichRule: policy.sandwichRule,
            allowNegativeBalance: policy.allowNegativeBalance,
            allowBackdated: policy.allowBackdated,
            proRata: policy.proRata ?? true,
            proofRequiredAbove: policy.proofRequiredAbove || 0
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this policy? This action cannot be undone.')) return;
        try {
            await api.delete(`/leaves/config/${id}`);
            toast.success('Policy Deleted');
            sessionStorage.removeItem(`leave_config_data_${user?._id}`);
            fetchPolicies();
        } catch (error) {
            toast.error('Failed to delete policy');
        }
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation Rules
        const parsedMaxLimit = Number(formData.maxLimitPerYear);
        const parsedAmount = Number(formData.accrualAmount);
        const parsedMaxCarry = Number(formData.maxCarryForward);

        if (parsedAmount < 0 || parsedMaxLimit < 0 || parsedMaxCarry < 0) {
            return toast.error('Amounts cannot be negative numbers.');
        }

        if (parsedMaxLimit > 365) {
            return toast.error('Max Limit Per Year cannot exceed 365 days.');
        }

        if (formData.accrualType === 'Yearly') {
            if (parsedAmount === 0 && parsedMaxLimit > 0) {
                return toast.error('If Amount is Unlimited (0), the Max Limit must also be Unlimited (0).');
            }
            if (parsedAmount > 0 && parsedMaxLimit > 0 && parsedAmount > parsedMaxLimit) {
                return toast.error('Yearly Initial Amount cannot exceed the Max Limit Per Year.');
            }
        }

        if (formData.carryForward && parsedMaxCarry > parsedMaxLimit && parsedMaxLimit !== 0) {
            return toast.error('Max Carry Forward cannot exceed the Max Limit Per Year.');
        }

        try {
            await api.post('/leaves/config', formData);
            toast.success('Policy Updated Successfully');
            sessionStorage.removeItem(`leave_config_data_${user?._id}`);
            setShowModal(false);
            fetchPolicies();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update policy');
        }
    };

    const seedDefaults = async () => {
        if (!confirm('This will create missing default policies. Continue?')) return;
        try {
            await api.post('/leaves/config/seed');
            toast.success('Defaults Seeded');
            sessionStorage.removeItem(`leave_config_data_${user?._id}`);
            fetchPolicies();
        } catch (error) {
            toast.error('Seed Failed');
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">

                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                            <Settings className="mr-2" /> Leave Policies
                        </h1>
                        <p className="text-sm text-slate-500">Configure rules for different leave types</p>
                    </div>
                    <div className="flex space-x-3">
                        <button onClick={handleCreate} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-all text-sm font-semibold">
                            <Plus size={16} /> <span>Create Policy</span>
                        </button>
                        <button onClick={seedDefaults} className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg shadow transition-all text-sm font-semibold">
                            <Shield size={16} /> <span>Seed Defaults</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {policies.map(policy => (
                        <div key={policy._id} className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <div className="h-8 w-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                                        {policy.leaveType}
                                    </div>
                                    <h3 className="font-bold text-slate-700">{policy.name}</h3>
                                </div>
                                <div className="flex space-x-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(policy)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(policy._id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-4 text-sm">
                                <div className="grid grid-cols-2 gap-y-2 text-slate-600">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-slate-400 uppercase font-bold">Accrual</span>
                                        <span className="font-medium">{policy.accrualType} ({policy.accrualAmount === 0 ? 'Unlimited' : policy.accrualAmount})</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-slate-400 uppercase font-bold">Max / Year</span>
                                        <span className="font-medium">{policy.maxLimitPerYear || 'Unlimited'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-slate-400 uppercase font-bold">Type</span>
                                        <span className={`font-medium ${policy.isPaid ? 'text-emerald-600' : 'text-red-500'}`}>{policy.isPaid ? 'Paid' : 'Unpaid'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-slate-400 uppercase font-bold">Carry Fwd</span>
                                        <span className="font-medium">{policy.carryForward ? `Yes (Max ${policy.maxCarryForward})` : 'No'}</span>
                                    </div>
                                    <div className="col-span-2 flex flex-col mt-2">
                                        <span className="text-xs text-slate-400 uppercase font-bold">Applicable To</span>
                                        <span className="font-medium text-xs bg-slate-100 p-1 rounded inline-block">
                                            {policy.employeeTypes?.filter(t => t !== 'All').join(', ') || 'None'}
                                        </span>
                                    </div>
                                </div>
                                <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-2">
                                    {policy.sandwichRule && <span className="px-2 py-1 bg-orange-50 text-orange-600 text-xs rounded border border-orange-100 flex items-center"><AlertCircle size={10} className="mr-1" /> Sandwich Rule</span>}
                                    {policy.allowBackdated && <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-xs rounded border border-emerald-100 flex items-center"><Check size={10} className="mr-1" /> Backdated</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Edit Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden animate-blob max-h-[90vh] overflow-y-auto">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <div className="flex items-center space-x-2">
                                    <div className={`h-8 w-8 rounded flex items-center justify-center font-bold ${editingPolicy ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
                                        {editingPolicy ? <Edit2 size={16} /> : <Plus size={16} />}
                                    </div>
                                    <h3 className="font-bold text-slate-800">{editingPolicy ? `Configure ${formData.name}` : 'Create New Policy'}</h3>
                                </div>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 text-2xl leading-none">&times;</button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-6">

                                {/* Base Config */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-2">Basic Settings</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="zoho-label">Code (Unique)</label>
                                            <input
                                                name="leaveType"
                                                value={formData.leaveType}
                                                onChange={(e) => setFormData({ ...formData, leaveType: e.target.value.toUpperCase() })}
                                                className="zoho-input uppercase"
                                                required
                                                disabled={!!editingPolicy}
                                                placeholder="e.g. PL"
                                            />
                                        </div>
                                        <div>
                                            <label className="zoho-label">Name</label>
                                            <input name="name" value={formData.name} onChange={handleChange} className="zoho-input" required />
                                        </div>
                                        <div>
                                            <label className="zoho-label">Is Paid Leave?</label>
                                            <select name="isPaid" value={formData.isPaid} onChange={(e) => setFormData({ ...formData, isPaid: e.target.value === 'true' })} className="zoho-input">
                                                <option value="true">Yes (Paid)</option>
                                                <option value="false">No (Unpaid)</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="zoho-label">Description</label>
                                            <textarea name="description" value={formData.description} onChange={handleChange} className="zoho-input" rows="2" placeholder="Policy details..."></textarea>
                                        </div>
                                    </div>
                                </div>

                                {/* Accrual Settings */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-2">Accrual & Limits</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="zoho-label">Type</label>
                                            <select name="accrualType" value={formData.accrualType} onChange={handleChange} className="zoho-input">
                                                <option value="Monthly">Monthly</option>
                                                <option value="Yearly">Yearly</option>
                                                <option value="Policy">Policy Based</option>
                                                <option value="None">None</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="zoho-label">Amount (0 = Unlimited)</label>
                                            <input type="number" step="0.5" min="0" name="accrualAmount" value={formData.accrualAmount} onChange={handleChange} className="zoho-input" required />
                                        </div>
                                        <div>
                                            <label className="zoho-label">Max / Year (0 = Unlimited)</label>
                                            <input type="number" name="maxLimitPerYear" min="0" max="365" value={formData.maxLimitPerYear} onChange={handleChange} className="zoho-input" />
                                        </div>
                                    </div>
                                </div>

                                {/* Employee Types */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-2">Applicable Employment Types</h4>
                                    <div className="flex flex-wrap gap-4">
                                        {['Full Time', 'Part Time', 'Contract', 'Intern', 'Probation', 'Consultant'].map(type => (
                                            <label key={type} className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.employeeTypes?.includes(type)}
                                                    onChange={(e) => {
                                                        const current = formData.employeeTypes || [];
                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, employeeTypes: [...current, type] });
                                                        } else {
                                                            setFormData({ ...formData, employeeTypes: current.filter(t => t !== type) });
                                                        }
                                                    }}
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-slate-700">{type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Rules */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-2">Business Rules</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input type="checkbox" name="sandwichRule" checked={formData.sandwichRule} onChange={handleChange} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-slate-700">Sandwich Rule (Include Holidays)</span>
                                        </label>
                                        <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input type="checkbox" name="allowBackdated" checked={formData.allowBackdated} onChange={handleChange} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-slate-700">Allow Backdated Application</span>
                                        </label>
                                        <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input type="checkbox" name="carryForward" checked={formData.carryForward} onChange={handleChange} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-slate-700">Allow Carry Forward</span>
                                        </label>
                                        {formData.carryForward && (
                                            <div>
                                                <label className="zoho-label">Max Carry Fwd</label>
                                                <input type="number" name="maxCarryForward" min="0" value={formData.maxCarryForward} onChange={handleChange} className="zoho-input" />
                                            </div>
                                        )}
                                        <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input type="checkbox" name="allowNegativeBalance" checked={formData.allowNegativeBalance} onChange={handleChange} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-slate-700">Allow Negative Balance</span>
                                        </label>
                                        <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input type="checkbox" name="proRata" checked={formData.proRata} onChange={handleChange} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-slate-700">Calculate Pro-Rata (Mid-month joining)</span>
                                        </label>
                                        <div className="flex flex-col justify-center">
                                            <label className="zoho-label">Proof Required Above (Days)</label>
                                            <div className="flex items-center space-x-2">
                                                <input type="number" name="proofRequiredAbove" value={formData.proofRequiredAbove} onChange={handleChange} className="zoho-input flex-1" min="0" />
                                                <span className="text-xs text-slate-400 w-24">0 = Never</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded mr-2">Cancel</button>
                                    <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div >
                )}

            </div >
        </div >
    );
};

export default LeaveConfig;
