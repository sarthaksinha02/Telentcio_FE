import React, { useState, useRef } from 'react';
import * as ExcelJS from 'exceljs';
import { X, Upload, FileText, CheckCircle, XCircle, AlertCircle, Loader, ArrowRight, Download } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

const BulkCandidateImport = ({ hiringRequestId, isOpen, onClose, onImportSuccess }) => {
    const [, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [isParsing, setIsParsing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
    const [importResults, setImportResults] = useState(null);
    const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'preview', 'summary'
    const [users, setUsers] = useState([]);
    const [existingCandidates, setExistingCandidates] = useState([]);
    const [request, setRequest] = useState(null);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
    
    const fileInputRef = useRef(null);

    const normalizeUsers = (payload) => {
        if (payload?.success && Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload)) return payload;
        return [];
    };

    const normalizeCandidates = (payload) => {
        if (Array.isArray(payload?.candidates)) return payload.candidates;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload)) return payload;
        return [];
    };

    React.useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                try {
                    const [usersRes, candidatesRes, requestRes] = await Promise.all([
                        api.get('/admin/users'),
                        api.get(`/ta/candidates/${hiringRequestId}`),
                        api.get(`/ta/hiring-request/${hiringRequestId}`)
                    ]);
                    setUsers(normalizeUsers(usersRes.data));
                    setExistingCandidates(normalizeCandidates(candidatesRes.data));
                    setRequest(requestRes.data);
                } catch (error) {
                    console.error('Error fetching import data:', error);
                }
            };
            fetchData();
        }
    }, [isOpen, hiringRequestId]);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
            processFile(droppedFile);
        } else {
            toast.error('Please upload a valid Excel file (.xlsx or .xls)');
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            processFile(selectedFile);
        }
    };

    const extractNumeric = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val !== 'string') return 0;
        const matches = val.match(/(\d+(\.\d+)?)/);
        return matches ? parseFloat(matches[1]) : 0;
    };

    const parseExcelDate = (dateVal) => {
        if (!dateVal || dateVal === '-') return null;
        try {
            let finalDate = null;
            if (dateVal instanceof Date) {
                finalDate = dateVal;
            } else if (typeof dateVal === 'string') {
                const parsed = new Date(dateVal);
                if (!isNaN(parsed.getTime())) finalDate = parsed;
            } else if (typeof dateVal === 'number') {
                // Excel serial date handle
                const excelEpoch = new Date(1899, 11, 30);
                finalDate = new Date(excelEpoch.getTime() + dateVal * 86400000);
            }
            
            if (finalDate && !isNaN(finalDate.getTime())) {
                return finalDate;
            }
        } catch (e) {
            console.error('Error parsing date:', e);
        }
        return null;
    };

    const mapSource = (source) => {
        if (!source) return 'Other';
        const s = source.toLowerCase().trim();
        if (s.includes('naukri')) return 'Job Portal';
        if (s.includes('referral')) return 'Referral';
        if (s.includes('linkedin')) return 'LinkedIn';
        if (s.includes('consultancy')) return 'Consultancy';
        if (s.includes('internal')) return 'Internal Database';
        return 'Other';
    };

    const mapStatus = (round1) => {
        if (!round1) return 'Interested';
        const r = round1.toLowerCase().trim();
        if (r.includes('not interested')) return 'Not Interested';
        if (r.includes('not relevant')) return 'Not Relevant';
        if (r.includes('interested')) return 'Interested';
        return 'Interested';
    };

    const processFile = async (file) => {
        setIsParsing(true);
        setFile(file);
        try {
            // Load users immediately if they haven't yet
            let currentUsers = users;
            if (currentUsers.length === 0) {
                try {
                    const res = await api.get('/admin/users');
                    currentUsers = normalizeUsers(res.data);
                    setUsers(currentUsers);
                } catch (e) {
                    console.error('Failed to load users for import', e);
                }
            }

            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                throw new Error('No worksheets found in the Excel file');
            }
            
            const rows = [];
            const row1 = worksheet.getRow(1);
            const row2 = worksheet.getRow(2);
            
            const headers = {};
            const tier1Headers = {}; // Main categories (Basic Info, Round 1, etc.)
            
            // Check if it's a two-tier header format (standard in our new template)
            const row2Value = row2.getCell(1).value?.toString().toLowerCase();
            const isTwoTier = row2Value === 'sl no' || row2Value === 's.no' || row2Value === 'serial no';

            if (isTwoTier) {
                // Tier 1 (Main Headings)
                row1.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    const val = cell.value?.toString().trim();
                    if (val) {
                        tier1Headers[colNumber] = val;
                    } else if (tier1Headers[colNumber - 1]) {
                        // Support merged cells if ExcelJS doesn't explode them
                        tier1Headers[colNumber] = tier1Headers[colNumber - 1];
                    }
                });

                // Tier 2 (Sub-Headers)
                row2.eachCell((cell, colNumber) => {
                    const val = cell.value?.toString().toLowerCase().trim();
                    if (val) headers[val] = colNumber;
                });
            } else {
                // Legacy Single Row Header
                row1.eachCell((cell, colNumber) => {
                    const val = cell.value?.toString().toLowerCase().trim();
                    if (val) headers[val] = colNumber;
                });
            }

            // Improved Column Mapping (Case-insensitive)
            const columnMapping = {
                candidateName: ['name of candidate', 'candidate name', 'name', 'full name', 'candidate'],
                email: ['email', 'email id', 'email address'],
                mobile: ['mobile no.', 'mobile', 'phone', 'contact', 'mobile number'],
                qualification: ['qualification', 'degree', 'education'],
                currentLocation: ['location', 'current location', 'city'],
                preferredLocation: ['preferred location', 'pref location'],
                source: ['source', 'recruitment source'],
                profilePulledBy: ['profile pulled by', 'sourcing recruiter', 'pulled by'],
                calledBy: ['calling by', 'called by'],
                rate: ['rate', 'billing rate'],
                totalExperience: ['total experience', 'experience', 'exp', 'relevant expe'],
                currentCompany: ['company', 'current company', 'organization'],
                currentCTC: ['ctc', 'current ctc', 'cctc'],
                expectedCTC: ['expected ctc', 'exp ctc', 'ectc'],
                noticePeriod: ['notice period', 'np'],
                tatToJoin: ['tat', 'tat to join'],
                inHandOffer: ['any offer in hand', 'offer in hand', 'counter offer'],
                status: ['status', 'round 1', 'initial status'],
                remark: ['remark', 'remarks', 'comments'],
                offerCompany: ['offer company', 'company offered'],
                lastWorkingDay: ['date of joining new company', 'date of joining', 'last working day', 'doj', 'lwd'],
                interviewDetails: ['interview details', 'interviews'],
                interviewRemark: ['interview remark', 'evaluator feedback', 'interview summary'],
                compSkillAssessment: ['comprehensive skill assessment', 'skill assessment', 'detailed ratings'],
                interviewerName: ['interviewer name', 'panel name', 'evaluated by']
            };

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1 || (isTwoTier && rowNumber === 2)) return; // Skip headers

                const getCellValue = (keys) => {
                    // 1. Try exact matches first
                    for (const key of keys) {
                        const colIndex = headers[key];
                        if (colIndex) {
                            const cell = row.getCell(colIndex);
                            const val = cell.value;
                            if (val === null || val === undefined) continue;
                            if (val instanceof Date) return val;
                            if (typeof val === 'object') {
                                return val.result !== undefined ? val.result : (val.text || val.richText?.[0]?.text || null);
                            }
                            return val;
                        }
                    }
                    
                    // 2. Fallback for Name: look for any header containing 'name' but not other specific things
                    if (keys.includes('name')) {
                        const nameHeader = Object.keys(headers).find(h => 
                            (h.includes('name') && !h.includes('company') && !h.includes('referral') && !h.includes('profile'))
                        );
                        if (nameHeader) {
                            const colIndex = headers[nameHeader];
                            const cell = row.getCell(colIndex);
                            return cell.value && typeof cell.value === 'object' ? (cell.value.result || cell.value.text || null) : cell.value;
                        }
                    }
                    return null;
                };

                const mappedRow = {
                    candidateName: getCellValue(columnMapping.candidateName),
                    email: getCellValue(columnMapping.email),
                    mobile: getCellValue(columnMapping.mobile)?.toString(),
                    qualification: getCellValue(columnMapping.qualification),
                    currentLocation: getCellValue(columnMapping.currentLocation),
                    preferredLocation: getCellValue(columnMapping.preferredLocation),
                    source: mapSource(getCellValue(columnMapping.source)),
                    profilePulledBy: getCellValue(columnMapping.profilePulledBy),
                    calledBy: getCellValue(columnMapping.calledBy),
                    rate: extractNumeric(getCellValue(columnMapping.rate)),
                    totalExperience: extractNumeric(getCellValue(columnMapping.totalExperience)),
                    currentCompany: getCellValue(columnMapping.currentCompany),
                    currentCTC: extractNumeric(getCellValue(columnMapping.currentCTC)),
                    expectedCTC: extractNumeric(getCellValue(columnMapping.expectedCTC)),
                    noticePeriod: extractNumeric(getCellValue(columnMapping.noticePeriod)),
                    tatToJoin: extractNumeric(getCellValue(columnMapping.tatToJoin)),
                    inHandOffer: getCellValue(columnMapping.inHandOffer)?.toString().toLowerCase() === 'yes',
                    status: mapStatus(getCellValue(columnMapping.status)),
                    remark: getCellValue(columnMapping.remark),
                    offerCompany: getCellValue(columnMapping.offerCompany),
                    lastWorkingDay: getCellValue(columnMapping.lastWorkingDay),
                    hiringRequestId: hiringRequestId,
                    resumeUrl: 'bulk-imported-placeholder',
                    resumePublicId: 'bulk-imported-placeholder',
                    mustHaveSkills: [],
                    interviewRounds: []
                };

                // Parse Date of Joining/Last Working Day
                mappedRow.lastWorkingDay = parseExcelDate(mappedRow.lastWorkingDay);

                // Identify and Parse Must-Have Skills
                const standardHeaders = [].concat(...Object.values(columnMapping), 'sl no', 's.no', 'serial no.', 'serial no', 'slno', 'submission date', 'date', 'relevant experience', 'custom remark', 'profile shortlisted (yes/no)', 'final scoring', 'profile shared', 'interview status', 'reason', 'decision status (auto-calculated)');
                
                if (isTwoTier) {
                    // In two-tier, technical skills are specifically under "Technical Skills (Experience)"
                    Object.keys(headers).forEach(header => {
                        const colIdx = headers[header]; // This is already a number from eachCell
                        const tier1 = tier1Headers[colIdx];
                        if (tier1 === 'Technical Skills (Experience)') {
                            const val = row.getCell(colIdx).value;
                            if (val !== undefined && val !== null && val !== '') {
                                mappedRow.mustHaveSkills.push({
                                    skill: header, // Column header is the skill name
                                    experience: extractNumeric(val)
                                });
                            }
                        }
                    });
                } else {
                    // Legacy Fallback
                    Object.keys(headers).forEach(header => {
                        const h = header.toLowerCase();
                        if (!standardHeaders.includes(h)) {
                            const val = row.getCell(headers[header]).value;
                            if (val !== undefined && val !== null && val !== '') {
                                mappedRow.mustHaveSkills.push({
                                    skill: header,
                                    experience: extractNumeric(val)
                                });
                            }
                        }
                    });
                }

                // Parse Interview Rounds (Enhanced for two-tier)
                if (isTwoTier) {
                    const roundsMap = {}; // { "Round 1": { feedback: ..., date: ... } }
                    
                    Object.keys(tier1Headers).forEach(colIdxStr => {
                        const colIdx = Number(colIdxStr);
                        const mainHeader = tier1Headers[colIdx];
                        if (mainHeader && (mainHeader.startsWith('Round ') || mainHeader === 'Internal Round')) {
                            const roundName = mainHeader;
                            if (!roundsMap[roundName]) {
                                roundsMap[roundName] = {
                                    levelName: roundName,
                                    status: 'Passed',
                                    phase: 1,
                                    skillRatings: []
                                };
                            }

                            const subHeader = row2.getCell(colIdx).value?.toString().trim();
                            const val = row.getCell(colIdx).value;
                            const lowerSub = subHeader?.toLowerCase();

                            if (lowerSub === 'interviewer feedback' || lowerSub === 'remarks') {
                                roundsMap[roundName].feedback = val || '';
                            } else if (lowerSub === 'interview date') {
                                roundsMap[roundName].scheduledDate = parseExcelDate(val);
                            } else if (lowerSub === 'interviewer name') {
                                roundsMap[roundName].rawInterviewer = val;
                            } else if (subHeader && val !== null && val !== undefined && val !== '') {
                                // Assume it's a skill rating if not standard
                                    roundsMap[roundName].skillRatings.push({
                                        skill: subHeader,
                                        rating: extractNumeric(val),
                                        category: 'Additional' // Must match backend enum: 'Must-Have', 'Nice-To-Have', 'Additional'
                                    });
                            }
                        }
                    });

                    mappedRow.interviewRounds = Object.values(roundsMap).filter(r => r.feedback || r.scheduledDate || r.rawInterviewer || r.skillRatings.length > 0);
                } else {
                    // Legacy Split Logic
                    const rawDetails = getCellValue(columnMapping.interviewDetails)?.toString() || '';
                    const rawRemarks = getCellValue(columnMapping.interviewRemark)?.toString() || '';
                    const rawAssessment = getCellValue(columnMapping.compSkillAssessment)?.toString() || '';
                    const rawInterviewers = getCellValue(columnMapping.interviewerName)?.toString() || '';

                    if (rawDetails || rawRemarks || rawAssessment || rawInterviewers) {
                        const splitRegex = /\r?\n|R\d+[:\s]+|Round\s*\d+[:\s]*/i;
                        const roundLines = rawDetails.split(splitRegex).map(l => l.trim()).filter(l => l.length > 3);
                        const remarkLines = rawRemarks.split(splitRegex).map(l => l.trim()).filter(l => l.length > 0);
                        const assessmentLines = rawAssessment.split(splitRegex).map(l => l.trim()).filter(l => l.length > 0);
                        const interviewerLines = rawInterviewers.split(splitRegex).map(l => l.trim()).filter(l => l.length > 0);

                        const maxRoundsCount = Math.max(roundLines.length, remarkLines.length, assessmentLines.length, interviewerLines.length);

                        for (let i = 0; i < maxRoundsCount; i++) {
                            const roundObj = {
                                levelName: `Round ${i + 1}`,
                                status: 'Passed',
                                phase: 1,
                                feedback: remarkLines[i]?.trim() || '',
                                rating: null,
                                skillRatings: []
                            };

                            if (roundLines[i]) {
                                const line = roundLines[i];
                                const levelMatch = line.match(/\(([^)]+)\)/);
                                if (levelMatch) roundObj.levelName = levelMatch[1];

                                const statusMatch = line.match(/:\s*([^-:\n]+)/);
                                if (statusMatch) {
                                    const s = statusMatch[1].trim();
                                    if (['Passed', 'Failed', 'Scheduled', 'Pending'].includes(s)) roundObj.status = s;
                                }

                                const ratingMatch = line.match(/(\d+)\/10/);
                                if (ratingMatch) roundObj.rating = parseInt(ratingMatch[1]);
                            }

                            if (assessmentLines[i]) {
                                const line = assessmentLines[i];
                                const overallMatch = line.match(/(\d+)\/10/);
                                if (overallMatch && !roundObj.rating) roundObj.rating = parseInt(overallMatch[1]);

                                const skillMatch = line.match(/\(([^)]+)\)/);
                                if (skillMatch) {
                                    const skills = skillMatch[1].split(',');
                                    skills.forEach(s => {
                                        const parts = s.split(':');
                                        if (parts.length === 2) {
                                            const rMatch = parts[1].match(/(\d+)\/10/);
                                            roundObj.skillRatings.push({
                                                skill: parts[0].trim(),
                                                rating: rMatch ? parseInt(rMatch[1]) : extractNumeric(parts[1]),
                                                category: 'Must-Have'
                                            });
                                        }
                                    });
                                }
                            }

                            if (interviewerLines[i]) {
                                roundObj.rawInterviewer = interviewerLines[i].replace(/^R\d+:\s*/i, '').trim();
                            }

                            mappedRow.interviewRounds.push(roundObj);
                        }
                    }
                }

                // Basic Validation
                const errors = [];
                if (!mappedRow.candidateName) errors.push('Name missing');
                if (!mappedRow.email) errors.push('Email missing');
                else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mappedRow.email)) errors.push('Invalid Email Format');
                if (!mappedRow.mobile) errors.push('Mobile missing');
                // Removed Experience check - defaults to 0 if missing

                const isExisting = existingCandidates.some(c => 
                    (mappedRow.email && c.email.toLowerCase() === mappedRow.email?.toLowerCase()) || 
                    (mappedRow.mobile && c.mobile === mappedRow.mobile)
                );

                rows.push({
                    data: mappedRow,
                    isValid: errors.length === 0,
                    isExisting: isExisting,
                    errors: errors,
                    rowNumber: rowNumber
                });
            });

            setPreviewData(rows);
            setActiveTab('preview');
        } catch (error) {
            console.error('Error parsing Excel:', error);
            toast.error('Failed to parse Excel file. Please ensure it is a valid .xlsx file.');
        } finally {
            setIsParsing(false);
        }
    };

    const handleImportAll = async () => {
        const validRows = previewData.filter(row => row.isValid);
        if (validRows.length === 0) {
            toast.error('No valid rows to import');
            return;
        }

        setImporting(true);
        setProgress({ current: 0, total: validRows.length, success: 0, failed: 0 });
        
        const results = { imported: [], failed: [] };

        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            try {
                // Resolve interviewers right before import using latest users list
                const processedRounds = (row.data.interviewRounds || []).map(round => {
                    if (round.rawInterviewer && users.length > 0) {
                        const normalize = (s) => (s ? String(s) : '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        const searchName = normalize(round.rawInterviewer);
                        
                        const foundUser = users.find(u => {
                            const f = normalize(u.firstName);
                            const l = normalize(u.lastName);
                            const full = f + l;
                            const email = normalize(u.email);
                            
                            // Try matching full name, first name, last name, or email (alphanumeric only)
                            return full === searchName || f === searchName || l === searchName || email === searchName;
                        });
                        
                        if (foundUser) {
                            return { ...round, evaluatedBy: foundUser._id, assignedTo: [foundUser._id] };
                        }
                    }
                    return round;
                });

                const importPayload = { ...row.data, interviewRounds: processedRounds };
                
                const response = await api.post('/ta/candidates', importPayload);
                results.imported.push({ 
                    ...row, 
                    isUpdate: response.data.isUpdate,
                    updatedFields: response.data.updatedFields || []
                });
                setProgress(prev => ({ ...prev, current: i + 1, success: prev.success + 1 }));
            } catch (error) {
                console.error(`Failed to import row ${row.rowNumber}:`, error);
                results.failed.push({
                    ...row,
                    apiError: error.response?.data?.message || 'Server error'
                });
                setProgress(prev => ({ ...prev, current: i + 1, failed: prev.failed + 1 }));
            }
        }

        setImportResults(results);
        setImporting(false);
        setActiveTab('summary');
    };

    const handleDone = () => {
        if (importResults?.imported?.length > 0) {
            onImportSuccess();
        }
        onClose();
    };

    const handleDownloadTemplate = async () => {
        try {
            setIsDownloadingTemplate(true);
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Candidate Import Template');

            // Skills from Hiring Request
            const techSkills = (Array.isArray(request?.requirements?.mustHaveSkills) 
                ? request.requirements.mustHaveSkills 
                : request?.requirements?.mustHaveSkills?.technical) || [];
            
            const softSkills = ['Communication Skills', 'Behavioral Skills'];

            // Define Sections (Matches Export)
            const sections = [
                { title: 'Basic Info', subHeaders: ['S.no', 'Submission Date', 'Source', 'Profile pulled by', 'Calling by', 'Name of Candidate', 'Total Experience'], width: 7 },
                { title: 'Internal Round', subHeaders: ['TAT', 'Rate', 'Remarks'], width: 3 },
                { title: 'Experience', subHeaders: ['Relevant Experience'], width: 1 },
                { title: 'Technical Skills (Experience)', subHeaders: techSkills, width: techSkills.length },
                { title: 'Education & Employment', subHeaders: ['Qualification', 'Company'], width: 2 },
                { title: 'Compensation', subHeaders: ['CTC', 'Expected CTC'], width: 2 },
                { title: 'Availability & Location', subHeaders: ['Notice Period', 'Location', 'Preferred Location'], width: 3 },
                { title: 'Contact Details', subHeaders: ['Email', 'Mobile No.'], width: 2 },
                { title: 'Offer Details', subHeaders: ['Offer Company', 'Date Of Joining new company'], width: 2 },
                { title: 'Status & Remarks', subHeaders: ['Status', 'Remark', 'Custom Remark'], width: 3 },
                { 
                    title: 'Round 1', 
                    subHeaders: ['Interviewer Feedback', 'Interview date', 'Interviewer Name', ...softSkills, ...techSkills],
                    width: 3 + softSkills.length + techSkills.length 
                },
                { title: 'Final Status & Decision', subHeaders: ['Profile Shortlisted (Yes/No)', 'Final Scoring', 'Profile Shared', 'Interview Status', 'Reason', 'Decision Status (Auto-calculated)'], width: 6 }
            ].filter(s => s.width > 0);

            // Row 1: Main Headings
            const row1Data = [];
            sections.forEach(s => {
                row1Data.push(s.title);
                for (let i = 1; i < s.width; i++) row1Data.push('');
            });
            const row1 = sheet.addRow(row1Data);

            // Row 2: Sub-Headers
            const row2Data = [];
            sections.forEach(s => {
                s.subHeaders.forEach(sub => row2Data.push(sub));
            });
            const row2 = sheet.addRow(row2Data);

            // Merging Main Headings
            let currentCol = 1;
            sections.forEach(s => {
                if (s.width > 1) {
                    sheet.mergeCells(1, currentCol, 1, currentCol + s.width - 1);
                }
                currentCol += s.width;
            });

            // Formatting
            row2Data.forEach((_, i) => {
                const col = sheet.getColumn(i + 1);
                col.width = 20;
                col.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
            });

            [row1, row2].forEach((row, idx) => {
                row.font = { bold: true };
                row.eachCell(cell => {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: idx === 0 ? 'FFD9EAD3' : 'FFE0E0E0' }
                    };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // Sample Row to show format
            const sampleRow = row2Data.map(h => {
                const lower = h.toLowerCase();
                if (lower === 's.no') return 1;
                if (lower === 'submission date') return format(new Date(), 'dd-MMM-yyyy');
                if (lower === 'name of candidate') return 'Sample Candidate';
                if (lower === 'email') return 'sample@example.com';
                if (lower === 'mobile no.') return '9876543210';
                if (lower === 'status') return 'Interested';
                if (lower === 'profile shortlisted (yes/no)') return 'Yes';
                if (h.includes('Skill') || techSkills.includes(h)) return '0';
                return '-';
            });
            sheet.addRow(sampleRow);

            sheet.views = [{ state: 'frozen', ySplit: 2 }];

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Bulk_Import_Template_${request?.roleDetails?.title || 'Candidates'}.xlsx`);
            toast.success('Template downloaded successfully');
        } catch (error) {
            console.error('Template error:', error);
            toast.error('Failed to generate template');
        } finally {
            setIsDownloadingTemplate(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Bulk Import Candidates</h2>
                        <p className="text-sm text-slate-500">Import multiple candidates from an Excel sheet</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'upload' && (
                        <div 
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 p-12 transition-all hover:border-blue-400 hover:bg-blue-50/30 group"
                        >
                            <div className="p-6 bg-white rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300">
                                <Upload size={48} className="text-blue-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Drag and drop your Excel file here</h3>
                            <p className="text-slate-500 text-center mb-8 max-w-sm">
                                Support .xlsx and .xls files. Use the standard two-tier template for best results.
                            </p>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".xlsx, .xls"
                                className="hidden"
                            />
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isParsing}
                                    className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                >
                                    {isParsing ? <Loader className="animate-spin" size={20} /> : <FileText size={20} />}
                                    {isParsing ? 'Parsing File...' : 'Browse Files'}
                                </button>
                                
                                <button 
                                    onClick={handleDownloadTemplate}
                                    disabled={isDownloadingTemplate || !request}
                                    className="flex items-center justify-center gap-2 px-8 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                >
                                    {isDownloadingTemplate ? <Loader className="animate-spin" size={20} /> : <Download size={20} className="text-blue-600" />}
                                    Download Template
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="flex gap-4">
                                    <div className="text-sm">
                                        <span className="text-slate-500">Total Rows:</span>
                                        <span className="ml-2 font-bold text-slate-800">{previewData.length}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-slate-500">Valid:</span>
                                        <span className="ml-2 font-bold text-green-600">{previewData.filter(r => r.isValid).length}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-slate-500">Invalid:</span>
                                        <span className="ml-2 font-bold text-red-600">{previewData.filter(r => !r.isValid).length}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setActiveTab('upload')}
                                        className="px-4 py-2 text-slate-600 font-bold hover:bg-white rounded-lg transition-colors"
                                    >
                                        Change File
                                    </button>
                                    <button 
                                        onClick={handleImportAll}
                                        disabled={importing || previewData.filter(r => r.isValid).length === 0}
                                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-all shadow-md"
                                    >
                                        {importing ? <Loader className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                        Import Valid Rows
                                    </button>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto max-h-[50vh]">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-100 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Row</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Type</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Candidate Name</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Email</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Mobile</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Experience</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Skills</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Interviewer</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Offer Co.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {previewData.map((row, idx) => (
                                                <tr key={idx} className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{row.rowNumber}</td>
                                                    <td className="px-4 py-3">
                                                        {row.isExisting ? (
                                                            <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded text-[10px]">UPDATE</span>
                                                        ) : (
                                                            <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">NEW</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {row.isValid ? (
                                                            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full w-fit">
                                                                <CheckCircle size={12} /> Ready
                                                            </span>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full w-fit">
                                                                    <AlertCircle size={12} /> Invalid
                                                                </span>
                                                                <span className="text-[10px] text-red-500 leading-tight">{row.errors.join(', ')}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.data.candidateName || <span className="text-red-400 italic">Missing</span>}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{row.data.email || <span className="text-red-400 italic">Missing</span>}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{row.data.mobile || <span className="text-red-400 italic">Missing</span>}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{row.data.totalExperience} yrs</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">
                                                        {row.data.mustHaveSkills.length > 0 ? (
                                                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-medium">
                                                                {row.data.mustHaveSkills.length} Skills
                                                            </span>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">
                                                        {row.data.interviewRounds.some(r => r.evaluatedBy) ? (
                                                            <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-xs font-medium">
                                                                {row.data.interviewRounds.filter(r => r.evaluatedBy).length} Linked
                                                            </span>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-600 truncate max-w-[120px]">{row.data.offerCompany || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'summary' && (
                        <div className="space-y-6 py-8 flex flex-col items-center">
                            <div className="p-6 bg-emerald-50 rounded-full mb-2">
                                <CheckCircle size={64} className="text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800">Import Completed!</h3>
                            
                            <div className="grid grid-cols-3 gap-6 w-full max-w-2xl">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center">
                                    <div className="text-3xl font-black text-emerald-600 mb-1">
                                        {importResults.imported.filter(r => !r.isUpdate).length}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Newly Added</div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center">
                                    <div className="text-3xl font-black text-blue-600 mb-1">
                                        {importResults.imported.filter(r => r.isUpdate).length}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Updated</div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center">
                                    <div className="text-3xl font-black text-red-600 mb-1">{importResults.failed.length}</div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Failed</div>
                                </div>
                            </div>

                            {importResults.imported.length > 0 && (
                                <div className="w-full mt-4 max-h-40 overflow-y-auto">
                                    <h4 className="font-bold text-slate-700 mb-2">Imported Candidates Detail</h4>
                                    <div className="border border-emerald-100 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-emerald-50 text-xs font-bold text-emerald-600 uppercase">
                                                <tr>
                                                    <th className="px-4 py-2">Row</th>
                                                    <th className="px-4 py-2">Candidate</th>
                                                    <th className="px-4 py-2">Action</th>
                                                    <th className="px-4 py-2">Specific Changes</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-emerald-50 text-sm">
                                                {importResults.imported.map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td className="px-4 py-2 font-medium text-slate-600">{row.rowNumber}</td>
                                                        <td className="px-4 py-2 text-slate-600">{row.data.candidateName}</td>
                                                        <td className="px-4 py-2">
                                                            {row.isUpdate ? (
                                                                <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded text-[10px]">UPDATED</span>
                                                            ) : (
                                                                <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">ADDED</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-[11px] text-slate-500">
                                                            {!row.isUpdate ? (
                                                                <span className="italic font-medium text-slate-400 font-mono">Full Record Created</span>
                                                            ) : row.updatedFields.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {row.updatedFields.map((f, i) => (
                                                                        <span key={i} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                                            {f}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="italic text-slate-400">Values matched exactly (No sub-field changes)</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {importResults.failed.length > 0 && (
                                <div className="w-full mt-4">
                                    <h4 className="font-bold text-slate-700 mb-2">Failed Rows Detail</h4>
                                    <div className="border border-red-100 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-red-50">
                                                <tr>
                                                    <th className="px-4 py-2 text-xs font-bold text-red-600 uppercase">Row</th>
                                                    <th className="px-4 py-2 text-xs font-bold text-red-600 uppercase">Candidate</th>
                                                    <th className="px-4 py-2 text-xs font-bold text-red-600 uppercase">Error Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-red-50">
                                                {importResults.failed.map((fail, idx) => (
                                                    <tr key={idx} className="text-sm">
                                                        <td className="px-4 py-2 font-medium text-slate-600">{fail.rowNumber}</td>
                                                        <td className="px-4 py-2 text-slate-600">{fail.data.candidateName}</td>
                                                        <td className="px-4 py-2 text-red-500 font-medium">{fail.apiError}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={handleDone}
                                className="mt-8 flex items-center gap-2 px-10 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg hover:scale-105 active:scale-95"
                            >
                                <CheckCircle size={20} />
                                Done & Close
                            </button>
                        </div>
                    )}
                </div>

                {/* Progress Bar (Visible only when importing) */}
                {importing && (
                    <div className="px-6 py-4 bg-slate-100 border-t border-slate-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-slate-700">Importing Data...</span>
                            <span className="text-sm font-bold text-blue-600">{progress.current} / {progress.total}</span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                        </div>
                        <div className="flex gap-4 mt-2">
                            <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                                <CheckCircle size={12} /> {progress.success} Successful
                            </span>
                            <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                                <XCircle size={12} /> {progress.failed} Failed
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkCandidateImport;
