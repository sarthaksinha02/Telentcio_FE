import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Plus, Trash2, Save, X, Check, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

const WorkflowSettings = () => {
    // Tabs Support
    const [activeTab, setActiveTab] = useState('APPROVAL');

    // Shared State
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);

    // ==========================================
    // 1. APPROVAL WORKFLOWS STATE (HIRING APPROVALS)
    // ==========================================
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    
    // Create/Edit Approval State
    const [newName, setNewName] = useState('');
    const [levels, setLevels] = useState([{ levelCheck: 1, role: '', approvers: [], isFinal: false }]);
    const [editingId, setEditingId] = useState(null);

    // ==========================================
    // 2. INTERVIEW WORKFLOWS STATE
    // ==========================================
    const [interviewWorkflows, setInterviewWorkflows] = useState([]);
    const [loadingInterview, setLoadingInterview] = useState(true);
    const [showCreateInterview, setShowCreateInterview] = useState(false);

    // Create/Edit Interview State
    const [newInterviewName, setNewInterviewName] = useState('');
    const [newInterviewDesc, setNewInterviewDesc] = useState('');
    const [interviewRounds, setInterviewRounds] = useState([{ levelCheck: 1, levelName: '', role: '' }]);
    const [editingInterviewId, setEditingInterviewId] = useState(null);


    // Init
    useEffect(() => {
        fetchWorkflows();
        fetchInterviewWorkflows();
        fetchUsers();
        fetchRoles();
    }, []);

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

    // ==========================================
    // APPROVAL WORKFLOWS LOGIC
    // ==========================================
    const fetchWorkflows = async () => {
        try {
            const res = await api.get('/workflows?module=TA');
            setWorkflows(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddLevel = () => setLevels([...levels, { levelCheck: levels.length + 1, role: '', approvers: [], isFinal: false }]);
    const handleRemoveLevel = (index) => {
        const newLevels = levels.filter((_, i) => i !== index);
        setLevels(newLevels.map((l, i) => ({ ...l, levelCheck: i + 1 })));
    };
    const handleLevelChange = (index, field, value) => {
        const newLevels = [...levels];
        newLevels[index][field] = value;
        setLevels(newLevels);
    };
    const handleApproverChange = (index, userId) => {
        const newLevels = [...levels];
        const currentApprovers = newLevels[index].approvers || [];
        if (currentApprovers.includes(userId)) newLevels[index].approvers = currentApprovers.filter(id => id !== userId);
        else newLevels[index].approvers = [...currentApprovers, userId];
        setLevels(newLevels);
    };

    const handleCreateWorkflow = async () => {
        if (!newName) return toast.error('Workflow name is required');
        for (let l of levels) {
            if (!l.role) return toast.error(`Role is required for Level ${l.levelCheck}`);
            if (!l.approvers || l.approvers.length === 0) return toast.error(`Select at least one approver for Level ${l.levelCheck}`);
        }

        try {
            if (editingId) {
                await api.put(`/workflows/${editingId}`, { name: newName, levels, module: 'TA' });
                toast.success('Hiring workflow updated');
            } else {
                await api.post('/workflows', { name: newName, levels, module: 'TA' });
                toast.success('Hiring workflow created');
            }
            setShowCreate(false);
            setEditingId(null);
            setNewName('');
            setLevels([{ levelCheck: 1, role: '', approvers: [], isFinal: false }]);
            fetchWorkflows();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save');
        }
    };

    const handleEdit = (wf) => {
        setEditingId(wf._id);
        setNewName(wf.name);
        setLevels(wf.levels.map(l => ({
            levelCheck: l.levelCheck,
            role: l.role ? (l.role._id || l.role) : '',
            approvers: l.approvers ? l.approvers.map(a => a._id || a) : [],
            isFinal: l.isFinal
        })));
        setShowCreate(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to deactivate this workflow?')) return;
        try {
            await api.delete(`/workflows/${id}`);
            toast.success('Workflow deactivated');
            fetchWorkflows();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    // ==========================================
    // INTERVIEW WORKFLOWS LOGIC
    // ==========================================
    const fetchInterviewWorkflows = async () => {
        try {
            const res = await api.get('/ta/interview-workflows');
            setInterviewWorkflows(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingInterview(false);
        }
    };

    const handleAddInterviewRound = () => setInterviewRounds([...interviewRounds, { levelCheck: interviewRounds.length + 1, levelName: '', role: '', user: '' }]);
    const handleRemoveInterviewRound = (index) => {
        const newRounds = interviewRounds.filter((_, i) => i !== index);
        setInterviewRounds(newRounds.map((r, i) => ({ ...r, levelCheck: i + 1 })));
    };
    const handleInterviewRoundChange = (index, field, value) => {
        const newRounds = [...interviewRounds];
        newRounds[index][field] = value;
        setInterviewRounds(newRounds);
    };

    const handleCreateInterviewWorkflow = async () => {
        if (!newInterviewName) return toast.error('Interview template name is required');
        for (let r of interviewRounds) {
            if (!r.levelName) return toast.error(`Round Title is required for Round ${r.levelCheck}`);
        }

        try {
            if (editingInterviewId) {
                await api.put(`/ta/interview-workflows/${editingInterviewId}`, { name: newInterviewName, description: newInterviewDesc, rounds: interviewRounds });
                toast.success('Interview Workflow updated');
            } else {
                await api.post('/ta/interview-workflows', { name: newInterviewName, description: newInterviewDesc, rounds: interviewRounds });
                toast.success('Interview Workflow created');
            }
            setShowCreateInterview(false);
            setEditingInterviewId(null);
            setNewInterviewName('');
            setNewInterviewDesc('');
            setInterviewRounds([{ levelCheck: 1, levelName: '', role: '', user: '' }]);
            fetchInterviewWorkflows();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save');
        }
    };

    const handleEditInterview = (wf) => {
        setEditingInterviewId(wf._id);
        setNewInterviewName(wf.name);
        setNewInterviewDesc(wf.description || '');
        setInterviewRounds(wf.rounds.map(r => ({
            levelCheck: r.levelCheck,
            levelName: r.levelName,
            role: r.role ? (r.role._id || r.role) : '',
            user: r.user ? (r.user._id || r.user) : ''
        })));
        setShowCreateInterview(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteInterview = async (id) => {
        if (!window.confirm('Are you sure you want to delete this Interview Workflow?')) return;
        try {
            await api.delete(`/ta/interview-workflows/${id}`);
            toast.success('Interview workflow deleted');
            fetchInterviewWorkflows();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header Area */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">TA Workflows</h1>
                    <p className="text-slate-500">Configure hiring rules and candidate interview templates</p>
                </div>
                {activeTab === 'APPROVAL' ? (
                    <button onClick={() => setShowCreate(!showCreate)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        {showCreate ? <X size={18} /> : <Plus size={18} />}
                        {showCreate ? 'Cancel' : 'Create Approval Workflow'}
                    </button>
                ) : (
                    <button onClick={() => setShowCreateInterview(!showCreateInterview)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        {showCreateInterview ? <X size={18} /> : <Plus size={18} />}
                        {showCreateInterview ? 'Cancel' : 'Create Interview Workflow'}
                    </button>
                )}
            </div>

            {/* Tabs Navigation */}
            <div className="flex gap-4 border-b border-slate-200 mb-6 font-medium">
                <button 
                    onClick={() => setActiveTab('APPROVAL')} 
                    className={`pb-3 px-4 transition-colors ${activeTab === 'APPROVAL' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Hiring Approvals
                </button>
                <button 
                    onClick={() => setActiveTab('INTERVIEW')} 
                    className={`pb-3 px-4 transition-colors ${activeTab === 'INTERVIEW' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Candidate Interviews
                </button>
            </div>

            {/* =========================================================================
                                APPROVAL TAB CONTENT
            ========================================================================== */}
            {activeTab === 'APPROVAL' && (
                <>
                    {/* Create / Edit Form */}
                    {showCreate && (
                        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-lg">{editingId ? 'Edit Hiring Workflow' : 'New Hiring Workflow'}</h3>
                                {editingId && (
                                    <button onClick={() => { setEditingId(null); setNewName(''); setLevels([{ levelCheck: 1, role: '', approvers: [], isFinal: false }]); setShowCreate(false); }} className="text-slate-400 hover:text-slate-600">
                                        <X size={20} />
                                    </button>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Workflow Name</label>
                                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-blue-500" placeholder="e.g., Standard Hiring Approval" />
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Approval Levels</label>
                                <div className="space-y-3">
                                    {levels.map((level, index) => {
                                        const roleUsers = users.filter(u => u.roles && u.roles.some(r => r._id === level.role || r === level.role));
                                        return (
                                            <div key={index} className="flex flex-col gap-3 bg-slate-50 p-4 rounded-md border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">{level.levelCheck}</div>
                                                        <span className="font-semibold text-sm text-slate-700">Level {level.levelCheck}</span>
                                                    </div>
                                                    {index > 0 && <button onClick={() => handleRemoveLevel(index)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                                                        <select value={level.role || ''} onChange={(e) => { handleLevelChange(index, 'role', e.target.value); handleLevelChange(index, 'approvers', []); }} className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm">
                                                            <option value="">Select Role</option>
                                                            {roles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-1">Approvers (Select Multiple)</label>
                                                        <div className="border border-slate-300 rounded-md max-h-32 overflow-y-auto bg-white p-2">
                                                            {level.role ? (
                                                                roleUsers.length > 0 ? (
                                                                    roleUsers.map(u => (
                                                                        <div key={u._id} className="flex items-center gap-2 mb-1 last:mb-0">
                                                                            <input type="checkbox" id={`lvl-${index}-u-${u._id}`} checked={level.approvers?.includes(u._id)} onChange={() => handleApproverChange(index, u._id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"/>
                                                                            <label htmlFor={`lvl-${index}-u-${u._id}`} className="text-sm text-slate-700 cursor-pointer select-none">{u.firstName} {u.lastName}</label>
                                                                        </div>
                                                                    ))
                                                                ) : <p className="text-xs text-slate-400 italic p-1">No users found with this role.</p>
                                                            ) : <p className="text-xs text-slate-400 italic p-1">So select a role first.</p>}
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-1">{level.approvers?.length || 0} selected</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <button onClick={handleAddLevel} className="mt-3 text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1"><Plus size={16} /> Add Level</button>
                            </div>

                            <div className="flex justify-end">
                                <button onClick={handleCreateWorkflow} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                                    <Save size={18} /> Save Hiring Workflow
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Data Table */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
                        {loading ? (
                            <div className="p-6 text-center text-slate-500">Loading workflows...</div>
                        ) : workflows.length === 0 ? (
                            <div className="p-6 text-center text-slate-500">No hiring workflows found. Add one above.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="font-semibold text-slate-600 text-sm px-6 py-4">Workflow Name</th>
                                            <th className="font-semibold text-slate-600 text-sm px-6 py-4">Created Date</th>
                                            <th className="font-semibold text-slate-600 text-sm px-6 py-4">Status</th>
                                            <th className="font-semibold text-slate-600 text-sm px-6 py-4">Levels</th>
                                            <th className="font-semibold text-slate-600 text-sm px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {workflows.map(wf => (
                                            <tr key={wf._id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 align-middle"><div className="font-medium text-slate-800">{wf.name}</div></td>
                                                <td className="px-6 py-4 text-sm text-slate-500 align-middle">{new Date(wf.createdAt).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 align-middle">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${wf.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                        {wf.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 align-middle">
                                                    <div className="flex items-center gap-2 overflow-x-auto max-w-[400px] scrollbar-hide py-1">
                                                        {wf.levels.map((lvl, i) => (
                                                            <React.Fragment key={i}>
                                                                <div className="bg-white border border-slate-200 rounded px-2 py-1 text-xs whitespace-nowrap shadow-sm flex items-center gap-1.5" title={lvl.approvers?.map(a => `${a.firstName} ${a.lastName}`).join(', ')}>
                                                                    <span className="font-semibold text-blue-600">L{lvl.levelCheck}</span>
                                                                    <div className="h-3 w-px bg-slate-300"></div>
                                                                    <span className="text-slate-700 font-medium">
                                                                        {lvl.role?.name || 'Unknown Role'}
                                                                        <span className="text-slate-400 font-normal ml-1 flex-shrink-0">({lvl.approvers?.length || 'Any'})</span>
                                                                    </span>
                                                                </div>
                                                                {i < wf.levels.length - 1 && <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />}
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right align-middle">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleEdit(wf)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Workflow">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                        </button>
                                                        {wf.isActive && (
                                                            <button onClick={() => handleDelete(wf._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Deactivate Workflow">
                                                                <Trash2 size={18} />
                                                            </button>
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
                </>
            )}


            {/* =========================================================================
                                INTERVIEW TAB CONTENT
            ========================================================================== */}
            {activeTab === 'INTERVIEW' && (
                <>
                    {/* Create / Edit Form */}
                    {showCreateInterview && (
                        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-lg">{editingInterviewId ? 'Edit Interview Workflow' : 'New Interview Workflow'}</h3>
                                {editingInterviewId && (
                                    <button onClick={() => { setEditingInterviewId(null); setNewInterviewName(''); setNewInterviewDesc(''); setInterviewRounds([{ levelCheck: 1, levelName: '', role: '' }]); setShowCreateInterview(false); }} className="text-slate-400 hover:text-slate-600">
                                        <X size={20} />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
                                    <input type="text" value={newInterviewName} onChange={(e) => setNewInterviewName(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-blue-500" placeholder="e.g., Standard Engineering Setup" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                                    <input type="text" value={newInterviewDesc} onChange={(e) => setNewInterviewDesc(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-blue-500" placeholder="e.g., Use this for generic backend applicants" />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Sequential Interview Rounds</label>
                                <div className="space-y-3">
                                    {interviewRounds.map((round, index) => (
                                        <div key={index} className="flex flex-col gap-3 bg-slate-50 p-4 rounded-md border border-slate-200">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">{round.levelCheck}</div>
                                                    <span className="font-semibold text-sm text-slate-700">Round {round.levelCheck}</span>
                                                </div>
                                                {index > 0 && <button onClick={() => handleRemoveInterviewRound(index)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Round Title</label>
                                                    <input type="text" value={round.levelName} onChange={(e) => handleInterviewRoundChange(index, 'levelName', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:border-indigo-500" placeholder="e.g., L1 Technical" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Target Evaluator Role (Optional)</label>
                                                    <select value={round.role || ''} onChange={(e) => { handleInterviewRoundChange(index, 'role', e.target.value); handleInterviewRoundChange(index, 'user', ''); }} className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm">
                                                        <option value="">Any Role</option>
                                                        {roles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Designated User (Optional)</label>
                                                    <select value={round.user || ''} onChange={(e) => handleInterviewRoundChange(index, 'user', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm">
                                                        <option value="">Any User</option>
                                                        {(round.role ? users.filter(u => u.roles?.some(r => r._id === round.role || r === round.role)) : users).map(u => (
                                                            <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={handleAddInterviewRound} className="mt-3 text-sm text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1"><Plus size={16} /> Add Round</button>
                            </div>

                            <div className="flex justify-end">
                                <button onClick={handleCreateInterviewWorkflow} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                                    <Save size={18} /> Save Interview Workflow
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Data Table */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
                        {loadingInterview ? (
                            <div className="p-6 text-center text-slate-500">Loading templates...</div>
                        ) : interviewWorkflows.length === 0 ? (
                            <div className="p-6 text-center text-slate-500">No interview workflows found. Add one above.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="font-semibold text-slate-600 text-sm px-6 py-4">Template Name</th>
                                            <th className="font-semibold text-slate-600 text-sm px-6 py-4">Created Date</th>
                                            <th className="font-semibold text-slate-600 text-sm px-6 py-4">Sequence / Target Roles</th>
                                            <th className="font-semibold text-slate-600 text-sm px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {interviewWorkflows.map(wf => (
                                            <tr key={wf._id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 align-middle">
                                                    <div className="font-medium text-slate-800">{wf.name}</div>
                                                    <div className="text-xs text-slate-500">{wf.description}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 align-middle">{new Date(wf.createdAt).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 align-middle">
                                                    <div className="flex items-center gap-2 overflow-x-auto max-w-[400px] scrollbar-hide py-1">
                                                        {wf.rounds.map((round, i) => (
                                                            <React.Fragment key={i}>
                                                                <div className="bg-white border border-slate-200 rounded px-2 py-1 text-xs whitespace-nowrap shadow-sm flex flex-col gap-0.5" title={round.role?.name || 'Any Role'}>
                                                                    <div className="font-semibold text-indigo-700">{round.levelName}</div>
                                                                    <div className="text-slate-500 text-[10px] uppercase font-medium">{round.role?.name || 'Any Role'}</div>
                                                                </div>
                                                                {i < wf.rounds.length - 1 && <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />}
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right align-middle">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleEditInterview(wf)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Template">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                        </button>
                                                        <button onClick={() => handleDeleteInterview(wf._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Template">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default WorkflowSettings;
