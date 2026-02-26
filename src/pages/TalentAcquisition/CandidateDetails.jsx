import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Loader, ArrowLeft, Download, Plus, CheckCircle, XCircle, Clock, User, Calendar, MessageSquare, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import Skeleton from '../../components/Skeleton';

const CandidateDetails = () => {
    const { user } = useAuth();
    const { hiringRequestId, candidateId } = useParams();
    const navigate = useNavigate();

    const [candidate, setCandidate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Round Management State
    const [isAddingRound, setIsAddingRound] = useState(false);
    const [newRound, setNewRound] = useState({ levelName: '', scheduledDate: '' });

    // Evaluation State
    const [evaluatingRoundId, setEvaluatingRoundId] = useState(null);
    const [evaluationForm, setEvaluationForm] = useState({ status: 'Passed', feedback: '' });

    // Edit Round State
    const [editingRoundId, setEditingRoundId] = useState(null);
    const [editingRoundForm, setEditingRoundForm] = useState({ levelName: '', scheduledDate: '', assignedTo: '' });

    // Workflow State
    const [interviewWorkflows, setInterviewWorkflows] = useState([]);
    const [isApplyingWorkflow, setIsApplyingWorkflow] = useState(false);
    const [selectedWorkflow, setSelectedWorkflow] = useState('');
    const [workflowMapping, setWorkflowMapping] = useState({});

    // Users List for Assessment assignment
    const [users, setUsers] = useState([]);
    const [selectedInterviewer, setSelectedInterviewer] = useState('');
    const [roles, setRoles] = useState([]);
    const [selectedRoleForRound, setSelectedRoleForRound] = useState('');

    useEffect(() => {
        fetchCandidate();
        fetchUsers();
        fetchRoles();
        fetchInterviewWorkflows();
    }, [candidateId]);

    const fetchCandidate = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/ta/candidates/candidate/${candidateId}`);
            setCandidate(res.data);
        } catch (error) {
            console.error('Error fetching candidate:', error);
            toast.error('Failed to load candidate details');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/admin/users'); // Use admin users route
            setUsers(res.data.data || res.data || []);
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

    const fetchInterviewWorkflows = async () => {
        try {
            const res = await api.get('/ta/interview-workflows');
            setInterviewWorkflows(res.data);
        } catch (error) {
            console.error('Failed to fetch interview workflows', error);
        }
    };

    const handleAddRound = async () => {
        if (!newRound.levelName) {
            toast.error('Level Name is required');
            return;
        }

        try {
            setActionLoading(true);
            const payload = {
                levelName: newRound.levelName,
                assignedTo: selectedInterviewer ? [selectedInterviewer] : [],
                scheduledDate: newRound.scheduledDate || undefined
            };

            await api.post(`/ta/candidates/${candidateId}/rounds`, payload);
            toast.success('Interview round added');
            setIsAddingRound(false);
            setNewRound({ levelName: '', scheduledDate: '' });
            setSelectedInterviewer('');
            setSelectedRoleForRound('');
            fetchCandidate();
            window.dispatchEvent(new Event('refreshNotifications'));
        } catch (error) {
            console.error('Error adding round:', error);
            toast.error(error.response?.data?.message || 'Failed to add round');
        } finally {
            setActionLoading(false);
        }
    };

    const handleEditRound = async (roundId) => {
        if (!editingRoundForm.levelName) {
            toast.error('Level Name is required');
            return;
        }

        try {
            setActionLoading(true);
            const payload = {
                levelName: editingRoundForm.levelName,
                assignedTo: editingRoundForm.assignedTo ? [editingRoundForm.assignedTo] : [],
                scheduledDate: editingRoundForm.scheduledDate || undefined
            };

            await api.put(`/ta/candidates/${candidateId}/rounds/${roundId}`, payload);
            toast.success('Interview round updated');
            setEditingRoundId(null);
            fetchCandidate();
            window.dispatchEvent(new Event('refreshNotifications'));
        } catch (error) {
            console.error('Error updating round:', error);
            toast.error(error.response?.data?.message || 'Failed to update round');
        } finally {
            setActionLoading(false);
        }
    };


    const handleApplyWorkflowSubmit = async () => {
        if (!selectedWorkflow) return toast.error('Please select a workflow template');
        try {
            setActionLoading(true);
            const template = interviewWorkflows.find(w => w._id === selectedWorkflow);
            if (!template) return;

            for (let i = 0; i < template.rounds.length; i++) {
                const r = template.rounds[i];
                const mapping = workflowMapping[i] || {};

                const payload = {
                    levelName: r.levelName,
                    assignedTo: mapping.assignedTo ? [mapping.assignedTo] : [],
                    scheduledDate: mapping.scheduledDate || undefined
                };
                await api.post(`/ta/candidates/${candidateId}/rounds`, payload);
            }
            toast.success('Interview workflow sequence applied successfully');
            setIsApplyingWorkflow(false);
            setSelectedWorkflow('');
            setWorkflowMapping({});
            fetchCandidate();
            window.dispatchEvent(new Event('refreshNotifications'));
        } catch (error) {
            console.error(error);
            toast.error('Failed to apply workflow completely. Some rounds may have failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteRound = async (roundId) => {
        if (!window.confirm('Are you sure you want to delete this round?')) return;
        try {
            setActionLoading(true);
            await api.delete(`/ta/candidates/${candidateId}/rounds/${roundId}`);
            toast.success('Round deleted');
            fetchCandidate();
        } catch (error) {
            console.error('Error deleting round:', error);
            toast.error('Failed to delete round');
        } finally {
            setActionLoading(false);
        }
    };

    const submitEvaluation = async (roundId) => {
        if (!evaluationForm.feedback) {
            toast.error('Feedback is required');
            return;
        }

        try {
            setActionLoading(true);
            await api.patch(`/ta/candidates/${candidateId}/rounds/${roundId}/evaluate`, evaluationForm);
            toast.success('Evaluation submitted');
            setEvaluatingRoundId(null);
            setEvaluationForm({ status: 'Passed', feedback: '' });
            fetchCandidate();
        } catch (error) {
            console.error('Error submitting evaluation:', error);
            toast.error(error.response?.data?.message || 'Failed to submit evaluation');
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusBadgeColor = (status) => {
        switch (status) {
            case 'Passed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Failed': return 'bg-red-100 text-red-700 border-red-200';
            case 'Scheduled': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Skipped': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-amber-100 text-amber-700 border-amber-200'; // Pending
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Passed': return <CheckCircle size={16} className="text-emerald-600" />;
            case 'Failed': return <XCircle size={16} className="text-red-600" />;
            case 'Scheduled': return <Calendar size={16} className="text-blue-600" />;
            default: return <Clock size={16} className="text-amber-600" />;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 pb-12">
                <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div>
                                <Skeleton className="h-6 w-48 mb-2" />
                                <Skeleton className="h-4 w-64" />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Skeleton className="h-10 w-36" />
                            <Skeleton className="h-10 w-36" />
                        </div>
                    </div>
                </div>
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <Skeleton className="h-6 w-40 mb-6" />
                            <div className="space-y-6">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <Skeleton className="h-6 w-48" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-9 w-32" />
                                    <Skeleton className="h-9 w-40" />
                                </div>
                            </div>
                            <div className="space-y-6">
                                <Skeleton className="h-32 w-full" />
                                <Skeleton className="h-32 w-full" />
                                <Skeleton className="h-32 w-full" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!candidate) return <div className="text-center p-8">Candidate not found</div>;

    const isAdmin = user?.roles?.includes('Admin') || user?.roles?.some(r => r.name === 'Admin');
    const userPermissions = user?.permissions || [];
    const hasSuperApprove = userPermissions.includes('ta.super_approve') || userPermissions.includes('*') || isAdmin;
    const canManageRounds = isAdmin || userPermissions.includes('ta.edit');

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate(`/ta/view/${hiringRequestId}?tab=applications`)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">{candidate.candidateName}</h1>
                                <p className="text-sm text-slate-500">{candidate.email} • {candidate.mobile}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <a
                                href={candidate.resumeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors border border-slate-200"
                            >
                                <Download size={18} /> View Resume
                            </a>
                            {canManageRounds && (
                                <button
                                    onClick={() => navigate(`/ta/hiring-request/${hiringRequestId}/candidate/${candidateId}/edit`)}
                                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    <Edit2 size={18} /> Edit Profile
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Basic Details Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Profile Summary</h3>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Status</p>
                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium border border-slate-200">
                                            {candidate.status}
                                        </span>
                                        {candidate.decision && candidate.decision !== 'None' && (
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${candidate.decision === 'Hired' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                candidate.decision === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                Decision: {candidate.decision}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Source</p>
                                    <p className="text-slate-700 font-medium">{candidate.source} {candidate.referralName && `(${candidate.referralName})`}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Experience</p>
                                    <p className="text-slate-700 font-medium">{candidate.totalExperience !== undefined ? `${candidate.totalExperience} Years` : 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Qualification</p>
                                    <p className="text-slate-700 font-medium">{candidate.qualification || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current CTC</p>
                                    <p className="text-slate-700 font-medium">{candidate.currentCTC ? `₹${candidate.currentCTC?.toLocaleString()}` : 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Expected CTC</p>
                                    <p className="text-slate-700 font-medium">{candidate.expectedCTC ? `₹${candidate.expectedCTC?.toLocaleString()}` : 'N/A'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Location</p>
                                    <p className="text-slate-700 font-medium">{candidate.currentLocation || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Preferred Location</p>
                                    <p className="text-slate-700 font-medium">{candidate.preferredLocation || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notice Period</p>
                                    <p className="text-slate-700 font-medium">{candidate.noticePeriod ? `${candidate.noticePeriod} Days` : 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">TAT To Join</p>
                                    <p className="text-slate-700 font-medium">{candidate.tatToJoin ? `${candidate.tatToJoin} Days` : 'N/A'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Last Working Day</p>
                                    <p className="text-slate-700 font-medium">{candidate.lastWorkingDay ? format(new Date(candidate.lastWorkingDay), 'dd MMM yyyy') : 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Preference</p>
                                    <p className="text-slate-700 font-medium">{candidate.preference || 'N/A'}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Company</p>
                                <p className="text-slate-700 font-medium">{candidate.currentCompany || 'N/A'}</p>
                            </div>

                            {candidate.remark && (
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Remark</p>
                                    <p className="text-slate-700 font-medium text-sm p-3 bg-slate-50 rounded-lg border border-slate-100 mt-1">{candidate.remark}</p>
                                </div>
                            )}

                            {candidate.pastExperience && candidate.pastExperience.length > 0 && (
                                <div className="pt-2 border-t border-slate-100 mt-2">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Past Experience</p>
                                    <ul className="space-y-2">
                                        {candidate.pastExperience.map((exp, idx) => (
                                            <li key={idx} className="text-sm text-slate-700 flex justify-between">
                                                <span>{exp.companyName}</span>
                                                <span className="text-slate-500">{exp.experienceYears} yrs</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Interview Workflow Timeline */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Interview Timeline</h3>
                            {canManageRounds && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setIsApplyingWorkflow(true); setIsAddingRound(false); }}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Plus size={16} /> Apply Workflow
                                    </button>
                                    <button
                                        onClick={() => { setIsAddingRound(!isAddingRound); setIsApplyingWorkflow(false); }}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Plus size={16} /> Add Custom Round
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Apply Workflow Form */}
                        {isApplyingWorkflow && (
                            <div className="bg-slate-50 p-5 rounded-xl border border-indigo-100 mb-8 animate-in fade-in slide-in-from-top-2">
                                <h4 className="text-sm font-bold text-slate-700 mb-4">Apply Interview Template Sequence</h4>
                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Select Template</label>
                                    <select
                                        value={selectedWorkflow}
                                        onChange={(e) => {
                                            const wfId = e.target.value;
                                            setSelectedWorkflow(wfId);
                                            const template = interviewWorkflows.find(w => w._id === wfId);
                                            if (template) {
                                                const mapping = {};
                                                template.rounds.forEach((r, i) => {
                                                    if (r.user) mapping[i] = { assignedTo: r.user?._id || r.user };
                                                });
                                                setWorkflowMapping(mapping);
                                            } else {
                                                setWorkflowMapping({});
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500"
                                    >
                                        <option value="">-- Select an Interview Workflow --</option>
                                        {interviewWorkflows.map(wf => (
                                            <option key={wf._id} value={wf._id}>{wf.name} ({wf.rounds?.length || 0} Rounds)</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedWorkflow && (
                                    <div className="space-y-3 mb-5 border-t border-slate-200 pt-4">
                                        <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">Configure Rounds</p>
                                        {interviewWorkflows.find(w => w._id === selectedWorkflow)?.rounds.map((round, index) => {
                                            // Filter users visually if the protocol specifies a target role
                                            const roleFilterId = round.role?._id || round.role;
                                            const roleUsers = roleFilterId
                                                ? users.filter(u => u.roles?.some(r => r._id === roleFilterId || r === roleFilterId))
                                                : users;

                                            return (
                                                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 bg-white rounded-lg border border-slate-200 items-center">
                                                    <div className="md:col-span-1 border-r border-slate-100">
                                                        <div className="font-semibold text-indigo-700 text-sm">{round.levelName}</div>
                                                        {roleFilterId && <div className="text-[10px] text-slate-500 uppercase mt-0.5 font-medium">Req Role: {round.role?.name || 'Assigned'}</div>}
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <select
                                                            value={workflowMapping[index]?.assignedTo || ''}
                                                            onChange={(e) => setWorkflowMapping({ ...workflowMapping, [index]: { ...workflowMapping[index], assignedTo: e.target.value } })}
                                                            className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm outline-none focus:border-indigo-500"
                                                        >
                                                            <option value="">-- Assign Interviewer --</option>
                                                            {roleUsers.map(u => (
                                                                <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="md:col-span-1">
                                                        <input
                                                            type="datetime-local"
                                                            value={workflowMapping[index]?.scheduledDate || ''}
                                                            onChange={(e) => setWorkflowMapping({ ...workflowMapping, [index]: { ...workflowMapping[index], scheduledDate: e.target.value } })}
                                                            className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                <div className="flex justify-end gap-2">
                                    <button onClick={() => { setIsApplyingWorkflow(false); setSelectedWorkflow(''); }} className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                                    <button onClick={handleApplyWorkflowSubmit} disabled={actionLoading || !selectedWorkflow} className="px-4 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                                        {actionLoading && <Loader size={14} className="animate-spin" />} Apply Workflow
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Add Round Form */}
                        {isAddingRound && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8 animate-in fade-in slide-in-from-top-2">
                                <h4 className="text-sm font-bold text-slate-700 mb-3">Schedule New Round</h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Round Level/Title *</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. L1 - Technical"
                                            value={newRound.levelName}
                                            onChange={(e) => setNewRound({ ...newRound, levelName: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Target Role (Optional)</label>
                                        <select
                                            value={selectedRoleForRound}
                                            onChange={(e) => {
                                                setSelectedRoleForRound(e.target.value);
                                                setSelectedInterviewer('');
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="">Any Role</option>
                                            {roles.map(r => (
                                                <option key={r._id} value={r._id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Assign Interviewer</label>
                                        <select
                                            value={selectedInterviewer}
                                            onChange={(e) => setSelectedInterviewer(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="">-- Select Evaluator --</option>
                                            {(selectedRoleForRound ? users.filter(u => u.roles?.some(r => r._id === selectedRoleForRound || r === selectedRoleForRound)) : users).map(u => (
                                                <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Scheduled Date</label>
                                        <input
                                            type="datetime-local"
                                            value={newRound.scheduledDate}
                                            onChange={(e) => setNewRound({ ...newRound, scheduledDate: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => { setIsAddingRound(false); setSelectedInterviewer(''); setSelectedRoleForRound(''); }} className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                                    <button onClick={handleAddRound} disabled={actionLoading} className="px-4 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                                        {actionLoading && <Loader size={14} className="animate-spin" />} Save Round
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="space-y-8 relative">
                            {(!candidate.interviewRounds || candidate.interviewRounds.length === 0) ? (
                                <div className="text-center py-12 text-slate-500">
                                    No interview rounds have been scheduled yet.
                                </div>
                            ) : (
                                candidate.interviewRounds.map((round, index) => {
                                    const isAssigned = round.assignedTo?.some(u => u._id === user?._id);
                                    const canEvaluate = (isAssigned || hasSuperApprove) && ['Pending', 'Scheduled'].includes(round.status);
                                    const isEvaluating = evaluatingRoundId === round._id;
                                    const isEditingRound = editingRoundId === round._id;

                                    return (
                                        <div key={round._id} className="relative pl-8">
                                            {/* Timeline Line */}
                                            {index !== candidate.interviewRounds.length - 1 && (
                                                <div className="absolute top-8 bottom-[-2rem] left-3.5 w-0.5 bg-slate-200"></div>
                                            )}

                                            {/* Dot */}
                                            <div className={`absolute top-1 left-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${round.status === 'Passed' ? 'bg-emerald-500' :
                                                round.status === 'Failed' ? 'bg-red-500' :
                                                    'bg-amber-400'
                                                }`}></div>

                                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                {/* Round Header */}
                                                <div className={`px-5 py-4 border-b flex justify-between items-center ${round.status === 'Passed' ? 'bg-emerald-50/50 border-emerald-100' :
                                                    round.status === 'Failed' ? 'bg-red-50/50 border-red-100' :
                                                        'bg-slate-50/50 border-slate-100'
                                                    }`}>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                            {round.levelName}
                                                            {getStatusIcon(round.status)}
                                                        </h4>
                                                        {round.scheduledDate && (
                                                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                                <Calendar size={12} /> Scheduled: {format(new Date(round.scheduledDate), 'PPp')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadgeColor(round.status)}`}>
                                                            {round.status}
                                                        </span>
                                                        {canManageRounds && ['Pending', 'Scheduled'].includes(round.status) && (
                                                            <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
                                                                <button
                                                                    onClick={() => {
                                                                        if (editingRoundId === round._id) {
                                                                            setEditingRoundId(null);
                                                                        } else {
                                                                            setEditingRoundId(round._id);
                                                                            setEvaluatingRoundId(null);
                                                                            const formattedDate = round.scheduledDate ? new Date(round.scheduledDate).toISOString().slice(0, 16) : '';
                                                                            setEditingRoundForm({
                                                                                levelName: round.levelName,
                                                                                scheduledDate: formattedDate,
                                                                                assignedTo: round.assignedTo?.[0]?._id || ''
                                                                            });
                                                                        }
                                                                    }}
                                                                    className={`transition-colors ${isEditingRound ? 'text-blue-500' : 'text-slate-400 hover:text-blue-500'}`}
                                                                    title="Edit Round"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteRound(round._id)}
                                                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                                                    title="Delete Round"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Round Details */}
                                                <div className="px-5 py-4">
                                                    <div className="flex items-start gap-2 mb-4">
                                                        <User size={16} className="text-slate-400 mt-0.5" />
                                                        <div>
                                                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned Evaluator</p>
                                                            {round.assignedTo?.length > 0 ? (
                                                                <p className="text-sm font-medium text-slate-800">
                                                                    {round.assignedTo.map(u =>
                                                                        u.firstName ? `${u.firstName} ${u.lastName}` : (u.email || 'Assigned User')
                                                                    ).join(', ')}
                                                                </p>
                                                            ) : (
                                                                <p className="text-sm text-slate-400 italic">Unassigned</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Evaluation Results Overlay */}
                                                    {['Passed', 'Failed'].includes(round.status) && (
                                                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                                            <div className="flex items-start gap-2">
                                                                <MessageSquare size={16} className="text-slate-400 mt-0.5" />
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Evaluator Feedback</p>
                                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{round.feedback}</p>

                                                                    {round.evaluatedBy && (
                                                                        <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
                                                                            <span>Evaluated by <span className="font-medium text-slate-700">{round.evaluatedBy.firstName} {round.evaluatedBy.lastName}</span></span>
                                                                            {round.evaluatedAt && <span>{format(new Date(round.evaluatedAt), 'PP')}</span>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* CTA to Evaluate */}
                                                    {canEvaluate && !isEvaluating && !isEditingRound && (
                                                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                                                            <button
                                                                onClick={() => setEvaluatingRoundId(round._id)}
                                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                                            >
                                                                Submit Evaluation
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Edit Form */}
                                                    {isEditingRound && (
                                                        <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                                <h5 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                                                    <Edit2 size={16} /> Edit Round Details
                                                                </h5>
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">Round Level/Title *</label>
                                                                        <input
                                                                            type="text"
                                                                            value={editingRoundForm.levelName}
                                                                            onChange={(e) => setEditingRoundForm({ ...editingRoundForm, levelName: e.target.value })}
                                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">Assign Interviewer</label>
                                                                        <select
                                                                            value={editingRoundForm.assignedTo}
                                                                            onChange={(e) => setEditingRoundForm({ ...editingRoundForm, assignedTo: e.target.value })}
                                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                                        >
                                                                            <option value="">-- Unassigned --</option>
                                                                            {users.map(u => (
                                                                                <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">Scheduled Date</label>
                                                                        <input
                                                                            type="datetime-local"
                                                                            value={editingRoundForm.scheduledDate}
                                                                            onChange={(e) => setEditingRoundForm({ ...editingRoundForm, scheduledDate: e.target.value })}
                                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        onClick={() => setEditingRoundId(null)}
                                                                        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleEditRound(round._id)}
                                                                        disabled={actionLoading}
                                                                        className="px-5 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                                                    >
                                                                        {actionLoading && <Loader size={14} className="animate-spin" />} Save Changes
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Evaluation Form */}
                                                    {isEvaluating && (
                                                        <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                                                <h5 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                                                                    <CheckCircle size={16} /> Complete Round Assessment
                                                                </h5>
                                                                <div className="space-y-4">
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Decision Result *</label>
                                                                        <div className="flex gap-4">
                                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`status-${round._id}`}
                                                                                    value="Passed"
                                                                                    checked={evaluationForm.status === 'Passed'}
                                                                                    onChange={(e) => setEvaluationForm({ ...evaluationForm, status: e.target.value })}
                                                                                    className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                                                                                />
                                                                                <span className="text-sm font-medium text-slate-800">Pass</span>
                                                                            </label>
                                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`status-${round._id}`}
                                                                                    value="Failed"
                                                                                    checked={evaluationForm.status === 'Failed'}
                                                                                    onChange={(e) => setEvaluationForm({ ...evaluationForm, status: e.target.value })}
                                                                                    className="w-4 h-4 text-red-600 border-slate-300 focus:ring-red-500"
                                                                                />
                                                                                <span className="text-sm font-medium text-slate-800">Fail</span>
                                                                            </label>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-slate-700 mb-1">Qualitative Feedback / Remarks *</label>
                                                                        <textarea
                                                                            rows={3}
                                                                            value={evaluationForm.feedback}
                                                                            onChange={(e) => setEvaluationForm({ ...evaluationForm, feedback: e.target.value })}
                                                                            placeholder="Detail the candidate's performance, strengths, and weaknesses observed in this round..."
                                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                                                                        ></textarea>
                                                                    </div>
                                                                    <div className="flex justify-end gap-2 pt-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                setEvaluatingRoundId(null);
                                                                                setEvaluationForm({ status: 'Passed', feedback: '' });
                                                                            }}
                                                                            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            onClick={() => submitEvaluation(round._id)}
                                                                            disabled={actionLoading}
                                                                            className="px-5 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                                                        >
                                                                            {actionLoading && <Loader size={14} className="animate-spin" />} Submit Decision
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CandidateDetails;
