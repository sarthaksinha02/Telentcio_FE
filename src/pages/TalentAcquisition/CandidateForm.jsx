import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Upload, Loader, ArrowLeft, Plus, Trash, CheckCircle, ChevronDown, Search, Eye, EyeOff } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Skeleton from '../../components/Skeleton';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const CandidateForm = () => {
    const { hiringRequestId, candidateId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const isViewMode = location.pathname.includes('/view');
    const isEditMode = location.pathname.includes('/edit');
    const isAddMode = !isViewMode && !isEditMode;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [resumeFile, setResumeFile] = useState(null);
    const [resumeUrl, setResumeUrl] = useState('');
    const [resumePublicId, setResumePublicId] = useState('');
    const [uploading, setUploading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [showResumePanel, setShowResumePanel] = useState(true);

    const [formData, setFormData] = useState({
        candidateName: '',
        email: '',
        mobile: '',
        source: 'Job Portal',
        referralName: '',
        profilePulledBy: '',
        calledBy: '',
        rate: '',
        currentCTC: '',
        expectedCTC: '',
        inHandOffer: false,
        offerCompany: '',
        offerCTC: '',
        preference: 'Neutral / Average',
        totalExperience: '',
        qualification: '',
        currentCompany: '',
        pastExperience: [{ companyName: '', experienceYears: '', role: '' }],
        currentLocation: '',
        preferredLocation: '',
        tatToJoin: '',
        noticePeriod: '',
        lastWorkingDay: '',
        status: 'Interested',
        remark: '',
        mustHaveSkills: [],
        niceToHaveSkills: []
    });

    const [sourceOptions, setSourceOptions] = useState([]);
    const [users, setUsers] = useState([]);
    const [showSourceDropdown, setShowSourceDropdown] = useState(false);
    const [sourceSearch, setSourceSearch] = useState('');
    const dropdownRef = useRef(null);

    // Duplicate detection state: { email: null | 'checking' | string, mobile: null | 'checking' | string }
    const [dupCheck, setDupCheck] = useState({ email: null, mobile: null });

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowSourceDropdown(false);
                setSourceSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await api.get('/admin/users');
            let fetchedUsers = [];
            if (res.data?.success) {
                fetchedUsers = res.data.data || [];
            } else if (Array.isArray(res.data)) {
                fetchedUsers = res.data;
            }

            // Filter users who have 'ta.create' permission or are 'Admin'
            const filteredUsers = fetchedUsers.filter(u => {
                // Check if the user is an Admin
                const roleNames = u.roles?.map(r => r.name) || [];
                if (roleNames.includes('Admin')) return true;

                // Check permissions inside roles
                let hasTaCreate = false;
                if (u.roles && Array.isArray(u.roles)) {
                    u.roles.forEach(role => {
                        if (role.permissions && Array.isArray(role.permissions)) {
                            // Backend populates permissions with { _id, key } so we check 'key'
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
    }, []);

    const fetchRequisitionSkills = useCallback(async () => {
        try {
            const res = await api.get(`/ta/hiring-request/${hiringRequestId}`);
            let reqData = res.data;
            if (res.data?.success) reqData = res.data.data;

            if (reqData?.requirements) {
                const { mustHaveSkills, niceToHaveSkills } = reqData.requirements;
                
                // Safely extract mustHaveSkills (it could be an object { technical: [], softSkills: [] } or just an array)
                const techSkills = Array.isArray(mustHaveSkills?.technical) ? mustHaveSkills.technical : (Array.isArray(mustHaveSkills) ? mustHaveSkills : []);
                const softSkills = Array.isArray(mustHaveSkills?.softSkills) ? mustHaveSkills.softSkills : [];
                const allMustHave = [...techSkills, ...softSkills];

                // Safely extract niceToHaveSkills
                const niceTech = Array.isArray(niceToHaveSkills?.technical) ? niceToHaveSkills.technical : (Array.isArray(niceToHaveSkills) ? niceToHaveSkills : []);
                const niceSoft = Array.isArray(niceToHaveSkills?.softSkills) ? niceToHaveSkills.softSkills : [];
                const allNiceToHave = [...niceTech, ...niceSoft];

                setFormData(prev => ({
                    ...prev,
                    mustHaveSkills: allMustHave.map(s => ({ skill: s, experience: '' })),
                    niceToHaveSkills: allNiceToHave.map(s => ({ skill: s, experience: '' }))
                }));
            }
        } catch (error) {
            console.error('Failed to fetch requisition skills', error);
        }
    }, [hiringRequestId]);

    const fetchSourceOptions = useCallback(async () => {
        try {
            const res = await api.get('/ta/candidates/sources');
            // Backend now returns [{ name, _id, isCustom }]
            setSourceOptions(res.data || []);
        } catch (error) {
            console.error('Failed to fetch source options', error);
            setSourceOptions([
                { name: 'Job Portal', isCustom: false },
                { name: 'Referral', isCustom: false },
                { name: 'Other', isCustom: false }
            ]);
        }
    }, []);

    const fetchCandidateDetails = useCallback(async () => {
        try {
            setFetching(true);
            const res = await api.get(`/ta/candidates/${hiringRequestId}`);
            const candidate = res.data.candidates.find(c => c._id === candidateId);

            if (candidate) {
                setFormData({
                    candidateName: candidate.candidateName || '',
                    email: candidate.email || '',
                    mobile: candidate.mobile || '',
                    source: candidate.source || 'Job Portal',
                    profilePulledBy: candidate.profilePulledBy || '',
                    calledBy: candidate.calledBy || '',
                    rate: candidate.rate || '',
                    currentCTC: candidate.currentCTC || '',
                    expectedCTC: candidate.expectedCTC || '',
                    inHandOffer: candidate.inHandOffer || false,
                    offerCompany: candidate.offerCompany || '',
                    offerCTC: candidate.offerCTC || '',
                    preference: candidate.preference || 'Neutral / Average',
                    totalExperience: candidate.totalExperience || '',
                    qualification: candidate.qualification || '',
                    currentCompany: candidate.currentCompany || '',
                    pastExperience: candidate.pastExperience && candidate.pastExperience.length > 0
                        ? candidate.pastExperience
                        : [{ companyName: '', experienceYears: '' }],
                    currentLocation: candidate.currentLocation || '',
                    preferredLocation: candidate.preferredLocation || '',
                    tatToJoin: candidate.tatToJoin || '',
                    noticePeriod: candidate.noticePeriod || '',
                    lastWorkingDay: candidate.lastWorkingDay ? new Date(candidate.lastWorkingDay).toISOString().split('T')[0] : '',
                    status: candidate.status || 'Interested',
                    remark: candidate.remark || '',
                    mustHaveSkills: candidate.mustHaveSkills || [],
                    niceToHaveSkills: candidate.niceToHaveSkills || []
                });
                setResumeUrl(candidate.resumeUrl || '');
                setResumePublicId(candidate.resumePublicId || '');
            } else {
                toast.error('Candidate not found');
                navigate(`/ta/view/${hiringRequestId}?tab=applications`); // Go back to list
            }
        } catch (error) {
            console.error('Error fetching candidate:', error);
            toast.error('Failed to load candidate details');
        } finally {
            setFetching(false);
        }
    }, [candidateId, hiringRequestId, navigate]);

    // 1. Fetch auxiliary data (Sources, Users) ONCE on mount
    useEffect(() => {
        fetchSourceOptions();
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2. Fetch specific candidate or requisition data when their IDs change
    useEffect(() => {
        if (candidateId) {
            fetchCandidateDetails();
        } else if (hiringRequestId) {
            fetchRequisitionSkills();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [candidateId, hiringRequestId]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (file.type !== 'application/pdf') {
            toast.error('Only PDF files are allowed');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB');
            return;
        }

        setResumeFile(file);
        // Create a local object URL for previewing before upload
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        // Deferred upload: File is stored in state, upload happens on submit
    };

    const handleAutoFill = async () => {
        if (!resumeFile) {
            toast.error('Please select a resume file first');
            return;
        }

        try {
            setIsParsing(true);
            const parseFormData = new FormData();
            parseFormData.append('resume', resumeFile);

            const response = await api.post('/ta/candidates/parse-resume', parseFormData);

            if (response.data?.data) {
                const parsed = response.data.data;

                // Update form data with parsed values
                setFormData(prev => ({
                    ...prev,
                    candidateName: parsed.candidateName || prev.candidateName,
                    email: parsed.email || prev.email,
                    mobile: parsed.mobile || prev.mobile,
                    totalExperience: parsed.totalExperience || prev.totalExperience,
                    niceToHaveSkills: parsed.niceToHaveSkills?.length > 0
                        ? parsed.niceToHaveSkills.map(s => ({ skill: s.skill, experience: '' }))
                        : prev.niceToHaveSkills
                }));

                toast.success('Information extracted from resume!');
            }
        } catch (error) {
            console.error('Error auto-filling from resume:', error);
            toast.error(error.response?.data?.message || 'Failed to extract information from resume.');
        } finally {
            setIsParsing(false);
        }
    };

    // Cleanup preview URL to avoid memory leaks
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const uploadResume = async (file) => {
        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('resume', file);

            const response = await api.post(`/ta/candidates/upload-resume/${hiringRequestId}`, formData);

            return {
                resumeUrl: response.data.resumeUrl,
                resumePublicId: response.data.resumePublicId
            };
        } catch (error) {
            console.error('Error uploading resume:', error);
            throw error;
        } finally {
            setUploading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear duplicate warning when user edits the field
        if (name === 'email' || name === 'mobile') {
            setDupCheck(prev => ({ ...prev, [name]: null }));
        }
    };

    // Called onBlur for email/mobile — only in add mode, skipped in edit mode
    const checkDuplicate = async (field, value) => {
        if (isEditMode || !value || !hiringRequestId) return;
        setDupCheck(prev => ({ ...prev, [field]: 'checking' }));
        try {
            const res = await api.get(`/ta/candidates/${hiringRequestId}`);
            const allCandidates = res.data.candidates || [];
            const trimmed = value.trim().toLowerCase();
            const duplicate = allCandidates.find(c =>
                field === 'email'
                    ? c.email?.toLowerCase() === trimmed
                    : c.mobile?.trim() === value.trim()
            );
            if (duplicate) {
                setDupCheck(prev => ({
                    ...prev,
                    [field]: `"${duplicate.candidateName}" is already added with this ${field === 'email' ? 'email' : 'mobile number'}.`
                }));
            } else {
                setDupCheck(prev => ({ ...prev, [field]: null }));
            }
        } catch {
            // silently ignore — backend will catch it on submit anyway
            setDupCheck(prev => ({ ...prev, [field]: null }));
        }
    };

    const handleAddExperience = () => {
        setFormData(prev => ({
            ...prev,
            pastExperience: [...prev.pastExperience, { companyName: '', experienceYears: '' }]
        }));
    };

    const handleRemoveExperience = (index) => {
        setFormData(prev => ({
            ...prev,
            pastExperience: prev.pastExperience.filter((_, i) => i !== index)
        }));
    };

    const handleExperienceChange = (index, field, value) => {
        const newExperience = [...formData.pastExperience];
        newExperience[index][field] = value;
        setFormData(prev => ({ ...prev, pastExperience: newExperience }));
    };

    const handleSkillExperienceChange = (type, index, value) => {
        const skills = [...formData[type]];
        skills[index].experience = value;
        setFormData(prev => ({ ...prev, [type]: skills }));
    };

    const handleSkillNameChange = (index, value) => {
        const skills = [...formData.niceToHaveSkills];
        skills[index].skill = value;
        setFormData(prev => ({ ...prev, niceToHaveSkills: skills }));
    };

    const addNiceToHaveSkill = () => {
        setFormData(prev => ({
            ...prev,
            niceToHaveSkills: [...prev.niceToHaveSkills, { skill: '', experience: '' }]
        }));
    };

    const removeNiceToHaveSkill = (index) => {
        const skills = formData.niceToHaveSkills.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, niceToHaveSkills: skills }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!isEditMode && !resumeFile && !resumeUrl && isAddMode) {
            toast.error('Please select a resume file');
            return;
        }

        if (!formData.candidateName || !formData.email || !formData.mobile || !formData.totalExperience) {
            toast.error('Please fill all required fields');
            return;
        }

        // Block submission if a duplicate was detected
        if (dupCheck.email && dupCheck.email !== 'checking') {
            toast.error('Please resolve the duplicate email before submitting.');
            return;
        }
        if (dupCheck.mobile && dupCheck.mobile !== 'checking') {
            toast.error('Please resolve the duplicate mobile number before submitting.');
            return;
        }

        try {
            setLoading(true);

            let uploadedResumeUrl = resumeUrl;
            let uploadedResumePublicId = resumePublicId;

            // Upload resume if a new file is selected
            if (resumeFile) {
                try {
                    const uploadData = await uploadResume(resumeFile);
                    uploadedResumeUrl = uploadData.resumeUrl;
                    uploadedResumePublicId = uploadData.resumePublicId;
                    toast.success('Resume uploaded successfully');
                } catch {
                    toast.error('Failed to upload resume. Please try again.');
                    setLoading(false);
                    return; // Stop submission
                }
            }

            const payload = {
                ...formData,
                mustHaveSkills: (formData.mustHaveSkills || []).filter(s => s.skill).map(s => ({ ...s, experience: s.experience ? Number(s.experience) : 0 })),
                niceToHaveSkills: (formData.niceToHaveSkills || []).filter(s => s.skill).map(s => ({ ...s, experience: s.experience ? Number(s.experience) : 0 })),
                hiringRequestId,
                resumeUrl: uploadedResumeUrl,
                resumePublicId: uploadedResumePublicId,
                calledBy: formData.calledBy || undefined,
                rate: formData.rate ? Number(formData.rate) : undefined,
                currentCTC: formData.currentCTC ? Number(formData.currentCTC) : undefined,
                expectedCTC: formData.expectedCTC ? Number(formData.expectedCTC) : undefined,
                preference: formData.preference || undefined,
                pastExperience: formData.pastExperience.filter(exp => exp.companyName && exp.experienceYears),
                totalExperience: Number(formData.totalExperience),
                tatToJoin: formData.tatToJoin ? Number(formData.tatToJoin) : undefined,
                noticePeriod: formData.noticePeriod ? Number(formData.noticePeriod) : undefined,
                lastWorkingDay: formData.lastWorkingDay || undefined
            };

            if (isEditMode) {
                await api.put(`/ta/candidates/${candidateId}`, payload);
                toast.success('Candidate updated successfully');
            } else {
                await api.post('/ta/candidates', payload);
                toast.success('Candidate created successfully');
            }

            navigate(`/ta/view/${hiringRequestId}?tab=applications`);
        } catch (error) {
            console.error('Error saving candidate:', error);
            toast.error(error.response?.data?.message || 'Failed to save candidate');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        navigate(`/ta/view/${hiringRequestId}?tab=applications`);
    };

    if (fetching) {
        return (
            <div className="min-h-screen bg-slate-50 pb-12">
                <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <Skeleton className="h-6 w-48" />
                        </div>
                    </div>
                </div>
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
                        <Skeleton className="h-20 w-full" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={handleCancel} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 flex-1">
                            {isViewMode ? 'Candidate Details' : (isEditMode ? 'Edit Candidate' : 'Add New Candidate')}
                        </h1>

                        {/* Toggle Resume Panel Button */}
                        {(resumeFile || (resumeUrl && String(resumeUrl).startsWith('http'))) && (
                            <button
                                onClick={() => setShowResumePanel(!showResumePanel)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${showResumePanel
                                    ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {showResumePanel ? <EyeOff size={18} /> : <Eye size={18} />}
                                <span className="text-sm font-semibold">{showResumePanel ? 'Hide Resume' : 'Show Resume'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className={`w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 transition-all duration-500 ${(resumeFile || (resumeUrl && String(resumeUrl).startsWith('http'))) && showResumePanel ? 'max-w-full' : 'max-w-7xl'}`}>
                <div className="flex gap-6 relative">
                    <div className={`transition-all duration-500 ${(resumeFile || (resumeUrl && String(resumeUrl).startsWith('http'))) && showResumePanel ? 'flex-1 h-[calc(100vh-140px)] overflow-y-auto' : 'w-full'}`}>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                            {/* Form */}
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                {/* Resume Upload */}
                                {!isViewMode && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <label className="block text-[11px] font-bold text-slate-700 mb-2">
                                            {isEditMode ? 'Replace Resume (PDF)' : 'Upload Resume (PDF) *'}
                                        </label>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors shadow-sm text-xs font-semibold whitespace-nowrap">
                                                <Upload size={14} />
                                                {uploading ? 'Uploading...' : (isEditMode ? 'New File' : 'Choose File')}
                                                <input
                                                    type="file"
                                                    accept="application/pdf"
                                                    onChange={handleFileChange}
                                                    className="hidden"
                                                    disabled={uploading}
                                                />
                                            </label>

                                            {resumeFile && (
                                                <div className="flex items-center gap-2 px-2 py-1 bg-white rounded border border-slate-200 min-w-0 flex-1 max-w-[250px]">
                                                    <span className="text-[10px] text-slate-600 font-medium truncate">{resumeFile.name}</span>
                                                    {previewUrl && (
                                                        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-600 hover:underline shrink-0">
                                                            Preview
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            {/* Auto-fill Button */}
                                            {resumeFile && !isViewMode && (
                                                <button
                                                    type="button"
                                                    onClick={handleAutoFill}
                                                    disabled={isParsing}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 text-xs font-semibold whitespace-nowrap ml-auto"
                                                >
                                                    {isParsing ? (
                                                        <>
                                                            <Loader size={12} className="animate-spin" />
                                                            <span>Parsing...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle size={14} />
                                                            <span>Auto-fill</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {/* Section 1: Basic Information */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-800 pb-1 border-b border-slate-200">1. Basic Candidate Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Candidate Name *</label>
                                            <input type="text" name="candidateName" value={formData.candidateName} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-50" required disabled={isViewMode} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Email *</label>
                                            <input type="email" name="email" value={formData.email} onChange={handleChange} onBlur={(e) => checkDuplicate('email', e.target.value)} className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 font-medium ${dupCheck.email && dupCheck.email !== 'checking' ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} required disabled={isViewMode} />
                                            {dupCheck.email === 'checking' && <p className="text-[10px] text-slate-400 mt-0.5">⏳ Checking...</p>}
                                            {dupCheck.email && dupCheck.email !== 'checking' && <p className="text-[10px] text-red-600 mt-0.5 font-medium">⚠️ {dupCheck.email}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Mobile Number *</label>
                                            <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} onBlur={(e) => checkDuplicate('mobile', e.target.value)} className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 font-medium ${dupCheck.mobile && dupCheck.mobile !== 'checking' ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} required disabled={isViewMode} />
                                            {dupCheck.mobile === 'checking' && <p className="text-[10px] text-slate-400 mt-0.5">⏳ Checking...</p>}
                                            {dupCheck.mobile && dupCheck.mobile !== 'checking' && <p className="text-[10px] text-red-600 mt-0.5 font-medium">⚠️ {dupCheck.mobile}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Qualification</label>
                                            <input type="text" name="qualification" value={formData.qualification} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-50" disabled={isViewMode} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Current Location</label>
                                            <input type="text" name="currentLocation" value={formData.currentLocation} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-50" disabled={isViewMode} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Preferred Location</label>
                                            <input type="text" name="preferredLocation" value={formData.preferredLocation} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-50" disabled={isViewMode} />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Recruitment Source Details */}
                                <div className="space-y-4 pt-4">
                                    <h3 className="text-sm font-bold text-slate-800 pb-1 border-b border-slate-200">2. Recruitment Source Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Source *</label>
                                            <div className="relative" ref={dropdownRef}>
                                                <div onClick={() => !isViewMode && setShowSourceDropdown(!showSourceDropdown)} className={`w-full px-2 py-1.5 text-sm border rounded-lg flex items-center justify-between cursor-pointer transition-all ${isViewMode ? 'bg-slate-50 cursor-not-allowed' : 'hover:border-blue-400 bg-white'} ${showSourceDropdown ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-300 font-medium'}`}>
                                                    <span className={formData.source ? 'text-slate-800' : 'text-slate-400'}>{formData.source || 'Select Source'}</span>
                                                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${showSourceDropdown ? 'rotate-180' : ''}`} />
                                                </div>
                                                {showSourceDropdown && (
                                                    <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <div className="p-2 border-b border-slate-100 bg-slate-50">
                                                            <div className="relative">
                                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                <input type="text" value={sourceSearch} onChange={(e) => setSourceSearch(e.target.value)} placeholder="Search sources..." className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none" autoFocus />
                                                            </div>
                                                        </div>
                                                        <div className="max-h-48 overflow-y-auto">
                                                            {sourceOptions.filter(opt => opt.name.toLowerCase().includes(sourceSearch.toLowerCase())).map(opt => (
                                                                <div key={opt.name} onClick={() => { setFormData(prev => ({ ...prev, source: opt.name })); setShowSourceDropdown(false); }} className="px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 flex items-center justify-between group cursor-pointer">
                                                                    <span>{opt.name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {(formData.source === 'Referral' || (formData.source && !sourceOptions.some(s => s.name === formData.source))) && (
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Referral Name / Specify *</label>
                                                <input type="text" name={formData.source === 'Referral' ? 'referralName' : 'source'} value={formData.source === 'Referral' ? formData.referralName : formData.source} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" required disabled={isViewMode} />
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Profile Pulled By</label>
                                            <select name="profilePulledBy" value={formData.profilePulledBy} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-50" disabled={isViewMode}>
                                                <option value="">Select Recruiter</option>
                                                {users.map(u => <option key={u._id} value={`${u.firstName || ''} ${u.lastName || ''}`.trim()}>{u.firstName} {u.lastName}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Called By</label>
                                            <select name="calledBy" value={formData.calledBy} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-50" disabled={isViewMode}>
                                                <option value="">Select Recruiter</option>
                                                {users.map(u => <option key={u._id} value={`${u.firstName || ''} ${u.lastName || ''}`.trim()}>{u.firstName} {u.lastName}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Rate</label>
                                            <input type="number" name="rate" value={formData.rate} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-50" disabled={isViewMode} />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Professional & Offer Details */}
                                <div className="space-y-4 pt-4">
                                    <h3 className="text-sm font-bold text-slate-800 pb-1 border-b border-slate-200">3. Professional & Offer Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Total Exp (Years) *</label>
                                            <input type="number" step="0.1" name="totalExperience" value={formData.totalExperience} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" required disabled={isViewMode} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Current Company</label>
                                            <input type="text" name="currentCompany" value={formData.currentCompany} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" disabled={isViewMode} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Current CTC (LPA)</label>
                                            <input type="number" step="0.01" name="currentCTC" value={formData.currentCTC} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" disabled={isViewMode} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Expected CTC (LPA)</label>
                                            <input type="number" step="0.01" name="expectedCTC" value={formData.expectedCTC} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" disabled={isViewMode} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Notice Period (Days)</label>
                                            <input type="number" name="noticePeriod" value={formData.noticePeriod} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" disabled={isViewMode} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">TAT to Join (Days)</label>
                                            <input type="number" name="tatToJoin" value={formData.tatToJoin} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" disabled={isViewMode} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Last Working Day</label>
                                            <input type="date" name="lastWorkingDay" value={formData.lastWorkingDay} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" disabled={isViewMode} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Preference</label>
                                            <select name="preference" value={formData.preference} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" disabled={isViewMode}>
                                                <option value="Highly Recommended">Highly Recommended</option>
                                                <option value="Recommended">Recommended</option>
                                                <option value="Neutral / Average">Neutral / Average</option>
                                                <option value="Not Recommended">Not Recommended</option>
                                                <option value="Very Poor">Very Poor</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* In-Hand Offer Toggle */}
                                    <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 mt-4">
                                        <div className="flex items-center gap-3">
                                            <button type="button" onClick={() => !isViewMode && setFormData(prev => ({ ...prev, inHandOffer: !prev.inHandOffer }))} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.inHandOffer ? 'bg-amber-500' : 'bg-slate-300'} ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`} disabled={isViewMode}>
                                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${formData.inHandOffer ? 'translate-x-5' : 'translate-x-1'}`} />
                                            </button>
                                            <label className="text-[11px] font-bold text-slate-700">Candidate has an In-Hand Offer</label>
                                        </div>
                                        {formData.inHandOffer && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Offering Company *</label>
                                                    <input type="text" name="offerCompany" value={formData.offerCompany} onChange={handleChange} placeholder="e.g. Infosys" className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" required disabled={isViewMode} />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Offered CTC</label>
                                                    <input type="number" name="offerCTC" value={formData.offerCTC} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" disabled={isViewMode} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Section 4: Skills Section */}
                                <div className="space-y-4 pt-4">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                                        <h3 className="text-sm font-bold text-slate-800">4. Skill Experience (Years)</h3>
                                        {!isViewMode && (
                                            <button type="button" onClick={addNiceToHaveSkill} className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                                                <Plus size={12} /> Add Skill
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {/* Must Have Skills */}
                                        {(formData.mustHaveSkills || []).map((skillObj, index) => (
                                            <div key={`must-${index}`} className="p-2 bg-slate-50 border border-slate-200 rounded-lg relative">
                                                <span className="absolute -top-1.5 left-2 px-1 bg-white text-[8px] font-bold text-red-500 border border-red-100 rounded">MUST HAVE</span>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 mt-1">{skillObj.skill}</label>
                                                <input type="number" step="0.1" value={skillObj.experience} onChange={(e) => handleSkillExperienceChange('mustHaveSkills', index, e.target.value)} placeholder="Years exp" className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" disabled={isViewMode} />
                                            </div>
                                        ))}

                                        {/* Nice to Have Skills */}
                                        {(formData.niceToHaveSkills || []).map((skillObj, index) => (
                                            <div key={`nice-${index}`} className="p-2 bg-blue-50/50 border border-blue-100 rounded-lg relative group">
                                                <div className="flex items-center gap-1 mb-1 mt-1">
                                                    <input type="text" value={skillObj.skill} onChange={(e) => handleSkillNameChange(index, e.target.value)} placeholder="Skill Name" className="text-[10px] font-bold text-slate-700 bg-transparent border-b border-blue-200 outline-none flex-1 focus:border-blue-500" disabled={isViewMode} />
                                                    {!isViewMode && <button type="button" onClick={() => removeNiceToHaveSkill(index)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash size={12} /></button>}
                                                </div>
                                                <input type="number" step="0.1" value={skillObj.experience} onChange={(e) => handleSkillExperienceChange('niceToHaveSkills', index, e.target.value)} placeholder="Years exp" className="w-full px-2 py-1 border border-blue-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white" disabled={isViewMode} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Section 5: Past Experience */}
                                <div className="space-y-4 pt-4">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                                        <h3 className="text-sm font-bold text-slate-800">5. Past Experience</h3>
                                        {!isViewMode && (
                                            <button type="button" onClick={handleAddExperience} className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                                                <Plus size={12} /> Add Company
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {formData.pastExperience.map((exp, index) => (
                                            <div key={index} className="flex gap-3 items-end p-2 bg-slate-50 border border-slate-100 rounded-lg group">
                                                <div className="flex-1">
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Company Name</label>
                                                    <input type="text" value={exp.companyName} onChange={(e) => handleExperienceChange(index, 'companyName', e.target.value)} placeholder="e.g. TCS" className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" disabled={isViewMode} />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Role</label>
                                                    <input type="text" value={exp.role || ''} onChange={(e) => handleExperienceChange(index, 'role', e.target.value)} placeholder="e.g. Analyst" className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" disabled={isViewMode} />
                                                </div>
                                                <div className="w-20">
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Years worked</label>
                                                    <input type="number" step="0.1" value={exp.experienceYears} onChange={(e) => handleExperienceChange(index, 'experienceYears', e.target.value)} placeholder="Exp" className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" disabled={isViewMode} />
                                                </div>
                                                {!isViewMode && (
                                                    <button type="button" onClick={() => handleRemoveExperience(index)} className="p-1.5 text-slate-400 hover:text-red-500 mb-0.5">
                                                        <Trash size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Section 6: Status & Remarks */}
                                <div className="space-y-4 pt-4 pb-4">
                                    <h3 className="text-sm font-bold text-slate-800 pb-1 border-b border-slate-200">6. Status & Remarks</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Status *</label>
                                            <select name="status" value={formData.status} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-blue-700 bg-blue-50" required disabled={isViewMode}>
                                                <option value="Interested">Interested</option>
                                                <option value="In Interview">In Interview</option>
                                                <option value="Not Interested">Not Interested</option>
                                                <option value="Not Relevant">Not Relevant</option>
                                                <option value="Not Picking">Not Picking</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Internal Remark</label>
                                            <textarea name="remark" value={formData.remark} onChange={handleChange} rows={1} placeholder="Notes..." className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" disabled={isViewMode} />
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                    <button type="button" onClick={handleCancel} className="px-4 py-1.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                                        {isViewMode ? 'Close' : 'Cancel'}
                                    </button>
                                    {!isViewMode && (
                                        <button type="submit" disabled={loading || uploading} className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2">
                                            {loading && <Loader className="animate-spin" size={14} />}
                                            {isEditMode ? 'Update Candidate' : 'Add Candidate'}
                                        </button>
                                    )}
                                </div>
                            </form>

                        </div>
                    </div>

                    {/* Resume Panel */}
                    {showResumePanel && (resumeFile || resumeUrl) && (
                        <div className="w-1/2 sticky top-[88px] h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group flex flex-col animate-in slide-in-from-right-4 duration-500">
                            {/* PDF Previewer */}
                            <div className="flex-1 bg-slate-100 relative">
                                <div className="absolute inset-0 flex items-center justify-center text-slate-400 z-0">
                                    <div className="text-center">
                                        <Loader className="animate-spin mb-2 mx-auto" size={24} />
                                        <p className="text-xs font-medium">Loading document...</p>
                                    </div>
                                </div>
                                <iframe
                                    src={(previewUrl || resumeUrl)?.startsWith('blob:')
                                        ? (previewUrl || resumeUrl)
                                        : (previewUrl || resumeUrl)?.replace('http://', 'https://')}
                                    className="w-full h-full relative z-10 border-none bg-white"
                                    title="Resume Preview"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CandidateForm;
