import React, { useState, useEffect } from 'react';
import { Edit, Trash2, FileText, Loader, Upload, Plus, Eye, MoreVertical } from 'lucide-react';
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
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterDecision, setFilterDecision] = useState('All');
    const [filterExperience, setFilterExperience] = useState('');
    const [filterInterviewStatus, setFilterInterviewStatus] = useState('All');

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
    }, [hiringRequestId]);

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

        return matchPreference && matchStatus && matchDecision && matchExperience && matchInterviewStatus;
    });

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
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Candidates</h3>
                    <p className="text-sm text-slate-500">{candidates.length} candidate(s) uploaded</p>
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
                {(filterPreference !== 'All' || filterStatus !== 'All' || filterDecision !== 'All' || filterExperience !== '' || filterInterviewStatus !== 'All') && (
                    <button
                        onClick={() => {
                            setFilterPreference('All');
                            setFilterStatus('All');
                            setFilterDecision('All');
                            setFilterExperience('');
                            setFilterInterviewStatus('All');
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
                <div className="bg-white rounded-xl border border-slate-200 overflow-visible mb-24">
                    <div className="overflow-visible">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr key="header-row">
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Candidate</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Contact</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Source</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Experience</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Preference</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Interviews</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Decision</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Uploaded</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredCandidates.length === 0 ? (
                                    <tr>
                                        <td colspan="9" className="px-4 py-8 text-center text-slate-500">
                                            No candidates match the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCandidates.map((candidate) => (
                                        <tr key={candidate._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-semibold text-slate-800">{candidate.candidateName}</p>
                                                    {candidate.currentCompany && (
                                                        <p className="text-xs text-slate-500">{candidate.currentCompany}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm">
                                                    <p className="text-slate-700">{candidate.email}</p>
                                                    <p className="text-slate-500">{candidate.mobile}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-slate-700">{candidate.source}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-medium text-slate-700">{candidate.totalExperience} yrs</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm">
                                                    {candidate.preference ? (
                                                        <p className="text-slate-700 font-medium">{candidate.preference}</p>
                                                    ) : (
                                                        <p className="text-slate-400 italic">-</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {(() => {
                                                    const summary = getInterviewStatusSummary(candidate.interviewRounds);
                                                    return (
                                                        <div className="flex flex-col gap-1 items-start">
                                                            <span className={`px-2 py-0.5 border rounded text-[11px] font-bold ${summary.color}`}>
                                                                {summary.label}
                                                            </span>
                                                            <span className="text-xs text-slate-500 font-medium ml-0.5">
                                                                {candidate.interviewRounds?.length || 0} rounds total
                                                            </span>
                                                        </div>
                                                    )
                                                })()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(candidate.status)}`}>
                                                    {candidate.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={candidate.decision || 'None'}
                                                    onChange={(e) => handleDecisionChange(candidate._id, e.target.value)}
                                                    className={`px-2 py-1 text-xs font-semibold rounded-lg border border-slate-300 bg-white outline-none cursor-pointer transition-colors hover:border-blue-500 hover:ring-1 hover:ring-blue-200 ${getDecisionColor(candidate.decision || 'None')}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={!(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.edit'))}
                                                >
                                                    <option value="None" className="text-slate-600">None</option>
                                                    <option value="Hired" className="text-emerald-600 font-bold">Hired</option>
                                                    <option value="Rejected" className="text-red-600 font-bold">Rejected</option>
                                                    <option value="On Hold" className="text-amber-600 font-bold">On Hold</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-slate-600">
                                                    <p>{format(new Date(candidate.uploadedAt), 'MMM dd, yyyy')}</p>
                                                    <p className="text-xs text-slate-500">{format(new Date(candidate.uploadedAt), 'hh:mm a')}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 relative isolate">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMenu(activeMenu === candidate._id ? null : candidate._id);
                                                    }}
                                                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative"
                                                >
                                                    <MoreVertical size={18} />
                                                </button>

                                                {/* Dropdown Menu */}
                                                {activeMenu === candidate._id && (
                                                    <div
                                                        className="absolute right-0 top-12 z-[100] w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1"
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
            )}
        </div>
    );
};

export default CandidateList;

