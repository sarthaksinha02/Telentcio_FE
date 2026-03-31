import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Trash2, FileText, Loader, Upload, Plus, Eye, MoreVertical, Users, ThumbsUp, ThumbsDown, CheckCircle, XCircle, Clock, UserCheck, Download, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../../components/Skeleton';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import BulkCandidateImport from './BulkCandidateImport';

const CandidateList = ({ hiringRequestId, positionName, isLegacyView = false }) => {
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
    const [filterTransferred, setFilterTransferred] = useState('All');
    const [users, setUsers] = useState([]);

    // Menu State
    const [activeMenu, setActiveMenu] = useState(null);
    const [activePhase, setActivePhase] = useState(1);
    const [showBulkImport, setShowBulkImport] = useState(false);

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

    // Base filter applies global filters (Preference, Experience, Rating, PulledBy) but NOT Status/Decision/InterviewStatus
    // This allows the cards to show correct overall metrics even when a specific card (which sets Status/Decision) is clicked.
    // 1. Structural population: Only structural filters (Pulled By, Transferred, Legacy)
    const structuralPhase1Candidates = useMemo(() => {
        return candidates.filter(candidate => {
            const matchPulledBy = filterPulledBy === 'All' || candidate.profilePulledBy === filterPulledBy;
            const matchTransferred = filterTransferred === 'All'
                ? true
                : filterTransferred === 'Transferred'
                    ? candidate.isTransferred
                    : !candidate.isTransferred;
            return matchPulledBy && matchTransferred;
        });
    }, [candidates, filterPulledBy, filterTransferred]);

    // 2. Base for Dynamic Cards: Structural + (Rating, Exp, Preference)
    const basePhase1Candidates = useMemo(() => {
        return structuralPhase1Candidates.filter(candidate => {
            const matchPreference = filterPreference === 'All' || candidate.preference === filterPreference;
            const matchExperience = !filterExperience || (candidate.totalExperience && Number(candidate.totalExperience) >= Number(filterExperience));

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
            return matchPreference && matchExperience && matchRating;
        });
    }, [structuralPhase1Candidates, filterPreference, filterExperience, filterRating]);

    // 3. Final Filtered list for the table: Base + (Status, Decision, InterviewStatus)
    const filteredCandidates = useMemo(() => {
        return basePhase1Candidates.filter(candidate => {
            const matchStatus = filterStatus === 'All' || candidate.status === filterStatus;
            const matchDecision = filterDecision === 'All' || (candidate.decision || 'None') === filterDecision;

            let matchInterviewStatus = true;
            if (filterInterviewStatus !== 'All') {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === 1) : [];
                const hasFailed = rounds.some(r => r.status === 'Failed');
                const allPassed = rounds.length > 0 && rounds.every(r => r.status === 'Passed');

                matchInterviewStatus = false;
                if (filterInterviewStatus === 'None') matchInterviewStatus = rounds.length === 0;
                else if (filterInterviewStatus === 'Pending' || filterInterviewStatus === 'Scheduled') matchInterviewStatus = rounds.length > 0;
                else if (filterInterviewStatus === 'Passed') matchInterviewStatus = allPassed;
                else if (filterInterviewStatus === 'Failed') matchInterviewStatus = hasFailed;
                else if (filterInterviewStatus === 'In_Process') matchInterviewStatus = rounds.length > 0 && !hasFailed && (!candidate.decision || candidate.decision === 'None');
            }
            return matchStatus && matchDecision && matchInterviewStatus;
        });
    }, [basePhase1Candidates, filterStatus, filterDecision, filterInterviewStatus]);

    // Compute Metrics for Summary Boxes (Phase 1 — computed from structuralPhase1Candidates for stability)
    const metrics = useMemo(() => {
        const counts = {
            total: structuralPhase1Candidates.length,
            interested: structuralPhase1Candidates.filter(c => c.status === 'Interested').length,
            interviewScheduled: structuralPhase1Candidates.filter(c =>
                (c.interviewRounds || []).some(r => (r.phase || 1) === 1)
            ).length,
            shortlisted: structuralPhase1Candidates.filter(c => c.decision === 'Shortlisted').length,
            rejected: structuralPhase1Candidates.filter(c => c.decision === 'Rejected').length,
            onHold: structuralPhase1Candidates.filter(c => c.decision === 'On Hold').length,
            transferred: structuralPhase1Candidates.filter(c => c.isTransferred).length,
        };
        return counts;
    }, [structuralPhase1Candidates]);

    // --- Phase 2: shortlisted candidates + their metrics ---
    // Structural Phase 2 population
    const structuralPhase2Candidates = useMemo(() => {
        return candidates.filter(c => {
            const isShortlisted = c.decision === 'Shortlisted';
            const matchPulledBy = filterPulledBy === 'All' || c.profilePulledBy === filterPulledBy;
            const matchTransferred = filterTransferred === 'All' || (filterTransferred === 'Transferred' ? c.isTransferred : !c.isTransferred);
            return isShortlisted && matchPulledBy && matchTransferred;
        });
    }, [candidates, filterPulledBy, filterTransferred]);

    // Base for Phase 2 dynamic cards
    const basePhase2Candidates = useMemo(() => {
        return structuralPhase2Candidates.filter(candidate => {
            const matchPreference = filterPreference === 'All' || candidate.preference === filterPreference;
            const matchExperience = !filterExperience || (candidate.totalExperience && Number(candidate.totalExperience) >= Number(filterExperience));
            let matchRating = true;
            if (filterRating !== 'All') {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === 2) : [];
                const ratedRounds = rounds.filter(r => r.rating && r.rating > 0);
                if (ratedRounds.length === 0) { matchRating = false; } else {
                    const avgRating = ratedRounds.reduce((acc, curr) => acc + curr.rating, 0) / ratedRounds.length;
                    matchRating = avgRating >= Number(filterRating);
                }
            }
            return matchPreference && matchExperience && matchRating;
        });
    }, [structuralPhase2Candidates, filterPreference, filterExperience, filterRating]);

    // Final Phase 2 list
    const phase2Filtered = useMemo(() => {
        return basePhase2Candidates.filter(candidate => {
            const matchDecision = filterDecision === 'All' ||
                (filterDecision === 'Shortlisted_Selected'
                    ? (candidate.phase2Decision === 'Shortlisted' || candidate.phase2Decision === 'Selected')
                    : (candidate.phase2Decision || 'None') === filterDecision);
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
            return matchDecision && matchInterviewStatus;
        });
    }, [basePhase2Candidates, filterDecision, filterInterviewStatus]);

    const phase2Metrics = useMemo(() => {
        return {
            totalShortlisted: structuralPhase2Candidates.length,
            totalScreened: structuralPhase2Candidates.filter(c => c.phase2Decision === 'Shortlisted' || c.phase2Decision === 'Selected').length,
            selected: structuralPhase2Candidates.filter(c => c.phase2Decision === 'Selected').length,
            rejected: structuralPhase2Candidates.filter(c => c.phase2Decision === 'Rejected').length,
            interviewScheduled: structuralPhase2Candidates.filter(c =>
                (c.interviewRounds || []).some(r => (r.phase || 1) === 2 && (r.status === 'Scheduled' || r.status === 'Pending'))
            ).length
        };
    }, [structuralPhase2Candidates]);

    // Structural Phase 3 population
    const structuralPhase3Candidates = useMemo(() => {
        return candidates.filter(c => {
            const isSelected = c.phase2Decision === 'Selected';
            const matchPulledBy = filterPulledBy === 'All' || c.profilePulledBy === filterPulledBy;
            const matchTransferred = filterTransferred === 'All' || (filterTransferred === 'Transferred' ? c.isTransferred : !c.isTransferred);
            return isSelected && matchPulledBy && matchTransferred;
        });
    }, [candidates, filterPulledBy, filterTransferred]);

    // Base for Phase 3 dynamic cards
    const basePhase3Candidates = useMemo(() => {
        return structuralPhase3Candidates.filter(candidate => {
            const matchPreference = filterPreference === 'All' || candidate.preference === filterPreference;
            const matchExperience = !filterExperience || (candidate.totalExperience && Number(candidate.totalExperience) >= Number(filterExperience));
            let matchRating = true;
            if (filterRating !== 'All') {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === 3) : [];
                const ratedRounds = rounds.filter(r => r.rating && r.rating > 0);
                if (ratedRounds.length === 0) { matchRating = false; } else {
                    const avgRating = ratedRounds.reduce((acc, curr) => acc + curr.rating, 0) / ratedRounds.length;
                    matchRating = avgRating >= Number(filterRating);
                }
            }
            return matchPreference && matchExperience && matchRating;
        });
    }, [structuralPhase3Candidates, filterPreference, filterExperience, filterRating]);

    const phase3Filtered = useMemo(() => {
        return basePhase3Candidates.filter(candidate => {
            const matchDecision = filterDecision === 'All' ||
                (filterDecision === 'No Show_Offer Declined'
                    ? (candidate.phase3Decision === 'No Show' || candidate.phase3Decision === 'Offer Declined')
                    : (candidate.phase3Decision || 'None') === filterDecision);

            let matchInterviewStatus = true;
            if (filterInterviewStatus !== 'All') {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === 3) : [];
                const hasFailed = rounds.some(r => r.status === 'Failed');
                const allPassed = rounds.length > 0 && rounds.every(r => r.status === 'Passed');
                matchInterviewStatus = false;
                if (filterInterviewStatus === 'None') matchInterviewStatus = rounds.length === 0;
                else if (filterInterviewStatus === 'Pending' || filterInterviewStatus === 'Scheduled') matchInterviewStatus = rounds.length > 0;
                else if (filterInterviewStatus === 'Passed') matchInterviewStatus = allPassed;
                else if (filterInterviewStatus === 'Failed') matchInterviewStatus = hasFailed;
                else if (filterInterviewStatus === 'In_Process') matchInterviewStatus = rounds.length > 0 && !hasFailed && !['No Show', 'Offer Declined'].includes(candidate.phase3Decision);
            }
            return matchDecision && matchInterviewStatus;
        });
    }, [basePhase3Candidates, filterDecision, filterInterviewStatus]);

    const phase3Metrics = useMemo(() => {
        return {
            total: structuralPhase3Candidates.length,
            offerSent: structuralPhase3Candidates.filter(c => c.phase3Decision === 'Offer Sent').length,
            offerAccepted: structuralPhase3Candidates.filter(c => c.phase3Decision === 'Offer Accepted').length,
            joined: structuralPhase3Candidates.filter(c => c.phase3Decision === 'Joined').length,
            noShow: structuralPhase3Candidates.filter(c => c.phase3Decision === 'No Show' || c.phase3Decision === 'Offer Declined').length
        };
    }, [structuralPhase3Candidates]);

    const itemsPerPage = 15;
    const activeList = activePhase === 1 ? filteredCandidates : activePhase === 2 ? phase2Filtered : phase3Filtered;
    const totalPages = Math.ceil(activeList.length / itemsPerPage) || 1;
    const paginatedCandidates = activeList.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const fetchCandidates = useCallback(async () => {
        try {
            setLoading(true);
            const endpoint = isLegacyView
                ? `/ta/hiring-request/${hiringRequestId}/previous-candidates`
                : `/ta/candidates/${hiringRequestId}`;
            const response = await api.get(endpoint);
            setCandidates(isLegacyView ? response.data : response.data.candidates || []);
        } catch (error) {
            console.error('Error fetching candidates:', error);
            toast.error('Failed to load candidates');
        } finally {
            setLoading(false);
        }
    }, [hiringRequestId, isLegacyView]);

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

    const handleTransfer = useCallback(async (candidateId) => {
        if (!window.confirm("Move this candidate to the newest active requisition? This creates a copy and resets their statuses for a fresh pipeline start.")) return;

        try {
            const res = await api.post(`/ta/hiring-request/transfer-candidate/${candidateId}`);
            toast.success(res.data.message || 'Candidate transferred successfully');
            fetchCandidates();
        } catch (error) {
            console.error('Transfer error:', error);
            toast.error(error.response?.data?.message || 'Failed to transfer candidate');
        }
    }, [fetchCandidates]);

    const handleTransferToOnboarding = useCallback(async (candidateId) => {
        if (!window.confirm("Are you sure you want to transfer this candidate to the onboarding pipeline? This will create a new onboarding record for them.")) return;

        try {
            const res = await api.post(`/ta/candidates/${candidateId}/transfer-to-onboarding`);
            toast.success('Candidate transferred successfully to onboarding.');
            fetchCandidates();
        } catch (error) {
            console.error('Transfer error:', error);
            toast.error(error.response?.data?.message || 'Failed to transfer candidate');
        }
    }, [fetchCandidates]);

    const handleExportExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Candidates');

            const dataToExport = activeList;

            // 1. Collect all unique Must-Have skills from the data
            const uniqueSkills = new Set();
            dataToExport.forEach(candidate => {
                (candidate.mustHaveSkills || []).forEach(s => {
                    if (s.skill) uniqueSkills.add(s.skill);
                });
            });
            const skillColumnsList = Array.from(uniqueSkills).sort();

            // 2. Define headers dynamically
            const columns = [
                { header: 'Serial No.', key: 'slNo', width: 10 },
                { header: 'Submission Date', key: 'submissionDate', width: 15 },
                { header: 'Source', key: 'source', width: 15 },
                { header: 'Pulled By', key: 'pulledBy', width: 20 },
                { header: 'Called By', key: 'calledBy', width: 20 },
                { header: 'Rate', key: 'rate', width: 10 },
                { header: 'Name of Candidate', key: 'name', width: 25 },
                { header: 'TAT To Join', key: 'tatToJoin', width: 15 },
                { header: 'Notice Period', key: 'noticePeriod', width: 15 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Remark', key: 'remark', width: 25 },
                { header: 'Comprehensive Skill Assessment', key: 'compSkillAssessment', width: 30 },
                { header: 'Interviewer Name', key: 'interviewerName', width: 25 },
            ];

            // Add dynamic skill columns
            skillColumnsList.forEach(skill => {
                columns.push({ header: skill, key: `skill_${skill}`, width: 15 });
            });

            // Add remaining columns (Note: Removed Nice-to-Have Skills)
            columns.push(
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
            );

            sheet.columns = columns;

            // Style headers
            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

            dataToExport.forEach((candidate, index) => {
                const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === activePhase) : [];
                const interviewDetails = rounds.map((r, i) => `R${i + 1} (${r.levelName}): ${r.status}${r.rating ? ` - ${r.rating}/10` : ''}`).join('\n');
                const interviewRemark = rounds.map((r, i) => r.feedback ? `R${i + 1}: ${r.feedback}` : null).filter(Boolean).join('\n');

                const rowData = {
                    slNo: index + 1,
                    submissionDate: candidate.uploadedAt ? format(new Date(candidate.uploadedAt), 'dd-MMM-yyyy') : '-',
                    source: candidate.source || '-',
                    pulledBy: candidate.profilePulledBy || '-',
                    calledBy: candidate.calledBy || '-',
                    rate: candidate.rate !== undefined ? candidate.rate : '-',
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
                    interviewRemark: interviewRemark || '-',
                    compSkillAssessment: rounds.map((r, i) => {
                        let text = r.rating ? `R${i + 1}: ${r.rating}/10` : `R${i + 1}: -`;
                        if (r.skillRatings && r.skillRatings.length > 0) {
                            const filterSkills = r.skillRatings.filter(sr => sr.rating > 0);
                            if (filterSkills.length > 0) {
                                const skillsInfo = filterSkills.map(sr => `${sr.skill}: ${sr.rating}/10`).join(', ');
                                text += ` (${skillsInfo})`;
                            }
                        }
                        return text;
                    }).join('\n') || '-',
                    interviewerName: rounds.map((r, i) => r.evaluatedBy ? `R${i + 1}: ${r.evaluatedBy.firstName} ${r.evaluatedBy.lastName}` : null).filter(Boolean).join('\n') || '-'
                };

                // Fill dynamic skill columns
                skillColumnsList.forEach(skill => {
                    const skillObj = (candidate.mustHaveSkills || []).find(s => s.skill === skill);
                    rowData[`skill_${skill}`] = skillObj ? (skillObj.experience || 0) : '-';
                });

                sheet.addRow(rowData);
            });

            // Enable text wrapping for interview columns
            sheet.getColumn('interviewDetails').alignment = { wrapText: true, vertical: 'top' };
            sheet.getColumn('interviewRemark').alignment = { wrapText: true, vertical: 'top' };
            sheet.getColumn('compSkillAssessment').alignment = { wrapText: true, vertical: 'top' };
            sheet.getColumn('interviewerName').alignment = { wrapText: true, vertical: 'top' };

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
            case 'Offer Sent': return 'text-blue-600 font-bold';
            case 'Offer Accepted': return 'text-amber-600 font-bold';
            case 'Joined': return 'text-emerald-600 font-bold';
            case 'No Show':
            case 'Offer Declined': return 'text-rose-600 font-bold';
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
                            onClick={() => setShowBulkImport(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors"
                        >
                            <Upload size={18} />
                            Bulk Import
                        </button>
                    )}
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
            </div>            {/* Pipeline Summary Boxes */}
            {activePhase === 1 ? (() => {
                const funnelCards = [
                    {
                        id: 'total',
                        label: 'Total Sourced',
                        value: metrics.total,
                        icon: Users,
                        color: 'purple',
                        isActive: filterStatus === 'All' && filterDecision === 'All' && filterInterviewStatus === 'All' && filterTransferred === 'All',
                        onClick: () => { setFilterStatus('All'); setFilterDecision('All'); setFilterInterviewStatus('All'); setFilterTransferred('All'); }
                    },
                    {
                        id: 'interested',
                        label: 'Interested',
                        value: metrics.interested,
                        icon: CheckCircle,
                        color: 'green',
                        isActive: filterStatus === 'Interested',
                        onClick: () => { setFilterStatus('Interested'); setFilterDecision('All'); setFilterInterviewStatus('All'); setFilterTransferred('All'); }
                    },
                    {
                        id: 'interviewScheduled',
                        label: 'Interview Scheduled',
                        value: metrics.interviewScheduled,
                        icon: UserCheck,
                        color: 'amber',
                        isActive: filterInterviewStatus === 'Scheduled',
                        onClick: () => { setFilterStatus('All'); setFilterDecision('All'); setFilterInterviewStatus('Scheduled'); setFilterTransferred('All'); }
                    },
                    {
                        id: 'shortlisted',
                        label: 'Shortlisted',
                        value: metrics.shortlisted,
                        icon: ThumbsUp,
                        color: 'sky',
                        isActive: filterDecision === 'Shortlisted',
                        onClick: () => { setFilterStatus('All'); setFilterDecision('Shortlisted'); setFilterInterviewStatus('All'); setFilterTransferred('All'); }
                    },
                    {
                        id: 'onHold',
                        label: 'On Hold',
                        value: metrics.onHold,
                        icon: Clock,
                        color: 'slate',
                        isActive: filterDecision === 'On Hold',
                        onClick: () => { setFilterStatus('All'); setFilterDecision('On Hold'); setFilterInterviewStatus('All'); setFilterTransferred('All'); }
                    }
                ];

                const dynamicCards = [];

                if (filterStatus !== 'All' && filterStatus !== 'Interested') {
                    const statusCount = basePhase1Candidates.filter(c => c.status === filterStatus).length;
                    dynamicCards.push({
                        label: filterStatus,
                        value: statusCount,
                        icon: ThumbsDown,
                        color: 'rose',
                        onClick: () => { }
                    });
                }

                if (filterDecision === 'Rejected') {
                    dynamicCards.push({
                        label: 'Rejected',
                        value: metrics.rejected,
                        icon: XCircle,
                        color: 'rose',
                        onClick: () => { }
                    });
                }

                if (filterPreference !== 'All') {
                    const prefCount = basePhase1Candidates.filter(c => c.preference === filterPreference).length;
                    dynamicCards.push({
                        label: filterPreference,
                        value: prefCount,
                        icon: UserCheck,
                        color: 'indigo',
                        onClick: () => { }
                    });
                }

                if (filterRating !== 'All') {
                    const ratedCount = basePhase1Candidates.filter(c => {
                        const rounds = c.interviewRounds || [];
                        const ratedRounds = rounds.filter(r => r.rating && r.rating > 0);
                        if (ratedRounds.length === 0) return false;
                        const avgRating = ratedRounds.reduce((acc, curr) => acc + curr.rating, 0) / ratedRounds.length;
                        return avgRating >= Number(filterRating);
                    }).length;
                    dynamicCards.push({
                        label: `${filterRating}+ Rating`,
                        value: ratedCount,
                        icon: ThumbsUp,
                        color: 'amber',
                        onClick: () => { }
                    });
                }

                if (filterInterviewStatus !== 'All' && filterInterviewStatus !== 'Scheduled') {
                    const interviewCount = basePhase1Candidates.filter(candidate => {
                        const rounds = candidate.interviewRounds ? candidate.interviewRounds.filter(r => (r.phase || 1) === 1) : [];
                        const hasFailed = rounds.some(r => r.status === 'Failed');
                        const allPassed = rounds.length > 0 && rounds.every(r => r.status === 'Passed');

                        if (filterInterviewStatus === 'None') return rounds.length === 0;
                        if (filterInterviewStatus === 'Pending' || filterInterviewStatus === 'Scheduled') return rounds.length > 0;
                        if (filterInterviewStatus === 'Passed') return allPassed;
                        if (filterInterviewStatus === 'Failed') return hasFailed;
                        if (filterInterviewStatus === 'In_Process') return rounds.length > 0 && !hasFailed && (!candidate.decision || candidate.decision === 'None');
                        return false;
                    }).length;
                    dynamicCards.push({
                        label: filterInterviewStatus.replace('_', ' '),
                        value: interviewCount,
                        icon: Clock,
                        color: 'amber',
                        onClick: () => { }
                    });
                }

                if (filterExperience) {
                    const expCount = basePhase1Candidates.filter(c => c.totalExperience && Number(c.totalExperience) >= Number(filterExperience)).length;
                    dynamicCards.push({
                        label: `${filterExperience}+ Yrs Exp`,
                        value: expCount,
                        icon: Briefcase,
                        color: 'blue',
                        onClick: () => { }
                    });
                }

                if (filterPulledBy !== 'All') {
                    const pulledCount = basePhase1Candidates.filter(c => c.profilePulledBy === filterPulledBy).length;
                    dynamicCards.push({
                        label: `By: ${filterPulledBy.split(' ')[0]}`,
                        value: pulledCount,
                        icon: Users,
                        color: 'indigo',
                        onClick: () => { }
                    });
                }

                if (filterTransferred === 'Transferred') {
                    dynamicCards.push({
                        label: 'Transferred',
                        value: metrics.transferred,
                        icon: Download,
                        color: 'blue',
                        onClick: () => { }
                    });
                }

                const allCards = [...funnelCards, ...dynamicCards];
                const gridCols = `grid-cols-2 lg:grid-cols-${Math.min(allCards.length, 6)}`;

                return (
                    <div className={`grid ${gridCols} gap-4`}>
                        {allCards.map((card, idx) => {
                            const Icon = card.icon;
                            const colorMap = {
                                purple: 'border-b-purple-500 text-purple-600',
                                green: 'border-b-green-500 text-green-600',
                                amber: 'border-b-amber-500 text-amber-600',
                                sky: 'border-b-sky-500 text-sky-600',
                                slate: 'border-b-slate-500 text-slate-600',
                                rose: 'border-b-rose-500 text-rose-600',
                                indigo: 'border-b-indigo-500 text-indigo-600',
                                blue: 'border-b-blue-500 text-blue-600'
                            };

                            return (
                                <div
                                    key={idx}
                                    onClick={card.onClick}
                                    className={`bg-white border border-slate-200 border-b-4 ${colorMap[card.color].split(' ')[0]} shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98] ${card.isActive ? 'ring-2 ring-blue-100 bg-blue-50/10' : ''}`}
                                >
                                    <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{card.value}</span>
                                    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">{card.label}</span>
                                    <Icon className={`absolute -right-2 top-1/2 -translate-y-1/2 ${colorMap[card.color].split(' ')[1]} opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10`} />
                                </div>
                            );
                        })}
                    </div>
                );
            })()
                : activePhase === 2 ? (() => {
                    const funnelCards = [
                        {
                            id: 'total',
                            label: 'Total Profile Sent',
                            value: phase2Metrics.totalShortlisted,
                            icon: Users,
                            color: 'purple',
                            isActive: filterDecision === 'All' && filterInterviewStatus === 'All' && filterStatus === 'All',
                            onClick: () => { setFilterDecision('All'); setFilterInterviewStatus('All'); setFilterStatus('All'); }
                        },
                        {
                            id: 'shortlisted',
                            label: 'Shortlisted',
                            value: phase2Metrics.totalScreened,
                            icon: UserCheck,
                            color: 'sky',
                            isActive: filterDecision === 'Shortlisted_Selected',
                            onClick: () => { setFilterDecision('Shortlisted_Selected'); setFilterStatus('All'); }
                        },
                        {
                            id: 'interviewScheduled',
                            label: 'Interview Scheduled',
                            value: phase2Metrics.interviewScheduled,
                            icon: Clock,
                            color: 'amber',
                            isActive: filterInterviewStatus === 'Pending' || filterInterviewStatus === 'Scheduled',
                            onClick: () => { setFilterDecision('All'); setFilterInterviewStatus('Pending'); }
                        },
                        {
                            id: 'selected',
                            label: 'Selected',
                            value: phase2Metrics.selected,
                            icon: CheckCircle,
                            color: 'emerald',
                            isActive: filterDecision === 'Selected',
                            onClick: () => { setFilterDecision('Selected'); setFilterInterviewStatus('All'); }
                        },
                        {
                            id: 'rejected',
                            label: 'Rejected',
                            value: phase2Metrics.rejected,
                            icon: ThumbsDown,
                            color: 'rose',
                            isActive: filterDecision === 'Rejected',
                            onClick: () => { setFilterDecision('Rejected'); setFilterInterviewStatus('All'); }
                        }
                    ];

                    const dynamicCards = [];

                    if (filterPreference !== 'All') {
                        const prefCount = basePhase2Candidates.filter(c => c.preference === filterPreference).length;
                        dynamicCards.push({
                            label: filterPreference,
                            value: prefCount,
                            icon: UserCheck,
                            color: 'indigo',
                            onClick: () => { }
                        });
                    }

                    if (filterRating !== 'All') {
                        const ratedCount = basePhase2Candidates.filter(c => {
                            const rounds = c.interviewRounds || [];
                            const ratedRounds = rounds.filter(r => (r.phase || 1) === 2 && r.rating && r.rating > 0);
                            if (ratedRounds.length === 0) return false;
                            const avgRating = ratedRounds.reduce((acc, curr) => acc + curr.rating, 0) / ratedRounds.length;
                            return avgRating >= Number(filterRating);
                        }).length;
                        dynamicCards.push({
                            label: `${filterRating}+ Rating`,
                            value: ratedCount,
                            icon: ThumbsUp,
                            color: 'amber',
                            onClick: () => { }
                        });
                    }

                    if (filterExperience) {
                        const expCount = basePhase2Candidates.filter(c => c.totalExperience && Number(c.totalExperience) >= Number(filterExperience)).length;
                        dynamicCards.push({
                            label: `${filterExperience}+ Yrs Exp`,
                            value: expCount,
                            icon: Briefcase,
                            color: 'blue',
                            onClick: () => { }
                        });
                    }

                    const allCards = [...funnelCards, ...dynamicCards];
                    const gridCols = `grid-cols-2 lg:grid-cols-${Math.min(allCards.length, 6)}`;

                    return (
                        <div className={`grid ${gridCols} gap-4`}>
                            {allCards.map((card, idx) => {
                                const Icon = card.icon;
                                const colorMap = {
                                    purple: 'border-b-purple-500 text-purple-600',
                                    sky: 'border-b-sky-500 text-sky-600',
                                    amber: 'border-b-amber-500 text-amber-600',
                                    emerald: 'border-b-emerald-500 text-emerald-600',
                                    rose: 'border-b-rose-500 text-rose-600',
                                    indigo: 'border-b-indigo-500 text-indigo-600',
                                    blue: 'border-b-blue-500 text-blue-600'
                                };

                                return (
                                    <div
                                        key={idx}
                                        onClick={card.onClick}
                                        className={`bg-white border border-slate-200 border-b-4 ${colorMap[card.color].split(' ')[0]} shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98] ${card.isActive ? 'ring-2 ring-blue-100 bg-blue-50/10' : ''}`}
                                    >
                                        <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{card.value}</span>
                                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">{card.label}</span>
                                        <Icon className={`absolute -right-2 top-1/2 -translate-y-1/2 ${colorMap[card.color].split(' ')[1]} opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10`} />
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()
                    : (() => {
                        const funnelCards = [
                            {
                                id: 'total',
                                label: 'Total Candidates',
                                value: phase3Metrics.total,
                                icon: Users,
                                color: 'purple',
                                isActive: filterDecision === 'All' && filterStatus === 'All',
                                onClick: () => { setFilterDecision('All'); setFilterStatus('All'); }
                            },
                            {
                                id: 'offerSent',
                                label: 'Offer Sent',
                                value: phase3Metrics.offerSent,
                                icon: FileText,
                                color: 'sky',
                                isActive: filterDecision === 'Offer Sent',
                                onClick: () => { setFilterDecision('Offer Sent'); setFilterStatus('All'); }
                            },
                            {
                                id: 'offerAccepted',
                                label: 'Offer Accepted',
                                value: phase3Metrics.offerAccepted,
                                icon: ThumbsUp,
                                color: 'amber',
                                isActive: filterDecision === 'Offer Accepted',
                                onClick: () => { setFilterDecision('Offer Accepted'); setFilterInterviewStatus('All'); }
                            },
                            {
                                id: 'joined',
                                label: 'Joined',
                                value: phase3Metrics.joined,
                                icon: CheckCircle,
                                color: 'emerald',
                                isActive: filterDecision === 'Joined',
                                onClick: () => { setFilterDecision('Joined'); setFilterInterviewStatus('All'); }
                            },
                            {
                                id: 'noShow',
                                label: 'No Show / Declined',
                                value: phase3Metrics.noShow,
                                icon: XCircle,
                                color: 'rose',
                                isActive: filterDecision === 'No Show_Offer Declined',
                                onClick: () => { setFilterDecision('No Show_Offer Declined'); setFilterInterviewStatus('All'); }
                            }
                        ];

                        const dynamicCards = [];

                        if (filterPreference !== 'All') {
                            const prefCount = basePhase3Candidates.filter(c => c.preference === filterPreference).length;
                            dynamicCards.push({
                                label: filterPreference,
                                value: prefCount,
                                icon: UserCheck,
                                color: 'indigo',
                                onClick: () => { }
                            });
                        }

                        if (filterRating !== 'All') {
                            const ratedCount = basePhase3Candidates.filter(c => {
                                const rounds = c.interviewRounds || [];
                                const ratedRounds = rounds.filter(r => (r.phase || 1) === 3 && r.rating && r.rating > 0);
                                if (ratedRounds.length === 0) return false;
                                const avgRating = ratedRounds.reduce((acc, curr) => acc + curr.rating, 0) / ratedRounds.length;
                                return avgRating >= Number(filterRating);
                            }).length;
                            dynamicCards.push({
                                label: `${filterRating}+ Rating`,
                                value: ratedCount,
                                icon: ThumbsUp,
                                color: 'amber',
                                onClick: () => { }
                            });
                        }

                        if (filterExperience) {
                            const expCount = basePhase3Candidates.filter(c => c.totalExperience && Number(c.totalExperience) >= Number(filterExperience)).length;
                            dynamicCards.push({
                                label: `${filterExperience}+ Yrs Exp`,
                                value: expCount,
                                icon: Briefcase,
                                color: 'blue',
                                onClick: () => { }
                            });
                        }

                        const allCards = [...funnelCards, ...dynamicCards];
                        const gridCols = `grid-cols-2 lg:grid-cols-${Math.min(allCards.length, 6)}`;

                        return (
                            <div className={`grid ${gridCols} gap-4`}>
                                {allCards.map((card, idx) => {
                                    const Icon = card.icon;
                                    const colorMap = {
                                        purple: 'border-b-purple-500 text-purple-600',
                                        sky: 'border-b-sky-500 text-sky-600',
                                        amber: 'border-b-amber-500 text-amber-600',
                                        emerald: 'border-b-emerald-500 text-emerald-600',
                                        rose: 'border-b-rose-500 text-rose-600',
                                        indigo: 'border-b-indigo-500 text-indigo-600',
                                        blue: 'border-b-blue-500 text-blue-600'
                                    };

                                    return (
                                        <div
                                            key={idx}
                                            onClick={card.onClick}
                                            className={`bg-white border border-slate-200 border-b-4 ${colorMap[card.color].split(' ')[0]} shadow-sm p-4 relative overflow-hidden group hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98] ${card.isActive ? 'ring-2 ring-blue-100 bg-blue-50/10' : ''}`}
                                        >
                                            <span className="block text-[32px] font-light text-slate-800 leading-none mb-2 relative z-10">{card.value}</span>
                                            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide relative z-10">{card.label}</span>
                                            <Icon className={`absolute -right-2 top-1/2 -translate-y-1/2 ${colorMap[card.color].split(' ')[1]} opacity-[0.08] size-16 transition-transform group-hover:scale-110 group-hover:opacity-10`} />
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

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
                {activePhase === 1 && (
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
                )}
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Decision</label>
                    <select
                        value={filterDecision}
                        onChange={(e) => setFilterDecision(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="All">All Decisions</option>
                        {activePhase === 1 && (
                            <>
                                <option value="Shortlisted">Shortlisted</option>
                                <option value="Rejected">Rejected</option>
                                <option value="On Hold">On Hold</option>
                                <option value="None">None</option>
                            </>
                        )}
                        {activePhase === 2 && (
                            <>
                                <option value="Selected">Selected</option>
                                <option value="Shortlisted">Shortlisted (Screened)</option>
                                <option value="Rejected">Rejected</option>
                                <option value="On Hold">On Hold</option>
                            </>
                        )}
                        {activePhase === 3 && (
                            <>
                                <option value="Offer Sent">Offer Sent</option>
                                <option value="Offer Accepted">Offer Accepted</option>
                                <option value="Joined">Joined</option>
                                <option value="No Show">No Show</option>
                                <option value="Offer Declined">Offer Declined</option>
                            </>
                        )}
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
                        <option value="Scheduled">Has Interviews (All)</option>
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
                        onChange={(e) => {
                            const val = e.target.value;
                            setFilterPulledBy(val);
                            if (val !== 'All') {
                                setFilterStatus('All');
                                setFilterDecision('All');
                                setFilterInterviewStatus('All');
                            }
                        }}
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
                {!isLegacyView && candidates.some(c => c.isTransferred) && (
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Origin</label>
                        <select
                            value={filterTransferred}
                            onChange={(e) => setFilterTransferred(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-36"
                        >
                            <option value="All">All Origins</option>
                            <option value="New">New Applications</option>
                            <option value="Transferred">Transferred</option>
                        </select>
                    </div>
                )}
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
                {(filterPreference !== 'All' || (activePhase === 1 && filterStatus !== 'Interested') || filterDecision !== 'All' || filterExperience !== '' || filterInterviewStatus !== 'All' || filterRating !== 'All' || filterPulledBy !== 'All' || filterTransferred !== 'All') && (
                    <button
                        onClick={() => {
                            setFilterPreference('All');
                            if (activePhase === 1) setFilterStatus('Interested');
                            else setFilterStatus('All');
                            setFilterDecision('All');
                            setFilterExperience('');
                            setFilterInterviewStatus('All');
                            setFilterRating('All');
                            setFilterPulledBy('All');
                            setFilterTransferred('All');
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
                                                        {candidate.isTransferred && !isLegacyView && (
                                                            <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold w-max uppercase tracking-wider mt-1 border border-blue-200" title="Moved from an older requisition">
                                                                Transferred
                                                            </span>
                                                        )}
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

                                                            {(user?.roles?.includes('Admin') || user?.permissions?.includes('ta.edit')) && (
                                                                <button
                                                                    onClick={() => {
                                                                        handleTransfer(candidate._id);
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors text-left font-semibold"
                                                                >
                                                                    <Briefcase size={16} className="text-blue-500" />
                                                                    Transfer to Active Requisition
                                                                </button>
                                                            )}

                                                            {activePhase === 3 && candidate.phase3Decision && candidate.phase3Decision !== 'None' && !candidate.isTransferredToOnboarding && (user?.roles?.includes('Admin') || user?.permissions?.includes('ta.edit')) && (
                                                                <button
                                                                    onClick={() => {
                                                                        handleTransferToOnboarding(candidate._id);
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors text-left font-bold"
                                                                >
                                                                    <CheckCircle size={16} className="text-emerald-500" />
                                                                    Transfer to Onboarding
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
            {showBulkImport && (
                <BulkCandidateImport
                    hiringRequestId={hiringRequestId}
                    isOpen={showBulkImport}
                    onClose={() => setShowBulkImport(false)}
                    onImportSuccess={fetchCandidates}
                />
            )}
        </div>
    );
};

export default CandidateList;

