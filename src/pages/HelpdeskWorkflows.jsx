import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Trash2, Save, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const HelpdeskWorkflows = () => {
    const [queryTypes, setQueryTypes] = useState([]);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Editor State
    const [editingId, setEditingId] = useState(null); // 'new' or ID
    const [formData, setFormData] = useState({
        name: '', assignedRole: '', assignedPerson: '',
        enableEscalation: false, escalationDays: 2, escalationRole: '', escalationPerson: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [typesRes, usersRes, rolesRes] = await Promise.all([
                api.get('/helpdesk/types'),
                api.get('/admin/users'), // assuming this endpoint gets all users
                api.get('/admin/roles')
            ]);
            setQueryTypes(typesRes.data.data);
            setUsers(usersRes.data);
            setRoles(rolesRes.data);
        } catch (error) {
            console.error('Failed to fetch data', error);
            toast.error('Failed to load configuration data');
        } finally {
            setLoading(false);
        }
    };

    const handleConfigure = (type = null) => {
        if (type) {
            setEditingId(type._id);
            setFormData({
                name: type.name,
                assignedRole: type.assignedRole?._id || '',
                assignedPerson: type.assignedPerson?._id || '',
                enableEscalation: type.enableEscalation || false,
                escalationDays: type.escalationDays || 2,
                escalationRole: type.escalationRole?._id || '',
                escalationPerson: type.escalationPerson?._id || ''
            });
        } else {
            setEditingId('new');
            setFormData({
                name: '', assignedRole: '', assignedPerson: '',
                enableEscalation: false, escalationDays: 2, escalationRole: '', escalationPerson: ''
            });
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setFormData({
            name: '', assignedRole: '', assignedPerson: '',
            enableEscalation: false, escalationDays: 2, escalationRole: '', escalationPerson: ''
        });
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return toast.error('Name is required');
        if (!formData.assignedPerson) return toast.error('Assigned Responsible Person is required');

        try {
            if (editingId === 'new') {
                await api.post('/helpdesk/types', formData);
                toast.success('Query Type created');
            } else {
                await api.put(`/helpdesk/types/${editingId}`, formData);
                toast.success('Query Type updated');
            }
            handleCancel();
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save Query Type');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this Query Type? Users will no longer be able to select it.')) return;
        try {
            await api.delete(`/helpdesk/types/${id}`);
            toast.success('Query Type deleted');
            fetchData();
        } catch {
            toast.error('Failed to delete Query Type');
        }
    };

    if (loading) return <div className="p-6 text-slate-500 font-medium">Loading configuration...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-start">
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex items-start text-indigo-800 text-xs flex-1 mr-4">
                    <AlertCircle size={16} className="mr-2 text-indigo-500 shrink-0 mt-0.5" />
                    <p>
                        Map Query Types to a single responsible person. When a ticket matching this type is raised, it is assigned directly to the chosen User.
                    </p>
                </div>
                {!editingId && (
                    <button
                        onClick={() => handleConfigure()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-all shrink-0"
                    >
                        <Plus size={14} /> Add Query Type
                    </button>
                )}
            </div>

            {editingId ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 shadow-indigo-100/40">
                    <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center">
                            {editingId === 'new' ? 'Create Query Type' : 'Edit Query Type'}
                        </h3>
                        <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Query Type Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none font-medium text-slate-700"
                                placeholder="e.g., Payroll Setup"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assigned Role</label>
                            <select
                                value={formData.assignedRole}
                                onChange={(e) => {
                                    setFormData({ ...formData, assignedRole: e.target.value, assignedPerson: '' });
                                }}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none font-medium text-slate-700 bg-white"
                            >
                                <option value="">Select Role (Optional)</option>
                                {roles.map(r => (
                                    <option key={r._id} value={r._id}>{r.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assigned Responsible Person</label>
                            <select
                                value={formData.assignedPerson}
                                onChange={(e) => setFormData({ ...formData, assignedPerson: e.target.value })}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none font-medium text-slate-700 bg-white disabled:opacity-50 disabled:bg-slate-50"
                                disabled={!formData.assignedRole && false /* could be optional */}
                            >
                                <option value="">Select User</option>
                                {users
                                    .filter(u => !formData.assignedRole || u.roles.some(r => (r._id || r) === formData.assignedRole))
                                    .map(u => (
                                        <option key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.email})</option>
                                    ))
                                }
                            </select>
                        </div>
                    </div>

                    {/* Escalation Workflow Settings */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                        <div className="flex items-center space-x-3 mb-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.enableEscalation}
                                    onChange={(e) => setFormData({ ...formData, enableEscalation: e.target.checked })}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <span className="text-sm font-bold text-slate-700">Enable Escalation Workflow</span>
                            </label>
                            {formData.enableEscalation && (
                                <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-md shadow-sm">
                                    If unresolved after <strong className="text-indigo-600">{formData.escalationDays} days</strong>, re-assign ticket automatically.
                                </span>
                            )}
                        </div>

                        {formData.enableEscalation && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Escalation Time (Days)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={formData.escalationDays}
                                        onChange={(e) => setFormData({ ...formData, escalationDays: Number(e.target.value) })}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none font-medium text-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Escalate To Role</label>
                                    <select
                                        value={formData.escalationRole}
                                        onChange={(e) => {
                                            setFormData({ ...formData, escalationRole: e.target.value, escalationPerson: '' });
                                        }}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none font-medium text-slate-700 bg-white"
                                    >
                                        <option value="">Select Role (Optional)</option>
                                        {roles.map(r => (
                                            <option key={r._id} value={r._id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Escalate To Person</label>
                                    <select
                                        value={formData.escalationPerson}
                                        onChange={(e) => setFormData({ ...formData, escalationPerson: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none font-medium text-slate-700 bg-white disabled:opacity-50 disabled:bg-slate-50"
                                    >
                                        <option value="">Select User</option>
                                        {users
                                            .filter(u => !formData.escalationRole || u.roles.some(r => (r._id || r) === formData.escalationRole))
                                            .map(u => (
                                                <option key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.email})</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-5 mt-5 border-t border-slate-100 gap-2">
                        <button onClick={handleCancel} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-all">
                            <Save size={14} /> Save
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-5 py-3">Query Type</th>
                                <th className="px-5 py-3">Assigned Responsible Person</th>
                                <th className="px-5 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {queryTypes.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                                        No Query Types configured. Click "Add Query Type" to create one.
                                    </td>
                                </tr>
                            )}
                            {queryTypes.map(qt => (
                                <tr key={qt._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-4 font-semibold text-slate-800 text-sm">
                                        {qt.name}
                                    </td>
                                    <td className="px-5 py-4 text-slate-600 font-medium text-sm">
                                        {qt.assignedPerson ? `${qt.assignedPerson.firstName} ${qt.assignedPerson.lastName}` : <span className="text-red-500 text-xs">Unassigned</span>}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <button onClick={() => handleConfigure(qt)} className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded transition-colors mr-2">
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(qt._id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default HelpdeskWorkflows;
