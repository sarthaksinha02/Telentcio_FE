import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Trash2, FileText, Loader, Upload, Plus, Eye, MoreVertical, Users, ThumbsUp, ThumbsDown, CheckCircle, XCircle, Clock, UserCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../../components/Skeleton';

const Phase1Candidates = () => {
    const { hiringRequestId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCandidates, setTotalCandidates] = useState(0);

    // Filter States
    const [filterPreference, setFilterPreference] = useState('All');
    const [filterStatus, setFilterStatus] = useState('Interested');
    const [filterDecision, setFilterDecision] = useState('All');
    const [filterExperience, setFilterExperience] = useState('');
    const [filterInterviewStatus, setFilterInterviewStatus] = useState('All');
    const [filterRating, setFilterRating] = useState('All');
    const [filterPulledBy] = useState('All');

    // Menu State
    const [activeMenu, setActiveMenu] = useState(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClose = () => setActiveMenu(null);
        document.addEventListener('click', handleClose);
        window.addEventListener('scroll', handleClose, true);
        return () => {
            document.removeEventListener('click', handleClose);
            window.removeEventListener('scroll', handleClose, true);
        };
    }, []);


    // Reset page to 1 when any filter changes
    useEffect(() => {
        setPage(1);
    }, [filterPreference, filterStatus, filterDecision, filterExperience, filterInterviewStatus, filterRating]);

    // Computed filtered candidates based on active frontend filters logic (if any are retained with backend pages)
    // Note: Since we fetch exact Phase 1 users via the backend page by page, most complex frontend filter limits may cause 
    // mismatched views unless we send filters to the backend. We'll retain basic array filtering for the current page chunk.
    const filteredCandidates = useMemo(() => {
        return candidates.filter(candidate => {
            const matchPreference = filterPreference === 'All' || candidate.preference === filterPreference;
            const matchStatus = filterStatus === 'All' || candidate.status === filterStatus;
            const matchExperience = !filterExperience || (candidate.totalExperience && Number(candidate.totalExperience) >= Number(filterExperience));

            // Interview filtering logic
            let matchInterviewStatus = true;
            if (filterInterviewStatus !== 'All') {
                if (filterInterviewStatus === 'None') {
                    matchInterviewStatus = !candidate.interviewRounds || candidate.interviewRounds.length === 0;
                } else if (['Pending', 'Scheduled', 'Failed', 'Passed'].includes(filterInterviewStatus)) {
                    matchInterviewStatus = candidate.interviewRounds?.some(round => round.status === filterInterviewStatus);
                } else if (filterInterviewStatus === 'In_Process') {
                    matchInterviewStatus = candidate.interviewRounds?.length > 0 && !candidate.interviewRounds.some(round => round.status === 'Failed');
                }
            }

            const matchRating = filterRating === 'All' || (candidate.interviewRounds?.some(round => round.rating && round.rating >= Number(filterRating)));

            return matchPreference && matchStatus && matchExperience && matchInterviewStatus && matchRating;
        });
    }, [candidates, filterPreference, filterStatus, filterExperience, filterInterviewStatus, filterRating]);

    const itemsPerPage = 10;
    // totalPages and paginatedCandidates are now backend controlled, so paginatedCandidates is just filteredCandidates
    const paginatedCandidates = filteredCandidates;

    const fetchCandidates = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get(`/ta/candidates/shortlisted/${hiringRequestId}?page=${page}&limit=${itemsPerPage}&preference=${filterPreference}&status=${filterStatus}&experience=${filterExperience}&interviewStatus=${filterInterviewStatus}&rating=${filterRating}`);

            // Expected backend format: { candidates: [], totalPages: N, count: N }
            setCandidates(response.data.candidates || []);
            setTotalPages(response.data.totalPages || 1);
            setTotalCandidates(response.data.count || 0);

        } catch (error) {
            console.error('Error fetching Phase 1 candidates:', error);
            toast.error('Failed to load Phase 1 candidates');
        } finally {
            setLoading(false);
        }
    }, [hiringRequestId, page, itemsPerPage, filterPreference, filterStatus, filterExperience, filterInterviewStatus, filterRating]);

    useEffect(() => {
        if (hiringRequestId) {
            fetchCandidates();
        }
    }, [hiringRequestId, fetchCandidates]);

    // Compute Metrics for Summary Boxes
    const metrics = useMemo(() => {
        // These metrics are now computed based on the *current page* of candidates,
        // or directly from backend data where available (like totalCandidates).
        // Apply PulledBy filter to the base dataset for metrics if a user is selected
        const baseCandidates = filterPulledBy === 'All'
            ? candidates
            : candidates.filter(c => c.profilePulledBy === filterPulledBy);

        return {
            totalShortlisted: filterPulledBy === 'All' ? totalCandidates : baseCandidates.length, // If filtered, use local array length instead of total backend count
            totalScreened: baseCandidates.filter(c => c.status === 'Interested').length,
            interviewScheduled: baseCandidates.filter(c => {
                const rounds = c.interviewRounds || [];
                if (rounds.length === 0) return false;
                const hasFailed = rounds.some(r => r.status === 'Failed');
                if (hasFailed) return false;
                return true;
            }).length,
        };
    }, [candidates, totalCandidates, filterPulledBy]);



    const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

    const toggleMenu = useCallback((e, candidateId) => {
        e.stopPropagation();
        if (activeMenu === candidateId) {
            setActiveMenu(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = 220; // safe estimation of dropdown height

            let positionStyles = {
                right: window.innerWidth - rect.right
            };

            // If not enough space below, open upwards
            if (spaceBelow < menuHeight && rect.top > menuHeight) {
                positionStyles.bottom = window.innerHeight - rect.top + 5;
            } else {
                positionStyles.top = rect.bottom + 5;
            }

            setMenuPosition(positionStyles);
            setActiveMenu(candidateId);
        }
    }, [activeMenu]);

    const handleEdit = useCallback((candidate) => {
        navigate(`/ta/hiring-request/${hiringRequestId}/candidate/${candidate._id}/edit`);
    }, [navigate, hiringRequestId]);

    const handleView = useCallback((candidate) => {
        navigate(`/ta/hiring-request/${hiringRequestId}/candidate/${candidate._id}/view?phase=1`);
    }, [navigate, hiringRequestId]);

    const handleDelete = useCallback(async (candidateId) => {
        if (!window.confirm('Are you sure you want to delete this candidate?')) return;

        try {
            await api.delete(`/ta/candidates/${candidateId}`);
            toast.success('Candidate deleted successfully');
            fetchCandidates();
        } catch (error) {
            console.error('Error deleting candidate:', error);
            toast.error(error.response?.data?.message || 'Failed to delete candidate');
        }
    }, [fetchCandidates]);

    const handleAddNew = useCallback(() => {
        navigate(`/ta/hiring-request/${hiringRequestId}/add-candidate`);
    }, [navigate, hiringRequestId]);



    const handleDecisionChange = async (candidateId, newDecision) => {
        try {
            await api.patch(`/ta/candidates/${candidateId}/decision`, { decision: newDecision });
            toast.success('Decision updated');
            // Re-fetch candidates to ensure the list is up-to-date and reflects any backend changes
            fetchCandidates();
        } catch (error) {
            console.error('Error updating decision:', error);
            toast.error('Failed to update decision');
        }
    };

    const getDecisionColor = (decision) => {
        switch (decision) {
            case 'Shortlisted': return 'text-emerald-600 font-bold';
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[...Array(4)].map((_, i) => (
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
        <div className="min-h-screen bg-slate-50">
            {/* Header / Sticky Top Navbar */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500 flex items-center justify-center h-8 w-8"
                            aria-label="Go back"
                        >
                            &larr;
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Phase 2 (Shortlisted)</h1>
                    </div>
                    <div className="flex gap-2">
                        {/* Phase Toggle */}
                        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                            <button
                                onClick={() => navigate(`/ta/view/${hiringRequestId}?tab=applications`)}
                                className="px-4 py-2 text-sm font-semibold bg-white text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Phase 1
                            </button>
                            <button
                                className="px-4 py-2 text-sm font-semibold bg-slate-800 text-white cursor-default border-l border-slate-600"
                            >
                                Phase 2
                            </button>
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
                </div>
            </div>

            {/* Main Content */}
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

                {/* Pipeline Summary Boxes - Redesigned */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div 
                        onClick={() => { setFilterDecision('All'); setFilterStatus('All'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-purple-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{metrics.totalShortlisted}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Total Shortlisted</span>
                        <Users className="absolute -right-2 top-1/2 -translate-y-1/2 text-purple-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div 
                        onClick={() => { setFilterStatus('Interested'); setFilterDecision('All'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-sky-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{metrics.totalScreened}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Total Screened</span>
                        <UserCheck className="absolute -right-2 top-1/2 -translate-y-1/2 text-sky-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div 
                        onClick={() => { setFilterInterviewStatus('In_Process'); setFilterDecision('All'); setFilterStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-amber-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{metrics.interviewScheduled}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Interview Scheduled</span>
                        <Clock className="absolute -right-2 top-1/2 -translate-y-1/2 text-amber-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
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
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Interview Status</label>
                        <select
                            value={filterInterviewStatus}
                            onChange={(e) => setFilterInterviewStatus(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-36"
                        >
                            <option value="All">All Interviews</option>
                            <option value="None">None Scheduled</option>
                            <option value="In_Process">In Interviews (Active)</option>
                            <option value="Pending">In Progress / Pending</option>
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
                    {(filterPreference !== 'All' || filterStatus !== 'Interested' || filterExperience !== '' || filterInterviewStatus !== 'All' || filterRating !== 'All') && (
                        <button
                            onClick={() => {
                                setFilterPreference('All');
                                setFilterStatus('Interested');
                                setFilterExperience('');
                                setFilterInterviewStatus('All');
                                setFilterRating('All');
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
                                        {paginatedCandidates.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                                                    No candidates match the selected filters.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedCandidates.map((candidate) => (
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
                                                            const averageRating = !hasFailed && ratedRounds.length > 0
                                                                ? ratedRounds.reduce((acc, curr) => acc + curr.rating, 0) / ratedRounds.length
                                                                : null;

                                                            return (
                                                                <div className="flex flex-col gap-1.5 items-start">
                                                                    <span className={`px-2 py-0.5 border rounded-md text-[10px] font-bold tracking-wide ${summary.color}`}>
                                                                        {summary.label}
                                                                    </span>
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap leading-tight">
                                                                            {candidate.interviewRounds?.length || 0} rounds total
                                                                        </span>
                                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                                            {ratedRounds.length > 0 && ratedRounds.slice(0, 2).map((r, idx) => (
                                                                                <span key={r._id || idx} title={r.roundName} className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                                                    R{idx + 1}: {r.rating}/10
                                                                                </span>
                                                                            ))}
                                                                            {ratedRounds.length > 2 && (
                                                                                <span
                                                                                    className={`text-[10px] font-bold flex items-center justify-center px-1.5 py-0.5 rounded border cursor-pointer hover:bg-amber-100 transition-colors ${averageRating !== null ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-500 bg-slate-50 border-slate-200'}`}
                                                                                    onClick={(e) => { e.stopPropagation(); handleView(candidate); }}
                                                                                    title="View all rounds"
                                                                                >
                                                                                    ...
                                                                                </span>
                                                                            )}
                                                                        </div>
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
                                                                <option value="Shortlisted" className="text-emerald-600 font-bold">Shortlisted</option>
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
                                                        {activeMenu === candidate._id && typeof document !== 'undefined' && createPortal(
                                                            <div
                                                                className="fixed z-[9999] w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1"
                                                                style={menuPosition}
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
                                                            </div>,
                                                            document.body
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination Controls */}
                        {!loading && filteredCandidates.length > 0 && (
                            <div className="flex justify-end items-center mt-6 gap-4 pr-4 pb-4">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-sm font-medium text-slate-600 min-w-[100px] text-center">
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Phase1Candidates;
