import React, { useState, useEffect } from 'react';
import { Edit, Trash2, FileText, Loader, Upload, Plus, Eye, MoreVertical, Users, ThumbsUp, ThumbsDown, CheckCircle, XCircle, Clock, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../../components/Skeleton';

const CandidateList = ({ hiringRequestId }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [filterPreference, setFilterPreference] = useState('All');
    const [filterStatus, setFilterStatus] = useState('Interested');
    const [filterDecision, setFilterDecision] = useState('All');
    const [filterExperience, setFilterExperience] = useState('');
    const [filterInterviewStatus, setFilterInterviewStatus] = useState('All');
    const [filterRating, setFilterRating] = useState('All');
    const [filterPulledBy, setFilterPulledBy] = useState('All');
    const [users, setUsers] = useState([]);

    // Menu State
    const [activeMenu, setActiveMenu] = useState(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenu(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        if (hiringRequestId) {
            fetchCandidates();
        }
        fetchUsers();
    }, [hiringRequestId]);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/admin/users');
            let fetchedUsers = [];
            if (res.data?.success) {
                fetchedUsers = res.data.data || [];
            } else if (Array.isArray(res.data)) {
                fetchedUsers = res.data;
            }

            const filteredUsers = fetchedUsers.filter(u => {
                const roleNames = u.roles?.map(r => r.name) || [];
                if (roleNames.includes('Admin')) return true;

                let hasTaCreate = false;
                if (u.roles && Array.isArray(u.roles)) {
                    u.roles.forEach(role => {
                        if (role.permissions && Array.isArray(role.permissions)) {
                            const keys = role.permissions.map(p => typeof p === 'string' ? p : p.key);
                            if (keys.includes('ta.create') || keys.includes('*')) {
                                hasTaCreate = true;
                            }
                        }
                    });
                }
                return hasTaCreate;
            });

            setUsers(filteredUsers);
        } catch (error) {
            console.error('Failed to fetch users', error);
        }
    };

    // Computed filtered candidates
    const filteredCandidates = candidates.filter(candidate => {
        const matchPreference = filterPreference === 'All' || candidate.preference === filterPreference;
        const matchStatus = filterStatus === 'All' || candidate.status === filterStatus;
        const matchDecision = filterDecision === 'All' || (candidate.decision || 'None') === filterDecision;
        const matchExperience = !filterExperience || (candidate.totalExperience && Number(candidate.totalExperience) >= Number(filterExperience));

        // Interview filtering logic
        let matchInterviewStatus = true;
        if (filterInterviewStatus !== 'All') {
            const rounds = candidate.interviewRounds || [];
            const hasPending = rounds.some(r => r.status === 'Pending' || r.status === 'Scheduled');
            const hasFailed = rounds.some(r => r.status === 'Failed');
            const allPassed = rounds.length > 0 && rounds.every(r => r.status === 'Passed');

            if (filterInterviewStatus === 'None') matchInterviewStatus = rounds.length === 0;
            if (filterInterviewStatus === 'Pending') matchInterviewStatus = rounds.length > 0 && hasPending && !hasFailed;
            if (filterInterviewStatus === 'Passed') matchInterviewStatus = allPassed;
            if (filterInterviewStatus === 'Failed') matchInterviewStatus = hasFailed;
        }

        let matchRating = true;
        if (filterRating !== 'All') {
            const rounds = candidate.interviewRounds || [];
            const ratedRounds = rounds.filter(r => r.rating && r.rating > 0);
            if (ratedRounds.length === 0) {
                 matchRating = false;                 
            } else {
                 const minRequired = Number(filterRating);
                 const avgRating = ratedRounds.reduce((acc, curr) => acc + curr.rating, 0) / ratedRounds.length;
                 matchRating = avgRating >= minRequired;
            }
        }

        const matchPulledBy = filterPulledBy === 'All' || candidate.profilePulledBy === filterPulledBy;

        return matchPreference && matchStatus && matchDecision && matchExperience && matchInterviewStatus && matchRating && matchPulledBy;
    });

    // Compute Metrics for Summary Boxes
    const metrics = {
        total: candidates.length,
        interested: candidates.filter(c => c.status === 'Interested').length,
        inInterviews: candidates.filter(c => {
            const rounds = c.interviewRounds || [];
            if (rounds.length === 0) return false;
            const hasFailed = rounds.some(r => r.status === 'Failed');
            if (hasFailed) return false;
            return rounds.some(r => r.status === 'Pending' || r.status === 'Scheduled');
        }).length,
        hired: candidates.filter(c => c.decision === 'Hired').length,
        rejected: candidates.filter(c => c.decision === 'Rejected').length,
        onHold: candidates.filter(c => c.decision === 'On Hold').length,
    };

    const fetchCandidates = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/ta/candidates/${hiringRequestId}`);
            setCandidates(response.data.candidates || []);
        } catch (error) {
            console.error('Error fetching candidates:', error);
            toast.error('Failed to load candidates');
        } finally {
            setLoading(false);
        }
    };

    const hEdit = (candidate) => {
        navigate(`/ta/hiring-request/${hiringRequestId}/candidate/${candidate._id}/edit`);
    };

    const hView = (candidate) => {
        navigate(`/ta/hiring-request/${hiringRequestId}/candidate/${candidate._id}/view`);
    };

    const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

    const toggleMenu = (e, candidateId) => {
        e.stopPropagation();
        if (activeMenu === candidateId) {
            setActiveMenu(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + window.scrollY + 5,
                right: window.innerWidth - rect.right
            });
            setActiveMenu(candidateId);
        }
    };

    const handleEdit = (candidate) => {
        navigate(`/ta/hiring-request/${hiringRequestId}/candidate/${candidate._id}/edit`);
    };

    const handleView = (candidate) => {
        navigate(`/ta/hiring-request/${hiringRequestId}/candidate/${candidate._id}/view`);
    };

    const handleDelete = async (candidateId) => {
        if (!window.confirm('Are you sure you want to delete this candidate?')) return;

        try {
            await api.delete(`/ta/candidates/${candidateId}`);
            toast.success('Candidate deleted successfully');
            fetchCandidates();
        } catch (error) {
            console.error('Error deleting candidate:', error);
            toast.error(error.response?.data?.message || 'Failed to delete candidate');
        }
    };

    const handleAddNew = () => {
        navigate(`/ta/hiring-request/${hiringRequestId}/add-candidate`);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Interested':
                return 'bg-green-100 text-green-700';
            case 'Not Interested':
                return 'bg-red-100 text-red-700';
            case 'Not Relevant':
                return 'bg-gray-100 text-gray-700';
            case 'Not Picking':
                return 'bg-yellow-100 text-yellow-700';
            default:
                return 'bg-blue-100 text-blue-700';
        }
    };

    const handleDecisionChange = async (candidateId, newDecision) => {
        try {
            await api.patch(`/ta/candidates/${candidateId}/decision`, { decision: newDecision });
            toast.success('Decision updated');
            setCandidates(prev => prev.map(c =>
                c._id === candidateId ? { ...c, decision: newDecision } : c
            ));
        } catch (error) {
            console.error('Error updating decision:', error);
            toast.error('Failed to update decision');
        }
    };



    const getDecisionColor = (decision) => {
        switch (decision) {
            case 'Hired': return 'text-emerald-600 font-bold';
            case 'Rejected': return 'text-red-600 font-bold';
            case 'On Hold': return 'text-amber-600 font-bold';
            default: return 'text-slate-600';
        }
    };

    const getInterviewStatusSummary = (rounds = []) => {
        if (!rounds || rounds.length === 0) return { label: 'None', color: 'text-slate-400 bg-slate-50 border-slate-200' };

        const pending = rounds.filter(r => r.status === 'Pending' || r.status === 'Scheduled').length;
        const passed = rounds.filter(r => r.status === 'Passed').length;
        const failedRounds = rounds.filter(r => r.status === 'Failed');
        const failedCount = failedRounds.length;
        const total = rounds.length;

        if (failedCount > 0) {
            const failedNames = failedRounds.map(r => r.levelName).join(', ');
            return { label: `Failed: ${failedNames}`, color: 'text-red-700 bg-red-50 border-red-200' };
        }
        if (pending > 0) return { label: `${passed}/${total} Completed`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
        if (passed === total) return { label: 'All Passed', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };

        return { label: 'In Progress', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Skeleton className="h-6 w-32 mb-2" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-10 w-36" />
                </div>
                {/* Skeleton for Summary Boxes */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-none" />
                    ))}
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex gap-4">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-4">
                        <Skeleton className="h-4 w-1/6" />
                        <Skeleton className="h-4 w-1/6" />
                        <Skeleton className="h-4 w-1/6" />
                        <Skeleton className="h-4 w-1/6" />
                        <Skeleton className="h-4 w-1/6" />
                        <Skeleton className="h-4 w-1/6" />
                    </div>
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="p-4 border-b border-slate-100 flex gap-4 items-center">
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest leading-loose">Pipeline</h3>
                </div>
                {(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.create')) && (
                    <button
                        onClick={handleAddNew}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus size={18} />
                        Add Candidate
                    </button>
                )}
            </div>

            {/* Pipeline Summary Boxes - Redesigned */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="bg-white border-t border-x border-slate-200 border-b-4 border-b-purple-500 shadow-sm p-5 relative overflow-hidden group hover:bg-slate-50 transition-colors">
                    <span className="block text-[28px] font-light text-slate-800 leading-none mb-1 relative z-10">{metrics.total}</span>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Total Sourced</span>
                    <Users className="absolute -right-2 top-1/2 -translate-y-1/2 text-purple-600 opacity-5 size-16 group-hover:opacity-10 transition-opacity" />
                </div>

                <div className="bg-white border-t border-x border-slate-200 border-b-4 border-b-sky-500 shadow-sm p-5 relative overflow-hidden group hover:bg-slate-50 transition-colors">
                    <span className="block text-[28px] font-light text-slate-800 leading-none mb-1 relative z-10">{metrics.interested}</span>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Pre-Screened</span>
                    <ThumbsUp className="absolute -right-2 top-1/2 -translate-y-1/2 text-sky-600 opacity-5 size-16 group-hover:opacity-10 transition-opacity" />
                </div>

                <div className="bg-white border-t border-x border-slate-200 border-b-4 border-b-amber-500 shadow-sm p-5 relative overflow-hidden group hover:bg-slate-50 transition-colors">
                    <span className="block text-[28px] font-light text-slate-800 leading-none mb-1 relative z-10">{metrics.inInterviews}</span>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">In Interviews</span>
                    <UserCheck className="absolute -right-2 top-1/2 -translate-y-1/2 text-amber-600 opacity-5 size-16 group-hover:opacity-10 transition-opacity" />
                </div>

                <div className="bg-white border-t border-x border-slate-200 border-b-4 border-b-emerald-500 shadow-sm p-5 relative overflow-hidden group hover:bg-slate-50 transition-colors">
                    <span className="block text-[28px] font-light text-slate-800 leading-none mb-1 relative z-10">{metrics.hired}</span>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Hired</span>
                    <CheckCircle className="absolute -right-2 top-1/2 -translate-y-1/2 text-emerald-600 opacity-5 size-16 group-hover:opacity-10 transition-opacity" />
                </div>

                <div className="bg-white border-t border-x border-slate-200 border-b-4 border-b-rose-500 shadow-sm p-5 relative overflow-hidden group hover:bg-slate-50 transition-colors">
                    <span className="block text-[28px] font-light text-slate-800 leading-none mb-1 relative z-10">{metrics.rejected}</span>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Rejected</span>
                    <ThumbsDown className="absolute -right-2 top-1/2 -translate-y-1/2 text-rose-600 opacity-5 size-16 group-hover:opacity-10 transition-opacity" />
                </div>

                <div className="bg-white border-t border-x border-slate-200 border-b-4 border-b-slate-400 shadow-sm p-5 relative overflow-hidden group hover:bg-slate-50 transition-colors">
                    <span className="block text-[28px] font-light text-slate-800 leading-none mb-1 relative z-10">{metrics.onHold}</span>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">On Hold</span>
                    <Clock className="absolute -right-2 top-1/2 -translate-y-1/2 text-slate-600 opacity-5 size-16 group-hover:opacity-10 transition-opacity" />
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Preference</label>
                    <select
                        value={filterPreference}
                        onChange={(e) => setFilterPreference(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="All">All Preferences</option>
                        <option value="Highly Recommended">Highly Recommended</option>
                        <option value="Recommended">Recommended</option>
                        <option value="Neutral / Average">Neutral / Average</option>
                        <option value="Not Recommended">Not Recommended</option>
                        <option value="Very Poor">Very Poor</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Interested">Interested</option>
                        <option value="Not Interested">Not Interested</option>
                        <option value="Not Relevant">Not Relevant</option>
                        <option value="Not Picking">Not Picking</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Decision</label>
                    <select
                        value={filterDecision}
                        onChange={(e) => setFilterDecision(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="All">All Decisions</option>
                        <option value="Hired">Hired</option>
                        <option value="Rejected">Rejected</option>
                        <option value="On Hold">On Hold</option>
                        <option value="None">None</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Interview Status</label>
                    <select
                        value={filterInterviewStatus}
                        onChange={(e) => setFilterInterviewStatus(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-36"
                    >
                        <option value="All">All Interviews</option>
                        <option value="None">None Scheduled</option>
                        <option value="Pending">In Progress</option>
                        <option value="Passed">All Passed</option>
                        <option value="Failed">Failed</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Min Avg Rating</label>
                    <select
                        value={filterRating}
                        onChange={(e) => setFilterRating(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-32"
                    >
                        <option value="All">All Ratings</option>
                        <option value="9">9+ (Excellent)</option>
                        <option value="7">7+ (Good)</option>
                        <option value="5">5+ (Average)</option>
                        <option value="3">3+ (Below Avg)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Pulled By</label>
                    <select
                        value={filterPulledBy}
                        onChange={(e) => setFilterPulledBy(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-36"
                    >
                        <option value="All">All Users</option>
                        {users.map(u => (
                            <option key={u._id} value={`${u.firstName || ''} ${u.lastName || ''}`.trim()}>
                                {u.firstName} {u.lastName}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Min Experience (Yrs)</label>
                    <input
                        type="number"
                        min="0"
                        placeholder="e.g. 2"
                        value={filterExperience}
                        onChange={(e) => setFilterExperience(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-32"
                    />
                </div>
                {(filterPreference !== 'All' || filterStatus !== 'Interested' || filterDecision !== 'All' || filterExperience !== '' || filterInterviewStatus !== 'All' || filterRating !== 'All' || filterPulledBy !== 'All') && (
                    <button
                        onClick={() => {
                            setFilterPreference('All');
                            setFilterStatus('Interested');
                            setFilterDecision('All');
                            setFilterExperience('');
                            setFilterInterviewStatus('All');
                            setFilterRating('All');
                            setFilterPulledBy('All');
                        }}
                        className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mb-0.5"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Candidates Table */}
            {candidates.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <Upload className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Candidates Yet</h3>
                    <p className="text-slate-500 mb-4">Start by uploading candidate resumes and filling their details</p>
                    {(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.create')) && (
                        <button
                            onClick={handleAddNew}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Upload First Resume
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 mb-24">
                    <div className="w-full overflow-x-auto">
                        <div className="min-w-[1100px]">
                            <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr key="header-row">
                                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Candidate</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Contact</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Experience</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Preference</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Interviews</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Decision</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Pulled By</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredCandidates.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                                            No candidates match the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCandidates.map((candidate) => (
                                        <tr key={candidate._id} className="hover:bg-slate-50 bg-white transition-colors border-b border-slate-100 last:border-0">
                                            <td className="px-4 py-4 align-top">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[13px] font-bold text-slate-700 leading-tight">
                                                        {candidate.candidateName.split(' ')[0]}<br />
                                                        {candidate.candidateName.split(' ').slice(1).join(' ')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <div className="flex flex-col gap-1 text-[12px]">
                                                    <span className="text-slate-500 font-medium">{candidate.email}</span>
                                                    <span className="text-slate-500 font-medium">{candidate.mobile}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <span className="text-[13px] font-semibold text-slate-700">{candidate.totalExperience} yrs</span>
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <div className="flex flex-col gap-0.5 text-[13px]">
                                                    {candidate.preference ? (
                                                        <>
                                                            <span className="text-slate-700 font-medium">
                                                                {candidate.preference.split(' ')[0]}
                                                            </span>
                                                            <span className="text-slate-700 font-medium">
                                                                {candidate.preference.split(' ').slice(1).join(' ')}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400 italic">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                {(() => {
                                                    const summary = getInterviewStatusSummary(candidate.interviewRounds);
                                                    
                                                    const rounds = candidate.interviewRounds || [];
                                                    const hasFailed = rounds.some(r => r.status === 'Failed');
                                                    const ratedRounds = rounds.filter(r => r.rating && r.rating > 0);
                                                    let avgRating = null;
                                                    
                                                    if (!hasFailed && ratedRounds.length > 0) {
                                                        const total = ratedRounds.reduce((acc, curr) => acc + curr.rating, 0);
                                                        // Format to 1 decimal place, or no decimals if whole number
                                                        let calculatedAvg = total / ratedRounds.length;
                                                        avgRating = Number.isInteger(calculatedAvg) ? calculatedAvg.toString() : calculatedAvg.toFixed(1);
                                                    }

                                                    return (
                                                        <div className="flex flex-col gap-1.5 items-start">
                                                            <span className={`px-2 py-0.5 border rounded-md text-[10px] font-bold tracking-wide ${summary.color}`}>
                                                                {summary.label}
                                                            </span>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap leading-tight">
                                                                    {candidate.interviewRounds?.length || 0} rounds total
                                                                </span>
                                                                {avgRating && (
                                                                    <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 self-start">
                                                                        ⭐ {avgRating}/10
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })()}
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <div className="relative inline-block w-full max-w-[110px]">
                                                    <select
                                                        value={candidate.decision || 'None'}
                                                        onChange={(e) => handleDecisionChange(candidate._id, e.target.value)}
                                                        className={`w-full appearance-none px-2.5 py-1 pr-7 text-[12px] font-bold rounded-lg border border-slate-200 bg-white outline-none cursor-pointer transition-colors hover:border-slate-300 focus:ring-2 focus:ring-blue-100 ${getDecisionColor(candidate.decision || 'None')}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        disabled={!(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.edit'))}
                                                    >
                                                        <option value="None" className="text-slate-600">None</option>
                                                        <option value="Hired" className="text-emerald-600 font-bold">Hired</option>
                                                        <option value="Rejected" className="text-red-600 font-bold">Rejected</option>
                                                        <option value="On Hold" className="text-amber-600 font-bold">On Hold</option>
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                                        <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <div className="flex flex-col gap-0.5 text-[12px] text-slate-500 font-medium whitespace-nowrap">
                                                    <span 
                                                        className="font-bold text-blue-600 mb-0.5 max-w-[120px] truncate cursor-pointer hover:underline" 
                                                        title={candidate.profilePulledBy || '-'}
                                                        onClick={() => candidate.profilePulledBy && navigate(`/ta/user-dashboard/${encodeURIComponent(candidate.profilePulledBy)}`)}
                                                    >
                                                        {candidate.profilePulledBy || '-'}
                                                    </span>
                                                    <span>{format(new Date(candidate.uploadedAt), 'MMM dd, yyyy')}</span>
                                                    <span className="text-[10px] mt-0.5">{format(new Date(candidate.uploadedAt), 'hh:mm a')}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-top text-center">
                                                <button
                                                    onClick={(e) => toggleMenu(e, candidate._id)}
                                                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative"
                                                >
                                                    <MoreVertical size={18} />
                                                </button>

                                                {/* Dropdown Menu */}
                                                {activeMenu === candidate._id && (
                                                    <div
                                                        className="fixed z-[9999] w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1"
                                                        style={{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <button
                                                            onClick={() => {
                                                                handleView(candidate);
                                                                setActiveMenu(null);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                                        >
                                                            <Eye size={16} className="text-slate-500" />
                                                            View Details
                                                        </button>

                                                        <a
                                                            href={candidate.resumeUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                                            onClick={() => setActiveMenu(null)}
                                                        >
                                                            <FileText size={16} className="text-slate-500" />
                                                            View Resume
                                                        </a>

                                                        {(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.edit')) && (
                                                            <button
                                                                onClick={() => {
                                                                    handleEdit(candidate);
                                                                    setActiveMenu(null);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                                            >
                                                                <Edit size={16} className="text-slate-500" />
                                                                Edit Candidate
                                                            </button>
                                                        )}

                                                        <div className="border-t border-slate-100 my-1"></div>

                                                        {(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.delete')) && (
                                                            <button
                                                                onClick={() => {
                                                                    handleDelete(candidate._id);
                                                                    setActiveMenu(null);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                                                            >
                                                                <Trash2 size={16} />
                                                                Delete Candidate
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
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
        </div>
    );
};

export default CandidateList;

