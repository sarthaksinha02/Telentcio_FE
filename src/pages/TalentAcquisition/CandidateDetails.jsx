import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Loader, ArrowLeft, Download, Plus, CheckCircle, XCircle, Clock, User, Calendar, MessageSquare, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import Skeleton from '../../components/Skeleton';

const CandidateDetails = ({ candidateId: propCandidateId, hiringRequestId: propHiringRequestId, isSidePanel = false, onUpdate }) => {
    const { user } = useAuth();
    const params = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const candidateId = propCandidateId || params.candidateId;
    const hiringRequestId = propHiringRequestId || params.hiringRequestId;

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
            onUpdate?.();
            window.dispatchEvent(new Event('refreshNotifications'));
        } catch (error) {
            console.error('Error adding round:', error);
            toast.error(error.response?.data?.message || 'Failed to add round');
        } finally {
            setActionLoading(false);
        }
    }, [newRound, selectedInterviewer, candidateId, fetchCandidate, currentPhase, onUpdate]);

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
            onUpdate?.();
            window.dispatchEvent(new Event('refreshNotifications'));
        } catch (error) {
            console.error('Error updating round:', error);
            toast.error(error.response?.data?.message || 'Failed to update round');
        } finally {
            setActionLoading(false);
        }
    }, [editingRoundForm, candidateId, fetchCandidate, onUpdate]);

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
            onUpdate?.();
            window.dispatchEvent(new Event('refreshNotifications'));
        } catch (error) {
            console.error(error);
            toast.error('Failed to apply workflow completely. Some rounds may have failed.');
        } finally {
            setActionLoading(false);
        }
    }, [selectedWorkflow, interviewWorkflows, workflowMapping, candidateId, fetchCandidate, currentPhase, onUpdate]);

    const handleDeleteRound = useCallback(async (roundId) => {
        if (!window.confirm('Are you sure you want to delete this round?')) return;
        try {
            setActionLoading(true);
            await api.delete(`/ta/candidates/${candidateId}/rounds/${roundId}`);
            toast.success('Round deleted');
            fetchCandidate();
            onUpdate?.();
        } catch (error) {
            console.error('Error deleting round:', error);
            toast.error('Failed to delete round');
        } finally {
            setActionLoading(false);
        }
    }, [candidateId, fetchCandidate, onUpdate]);

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
            setEvaluationForm({ status: 'Passed', feedback: '', rating: '', skillRatings: [], showAssessment: false, manualSkillName: '' });
            fetchCandidate();
            onUpdate?.();
        } catch (error) {
            console.error('Error submitting evaluation:', error);
            toast.error(error.response?.data?.message || 'Failed to submit evaluation');
        } finally {
            setActionLoading(false);
        }
    }, [evaluationForm, candidateId, fetchCandidate, onUpdate]);

    const handlePhase3DecisionChange = async (newDecision) => {
        try {
            await api.patch(`/ta/candidates/${candidateId}/phase3-decision`, { phase3Decision: newDecision });
            toast.success('Phase 3 Decision updated');
            setCandidate(prev => ({ ...prev, phase3Decision: newDecision }));
            onUpdate?.();
            window.dispatchEvent(new Event('refreshNotifications'));
        } catch (error) {
            console.error('Error updating Phase 3 decision:', error);
            toast.error('Failed to update Phase 3 decision');
        }
    };

    const handleTransferToOnboarding = async () => {
        if (!window.confirm("Are you sure you want to transfer this candidate to the onboarding pipeline? This will create a new onboarding record for them.")) return;

        try {
            setActionLoading(true);
            await api.post(`/ta/candidates/${candidateId}/transfer-to-onboarding`);
            toast.success('Candidate transferred successfully to onboarding.');
            fetchCandidate();
            onUpdate?.();
        } catch (error) {
            console.error('Transfer error:', error);
            toast.error(error.response?.data?.message || 'Failed to transfer candidate');
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdateInternalRemark = async () => {
        try {
            setInternalRemarkLoading(true);
            await api.patch(`/ta/candidates/${candidateId}/internal-remark`, { internalRemark: internalRemarkText });
            setCandidate(prev => ({ ...prev, internalRemark: internalRemarkText }));
            setInternalRemarkEditing(false);
            toast.success('Internal remark saved successfully');
            onUpdate?.();
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

    const { isAdmin, userPermissions, hasSuperApprove, canManageRounds } = useMemo(() => {
        const admin = user?.roles?.includes('Admin') || user?.roles?.some(r => r.name === 'Admin');
        const perms = user?.permissions || [];
        const superApprove = perms.includes('ta.super_approve') || perms.includes('*') || admin;
        const manageRounds = admin || perms.includes('ta.edit');
        return { isAdmin: admin, userPermissions: perms, hasSuperApprove: superApprove, canManageRounds: manageRounds };
    }, [user]);

    if (loading) {
        return (
            <div className="h-full bg-slate-50 p-6 space-y-6">
                <Skeleton className="h-12 w-3/4 rounded-xl" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                </div>
            </div>
        );
    }

    if (!candidate) return <div className="text-center p-8">Candidate not found</div>;

    const currentRounds = candidate.interviewRounds?.filter(r => r.phase === currentPhase) || [];

    return (
        <div className={`bg-slate-50 pb-12 ${!isSidePanel ? 'min-h-screen' : ''}`}>
            {/* Header - Only show if NOT in side panel */}
            {!isSidePanel && (
                <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <div className="w-full px-4 lg:px-6 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={20}/></button>
                            <h1 className="text-xl font-bold text-slate-800">{candidate.candidateName}</h1>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Pane: Resume Viewer (CV at Top as requested) */}
            {isSidePanel && (
                <div className="w-full h-[550px] border-b border-slate-200 bg-slate-100 flex flex-col relative group shrink-0">
                    <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
                        <div className="flex items-center gap-2">
                            <Download size={14} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Candidate Resume Preview</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {candidate.resumeUrl && (
                                <>
                                    <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded font-bold uppercase transition-colors border border-slate-200">Full View</a>
                                    <a href={candidate.resumeUrl} download className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded font-bold uppercase transition-colors shadow-sm">Download</a>
                                </>
                            )}
                        </div>
                    </div>
                    {candidate.resumeUrl ? (
                        <div className="flex-1 w-full bg-slate-200/50">
                            <iframe 
                                src={`${candidate.resumeUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                                title="Candidate Resume"
                                className="w-full h-full border-none"
                                loading="lazy"
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 gap-4">
                             <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-2"><Download size={32} className="opacity-20" /></div>
                             <p className="font-bold text-slate-500">No resume uploaded for this user</p>
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Content Pane: All Details at the Bottom */}
            <div className="p-6 space-y-8 max-w-4xl mx-auto">
                {/* Integrated Profile Summary Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
                        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <User size={18} className="text-slate-400" />
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Professional Profile</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                {canManageRounds && (
                                    <button onClick={() => navigate(`/ta/hiring-request/${hiringRequestId}/candidate/${candidateId}/edit`)} className="text-slate-500 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-md transition-colors">
                                        <Edit2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                                <div className="col-span-2 flex items-center gap-3 flex-wrap">
                                    <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 uppercase tracking-tight">
                                        Status: {candidate.status}
                                    </span>
                                    {candidate.decision && candidate.decision !== 'None' && (
                                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100 uppercase tracking-tight">
                                            Phase 1: {candidate.decision}
                                        </span>
                                    )}
                                    {candidate.isTransferredToOnboarding && (
                                        <span className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-sm">
                                            <CheckCircle size={14} /> Onboarded
                                        </span>
                                    )}
                                </div>
                                
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Source Information</p>
                                    <p className="text-slate-800 font-semibold">{candidate.source || 'Standard Recruitment'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notice & Readiness</p>
                                    <p className="text-blue-600 font-bold">{candidate.noticePeriod ? `${candidate.noticePeriod} Days` : 'Immediate'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Experience Level</p>
                                    <p className="text-slate-800 font-bold">{candidate.totalExperience ? `${candidate.totalExperience} Years` : 'Fresh Graduate'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current/Exp CTC</p>
                                    <p className="text-slate-800 font-semibold text-sm">₹{candidate.currentCTC?.toLocaleString() || 'N/A'} / <span className="text-emerald-600">₹{candidate.expectedCTC?.toLocaleString() || 'N/A'}</span></p>
                                </div>
                                <div className="col-span-2 pt-4 border-t border-slate-50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Organization</p>
                                    <p className="text-slate-800 font-bold text-lg leading-tight">{candidate.currentCompany || 'Not Specified'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Interview Workflow Section */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Clock size={18} className="text-slate-400" />
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Interview Workflow (Phase {currentPhase})</h3>
                            </div>
                            {canManageRounds && (
                                <button onClick={() => setIsAddingRound(!isAddingRound)} className="p-1 px-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5">
                                    <Plus size={14}/> {isAddingRound ? 'Cancel' : 'Add Round'}
                                </button>
                            )}
                        </div>

                        <div className="p-6">
                            {isAddingRound && (
                                <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl animate-in slide-in-from-top-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                        <input type="text" placeholder="Title (e.g. L1 Technical Interview)" value={newRound.levelName} onChange={(e) => setNewRound({...newRound, levelName: e.target.value})} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
                                        <input type="datetime-local" value={newRound.scheduledDate} onChange={(e) => setNewRound({...newRound, scheduledDate: e.target.value})} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={handleAddRound} disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50">Schedule Round</button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
                                {currentRounds.length > 0 ? (
                                    currentRounds.map((round) => {
                                        const isEvaluating = evaluatingRoundId === round._id;
                                        return (
                                            <div key={round._id} className="relative pl-10">
                                                <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-white ring-2 ${round.status === 'Passed' ? 'ring-emerald-500 bg-emerald-500' : round.status === 'Failed' ? 'ring-rose-500 bg-rose-500' : 'ring-amber-400 bg-amber-400'}`}></div>
                                                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors group">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-800">{round.levelName}</h4>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar size={12}/> {round.scheduledDate ? format(new Date(round.scheduledDate), 'dd MMM, hh:mm a') : 'Not Scheduled'}</span>
                                                                {round.status === 'Pending' && (
                                                                    <button onClick={() => setEvaluatingRoundId(round._id)} className="text-[10px] text-blue-600 font-bold hover:underline">Submit Decision</button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadgeColor(round.status)}`}>{round.status}</span>
                                                    </div>
                                                    {round.feedback && (
                                                        <div className="mt-3 p-3 bg-white rounded-lg border border-slate-100 text-[11px] text-slate-600 leading-relaxed italic">
                                                            {round.feedback}
                                                        </div>
                                                    )}

                                                    {/* Inline Evaluation Form */}
                                                    {isEvaluating && (
                                                        <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 animate-in fade-in">
                                                            <div className="flex gap-4">
                                                                <button onClick={() => setEvaluationForm({...evaluationForm, status: 'Passed'})} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${evaluationForm.status === 'Passed' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>Pass</button>
                                                                <button onClick={() => setEvaluationForm({...evaluationForm, status: 'Failed'})} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${evaluationForm.status === 'Failed' ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}>Fail</button>
                                                            </div>
                                                            <textarea rows={3} placeholder="Write assessment remarks..." value={evaluationForm.feedback} onChange={(e) => setEvaluationForm({...evaluationForm, feedback: e.target.value})} className="w-full px-3 py-2 text-[11px] border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none resize-none shadow-inner"></textarea>
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => setEvaluatingRoundId(null)} className="px-3 py-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">Cancel</button>
                                                                <button onClick={() => submitEvaluation(round._id)} disabled={actionLoading} className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition-colors">Save Decision</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 italic text-xs">
                                        No active interview rounds in this phase.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Internal Assessment Note */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Internal Findings</h3>
                            {!internalRemarkEditing && (
                                <button onClick={() => { setInternalRemarkText(candidate.internalRemark || ''); setInternalRemarkEditing(true); }} className="text-blue-600 hover:text-blue-800 text-xs font-bold">
                                    {candidate.internalRemark ? 'Edit Findings' : '+ New Assessment Note'}
                                </button>
                            )}
                        </div>
                        <div className="p-6">
                            {internalRemarkEditing ? (
                                <div className="space-y-3">
                                    <textarea rows={4} value={internalRemarkText} onChange={(e) => setInternalRemarkText(e.target.value)} placeholder="Overall assessment results..." className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none shadow-inner" autoFocus />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setInternalRemarkEditing(false)} className="px-4 py-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">Discard</button>
                                        <button onClick={handleUpdateInternalRemark} className="px-5 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition-all">Save Findings</button>
                                    </div>
                                </div>
                            ) : (
                                <p className={`text-sm ${candidate.internalRemark ? 'text-slate-700 italic leading-relaxed' : 'text-slate-400 italic'}`}>
                                    {candidate.internalRemark || 'No internal assessment notes recorded.'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
    );
};

export default CandidateDetails;
