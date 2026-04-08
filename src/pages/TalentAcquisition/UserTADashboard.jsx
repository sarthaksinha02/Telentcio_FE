import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, ThumbsUp, ThumbsDown, CheckCircle, Clock, UserCheck, Eye, FileText, Upload } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Skeleton from '../../components/Skeleton';
import { Filter, Search, X } from 'lucide-react';

const UserTADashboard = ({ providedUserName }) => {
    const { userName: routeUserName } = useParams();
    const navigate = useNavigate();

    // Use the provided name (if used as embedded component) or the route param
    const userName = providedUserName || routeUserName;

    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterProfile, setFilterProfile] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const fetchUserCandidates = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get(`/ta/candidates/user/${encodeURIComponent(userName)}`);
            setCandidates(response.data.candidates || []);
        } catch (error) {
            console.error('Error fetching user candidates:', error);
            toast.error('Failed to load candidate metrics for this user');
        } finally {
            setLoading(false);
        }
    }, [userName]);

    useEffect(() => {
        if (userName) {
            fetchUserCandidates();
        }
    }, [userName, fetchUserCandidates]);

    const uniqueProfiles = useMemo(() => {
        const profiles = candidates.map(c => c.hiringRequestId?.roleDetails?.title).filter(Boolean);
        return [...new Set(profiles)];
    }, [candidates]);

    // Apply Filters
    const filteredCandidates = useMemo(() => {
        return candidates.filter(candidate => {
            // Search
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                candidate.candidateName?.toLowerCase().includes(searchLower) ||
                candidate.email?.toLowerCase().includes(searchLower) ||
                candidate.mobile?.includes(searchTerm);

            // Profile
            const matchesProfile = !filterProfile || candidate.hiringRequestId?.roleDetails?.title === filterProfile;

            // Status (which maps to candidate.status OR candidate.decision depending on context, but user specifically asked for 'Interested' filters)
            const matchesStatus = !filterStatus || candidate.status === filterStatus;

            // Date Range
            let matchesDate = true;
            if (filterDateFrom || filterDateTo) {
                const dateAdded = new Date(candidate.uploadedAt).getTime();
                if (filterDateFrom) {
                    const fromTime = new Date(filterDateFrom).getTime();
                    if (dateAdded < fromTime) matchesDate = false;
                }
                if (filterDateTo) {
                    const toTime = new Date(filterDateTo).getTime();
                    // Add 24 hours to "to" date to include the whole day
                    if (dateAdded > toTime + 86400000) matchesDate = false;
                }
            }

            return matchesSearch && matchesProfile && matchesStatus && matchesDate;
        });
    }, [candidates, searchTerm, filterProfile, filterStatus, filterDateFrom, filterDateTo]);

    // Calculate metrics based on FILTERED candidates
    const metrics = useMemo(() => {
        return {
            total: filteredCandidates.length,
            interested: filteredCandidates.filter(c => {
                if (c.status !== 'Interested') return false;
                if (c.decision && ['Rejected', 'On Hold'].includes(c.decision)) return false;
                if (c.interviewRounds && c.interviewRounds.length > 0) return false;
                return true;
            }).length,
            inInterviews: filteredCandidates.filter(c => {
                const rounds = c.interviewRounds || [];
                if (rounds.length === 0) return false;
                if (c.decision && ['Rejected', 'On Hold'].includes(c.decision)) return false;
                const hasFailed = rounds.some(r => r.status === 'Failed');
                if (hasFailed) return false;
                return true;
            }).length,
            rejected: filteredCandidates.filter(c => c.decision === 'Rejected').length,
            onHold: filteredCandidates.filter(c => c.decision === 'On Hold').length,
        };
    }, [filteredCandidates]);

    const getDecisionColor = useCallback((decision) => {
        switch (decision) {
            case 'Rejected': return 'text-red-600 font-bold';
            case 'On Hold': return 'text-amber-600 font-bold';
            default: return 'text-slate-600';
        }
    }, []);

    const getInterviewStatusSummary = useCallback((rounds = []) => {
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
    }, []);

    if (loading) {
        return (
            <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
                <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-24 bg-slate-200 rounded"></div>
                    ))}
                </div>
                <div className="h-64 bg-slate-200 rounded mt-6"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{userName}'s Dashboard</h1>
                    <p className="text-sm text-slate-500">Performance metrics and candidates sourced by {userName}</p>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border-t border-x border-slate-200 border-b-4 border-b-purple-500 shadow-sm p-5 relative overflow-hidden group">
                    <span className="block text-[28px] font-light text-slate-800 leading-none mb-1 relative z-10">{metrics.total}</span>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Total Sourced</span>
                    <Users className="absolute -right-2 top-1/2 -translate-y-1/2 text-purple-600 opacity-5 size-16 group-hover:opacity-10 transition-opacity" />
                </div>
                <div className="bg-white border-t border-x border-slate-200 border-b-4 border-b-amber-500 shadow-sm p-5 relative overflow-hidden group">
                    <span className="block text-[28px] font-light text-slate-800 leading-none mb-1 relative z-10">{metrics.inInterviews}</span>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">In Interviews</span>
                    <UserCheck className="absolute -right-2 top-1/2 -translate-y-1/2 text-amber-600 opacity-5 size-16 group-hover:opacity-10 transition-opacity" />
                </div>
                <div className="bg-white border-t border-x border-slate-200 border-b-4 border-b-slate-400 shadow-sm p-5 relative overflow-hidden group">
                    <span className="block text-[28px] font-light text-slate-800 leading-none mb-1 relative z-10">{metrics.onHold}</span>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">On Hold</span>
                    <Clock className="absolute -right-2 top-1/2 -translate-y-1/2 text-slate-600 opacity-5 size-16 group-hover:opacity-10 transition-opacity" />
                </div>
            </div>

            {/* Candidate List */}
            <div className="bg-white rounded-xl border border-slate-200 mt-8">
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl flex justify-between items-center sm:flex-row flex-col gap-4">
                    <h2 className="text-lg font-semibold text-slate-800">Sourced Candidates</h2>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-grow sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                            <input
                                type="text"
                                placeholder="Search candidates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-lg border transition-all ${showFilters || filterProfile || filterStatus || filterDateFrom || filterDateTo
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            title="Toggle Filters"
                        >
                            <Filter size={18} />
                        </button>
                    </div>
                </div>

                {/* Filters Section */}
                {showFilters && (
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 animate-fade-in-down">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Candidates</h3>
                            {(filterProfile || filterStatus || filterDateFrom || filterDateTo) && (
                                <button
                                    onClick={() => {
                                        setFilterProfile('');
                                        setFilterStatus('');
                                        setFilterDateFrom('');
                                        setFilterDateTo('');
                                    }}
                                    className="text-[11px] font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
                                >
                                    <X size={12} /> Clear All
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Job Profile</label>
                                <select
                                    value={filterProfile}
                                    onChange={(e) => setFilterProfile(e.target.value)}
                                    className="w-full p-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 bg-white"
                                >
                                    <option value="">All Profiles</option>
                                    {uniqueProfiles.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Status</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full p-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 bg-white"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="Interested">Interested</option>
                                    <option value="Not Interested">Not Interested</option>
                                    <option value="Not Relevant">Not Relevant</option>
                                    <option value="Not Picking">Not Picking</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Date From</label>
                                <input
                                    type="date"
                                    value={filterDateFrom}
                                    onChange={(e) => setFilterDateFrom(e.target.value)}
                                    className="w-full p-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Date To</label>
                                <input
                                    type="date"
                                    value={filterDateTo}
                                    onChange={(e) => setFilterDateTo(e.target.value)}
                                    className="w-full p-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 bg-white"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {filteredCandidates.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <Upload className="text-slate-300 mb-4" size={48} />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No Candidates Found</h3>
                        <p className="text-slate-500">No candidates match the current filters or none have been sourced yet.</p>
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto">
                        <div className="min-w-[1000px]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white border-b border-slate-200">
                                        <th className="px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Candidate</th>
                                        <th className="px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Experience</th>
                                        <th className="px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Interviews</th>
                                        <th className="px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Decision</th>
                                        <th className="px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Hiring Request</th>
                                        <th className="px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                        <th className="px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredCandidates.map(candidate => (
                                        <tr key={candidate._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-4 align-top">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-[14px]">
                                                        {candidate.candidateName}
                                                    </span>
                                                    <span className="text-slate-500 text-[12px]">{candidate.email}</span>
                                                    <span className="text-slate-500 text-[12px] mt-0.5">{candidate.mobile}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                <span className="text-[13px] font-semibold text-slate-700">{candidate.totalExperience} yrs</span>
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                {(() => {
                                                    const summary = getInterviewStatusSummary(candidate.interviewRounds);
                                                    const rounds = candidate.interviewRounds || [];
                                                    const hasFailed = rounds.some(r => r.status === 'Failed');
                                                    const ratedRounds = rounds.filter(r => r.rating && r.rating > 0);
                                                    let avgRating = null;

                                                    if (!hasFailed && ratedRounds.length > 0) {
                                                        const total = ratedRounds.reduce((acc, curr) => acc + curr.rating, 0);
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
                                            <td className="px-5 py-4 align-top">
                                                <span className={`text-[12px] ${getDecisionColor(candidate.decision || 'None')}`}>
                                                    {candidate.decision || 'None'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                <div className="flex flex-col max-w-[150px]">
                                                    <span className="text-[12px] font-bold text-slate-700 truncate" title={candidate.hiringRequestId?.roleDetails?.title}>
                                                        {candidate.hiringRequestId?.roleDetails?.title || 'Unknown Role'}
                                                    </span>
                                                    <span className="text-[11px] text-slate-500 font-medium tracking-wide">
                                                        {candidate.hiringRequestId?.requestId || '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                <div className="flex flex-col text-[12px] text-slate-500 font-medium">
                                                    <span>{format(new Date(candidate.uploadedAt), 'MMM dd, yyyy')}</span>
                                                    <span className="text-[11px]">{format(new Date(candidate.uploadedAt), 'hh:mm a')}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 align-top text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => navigate(`/ta/hiring-request/${candidate.hiringRequestId?._id || candidate.hiringRequestId}/candidate/${candidate._id}/view`)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-100 rounded-lg transition-colors"
                                                        title="View Candidate"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    {candidate.resumeUrl && (
                                                        <a
                                                            href={candidate.resumeUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 text-slate-500 hover:bg-slate-100 focus:ring-2 focus:ring-slate-200 rounded-lg transition-colors"
                                                            title="View Resume"
                                                        >
                                                            <FileText size={18} />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserTADashboard;
