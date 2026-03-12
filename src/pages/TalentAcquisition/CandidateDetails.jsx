import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
    const [searchParams] = useSearchParams();
    const phaseParam = searchParams.get('phase');
    const currentPhase = phaseParam ? parseInt(phaseParam, 10) : 2;

    const [candidate, setCandidate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Round Management State
    const [isAddingRound, setIsAddingRound] = useState(false);
    const [newRound, setNewRound] = useState({ levelName: '', scheduledDate: '' });

    // Evaluation State
    const [evaluatingRoundId, setEvaluatingRoundId] = useState(null);
    const [evaluationForm, setEvaluationForm] = useState({ status: 'Passed', feedback: '', rating: '', skillRatings: [], showAssessment: false, manualSkillName: '' });

    // Edit Round State
    const [editingRoundId, setEditingRoundId] = useState(null);
    const [editingRoundForm, setEditingRoundForm] = useState({ levelName: '', scheduledDate: '', assignedTo: '' });

    // Workflow State
    const [interviewWorkflows, setInterviewWorkflows] = useState([]);
    const [isApplyingWorkflow, setIsApplyingWorkflow] = useState(false);
    const [selectedWorkflow, setSelectedWorkflow] = useState('');
    const [workflowMapping, setWorkflowMapping] = useState({});

    // Internal Remark state (separate from sourcing remark)
    const [internalRemarkText, setInternalRemarkText] = useState('');
    const [internalRemarkEditing, setInternalRemarkEditing] = useState(false);
    const [internalRemarkLoading, setInternalRemarkLoading] = useState(false);

    // Users List for Assessment assignment
    const [users, setUsers] = useState([]);
    const [selectedInterviewer, setSelectedInterviewer] = useState('');
    const [roles, setRoles] = useState([]);
    const [selectedRoleForRound, setSelectedRoleForRound] = useState('');



    useEffect(() => {
        const initializeData = async () => {
            try {
                setLoading(true);
                const [candRes, usersRes, rolesRes, workflowsRes] = await Promise.all([
                    api.get(`/ta/candidates/candidate/${candidateId}`),
                    api.get('/admin/users'),
                    api.get('/admin/roles'),
                    api.get('/ta/interview-workflows')
                ]);

                setCandidate(candRes.data);
                setInternalRemarkText(candRes.data.internalRemark || '');
                setUsers(usersRes.data.data || usersRes.data || []);
                setRoles(rolesRes.data || []);
                setInterviewWorkflows(workflowsRes.data || []);
            } catch (error) {
                console.error('Error initializing candidate details:', error);
                toast.error('Failed to load candidate details correctly.');
            } finally {
                setLoading(false);
            }
        };

        if (candidateId) {
            initializeData();
        }
    }, [candidateId]);

    const fetchCandidate = useCallback(async () => {
        try {
            const res = await api.get(`/ta/candidates/candidate/${candidateId}`);
            setCandidate(res.data);
        } catch (error) {
            console.error('Error fetching candidate:', error);
        }
    }, [candidateId]);



    const handleAddRound = useCallback(async () => {
        if (!newRound.levelName) {
            toast.error('Level Name is required');
            return;
        }

        try {
            setActionLoading(true);
            const payload = {
                levelName: newRound.levelName,
                assignedTo: selectedInterviewer && selectedInterviewer.trim() !== '' ? [selectedInterviewer] : [],
                scheduledDate: newRound.scheduledDate || undefined,
                phase: currentPhase
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
    }, [newRound, selectedInterviewer, candidateId, fetchCandidate]);

    const handleEditRound = useCallback(async (roundId) => {
        if (!editingRoundForm.levelName) {
            toast.error('Level Name is required');
            return;
        }

        try {
            setActionLoading(true);
            const payload = {
                levelName: editingRoundForm.levelName,
                assignedTo: editingRoundForm.assignedTo && editingRoundForm.assignedTo.trim() !== '' ? [editingRoundForm.assignedTo] : [],
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
    }, [editingRoundForm, candidateId, fetchCandidate]);


    const handleApplyWorkflowSubmit = useCallback(async () => {
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
                    assignedTo: mapping.assignedTo && mapping.assignedTo.trim() !== '' ? [mapping.assignedTo] : [],
                    scheduledDate: mapping.scheduledDate || undefined,
                    phase: currentPhase
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
    }, [selectedWorkflow, interviewWorkflows, workflowMapping, candidateId, fetchCandidate]);

    const handleDeleteRound = useCallback(async (roundId) => {
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
    }, [candidateId, fetchCandidate]);

    const submitEvaluation = useCallback(async (roundId) => {
        if (!evaluationForm.feedback) {
            toast.error('Feedback is required');
            return;
        }

        try {
            setActionLoading(true);
            const payload = {
                status: evaluationForm.status,
                feedback: evaluationForm.feedback,
                skillRatings: evaluationForm.skillRatings,
                ...(evaluationForm.status === 'Passed' && evaluationForm.rating ? { rating: evaluationForm.rating } : {})
            };
            await api.patch(`/ta/candidates/${candidateId}/rounds/${roundId}/evaluate`, payload);
            toast.success('Evaluation submitted');
            setEvaluatingRoundId(null);
            setEvaluationForm({ status: 'Passed', feedback: '', rating: '' });
            fetchCandidate();
        } catch (error) {
            console.error('Error submitting evaluation:', error);
            toast.error(error.response?.data?.message || 'Failed to submit evaluation');
        } finally {
            setActionLoading(false);
        }
    }, [evaluationForm, candidateId, fetchCandidate]);

    const handlePhase3DecisionChange = async (newDecision) => {
        try {
            await api.patch(`/ta/candidates/${candidateId}/phase3-decision`, { phase3Decision: newDecision });
            toast.success('Phase 3 Decision updated');
            setCandidate(prev => ({ ...prev, phase3Decision: newDecision }));
            window.dispatchEvent(new Event('refreshNotifications'));
        } catch (error) {
            console.error('Error updating Phase 3 decision:', error);
            toast.error('Failed to update Phase 3 decision');
        }
    };

    const handleUpdateInternalRemark = async () => {
        try {
            setInternalRemarkLoading(true);
            await api.patch(`/ta/candidates/${candidateId}/internal-remark`, { internalRemark: internalRemarkText });
            setCandidate(prev => ({ ...prev, internalRemark: internalRemarkText }));
            setInternalRemarkEditing(false);
            toast.success('Internal remark saved successfully');
        } catch (error) {
            console.error('Error saving internal remark:', error);
            toast.error('Failed to save internal remark');
        } finally {
            setInternalRemarkLoading(false);
        }
    };



    const getStatusBadgeColor = useCallback((status) => {
        switch (status) {
            case 'Passed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Failed': return 'bg-red-100 text-red-700 border-red-200';
            case 'Scheduled': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Skipped': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-amber-100 text-amber-700 border-amber-200'; // Pending
        }
    }, []);

    const getStatusIcon = useCallback((status) => {
        switch (status) {
            case 'Passed': return <CheckCircle size={16} className="text-emerald-600" />;
            case 'Failed': return <XCircle size={16} className="text-red-600" />;
            case 'Scheduled': return <Calendar size={16} className="text-blue-600" />;
            default: return <Clock size={16} className="text-amber-600" />;
        }
    }, []);

    const { isAdmin, userPermissions, hasSuperApprove, canManageRounds } = useMemo(() => {
        const admin = user?.roles?.includes('Admin') || user?.roles?.some(r => r.name === 'Admin');
        const perms = user?.permissions || [];
        const superApprove = perms.includes('ta.super_approve') || perms.includes('*') || admin;
        const manageRounds = admin || perms.includes('ta.edit');
        return { isAdmin: admin, userPermissions: perms, hasSuperApprove: superApprove, canManageRounds: manageRounds };
    }, [user]);

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
                <div className="w-full px-3 sm:px-4 lg:px-6 mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
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

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="w-full px-3 sm:px-4 lg:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(`/ta/view/${hiringRequestId}?tab=applications`)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">{candidate.candidateName}</h1>
                            <p className="text-sm text-slate-500">{candidate.email} • {candidate.mobile}</p>
                        </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
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

            <div className="w-full px-3 sm:px-4 lg:px-6 mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left Column: Basic Details Summary */}
                <div className="lg:col-span-2 space-y-6">
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
                                        {currentPhase === 1 && candidate.decision && candidate.decision !== 'None' && (
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${candidate.decision === 'Hired' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                candidate.decision === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                Phase 1: {candidate.decision}
                                            </span>
                                        )}
                                        {currentPhase === 2 && candidate.phase2Decision && candidate.phase2Decision !== 'None' && (
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${candidate.phase2Decision === 'Hired' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                candidate.phase2Decision === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                Phase 2: {candidate.phase2Decision}
                                            </span>
                                        )}
                                        {currentPhase === 3 && candidate.phase3Decision && candidate.phase3Decision !== 'None' && (
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${candidate.phase3Decision === 'Joined' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                candidate.phase3Decision === 'Offer Sent' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    candidate.phase3Decision === 'No Show' || candidate.phase3Decision === 'Offer Declined' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                Phase 3: {candidate.phase3Decision}
                                            </span>
                                        )}

                                        {/* Dropdown to change decision based on active phase */}
                                        {canManageRounds && (
                                            <div className="mt-2 w-full max-w-[200px]">
                                                {currentPhase === 1 ? (
                                                    <select
                                                        value={candidate.decision || 'None'}
                                                        onChange={(e) => {
                                                            // Currently, list UI handles patch, let's keep consistency or just show it readonly here,
                                                            // But user wants to update from details too if possible.
                                                            // For now, list is main place, but we can add patch if missing.
                                                            toast.error("Please update Phase 1 decision from Candidate List page.");
                                                        }}
                                                        disabled
                                                        className="w-full appearance-none px-3 py-1.5 pr-8 text-sm font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                                                    >
                                                        <option value="None">None</option>
                                                        <option value="Shortlisted">Shortlisted</option>
                                                        <option value="Hired">Hired</option>
                                                        <option value="Rejected">Rejected</option>
                                                        <option value="On Hold">On Hold</option>
                                                    </select>
                                                ) : currentPhase === 2 ? (
                                                    <select
                                                        value={candidate.phase2Decision || 'None'}
                                                        onChange={(e) => {
                                                            toast.error("Please update Phase 2 decision from Candidate List page.");
                                                        }}
                                                        disabled
                                                        className="w-full appearance-none px-3 py-1.5 pr-8 text-sm font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                                                    >
                                                        <option value="None">None</option>
                                                        <option value="Shortlisted">Shortlisted</option>
                                                        <option value="Hired">Hired</option>
                                                        <option value="Rejected">Rejected</option>
                                                        <option value="On Hold">On Hold</option>
                                                    </select>
                                                ) : (
                                                    <select
                                                        value={candidate.phase3Decision || 'None'}
                                                        onChange={(e) => handlePhase3DecisionChange(e.target.value)}
                                                        className="w-full appearance-none px-3 py-1.5 pr-8 text-sm font-bold rounded-lg border border-slate-300 bg-white outline-none cursor-pointer hover:border-blue-400 focus:ring-2 focus:ring-blue-100 text-slate-700 transition-colors"
                                                    >
                                                        <option value="None">-- Set Phase 3 Status --</option>
                                                        <option value="Offer Sent">Offer Sent</option>
                                                        <option value="Offer Accepted">Offer Accepted</option>
                                                        <option value="Joined">Joined</option>
                                                        <option value="No Show">No Show</option>
                                                        <option value="Offer Declined">Offer Declined</option>
                                                    </select>
                                                )}
                                            </div>
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

                            {/* In-Hand Offer */}
                            {candidate.inHandOffer ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">In-Hand Offer</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Company</p>
                                            <p className="text-slate-800 font-semibold text-sm">{candidate.offerCompany || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Their CTC</p>
                                            <p className="text-slate-800 font-semibold text-sm">{candidate.offerCTC ? `₹${candidate.offerCTC.toLocaleString()}` : 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In-Hand Offer</p>
                                    <span className="text-xs text-slate-400 font-medium">No</span>
                                </div>
                            )}

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
                                    <p className="text-slate-700 text-sm p-3 bg-slate-50 rounded-lg border border-slate-100 whitespace-pre-wrap">{candidate.remark}</p>
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
                <div className="lg:col-span-3 space-y-6">
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
                                (() => {
                                    const displayedRounds = candidate.interviewRounds.filter(r => (r.phase || 1) === currentPhase);
                                    return displayedRounds.map((round, index) => {
                                        const isAssigned = round.assignedTo?.some(u => u._id === user?._id || u._id?.toString() === user?._id?.toString());
                                        const canEvaluate = (isAssigned || hasSuperApprove) && ['Pending', 'Scheduled'].includes(round.status);
                                        const canEditFeedback = (isAssigned || hasSuperApprove) && ['Passed', 'Failed'].includes(round.status);
                                        const isEvaluating = evaluatingRoundId === round._id;
                                        const isEditingRound = editingRoundId === round._id;

                                        return (
                                            <div key={round._id} className="relative pl-8">
                                                {/* Timeline Line */}
                                                {index !== displayedRounds.length - 1 && (
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
                                                        {['Passed', 'Failed'].includes(round.status) && !isEvaluating && (
                                                            <div className={`rounded-lg p-4 border ${round.status === 'Passed' ? 'bg-emerald-50/60 border-emerald-100' : 'bg-red-50/60 border-red-100'}`}>
                                                                <div className="flex items-start gap-2">
                                                                    <MessageSquare size={16} className="text-slate-400 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Evaluator Feedback</p>
                                                                            {round.status === 'Passed' && round.rating && (
                                                                                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                                                                                    ⭐ {round.rating}/10
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{round.feedback}</p>
                                                                        
                                                                        {round.skillRatings && round.skillRatings.some(sr => sr.rating > 0) && (
                                                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                                {round.skillRatings.map((sr, idx) => (
                                                                                    <div key={idx} className="flex items-center justify-between text-[11px] bg-white/60 px-2.5 py-1.5 rounded-lg border border-slate-200/50 shadow-sm">
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <span className={`w-1.5 h-1.5 rounded-full ${sr.rating > 0 ? 'bg-blue-400' : 'bg-slate-300'}`}></span>
                                                                                            <span className={`text-slate-600 font-semibold ${sr.rating === 0 ? 'opacity-50' : ''}`}>{sr.skill}</span>
                                                                                        </div>
                                                                                        <span className={`${sr.rating > 0 ? 'font-black text-blue-700' : 'font-medium text-slate-400'}`}>{sr.rating}/10</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}

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

                                                        {/* CTA to Evaluate / Edit Feedback */}
                                                        {(canEvaluate || canEditFeedback) && !isEvaluating && !isEditingRound && (
                                                            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                                                                {canEvaluate && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setEvaluatingRoundId(round._id);
                                                                            setEvaluationForm({ 
                                                                                rating: '',
                                                                                skillRatings: (candidate.skillRatings || []).map(sr => ({ ...sr, rating: 0 })),
                                                                                showAssessment: false,
                                                                                manualSkillName: ''
                                                                            });
                                                                        }}
                                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                                                    >
                                                                        Submit Evaluation
                                                                    </button>
                                                                )}
                                                                {canEditFeedback && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setEvaluatingRoundId(round._id);
                                                                            setEvaluationForm({
                                                                                status: round.status,
                                                                                feedback: round.feedback || '',
                                                                                rating: round.rating || '',
                                                                                skillRatings: round.skillRatings && round.skillRatings.length > 0 
                                                                                    ? round.skillRatings 
                                                                                    : (candidate.skillRatings || [])
                                                                            });
                                                                        }}
                                                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                                                                    >
                                                                        <Edit2 size={14} /> Edit Feedback
                                                                    </button>
                                                                )}
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
                                                                                        onChange={(e) => setEvaluationForm({ ...evaluationForm, status: e.target.value, rating: '' })}
                                                                                        className="w-4 h-4 text-red-600 border-slate-300 focus:ring-red-500"
                                                                                    />
                                                                                    <span className="text-sm font-medium text-slate-800">Fail</span>
                                                                                </label>
                                                                            </div>
                                                                        </div>

                                                                        {/* Rating dropdown — shown only when Pass is selected */}
                                                                        {evaluationForm.status === 'Passed' && (
                                                                            <>
                                                                                {/* Skill Ratings inside Evaluation */}
                                                                                <div className="mb-4">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setEvaluationForm(prev => ({ ...prev, showAssessment: !prev.showAssessment }))}
                                                                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                                                                                            evaluationForm.showAssessment 
                                                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                                                                                : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                                                                                        }`}
                                                                                    >
                                                                                        <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                                                                            {evaluationForm.showAssessment ? <CheckCircle size={16} /> : <Plus size={16} />} 
                                                                                            Comprehensive Skill Assessment
                                                                                        </span>
                                                                                        <span className="text-[10px] opacity-80">
                                                                                            {evaluationForm.showAssessment ? 'Click to Close' : 'Click to Open & Rate'}
                                                                                        </span>
                                                                                    </button>

                                                                                    {evaluationForm.showAssessment && (
                                                                                        <div className="mt-2 bg-white/80 p-4 rounded-xl border border-blue-100 shadow-inner animate-in fade-in slide-in-from-top-1 duration-200">
                                                                                            {/* Manual Skill Addition Row */}
                                                                                            <div className="flex items-center gap-2 mb-4 p-2 bg-blue-50/50 rounded-lg border border-blue-100/50">
                                                                                                <input 
                                                                                                    type="text"
                                                                                                    placeholder="Add expert skill (e.g. System Design)..."
                                                                                                    value={evaluationForm.manualSkillName}
                                                                                                    onChange={(e) => setEvaluationForm(prev => ({ ...prev, manualSkillName: e.target.value }))}
                                                                                                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-blue-500"
                                                                                                />
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        if (!evaluationForm.manualSkillName.trim()) return;
                                                                                                        const newSkill = {
                                                                                                            skill: evaluationForm.manualSkillName.trim(),
                                                                                                            rating: 0,
                                                                                                            category: 'Additional'
                                                                                                        };
                                                                                                        setEvaluationForm(prev => ({
                                                                                                            ...prev,
                                                                                                            skillRatings: [...prev.skillRatings, newSkill],
                                                                                                            manualSkillName: ''
                                                                                                        }));
                                                                                                    }}
                                                                                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-bold hover:bg-blue-700 transition-colors"
                                                                                                >
                                                                                                    Add Skill
                                                                                                </button>
                                                                                            </div>

                                                                                            <div className="space-y-4">
                                                                                                {evaluationForm.skillRatings && evaluationForm.skillRatings.length > 0 ? (
                                                                                                    evaluationForm.skillRatings.map((sr, idx) => (
                                                                                                        <div key={idx} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 hover:bg-white rounded-lg transition-colors border-b border-slate-50 last:border-0 pb-3 sm:pb-2">
                                                                                                            <div className="flex items-center gap-2">
                                                                                                                <span className="text-sm font-semibold text-slate-700">{sr.skill}</span>
                                                                                                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                                                                                                    sr.category === 'Must-Have' ? 'bg-red-50 text-red-500' :
                                                                                                                    sr.category === 'Nice-To-Have' ? 'bg-blue-50 text-blue-500' :
                                                                                                                    'bg-slate-100 text-slate-500'
                                                                                                                }`}>
                                                                                                                    {sr.category}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <div className="flex items-center gap-3">
                                                                                                                <div className="flex items-center gap-1">
                                                                                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                                                                                                        <button
                                                                                                                            key={star}
                                                                                                                            type="button"
                                                                                                                            onClick={() => {
                                                                                                                                const newSkills = [...evaluationForm.skillRatings];
                                                                                                                                newSkills[idx] = { ...newSkills[idx], rating: star };
                                                                                                                                setEvaluationForm({ ...evaluationForm, skillRatings: newSkills });
                                                                                                                            }}
                                                                                                                            className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold transition-all ${
                                                                                                                                star <= sr.rating 
                                                                                                                                    ? 'bg-blue-600 text-white shadow-sm scale-110 z-10' 
                                                                                                                                    : 'bg-white text-slate-400 border border-slate-200 hover:border-blue-400 hover:text-blue-600'
                                                                                                                            }`}
                                                                                                                        >
                                                                                                                            {star}
                                                                                                                        </button>
                                                                                                                    ))}
                                                                                                                    <span className="ml-2 text-xs font-black text-blue-700 w-8">{sr.rating}/10</span>
                                                                                                                </div>
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    onClick={() => {
                                                                                                                        const newSkills = evaluationForm.skillRatings.filter((_, i) => i !== idx);
                                                                                                                        setEvaluationForm({ ...evaluationForm, skillRatings: newSkills });
                                                                                                                    }}
                                                                                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                                                                                                    title="Remove skill from this assessment"
                                                                                                                >
                                                                                                                    <Trash2 size={14} />
                                                                                                                </button>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    ))
                                                                                                ) : (
                                                                                                    <p className="text-center text-xs text-slate-400 py-4 italic">No skills defined for this candidate yet. Add one above.</p>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                <div>
                                                                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                                        Performance Rating
                                                                                        <span className="ml-1 text-xs text-slate-400 font-normal">(Optional, 1–10)</span>
                                                                                    </label>
                                                                                    <select
                                                                                        value={evaluationForm.rating}
                                                                                        onChange={(e) => setEvaluationForm({ ...evaluationForm, rating: e.target.value })}
                                                                                        className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                                                                                    >
                                                                                        <option value="">-- Select Rating --</option>
                                                                                        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => (
                                                                                            <option key={n} value={n}>{n} / 10{n === 10 ? ' — Outstanding' : n >= 8 ? ' — Excellent' : n >= 6 ? ' — Good' : n >= 4 ? ' — Average' : ' — Poor'}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>
                                                                            </>
                                                                        )}

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
                                                                                     setEvaluationForm({ status: 'Passed', feedback: '', rating: '', skillRatings: [], showAssessment: false, manualSkillName: '' });
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
                                                                                {actionLoading && <Loader size={14} className="animate-spin" />}
                                                                                {['Passed', 'Failed'].includes(round.status) ? 'Update Feedback' : 'Submit Decision'}
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
                                })()
                            )}
                        </div>
                    </div>



                    {/* Internal Remark Card */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Internal Remark</h3>
                            {!internalRemarkEditing && (
                                <button
                                    onClick={() => { setInternalRemarkText(candidate.internalRemark || ''); setInternalRemarkEditing(true); }}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                                >
                                    <Edit2 size={12} /> {candidate.internalRemark ? 'Edit' : 'Add Remark'}
                                </button>
                            )}
                        </div>
                        {internalRemarkEditing ? (
                            <div className="space-y-2">
                                <textarea
                                    rows={4}
                                    value={internalRemarkText}
                                    onChange={(e) => setInternalRemarkText(e.target.value)}
                                    placeholder="Add an internal remark about this candidate..."
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setInternalRemarkEditing(false)}
                                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleUpdateInternalRemark}
                                        disabled={internalRemarkLoading}
                                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {internalRemarkLoading && <Loader size={12} className="animate-spin" />} Save Remark
                                    </button>
                                </div>
                            </div>
                        ) : candidate.internalRemark ? (
                            <p className="text-slate-700 text-sm p-3 bg-slate-50 rounded-lg border border-slate-100 whitespace-pre-wrap">{candidate.internalRemark}</p>
                        ) : (
                            <p className="text-slate-400 text-sm italic">No remark added yet. Click "Add Remark" to write one.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CandidateDetails;
