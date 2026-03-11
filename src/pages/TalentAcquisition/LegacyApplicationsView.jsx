import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import {
    Calendar, ChevronDown, ChevronUp, Users, Eye, FileText,
    Briefcase, MoreVertical, ArrowRight, Download, Plus,
    CheckCircle, UserCheck, ThumbsUp, Clock, ThumbsDown, XCircle, Upload, Search
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../../components/Skeleton';

const decisionColor = (d) => {
    switch (d) {
        case 'Shortlisted': return 'bg-sky-100 text-sky-700 border-sky-200';
        case 'Rejected': return 'bg-red-100 text-red-700 border-red-200';
        case 'On Hold': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'Selected': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'None': return 'bg-slate-100 text-slate-500 border-slate-200';
        default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
};

const OpeningSection = ({ opening, openingNum, hiringRequestId, onTransfer }) => {
    const [expanded, setExpanded] = useState(openingNum === 1); // most recent expanded by default
    const [activePhase, setActivePhase] = useState(1);
    const [activeMenu, setActiveMenu] = useState(null);
    const [menuPosition, setMenuPosition] = useState({});
    const navigate = useNavigate();
    const { user } = useAuth();
    const [users, setUsers] = useState([]);

    // Filtering State
    const [filterPreference, setFilterPreference] = useState('All');
    const [filterStatus, setFilterStatus] = useState('Interested');
    const [filterDecision, setFilterDecision] = useState('All');
    const [filterExperience, setFilterExperience] = useState('');
    const [filterInterviewStatus, setFilterInterviewStatus] = useState('All');
    const [filterRating, setFilterRating] = useState('All');
    const [filterPulledBy, setFilterPulledBy] = useState('All');
    const [filterTransferred, setFilterTransferred] = useState('All');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await api.get('/ta/users');
                setUsers(res.data || []);
            } catch (e) {
                console.error('Failed to fetch users', e);
            }
        };
        fetchUsers();
    }, []);

    const toggleMenu = (e, candidateId) => {
        e.stopPropagation();
        if (activeMenu === candidateId) { setActiveMenu(null); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const menuHeight = 220;
        let pos = { right: window.innerWidth - rect.right };
        if (spaceBelow < menuHeight && rect.top > menuHeight) {
            pos.bottom = window.innerHeight - rect.top + 5;
        } else {
            pos.top = rect.bottom + 5;
        }
        setMenuPosition(pos);
        setActiveMenu(candidateId);
    };

    const { requisition, candidates } = opening;
    const openedAt = requisition.createdAt ? format(new Date(requisition.createdAt), 'MMM dd, yyyy') : '—';
    const closedAt = requisition.closedAt ? format(new Date(requisition.closedAt), 'MMM dd, yyyy') : 'Ongoing';
    const positionName = requisition.title || 'Position';

    // Metric Calculations (similar to CandidateList logic)
    const metrics = {
        total: candidates.length,
        totalSourced: candidates.filter(c => c.status !== 'Not Relevant').length,
        interested: candidates.filter(c => c.status === 'Interested').length,
        inInterviews: candidates.filter(c => c.decision === 'None' && c.interviewRounds?.length > 0 && !c.interviewRounds.some(r => r.status === 'Failed')).length,
        shortlisted: candidates.filter(c => c.decision === 'Shortlisted').length,
        onHold: candidates.filter(c => c.decision === 'On Hold').length,
        transferred: candidates.filter(c => c.isTransferred).length,
        conversion: candidates.length > 0 ? ((candidates.filter(c => c.phase3Decision === 'Joined' && c.phase2Decision === 'Selected').length / (candidates.filter(c => c.status !== 'Not Relevant').length || 1)) * 100).toFixed(1) : 0
    };



    const phase2Metrics = {
        totalShortlisted: candidates.filter(c => c.decision === 'Shortlisted' || c.decision === 'Selected').length,
        totalScreened: candidates.filter(c => (c.decision === 'Shortlisted' || c.decision === 'Selected') && (c.phase2Decision === 'Shortlisted' || c.phase2Decision === 'Selected')).length,
        interviewScheduled: candidates.filter(c => (c.decision === 'Shortlisted' || c.decision === 'Selected') && c.phase2Decision === 'None' && c.interviewRounds?.some(r => r.phase === 2 && (r.status === 'Scheduled' || r.status === 'Pending'))).length,
        selected: candidates.filter(c => (c.decision === 'Shortlisted' || c.decision === 'Selected') && c.phase2Decision === 'Selected').length,
        rejected: candidates.filter(c => (c.decision === 'Shortlisted' || c.decision === 'Selected') && c.phase2Decision === 'Rejected').length
    };

    const phase3Metrics = {
        total: candidates.filter(c => c.phase2Decision === 'Selected').length,
        offerSent: candidates.filter(c => c.phase2Decision === 'Selected' && c.phase3Decision === 'Offer Sent').length,
        offerAccepted: candidates.filter(c => c.phase2Decision === 'Selected' && c.phase3Decision === 'Offer Accepted').length,
        joined: candidates.filter(c => c.phase2Decision === 'Selected' && c.phase3Decision === 'Joined').length,
        noShow: candidates.filter(c => c.phase2Decision === 'Selected' && (c.phase3Decision === 'No Show' || c.phase3Decision === 'Offer Declined')).length
    };


    // Filter Logic
    const filteredCandidates = candidates.filter(candidate => {
        if (filterPreference !== 'All' && candidate.profilePreference !== filterPreference) return false;
        if (filterStatus !== 'All' && candidate.status !== filterStatus) return false;

        // Phase-specific Filtering
        if (activePhase === 1) {
            if (filterDecision !== 'All' && candidate.decision !== filterDecision) return false;
        } else if (activePhase === 2) {
            if (candidate.decision !== 'Shortlisted' && candidate.decision !== 'Selected') return false;
            if (filterDecision !== 'All') {
                if (filterDecision === 'Shortlisted_Selected' && candidate.phase2Decision !== 'Shortlisted' && candidate.phase2Decision !== 'Selected') return false;
                if (filterDecision !== 'Shortlisted_Selected' && candidate.phase2Decision !== filterDecision) return false;
            }
        } else if (activePhase === 3) {
            if (candidate.phase2Decision !== 'Selected') return false;
            if (filterDecision !== 'All') {
                if (filterDecision === 'No Show_Offer Declined' && candidate.phase3Decision !== 'No Show' && candidate.phase3Decision !== 'Offer Declined') return false;
                if (filterDecision !== 'No Show_Offer Declined' && candidate.phase3Decision !== filterDecision) return false;
            }
        }

        if (filterExperience && parseFloat(candidate.totalExperience) < parseFloat(filterExperience)) return false;
        if (filterRating !== 'All' && (candidate.averageRating || 0) < parseInt(filterRating)) return false;
        if (filterPulledBy !== 'All' && candidate.profilePulledBy !== filterPulledBy) return false;
        if (filterTransferred !== 'All') {
            if (filterTransferred === 'Transferred' && !candidate.isTransferred) return false;
            if (filterTransferred === 'New' && candidate.isTransferred) return false;
        }

        // Interview Status Filter
        if (filterInterviewStatus !== 'All') {
            const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === activePhase) : [];
            const hasPassed = rounds.length > 0 && rounds.every(r => r.status === 'Passed');
            const hasFailed = rounds.some(r => r.status === 'Failed');
            const hasInProcess = rounds.some(r => r.status === 'Scheduled' || r.status === 'Pending' || r.status === 'In Progress');

            if (filterInterviewStatus === 'None' && rounds.length > 0) return false;
            if (filterInterviewStatus === 'In_Process' && (hasFailed || rounds.length === 0)) return false;
            if (filterInterviewStatus === 'Pending' && !hasInProcess) return false;
            if (filterInterviewStatus === 'Passed' && !hasPassed) return false;
            if (filterInterviewStatus === 'Failed' && !hasFailed) return false;
        }

        return true;
    });



    const renderTable = (candidateList, phaseIndex) => {
        if (candidateList.length === 0) {
            return (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center my-4 mx-6">
                    <Search className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Matches Found</h3>
                    <p className="text-slate-500">Try adjusting your filters to see more candidates.</p>
                </div>
            );
        }
        return (
            <div className="overflow-x-auto p-6 pt-2">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full min-w-[1000px]">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Candidate</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Experience</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Decision</th>
                                {phaseIndex === 1 && <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pulled By</th>}
                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {candidateList.map(candidate => {
                                let decision = candidate.decision || 'None';
                                if (phaseIndex === 2) decision = candidate.phase2Decision || 'None';
                                if (phaseIndex === 3) decision = candidate.phase3Decision || 'None';

                                return (
                                    <tr key={candidate._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div>
                                                <span className="text-[13px] font-bold text-slate-800">{candidate.candidateName}</span>
                                                {candidate.isTransferred && (
                                                    <span className="ml-2 text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">TRANSFERRED</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-[12px] text-slate-500">
                                                <div>{candidate.email}</div>
                                                <div>{candidate.mobile}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[13px] font-semibold text-slate-700">{candidate.totalExperience || '—'} yrs</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${decisionColor(decision)}`}>
                                                {decision}
                                            </span>
                                        </td>
                                        {phaseIndex === 1 && (
                                            <td className="px-4 py-3">
                                                <span className="text-[12px] text-slate-600 font-medium">{candidate.profilePulledBy || '—'}</span>
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={(e) => toggleMenu(e, candidate._id)}
                                                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            {activeMenu === candidate._id && typeof document !== 'undefined' && createPortal(
                                                <div
                                                    className="fixed z-[9999] w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1"
                                                    style={menuPosition}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <button
                                                        onClick={() => {
                                                            navigate(`/ta/hiring-request/${candidate.hiringRequestId}/candidate/${candidate._id}/view`);
                                                            setActiveMenu(null);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                                    >
                                                        <Eye size={15} className="text-slate-500" />
                                                        View Details
                                                    </button>
                                                    {candidate.resumeUrl && (
                                                        <a
                                                            href={candidate.resumeUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                                            onClick={() => setActiveMenu(null)}
                                                        >
                                                            <FileText size={15} className="text-slate-500" />
                                                            View Resume
                                                        </a>
                                                    )}
                                                    {(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.edit')) && (
                                                        <>
                                                            <div className="border-t border-slate-100 my-1"></div>
                                                            <button
                                                                onClick={() => {
                                                                    onTransfer(candidate._id);
                                                                    setActiveMenu(null);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors text-left font-semibold"
                                                            >
                                                                <ArrowRight size={15} className="text-blue-500" />
                                                                Transfer to Active Req.
                                                            </button>
                                                        </>
                                                    )}
                                                </div>,
                                                document.body
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden mb-8 transition-shadow hover:shadow-xl">
            {/* Opening header */}
            <div className="border-b border-slate-100 bg-slate-50/30">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-white font-bold text-lg shrink-0 shadow-md">
                            #{openingNum}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold text-slate-800 text-base">Opening #{openingNum}: {positionName}</h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${requisition.status === 'Closed' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                    {requisition.status.toUpperCase()}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-[12px] text-slate-500 flex-wrap font-medium">
                                <span className="flex items-center gap-1.5"><Calendar size={13} className="text-slate-400" /> {openedAt} — {closedAt}</span>
                                <span className="text-slate-300">|</span>
                                <span className="flex items-center gap-1.5"><Users size={13} className="text-slate-400" /> {candidates.length} candidates tracked</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            className="p-2 text-slate-400 hover:bg-white hover:text-slate-600 rounded-xl transition-all border border-transparent hover:border-slate-200 shadow-sm"
                            onClick={() => setExpanded(v => !v)}
                        >
                            {expanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content: Cards, Tabs, Filters and Table */}
            {expanded && (
                <div className="bg-slate-50/30">
                    {/* Header Row similar to CandidateList */}
                    <div className="px-6 pt-6 pb-2 flex justify-between items-center">
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-[2px]">Pipeline Snapshot</h3>
                        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                            {[1, 2, 3].map(v => (
                                <button
                                    key={v}
                                    onClick={() => {
                                        setActivePhase(v);
                                        setFilterStatus(v === 1 ? 'Interested' : 'All');
                                        setFilterDecision('All');
                                        setFilterInterviewStatus('All');
                                    }}
                                    className={`px-6 py-1.5 text-xs font-bold rounded-lg transition-all ${activePhase === v ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                                >
                                    Phase {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Metric Cards - Exactly like CandidateList */}
                    <div className="px-6 pb-6">
                        {activePhase === 1 ? (
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                                <MetricCard label="Total Sourced" val={metrics.totalSourced} icon={<Users />} color="purple" onClick={() => { setFilterStatus('All'); setFilterDecision('All'); }} />
                                <MetricCard label="Interested" val={metrics.interested} icon={<CheckCircle />} color="green" onClick={() => { setFilterStatus('Interested'); setFilterDecision('All'); }} />
                                <MetricCard label="In Interviews" val={metrics.inInterviews} icon={<UserCheck />} color="amber" onClick={() => { setFilterStatus('All'); setFilterDecision('None'); setFilterInterviewStatus('In_Process'); }} />
                                <MetricCard label="Shortlisted" val={metrics.shortlisted} icon={<ThumbsUp />} color="sky" onClick={() => { setFilterStatus('All'); setFilterDecision('Shortlisted'); }} />
                                <MetricCard label="On Hold" val={metrics.onHold} icon={<Clock />} color="slate" onClick={() => { setFilterStatus('All'); setFilterDecision('On Hold'); }} />
                                <MetricCard label="Transferred" val={metrics.transferred} icon={<Briefcase />} color="blue" onClick={() => { setFilterStatus('All'); setFilterTransferred('Transferred'); }} />
                            </div>

                        ) : activePhase === 2 ? (
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                <MetricCard label="Total Sent" val={phase2Metrics.totalShortlisted} icon={<Users />} color="purple" onClick={() => setFilterDecision('All')} />
                                <MetricCard label="Shortlisted" val={phase2Metrics.totalScreened} icon={<UserCheck />} color="sky" onClick={() => setFilterDecision('Shortlisted_Selected')} />
                                <MetricCard label="Interviews" val={phase2Metrics.interviewScheduled} icon={<Clock />} color="amber" onClick={() => { setFilterDecision('None'); setFilterInterviewStatus('In_Process'); }} />
                                <MetricCard label="Selected" val={phase2Metrics.selected} icon={<CheckCircle />} color="emerald" onClick={() => setFilterDecision('Selected')} />
                                <MetricCard label="Rejected" val={phase2Metrics.rejected} icon={<ThumbsDown />} color="rose" onClick={() => setFilterDecision('Rejected')} />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                <MetricCard label="Total" val={phase3Metrics.total} icon={<Users />} color="purple" onClick={() => setFilterDecision('All')} />
                                <MetricCard label="Offer Sent" val={phase3Metrics.offerSent} icon={<FileText />} color="sky" onClick={() => setFilterDecision('Offer Sent')} />
                                <MetricCard label="Accepted" val={phase3Metrics.offerAccepted} icon={<ThumbsUp />} color="amber" onClick={() => setFilterDecision('Offer Accepted')} />
                                <MetricCard label="Joined" val={phase3Metrics.joined} icon={<CheckCircle />} color="emerald" onClick={() => setFilterDecision('Joined')} />
                                <MetricCard label="Declined" val={phase3Metrics.noShow} icon={<XCircle />} color="rose" onClick={() => setFilterDecision('No Show_Offer Declined')} />

                            </div>
                        )}
                    </div>

                    {/* Filter Bar */}
                    <div className="px-6 pb-6">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
                            <FilterSelect label="Preference" val={filterPreference} onChange={setFilterPreference} options={[
                                ['All', 'All Preferences'], ['Highly Recommended', 'Highly Recommended'], ['Recommended', 'Recommended'], ['Neutral / Average', 'Neutral / Average'], ['Not Recommended', 'Not Recommended'], ['Very Poor', 'Very Poor']
                            ]} />
                            <FilterSelect label="Status" val={filterStatus} onChange={setFilterStatus} options={[
                                ['All', 'All Statuses'], ['Interested', 'Interested'], ['Not Interested', 'Not Interested'], ['Not Relevant', 'Not Relevant'], ['Not Picking', 'Not Picking']
                            ]} />
                            <FilterSelect label="Decision" val={filterDecision} onChange={setFilterDecision} options={
                                activePhase === 1 ? [['All', 'All Decisions'], ['Shortlisted', 'Shortlisted'], ['Rejected', 'Rejected'], ['On Hold', 'On Hold'], ['None', 'None']] :
                                    activePhase === 2 ? [['All', 'All Decisions'], ['Shortlisted_Selected', 'Shortlisted/Selected'], ['Selected', 'Selected'], ['Rejected', 'Rejected'], ['On Hold', 'On Hold'], ['None', 'None']] :
                                        [['All', 'All Decisions'], ['Offer Sent', 'Offer Sent'], ['Offer Accepted', 'Offer Accepted'], ['Joined', 'Joined'], ['No Show_Offer Declined', 'Declined'], ['Rejected', 'Rejected'], ['None', 'None']]
                            } />
                            <FilterSelect label="Interviews" val={filterInterviewStatus} onChange={setFilterInterviewStatus} options={[
                                ['All', 'All Interviews'], ['None', 'None Scheduled'], ['In_Process', 'Active'], ['Pending', 'In Progress'], ['Passed', 'All Passed'], ['Failed', 'Failed']
                            ]} />
                            <FilterSelect label="Min Rating" val={filterRating} onChange={setFilterRating} options={[['All', 'Ratings'], ['9', '9+'], ['7', '7+'], ['5', '5+'], ['3', '3+']]} />
                            <FilterSelect label="Pulled By" val={filterPulledBy} onChange={setFilterPulledBy} options={[['All', 'All Users'], ...users.map(u => [`${u.firstName} ${u.lastName}`.trim(), `${u.firstName} ${u.lastName}`])]} />

                            <div className="w-28">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Experience</label>
                                <input type="number" value={filterExperience} onChange={e => setFilterExperience(e.target.value)} placeholder="0 Yrs" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                            </div>

                            {(filterPreference !== 'All' || filterStatus !== (activePhase === 1 ? 'Interested' : 'All') || filterDecision !== 'All' || filterExperience !== '' || filterInterviewStatus !== 'All' || filterRating !== 'All' || filterPulledBy !== 'All' || filterTransferred !== 'All') && (
                                <button onClick={() => {
                                    setFilterPreference('All'); setFilterStatus(activePhase === 1 ? 'Interested' : 'All'); setFilterDecision('All'); setFilterExperience(''); setFilterInterviewStatus('All'); setFilterRating('All'); setFilterPulledBy('All'); setFilterTransferred('All');
                                }} className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all mb-0.5">
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table Container */}
                    <div className="bg-white border-t border-slate-100">
                        {renderTable(filteredCandidates, activePhase)}
                    </div>
                </div>
            )}
        </div>
    );
};

const MetricCard = ({ label, val, icon, color, onClick }) => (
    <div
        onClick={onClick}
        className={`bg-white border border-slate-200 border-b-4 border-b-${color}-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-all cursor-pointer active:scale-95 rounded-xl`}
    >
        <div className="relative z-10">
            <span className="block text-[28px] font-light text-slate-800 leading-none mb-1.5 tracking-tight">{val}</span>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-[1px]">{label}</span>
        </div>
        <div className={`absolute -right-2 top-1/2 -translate-y-1/2 text-${color}-600 opacity-[0.06] transition-all group-hover:scale-110 group-hover:opacity-10 group-hover:-rotate-12`}>
            {React.cloneElement(icon, { size: 64 })}
        </div>
    </div>
);

const FilterSelect = ({ label, val, onChange, options }) => (
    <div className="flex-1 min-w-[130px]">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">{label}</label>
        <select
            value={val}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
        >
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
    </div>
);

const LegacyApplicationsView = ({ hiringRequestId }) => {
    const [openings, setOpenings] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLegacy = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/ta/hiring-request/${hiringRequestId}/previous-candidates`);
            setOpenings(res.data || []);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load legacy applications');
        } finally {
            setLoading(false);
        }
    }, [hiringRequestId]);

    useEffect(() => { fetchLegacy(); }, [fetchLegacy]);

    const [selectedOpenings, setSelectedOpenings] = useState([]);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);

    const handleExportSelected = async () => {
        if (selectedOpenings.length === 0) {
            toast.error('Please select at least one opening to export');
            return;
        }

        try {
            const workbook = new ExcelJS.Workbook();

            selectedOpenings.forEach(idx => {
                const opening = openings[idx];
                const openingNum = openings.length - idx;
                const sheet = workbook.addWorksheet(`Opening #${openingNum}`);

                sheet.columns = [
                    { header: 'Candidate Name', key: 'name', width: 25 },
                    { header: 'Email', key: 'email', width: 25 },
                    { header: 'Mobile', key: 'mobile', width: 15 },
                    { header: 'Experience', key: 'experience', width: 15 },
                    { header: 'Status', key: 'status', width: 15 },
                    { header: 'P1 Decision', key: 'p1', width: 15 },
                    { header: 'P2 Decision', key: 'p2', width: 15 },
                    { header: 'P3 Decision', key: 'p3', width: 15 },
                    { header: 'Pulled By', key: 'pulledBy', width: 20 }
                ];

                opening.candidates.forEach(c => {
                    sheet.addRow({
                        name: c.candidateName,
                        email: c.email,
                        mobile: c.mobile,
                        experience: c.totalExperience,
                        status: c.status,
                        p1: c.decision || 'None',
                        p2: c.phase2Decision || 'None',
                        p3: c.phase3Decision || 'None',
                        pulledBy: c.profilePulledBy
                    });
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Legacy_Application_History_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
            toast.success('Excel exported successfully');
            setExportMenuOpen(false);
        } catch (e) {
            console.error(e);
            toast.error('Export failed');
        }
    };

    const toggleOpeningSelection = (idx) => {
        setSelectedOpenings(prev =>
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        );
    };

    const handleTransfer = async (candidateId) => {
        if (!window.confirm('Transfer this candidate to the newest active requisition? This creates a fresh copy.')) return;
        try {
            const res = await api.post(`/ta/hiring-request/transfer-candidate/${candidateId}`);
            toast.success(res.data.message || 'Candidate transferred successfully');
            fetchLegacy();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to transfer candidate');
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
            </div>
        );
    }

    if (openings.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Briefcase className="mx-auto text-slate-300 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No Legacy Applications</h3>
                <p className="text-slate-400 text-sm">No previous openings found for this requisition.</p>
            </div>
        );
    }

    // Openings are returned newest-first from the backend
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-slate-500" />
                    <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">
                        Legacy Application History — {openings.length} Opening{openings.length > 1 ? 's' : ''}
                    </h3>
                </div>
                <div className="relative">
                    <button
                        onClick={() => setExportMenuOpen(!exportMenuOpen)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95"
                    >
                        <Download size={16} />
                        Export Excel
                    </button>

                    {exportMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-[100] p-4 transition-all animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Select Openings</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group">
                                    <input
                                        type="checkbox"
                                        checked={selectedOpenings.length === openings.length}
                                        onChange={() => {
                                            if (selectedOpenings.length === openings.length) setSelectedOpenings([]);
                                            else setSelectedOpenings(openings.map((_, i) => i));
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm font-bold text-slate-700">Select All</span>
                                </label>
                                <div className="border-t border-slate-100 my-1"></div>
                                {openings.map((opening, idx) => (
                                    <label key={opening.requisition._id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedOpenings.includes(idx)}
                                            onChange={() => toggleOpeningSelection(idx)}
                                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700">Opening #{openings.length - idx}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                {format(new Date(opening.requisition.createdAt), 'MMM dd')} - {opening.requisition.closedAt ? format(new Date(opening.requisition.closedAt), 'MMM dd') : 'Current'}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <button
                                onClick={handleExportSelected}
                                disabled={selectedOpenings.length === 0}
                                className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                            >
                                <Download size={14} />
                                Download {selectedOpenings.length > 0 ? `(${selectedOpenings.length})` : ''}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {openings.map((opening, idx) => (
                <OpeningSection
                    key={opening.requisition._id}
                    opening={opening}
                    openingNum={openings.length - idx} // newest = highest number
                    hiringRequestId={hiringRequestId}
                    onTransfer={handleTransfer}
                />
            ))}
        </div>
    );
};

export default LegacyApplicationsView;
