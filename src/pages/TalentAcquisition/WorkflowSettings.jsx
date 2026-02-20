import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Plus, Trash2, Save, X, Check, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

const WorkflowSettings = () => {
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);

    // New Workflow State
    const [newName, setNewName] = useState('');
    const [levels, setLevels] = useState([{ levelCheck: 1, role: '', approvers: [], isFinal: false }]);

    useEffect(() => {
        fetchWorkflows();
        fetchUsers();
        fetchRoles();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const res = await api.get('/workflows');
            setWorkflows(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/admin/users');
            setUsers(res.data);
        } catch (error) {
            console.error('Failed to fetch users', error);
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await api.get('/admin/roles');
            setRoles(res.data);
        } catch (error) {
            console.error('Failed to fetch roles', error);
        }
    };

    const handleAddLevel = () => {
        setLevels([...levels, { levelCheck: levels.length + 1, role: '', approvers: [], isFinal: false }]);
    };

    const handleRemoveLevel = (index) => {
        const newLevels = levels.filter((_, i) => i !== index);
        // Re-number levels
        const reordered = newLevels.map((l, i) => ({ ...l, levelCheck: i + 1 }));
        setLevels(reordered);
    };

    const handleLevelChange = (index, field, value) => {
        const newLevels = [...levels];
        newLevels[index][field] = value;
        setLevels(newLevels);
    };

    // Handle multi-select for approvers
    const handleApproverChange = (index, userId) => {
        const newLevels = [...levels];
        const currentApprovers = newLevels[index].approvers || [];

        if (currentApprovers.includes(userId)) {
            newLevels[index].approvers = currentApprovers.filter(id => id !== userId);
        } else {
            newLevels[index].approvers = [...currentApprovers, userId];
        }
        setLevels(newLevels);
    };

    const handleCreateWorkflow = async () => {
        if (!newName) return toast.error('Workflow name is required');

        // Validate levels
        for (let l of levels) {
            if (!l.role) return toast.error(`Role is required for Level ${l.levelCheck}`);
            // Approvers optional? "any user show dropdown the user to which that role is assign"
            // Let's make it optional, if empty it might mean "Any" (requires backend support) or enforce selection.
            // Be safe, warn if empty but allow? Or require at least one?
            // "make it like i can choose multiple user". 
            // I'll require at least one for now to be safe with backend logic.
            if (!l.approvers || l.approvers.length === 0) return toast.error(`Select at least one approver for Level ${l.levelCheck}`);
        }

        try {
            await api.post('/workflows', {
                name: newName,
                levels
            });
            toast.success('Workflow created');
            setShowCreate(false);
            setNewName('');
            setLevels([{ levelCheck: 1, role: '', approvers: [], isFinal: false }]);
            fetchWorkflows();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            await api.delete(`/workflows/${id}`);
            toast.success('Workflow deactivated');
            fetchWorkflows();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Approval Workflows</h1>
                    <p className="text-slate-500">Configure hiring request approval chains</p>
                </div>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                    {showCreate ? <X size={18} /> : <Plus size={18} />}
                    {showCreate ? 'Cancel' : 'Create Workflow'}
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm mb-6">
                    <h3 className="font-semibold text-lg mb-4">New Workflow</h3>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Workflow Name</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-100 outline-none"
                            placeholder="e.g., Standard Hiring Approval"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Approval Levels</label>
                        <div className="space-y-3">
                            {levels.map((level, index) => {
                                // Filter users who have the selected role? 
                                // "show dropdown the user to which that role is assign"
                                // Yes, filter users based on level.role
                                const roleUsers = users.filter(u => u.roles && u.roles.some(r => r._id === level.role || r === level.role));
                                // Depending on how users are fetched, roles might be populated or just IDs. 
                                // userController getUsers populates roles ('name' only?).
                                // Wait, getUsers populates 'roles' with 'name'. It doesn't give ID? 
                                // Let's check userController.js: .populate('roles', 'name')
                                // So u.roles is array of objects { _id, name }. 
                                // level.role is ID from select value.

                                return (
                                    <div key={index} className="flex flex-col gap-3 bg-slate-50 p-4 rounded-md border border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                    {level.levelCheck}
                                                </div>
                                                <span className="font-semibold text-sm text-slate-700">Level {level.levelCheck}</span>
                                            </div>
                                            {index > 0 && (
                                                <button onClick={() => handleRemoveLevel(index)} className="text-red-500 hover:text-red-700">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                                                <select
                                                    value={level.role}
                                                    onChange={(e) => {
                                                        handleLevelChange(index, 'role', e.target.value);
                                                        handleLevelChange(index, 'approvers', []); // Reset approvers on role change
                                                    }}
                                                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
                                                >
                                                    <option value="">Select Role</option>
                                                    {roles.map(r => (
                                                        <option key={r._id} value={r._id}>{r.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Approvers (Select Multiple)</label>
                                                <div className="border border-slate-300 rounded-md max-h-32 overflow-y-auto bg-white p-2">
                                                    {level.role ? (
                                                        roleUsers.length > 0 ? (
                                                            roleUsers.map(u => (
                                                                <div key={u._id} className="flex items-center gap-2 mb-1 last:mb-0">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`lvl-${index}-u-${u._id}`}
                                                                        checked={level.approvers?.includes(u._id)}
                                                                        onChange={() => handleApproverChange(index, u._id)}
                                                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                    <label htmlFor={`lvl-${index}-u-${u._id}`} className="text-sm text-slate-700 cursor-pointer select-none">
                                                                        {u.firstName} {u.lastName}
                                                                    </label>
                                                                </div>
                                                            ))
                                                        ) : <p className="text-xs text-slate-400 italic p-1">No users found with this role.</p>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic p-1">So select a role first.</p>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1">{level.approvers?.length || 0} selected</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <button onClick={handleAddLevel} className="mt-3 text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1">
                            <Plus size={16} /> Add Level
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleCreateWorkflow}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                        >
                            <Save size={18} /> Save Workflow
                        </button>
                    </div>
                </div>
            )}

            {/* Workflow List */}
            <div className="grid gap-4">
                {loading ? (
                    <p>Loading...</p>
                ) : workflows.map(wf => (
                    <div key={wf._id} className={`bg-white p-6 rounded-lg border ${wf.isActive ? 'border-slate-200' : 'border-red-100 bg-red-50'} shadow-sm`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">{wf.name}</h3>
                                <p className="text-xs text-slate-500">Created: {new Date(wf.createdAt).toLocaleDateString()}</p>
                            </div>
                            {wf.isActive && (
                                <button onClick={() => handleDelete(wf._id)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            {wf.levels.map((lvl, i) => (
                                <React.Fragment key={i}>
                                    <div className="flex flex-col items-center min-w-[140px]">
                                        <div className="bg-white border border-slate-300 rounded-lg p-3 text-center w-full relative">
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full border border-slate-200">
                                                L{lvl.levelCheck}
                                            </div>
                                            <div className="font-semibold text-sm text-slate-800 mt-1">{lvl.role?.name || 'Unknown Role'}</div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {lvl.approvers && lvl.approvers.length > 0
                                                    ? `${lvl.approvers.length} Approver(s)`
                                                    : 'Any'}
                                            </div>
                                            {/* Hover to see names? Simple title attribute for now */}
                                            <div className="text-[10px] text-slate-400 truncate max-w-[120px]" title={lvl.approvers?.map(a => `${a.firstName} ${a.lastName}`).join(', ')}>
                                                {lvl.approvers?.map(a => a.firstName).join(', ')}
                                            </div>
                                        </div>
                                    </div>
                                    {i < wf.levels.length - 1 && <ArrowRight className="text-slate-300 flex-shrink-0" />}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WorkflowSettings;
