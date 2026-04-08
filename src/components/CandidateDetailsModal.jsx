import React from 'react';
import { X, CheckCircle, XCircle, Clock, Calendar, MessageSquare, User } from 'lucide-react';
import { format } from 'date-fns';

const CandidateDetailsModal = ({ candidate, phase, onClose }) => {
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

    // Derived Timelines based on phase
    // Phase 1: Only interested/pre-screened, and L1 rounds
    // Phase 2: All rounds + Selection/Hired logic
    const displayedRounds = !candidate?.interviewRounds
        ? []
        : phase === 1
            ? candidate.interviewRounds.filter((r, idx) => idx < 2)
            : candidate.interviewRounds;

    if (!candidate) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{candidate.candidateName}</h2>
                        <p className="text-sm text-slate-500">{candidate.email} • {candidate.mobile}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        
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

                        {/* Right Column: Interview Timeline */}
                        <div className="lg:col-span-3 space-y-6">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-full">
                                <h3 className="text-lg font-bold text-slate-800 mb-6">
                                    {phase === 1 ? 'Phase 1 Timeline' : 'Complete Interview Timeline'}
                                </h3>

                                <div className="space-y-8 relative pl-4">
                                    {displayedRounds.length === 0 ? (
                                        <div className="text-center py-12 text-slate-500">
                                            {phase === 1 
                                                ? 'No initial screening rounds scheduled yet.'
                                                : 'No interview rounds have been scheduled yet.'}
                                        </div>
                                    ) : (
                                        displayedRounds.map((round, index) => (
                                            <div key={round._id || index} className="relative pl-8">
                                                {/* Timeline Line */}
                                                {index !== displayedRounds.length - 1 && (
                                                    <div className="absolute top-8 bottom-[-2rem] left-3.5 w-0.5 bg-slate-200"></div>
                                                )}

                                                {/* Dot */}
                                                <div className={`absolute top-1 left-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${round.status === 'Passed' ? 'bg-emerald-500' : 
                                                    round.status === 'Failed' ? 'bg-red-500' : 
                                                    'bg-amber-400'
                                                }`}></div>

                                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
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
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadgeColor(round.status)}`}>
                                                            {round.status}
                                                        </span>
                                                    </div>

                                                    {/* Round Details */}
                                                    <div className="px-5 py-4">
                                                        <div className="flex items-start gap-2 mb-3">
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

                                                        {['Passed', 'Failed'].includes(round.status) && (
                                                            <div className={`mt-3 rounded-lg p-3 border ${round.status === 'Passed' ? 'bg-emerald-50/60 border-emerald-100' : 'bg-red-50/60 border-red-100'}`}>
                                                                <div className="flex items-start gap-2">
                                                                    <MessageSquare size={16} className="text-slate-400 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Feedback</p>
                                                                            {round.status === 'Passed' && round.rating && (
                                                                                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                                                                                    ⭐ {round.rating}/10
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{round.feedback || 'No feedback provided.'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}

                                    {/* Phase 2 explicit hiring decision summary at the end */}
                                    {phase === 2 && candidate.decision && candidate.decision !== 'None' && displayedRounds.length > 0 && (
                                         <div className="relative pl-8 mt-8">
                                              {/* Dot */}
                                              <div className={`absolute top-1 left-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${candidate.decision === 'Hired' ? 'bg-emerald-500' : candidate.decision === 'Rejected' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                                              
                                              <div className={`rounded-xl border p-5 shadow-sm ${candidate.decision === 'Hired' ? 'bg-emerald-50 border-emerald-200' : candidate.decision === 'Rejected' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                                                  <h4 className={`font-bold text-lg mb-1 flex items-center gap-2 ${candidate.decision === 'Hired' ? 'text-emerald-800' : candidate.decision === 'Rejected' ? 'text-red-800' : 'text-amber-800'}`}>
                                                      Final Decision: {candidate.decision}
                                                  </h4>
                                                  <p className="text-sm text-slate-600">The candidate has been officially designated as {candidate.decision}.</p>
                                              </div>
                                         </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default CandidateDetailsModal;
