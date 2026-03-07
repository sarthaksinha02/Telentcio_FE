import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Trash2, FileText, Loader, Upload, Plus, Eye, MoreVertical, Users, ThumbsUp, ThumbsDown, CheckCircle, XCircle, Clock, UserCheck, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../../components/Skeleton';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const CandidateList = ({ hiringRequestId, positionName }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

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
    const [activePhase, setActivePhase] = useState(1);

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

    useEffect(() => {
        if (hiringRequestId) {
            fetchCandidates();
        }
        fetchUsers();
    }, [hiringRequestId]); // Removed page dependency

    // Reset page to 1 when any filter changes
    useEffect(() => {
        setPage(1);
    }, [filterPreference, filterStatus, filterDecision, filterExperience, filterInterviewStatus, filterRating, filterPulledBy]);

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

    // Computed filtered candidates (Phase 1 — Shortlisted/Hired also appear here AND in Phase 2)
    const filteredCandidates = useMemo(() => {
        return candidates.filter(candidate => {
            const matchPreference = filterPreference === 'All' || candidate.preference === filterPreference;
            const matchStatus = filterStatus === 'All' || candidate.status === filterStatus;
            const matchDecision = filterDecision === 'All' || (candidate.decision || 'None') === filterDecision;
            const matchExperience = !filterExperience || (candidate.totalExperience && Number(candidate.totalExperience) >= Number(filterExperience));

            // Interview filtering logic
            let matchInterviewStatus = true;
            if (filterInterviewStatus !== 'All') {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === 1) : [];
                const hasPending = rounds.some(r => r.status === 'Pending' || r.status === 'Scheduled');
                const hasFailed = rounds.some(r => r.status === 'Failed');
                const allPassed = rounds.length > 0 && rounds.every(r => r.status === 'Passed');

                matchInterviewStatus = false;

                if (filterInterviewStatus === 'None') matchInterviewStatus = rounds.length === 0;
                else if (filterInterviewStatus === 'Pending' || filterInterviewStatus === 'Scheduled') matchInterviewStatus = rounds.length > 0 && hasPending && !hasFailed;
                else if (filterInterviewStatus === 'Passed') matchInterviewStatus = allPassed;
                else if (filterInterviewStatus === 'Failed') matchInterviewStatus = hasFailed;
                else if (filterInterviewStatus === 'In_Process') matchInterviewStatus = rounds.length > 0 && !hasFailed && (!candidate.decision || candidate.decision === 'None');
            }

            let matchRating = true;
            if (filterRating !== 'All') {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === 1) : [];
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
    }, [candidates, filterPreference, filterStatus, filterDecision, filterExperience, filterInterviewStatus, filterRating, filterPulledBy]);



    // Compute Metrics for Summary Boxes (Phase 1 — shows all candidates including Shortlisted/Hired)
    const metrics = useMemo(() => {
        const targetStatus = filterStatus === 'All' ? 'Interested' : filterStatus;

        const baseCandidates = filterPulledBy === 'All'
            ? candidates
            : candidates.filter(c => c.profilePulledBy === filterPulledBy);

        return {
            total: baseCandidates.length,
            dynamicStatusLabel: targetStatus,
            dynamicStatusCount: baseCandidates.filter(c => {
                if (c.status !== targetStatus) return false;
                if (c.decision && ['Rejected', 'On Hold'].includes(c.decision)) return false;
                const rounds = c.interviewRounds ? c.interviewRounds.filter(r => (r.phase || 1) === 1) : [];
                if (rounds.length > 0) return false;
                return true;
            }).length,
            inInterviews: baseCandidates.filter(c => {
                const rounds = c.interviewRounds ? c.interviewRounds.filter(r => (r.phase || 1) === 1) : [];
                if (rounds.length === 0) return false;
                if (c.decision && c.decision !== 'None') return false;
                const hasFailed = rounds.some(r => r.status === 'Failed');
                if (hasFailed) return false;
                return true;
            }).length,
            shortlisted: candidates.filter(c => c.decision === 'Shortlisted').length,
            rejected: baseCandidates.filter(c => c.decision === 'Rejected').length,
            onHold: baseCandidates.filter(c => c.decision === 'On Hold').length,
        };
    }, [candidates, filterStatus, filterPulledBy]);

    // --- Phase 2: shortlisted candidates + their metrics ---
    const phase2Candidates = useMemo(() => {
        return candidates.filter(c => c.decision === 'Shortlisted'); // Only Phase 1 Shortlisted enter Phase 2.
    }, [candidates]);

    const phase2Filtered = useMemo(() => {
        return phase2Candidates.filter(candidate => {
            const matchPreference = filterPreference === 'All' || candidate.preference === filterPreference;
            const matchStatus = filterStatus === 'All' || candidate.status === filterStatus;
            const matchDecision = filterDecision === 'All' ||
                (filterDecision === 'Shortlisted_Selected'
                    ? (candidate.phase2Decision === 'Shortlisted' || candidate.phase2Decision === 'Selected')
                    : (candidate.phase2Decision || 'None') === filterDecision);
            const matchExperience = !filterExperience || (candidate.totalExperience && Number(candidate.totalExperience) >= Number(filterExperience));
            let matchInterviewStatus = true;
            if (filterInterviewStatus !== 'All') {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === 2) : [];
                const hasPending = rounds.some(r => r.status === 'Pending' || r.status === 'Scheduled');
                const hasFailed = rounds.some(r => r.status === 'Failed');
                const allPassed = rounds.length > 0 && rounds.every(r => r.status === 'Passed');

                matchInterviewStatus = false;

                if (filterInterviewStatus === 'None') matchInterviewStatus = rounds.length === 0;
                else if (filterInterviewStatus === 'Pending' || filterInterviewStatus === 'Scheduled') matchInterviewStatus = rounds.length > 0 && hasPending && !hasFailed;
                else if (filterInterviewStatus === 'Passed') matchInterviewStatus = allPassed;
                else if (filterInterviewStatus === 'Failed') matchInterviewStatus = hasFailed;
                else if (filterInterviewStatus === 'In_Process') matchInterviewStatus = rounds.length > 0 && !hasFailed && (!candidate.phase2Decision || candidate.phase2Decision === 'None');
            }
            let matchRating = true;
            if (filterRating !== 'All') {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === 2) : [];
                const ratedRounds = rounds.filter(r => r.rating && r.rating > 0);
                if (ratedRounds.length === 0) { matchRating = false; } else {
                    const avgRating = ratedRounds.reduce((acc, curr) => acc + curr.rating, 0) / ratedRounds.length;
                    matchRating = avgRating >= Number(filterRating);
                }
            }
            const matchPulledBy = filterPulledBy === 'All' || candidate.profilePulledBy === filterPulledBy;
            return matchPreference && matchStatus && matchDecision && matchExperience && matchInterviewStatus && matchRating && matchPulledBy;
        });
    }, [phase2Candidates, filterPreference, filterStatus, filterDecision, filterExperience, filterInterviewStatus, filterRating, filterPulledBy]);

    const phase2Metrics = useMemo(() => {
        const base = filterPulledBy === 'All' ? phase2Candidates : phase2Candidates.filter(c => c.profilePulledBy === filterPulledBy);
        return {
            totalShortlisted: base.length,
            totalScreened: base.filter(c => c.phase2Decision === 'Shortlisted' || c.phase2Decision === 'Selected').length,
            selected: base.filter(c => c.phase2Decision === 'Selected').length,
            rejected: base.filter(c => c.phase2Decision === 'Rejected').length,
            interviewScheduled: base.filter(c => {
                const rounds = c.interviewRounds ? c.interviewRounds.filter(r => (r.phase || 1) === 2) : [];
                if (rounds.length === 0) return false;
                if (c.phase2Decision && c.phase2Decision !== 'None') return false;
                return !rounds.some(r => r.status === 'Failed');
            }).length
        };
    }, [phase2Candidates, filterPulledBy]);

    // --- Phase 3: Offer & Onboarding ---
    const phase3Candidates = useMemo(() => {
        return candidates.filter(c => c.phase2Decision === 'Selected'); // "Selected" in Phase 2 moves them to Phase 3. They also remain in Phase 2.
    }, [candidates]);

    const phase3Filtered = useMemo(() => {
        return phase3Candidates.filter(candidate => {
            const matchPreference = filterPreference === 'All' || candidate.preference === filterPreference;
            const matchStatus = filterStatus === 'All' || candidate.status === filterStatus;
            const matchDecision = filterDecision === 'All' ||
                (filterDecision === 'No Show_Offer Declined'
                    ? (candidate.phase3Decision === 'No Show' || candidate.phase3Decision === 'Offer Declined')
                    : (candidate.phase3Decision || 'None') === filterDecision);
            const matchExperience = !filterExperience || (candidate.totalExperience && Number(candidate.totalExperience) >= Number(filterExperience));

            let matchInterviewStatus = true;
            if (filterInterviewStatus !== 'All') {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === 3) : [];
                const hasPending = rounds.some(r => r.status === 'Pending' || r.status === 'Scheduled');
                const hasFailed = rounds.some(r => r.status === 'Failed');
                const allPassed = rounds.length > 0 && rounds.every(r => r.status === 'Passed');

                matchInterviewStatus = false;

                if (filterInterviewStatus === 'None') matchInterviewStatus = rounds.length === 0;
                else if (filterInterviewStatus === 'Pending' || filterInterviewStatus === 'Scheduled') matchInterviewStatus = rounds.length > 0 && hasPending && !hasFailed;
                else if (filterInterviewStatus === 'Passed') matchInterviewStatus = allPassed;
                else if (filterInterviewStatus === 'Failed') matchInterviewStatus = hasFailed;
                else if (filterInterviewStatus === 'In_Process') matchInterviewStatus = rounds.length > 0 && !hasFailed && !['No Show', 'Offer Declined'].includes(candidate.phase3Decision);
            }

            let matchRating = true;
            if (filterRating !== 'All') {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === 3) : [];
                const ratedRounds = rounds.filter(r => r.rating && r.rating > 0);
                if (ratedRounds.length === 0) { matchRating = false; } else {
                    const avgRating = ratedRounds.reduce((acc, curr) => acc + curr.rating, 0) / ratedRounds.length;
                    matchRating = avgRating >= Number(filterRating);
                }
            }
            const matchPulledBy = filterPulledBy === 'All' || candidate.profilePulledBy === filterPulledBy;
            return matchPreference && matchStatus && matchDecision && matchExperience && matchInterviewStatus && matchRating && matchPulledBy;
        });
    }, [phase3Candidates, filterPreference, filterStatus, filterDecision, filterExperience, filterInterviewStatus, filterRating, filterPulledBy]);

    const phase3Metrics = useMemo(() => {
        const base = filterPulledBy === 'All' ? phase3Candidates : phase3Candidates.filter(c => c.profilePulledBy === filterPulledBy);
        return {
            total: base.length,
            offerSent: base.filter(c => c.phase3Decision === 'Offer Sent').length,
            offerAccepted: base.filter(c => c.phase3Decision === 'Offer Accepted').length,
            joined: base.filter(c => c.phase3Decision === 'Joined').length,
            noShow: base.filter(c => c.phase3Decision === 'No Show' || c.phase3Decision === 'Offer Declined').length
        };
    }, [phase3Candidates, filterPulledBy]);

    const itemsPerPage = 15;
    const activeList = activePhase === 1 ? filteredCandidates : activePhase === 2 ? phase2Filtered : phase3Filtered;
    const totalPages = Math.ceil(activeList.length / itemsPerPage) || 1;
    const paginatedCandidates = activeList.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const fetchCandidates = useCallback(async () => {
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
    }, [hiringRequestId]);

    const hEdit = useCallback((candidate) => {
        navigate(`/ta/hiring-request/${hiringRequestId}/candidate/${candidate._id}/edit`);
    }, [navigate, hiringRequestId]);

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
        navigate(`/ta/hiring-request/${hiringRequestId}/candidate/${candidate._id}/view?phase=${activePhase}`);
    }, [navigate, hiringRequestId, activePhase]);

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

    const handleExportExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Candidates');

            sheet.columns = [
                { header: 'Serial No.', key: 'slNo', width: 10 },
                { header: 'Submission Date', key: 'submissionDate', width: 15 },
                { header: 'Source', key: 'source', width: 15 },
                { header: 'Profile Pulled By', key: 'pulledBy', width: 20 },
                { header: 'Name of Candidate', key: 'name', width: 25 },
                { header: 'TAT To Join', key: 'tatToJoin', width: 15 },
                { header: 'Notice Period', key: 'noticePeriod', width: 15 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Remark', key: 'remark', width: 25 },
                { header: 'CTC', key: 'ctc', width: 15 },
                { header: 'Expected CTC', key: 'expectedCtc', width: 15 },
                { header: 'Total Experience', key: 'experience', width: 15 },
                { header: 'Qualification', key: 'qualification', width: 20 },
                { header: 'Company', key: 'company', width: 20 },
                { header: 'Location', key: 'location', width: 15 },
                { header: 'Preferred Location', key: 'prefLocation', width: 20 },
                { header: 'Email', key: 'email', width: 25 },
                { header: 'Mobile No.', key: 'mobile', width: 15 },
                { header: 'Offer Company', key: 'offerCompany', width: 20 },
                { header: 'Date Of Joining', key: 'dateOfJoining', width: 15 },
                { header: 'Interview Details', key: 'interviewDetails', width: 30 },
                { header: 'Interview Remark', key: 'interviewRemark', width: 30 }
            ];

            // Style headers
            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

            const dataToExport = activeList;

            dataToExport.forEach((candidate, index) => {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === activePhase) : [];
                const interviewDetails = rounds.map((r, i) => `R${i + 1} (${r.levelName}): ${r.status}${r.rating ? ` - ${r.rating}/10` : ''}`).join('\n');
                const interviewRemark = rounds.map((r, i) => r.feedback ? `R${i + 1}: ${r.feedback}` : null).filter(Boolean).join('\n');

                sheet.addRow({
                    slNo: index + 1,
                    submissionDate: candidate.uploadedAt ? format(new Date(candidate.uploadedAt), 'dd-MMM-yyyy') : '-',
                    source: candidate.source || '-',
                    pulledBy: candidate.profilePulledBy || '-',
                    name: candidate.candidateName || '-',
                    tatToJoin: candidate.tatToJoin ? `${candidate.tatToJoin} days` : '-',
                    noticePeriod: candidate.noticePeriod ? `${candidate.noticePeriod} days` : '-',
                    status: candidate.status || '-',
                    remark: candidate.remark || '-',
                    ctc: candidate.currentCTC ? `${candidate.currentCTC}` : '-',
                    expectedCtc: candidate.expectedCTC ? `${candidate.expectedCTC}` : '-',
                    experience: candidate.totalExperience ? `${candidate.totalExperience} yrs` : '-',
                    qualification: candidate.qualification || '-',
                    company: candidate.currentCompany || '-',
                    location: candidate.currentLocation || '-',
                    prefLocation: candidate.preferredLocation || '-',
                    email: candidate.email || '-',
                    mobile: candidate.mobile || '-',
                    offerCompany: candidate.inHandOffer ? (candidate.offerCompany || 'Yes') : 'No',
                    dateOfJoining: candidate.lastWorkingDay ? format(new Date(candidate.lastWorkingDay), 'dd-MMM-yyyy') : '-',
                    interviewDetails: interviewDetails || '-',
                    interviewRemark: interviewRemark || '-'
                });
            });

            // Enable text wrapping for interview columns
            sheet.getColumn('interviewDetails').alignment = { wrapText: true, vertical: 'top' };
            sheet.getColumn('interviewRemark').alignment = { wrapText: true, vertical: 'top' };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `${positionName || 'Candidates'} Data sheet.xlsx`);
            toast.success('Excel downloaded successfully');
        } catch (error) {
            console.error('Error exporting excel:', error);
            toast.error('Failed to export excel');
        }
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

    const handlePhase2DecisionChange = async (candidateId, newDecision) => {
        try {
            await api.patch(`/ta/candidates/${candidateId}/phase2-decision`, { phase2Decision: newDecision });
            toast.success('Phase 2 Decision updated');
            setCandidates(prev => prev.map(c =>
                c._id === candidateId ? { ...c, phase2Decision: newDecision } : c
            ));
        } catch (error) {
            console.error('Error updating Phase 2 decision:', error);
            toast.error('Failed to update Phase 2 decision');
        }
    };

    const handlePhase3DecisionChange = async (candidateId, newDecision) => {
        try {
            await api.patch(`/ta/candidates/${candidateId}/phase3-decision`, { phase3Decision: newDecision });
            toast.success('Phase 3 Decision updated');
            setCandidates(prev => prev.map(c =>
                c._id === candidateId ? { ...c, phase3Decision: newDecision } : c
            ));
        } catch (error) {
            console.error('Error updating Phase 3 decision:', error);
            toast.error('Failed to update Phase 3 decision');
        }
    };



    const getDecisionColor = (decision) => {
        switch (decision) {
            case 'Selected': return 'text-purple-600 font-bold';
            case 'Shortlisted': return 'text-emerald-600 font-bold';
            case 'Phase 3 Offer Stage': return 'text-purple-600 font-bold';
            case 'Joined': return 'text-emerald-600 font-bold';
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
                <div className="flex gap-2">
                    {/* Phase Toggle */}
                    <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                        <button
                            onClick={() => {
                                setActivePhase(1);
                                setPage(1);
                                setFilterStatus('Interested');
                                setFilterDecision('All');
                                setFilterInterviewStatus('All');
                                setFilterPreference('All');
                                setFilterRating('All');
                            }}
                            className={`px-4 py-2 text-sm font-semibold transition-colors ${activePhase === 1
                                ? 'bg-slate-800 text-white cursor-default'
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            Phase 1
                        </button>
                        <button
                            onClick={() => {
                                setActivePhase(2);
                                setPage(1);
                                setFilterStatus('All');
                                setFilterDecision('All');
                                setFilterInterviewStatus('All');
                                setFilterPreference('All');
                                setFilterRating('All');
                            }}
                            className={`px-4 py-2 text-sm font-semibold border-l border-slate-300 transition-colors ${activePhase === 2
                                ? 'bg-slate-800 text-white cursor-default'
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            Phase 2
                        </button>
                        <button
                            onClick={() => {
                                setActivePhase(3);
                                setPage(1);
                                setFilterStatus('All');
                                setFilterDecision('All');
                                setFilterInterviewStatus('All');
                                setFilterPreference('All');
                                setFilterRating('All');
                            }}
                            className={`px-4 py-2 text-sm font-semibold border-l border-slate-300 transition-colors ${activePhase === 3
                                ? 'bg-slate-800 text-white cursor-default'
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            Phase 3
                        </button>
                    </div>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Download size={18} />
                        Export Excel
                    </button>
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

            {/* Pipeline Summary Boxes */}
            {activePhase === 1 ? (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    <div
                        onClick={() => { setFilterStatus('All'); setFilterDecision('All'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-purple-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{metrics.total}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Total Sourced</span>
                        <Users className="absolute -right-2 top-1/2 -translate-y-1/2 text-purple-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterStatus('All'); setFilterDecision('None'); setFilterInterviewStatus('In_Process'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-amber-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{metrics.inInterviews}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">In Interviews</span>
                        <UserCheck className="absolute -right-2 top-1/2 -translate-y-1/2 text-amber-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterStatus('All'); setFilterDecision('Shortlisted'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-sky-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{metrics.shortlisted}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Shortlisted</span>
                        <ThumbsUp className="absolute -right-2 top-1/2 -translate-y-1/2 text-sky-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterStatus('All'); setFilterDecision('Rejected'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-rose-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{metrics.rejected}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Rejected</span>
                        <ThumbsDown className="absolute -right-2 top-1/2 -translate-y-1/2 text-rose-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterStatus('All'); setFilterDecision('On Hold'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-slate-400 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{metrics.onHold}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">On Hold</span>
                        <Clock className="absolute -right-2 top-1/2 -translate-y-1/2 text-slate-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>
                </div>
            ) : activePhase === 2 ? (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    <div
                        onClick={() => { setFilterDecision('All'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-purple-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{phase2Metrics.totalShortlisted}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Total Profile Sent</span>
                        <Users className="absolute -right-2 top-1/2 -translate-y-1/2 text-purple-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterDecision('Shortlisted_Selected'); setFilterStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-sky-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{phase2Metrics.totalScreened}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Shortlisted</span>
                        <UserCheck className="absolute -right-2 top-1/2 -translate-y-1/2 text-sky-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterDecision('None'); setFilterInterviewStatus('In_Process'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-amber-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{phase2Metrics.interviewScheduled}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Interview Scheduled</span>
                        <Clock className="absolute -right-2 top-1/2 -translate-y-1/2 text-amber-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterDecision('Selected'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-emerald-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{phase2Metrics.selected}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Selected</span>
                        <CheckCircle className="absolute -right-2 top-1/2 -translate-y-1/2 text-emerald-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterDecision('Rejected'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-rose-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{phase2Metrics.rejected}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Rejected</span>
                        <ThumbsDown className="absolute -right-2 top-1/2 -translate-y-1/2 text-rose-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div
                        onClick={() => { setFilterDecision('All'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-purple-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{phase3Metrics.total}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Total Candidates</span>
                        <Users className="absolute -right-2 top-1/2 -translate-y-1/2 text-purple-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterDecision('Offer Sent'); setFilterStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-sky-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{phase3Metrics.offerSent}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Offer Sent</span>
                        <FileText className="absolute -right-2 top-1/2 -translate-y-1/2 text-sky-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterDecision('Offer Accepted'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-amber-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{phase3Metrics.offerAccepted}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Offer Accepted</span>
                        <ThumbsUp className="absolute -right-2 top-1/2 -translate-y-1/2 text-amber-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterDecision('Joined'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-emerald-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{phase3Metrics.joined}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">Joined</span>
                        <CheckCircle className="absolute -right-2 top-1/2 -translate-y-1/2 text-emerald-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>

                    <div
                        onClick={() => { setFilterDecision('No Show_Offer Declined'); setFilterInterviewStatus('All'); }}
                        className="bg-white border border-slate-200 border-b-4 border-b-rose-500 shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{phase3Metrics.noShow}</span>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">No Show / Declined</span>
                        <XCircle className="absolute -right-2 top-1/2 -translate-y-1/2 text-rose-600 opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10" />
                    </div>
                </div>
            )}

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
                        {activePhase === 2 && <option value="Selected">Selected</option>}
                        <option value="Shortlisted">Shortlisted</option>
                        {activePhase === 3 && <option value="Hired">Hired</option>}
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
                                                        const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === activePhase) : [];

                                                        const summary = getInterviewStatusSummary(rounds);

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
                                                                        {rounds.length} rounds total
                                                                    </span>
                                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                                        {ratedRounds.length > 0 && ratedRounds.slice(0, 2).map((r, idx) => (
                                                                            <span key={r._id || idx} title={r.roundName} className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                                                R{idx + 1}: {r.rating}/10
                                                                            </span>
                                                                        ))}
                                                                        {ratedRounds.length > 2 && (
                                                                            <span
                                                                                className="text-[10px] font-bold text-amber-600 flex items-center justify-center bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
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
                                                        {activePhase === 1 ? (
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
                                                        ) : activePhase === 2 ? (
                                                            <select
                                                                value={candidate.phase2Decision || 'None'}
                                                                onChange={(e) => handlePhase2DecisionChange(candidate._id, e.target.value)}
                                                                className={`w-full appearance-none px-2.5 py-1 pr-7 text-[12px] font-bold rounded-lg border border-slate-200 bg-white outline-none cursor-pointer transition-colors hover:border-slate-300 focus:ring-2 focus:ring-blue-100 ${getDecisionColor(candidate.phase2Decision || 'None')}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                disabled={!(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.edit'))}
                                                            >
                                                                <option value="None" className="text-slate-600">None</option>
                                                                <option value="Shortlisted" className="text-emerald-600 font-bold">Shortlisted</option>
                                                                <option value="Selected" className="text-purple-600 font-bold">Selected</option>
                                                                <option value="Rejected" className="text-red-600 font-bold">Rejected</option>
                                                                <option value="On Hold" className="text-amber-600 font-bold">On Hold</option>
                                                            </select>
                                                        ) : (
                                                            <select
                                                                value={candidate.phase3Decision || 'None'}
                                                                onChange={(e) => handlePhase3DecisionChange(candidate._id, e.target.value)}
                                                                className={`w-full appearance-none px-2.5 py-1 pr-7 text-[12px] font-bold rounded-lg border border-slate-200 bg-white outline-none cursor-pointer transition-colors hover:border-slate-300 focus:ring-2 focus:ring-blue-100 ${getDecisionColor(candidate.phase3Decision || 'None')}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                disabled={!(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.edit'))}
                                                            >
                                                                <option value="None" className="text-slate-600">None</option>
                                                                <option value="Offer Sent" className="text-blue-600 font-bold">Offer Sent</option>
                                                                <option value="Offer Accepted" className="text-amber-600 font-bold">Offer Accepted</option>
                                                                <option value="Joined" className="text-emerald-600 font-bold">Joined</option>
                                                                <option value="No Show" className="text-rose-600 font-bold">No Show</option>
                                                                <option value="Offer Declined" className="text-rose-600 font-bold">Offer Declined</option>
                                                            </select>
                                                        )}
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
    );
};

export default CandidateList;

