import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Loader, ArrowLeft, Plus, Trash, CheckCircle, ChevronDown, Search } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../../components/Skeleton';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const CandidateForm = () => {
    const { user } = useAuth();
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
    const [showAddSource, setShowAddSource] = useState(false);
    const [newSourceName, setNewSourceName] = useState('');
    const [addingSource, setAddingSource] = useState(false);
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

    useEffect(() => {
        fetchSourceOptions();
        fetchUsers();
        if (candidateId) {
            fetchCandidateDetails();
        } else if (hiringRequestId) {
            fetchRequisitionSkills();
        }
    }, [candidateId, hiringRequestId]);

    const fetchUsers = async () => {
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
    };

    const fetchRequisitionSkills = async () => {
        try {
            const res = await api.get(`/ta/hiring-request/${hiringRequestId}`);
            let reqData = res.data;
            if (res.data?.success) reqData = res.data.data;

            if (reqData?.requirements) {
                const { mustHaveSkills, niceToHaveSkills } = reqData.requirements;
                setFormData(prev => ({
                    ...prev,
                    mustHaveSkills: (mustHaveSkills || []).map(s => ({ skill: s, experience: '' })),
                    niceToHaveSkills: (niceToHaveSkills || []).map(s => ({ skill: s, experience: '' }))
                }));
            }
        } catch (error) {
            console.error('Failed to fetch requisition skills', error);
        }
    };

    const fetchSourceOptions = async () => {
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
    };

    const handleAddSource = async () => {
        if (!newSourceName.trim()) return;
        try {
            setAddingSource(true);
            const res = await api.post('/ta/candidates/sources', { name: newSourceName.trim() });
            if (res.data) {
                toast.success('Source added successfully');
                setNewSourceName('');
                setShowAddSource(false);
                fetchSourceOptions();
                setFormData(prev => ({ ...prev, source: newSourceName.trim() }));
                setShowSourceDropdown(false);
                setSourceSearch('');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add source');
        } finally {
            setAddingSource(false);
        }
    };

    const handleDeleteSource = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this source?')) return;
        try {
            await api.delete(`/ta/candidates/sources/${id}`);
            toast.success('Source deleted successfully');
            fetchSourceOptions();
            if (formData.source === sourceOptions.find(s => s._id === id)?.name) {
                setFormData(prev => ({ ...prev, source: '' }));
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete source');
        }
    };

    const fetchCandidateDetails = async () => {
        try {
            setFetching(true);
            const response = await api.get(`/ta/candidates/${hiringRequestId}`);
            // The API returns all candidates for a request. We need to find the specific one or fetch by ID if endpoint exists.
            // Based on previous code, there is likely a Get Single Candidate endpoint or we filter.
            // Let's try fetching specific candidate if endpoint exists, otherwise filter. 
            // Actually, best to check if there is a get by ID. 
            // WORKAROUND: The previous code passed `candidateToEdit`. current API usage in list is `/ta/candidates/${hiringRequestId}`.
            // There isn't a clear "get candidate by ID" endpoint visible in previous context, but usually `api.put('/ta/candidates/:id')` exists.
            // I will assume logic to filter from the list or I should check if there is a single get endpoint.
            // Let's try to fetch the single candidate using the list endpoint and filtering for now to be safe,
            // or better, let's assume standard REST patterns. 
            // Wait, looking at `CandidateList.jsx`: `api.delete('/ta/candidates/${candidateId}')` exists.
            // So `api.get('/ta/candidates/${candidateId}')` might exist? 
            // Let's stick to fetching all and filtering for this iteration to ensuring no 404s if I guess wrong.
            // Actually, the `CandidateForm` props previously took `candidateToEdit`. 
            // Let's try to fetch the specific candidate. 
            // If I look at `CandidateForm.jsx` previously: `api.put('/ta/candidates/${candidateToEdit._id}')` 
            // I'll try fetching the single candidate.

            // To be safe regarding endpoints, I will fetch the list and find the candidate.
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
    };

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

            const response = await api.post(`/ta/candidates/upload-resume/${hiringRequestId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

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

    const handleSourceChange = (e) => {
        const { value } = e.target;
        if (value === 'Other') {
            setFormData(prev => ({ ...prev, source: '' })); // Clear for input
        } else {
            setFormData(prev => ({ ...prev, source: value }));
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
                } catch (uploadError) {
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
                        <h1 className="text-xl font-bold text-slate-800">
                            {isViewMode ? 'Candidate Details' : (isEditMode ? 'Edit Candidate' : 'Add New Candidate')}
                        </h1>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        {/* Resume Upload - Show upload if NOT readOnly */}
                        {!isViewMode && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    {isEditMode ? 'Replace Resume (PDF)' : 'Upload Resume (PDF) *'}
                                </label>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors shadow-sm">
                                            <Upload size={18} />
                                            {uploading ? 'Uploading...' : (isEditMode ? 'Choose New File' : 'Choose File')}
                                            <input
                                                type="file"
                                                accept="application/pdf"
                                                onChange={handleFileChange}
                                                className="hidden"
                                                disabled={uploading}
                                            />
                                        </label>
                                        {resumeFile && (
                                            <div className="flex items-center gap-3 p-2 bg-white rounded border border-slate-200">
                                                <span className="text-sm text-slate-600 font-medium truncate max-w-[200px]">Selected: {resumeFile.name}</span>
                                                {previewUrl && (
                                                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 bg-blue-50 rounded">
                                                        Preview
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {uploading && <Loader className="animate-spin text-blue-600" size={20} />}
                                    </div>

                                    {/* Show existing resume link right in the upload box when editing */}
                                    {isEditMode && resumeUrl && !resumeFile && (
                                        <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 hover:bg-blue-100 font-medium px-4 py-2 bg-white rounded-lg border border-blue-200 transition-colors shadow-sm">
                                            <Upload size={16} /> View Current Resume
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Always show View Resume link if URL exists and we are in VIEW mode */}
                        {isViewMode && (resumeUrl || resumeFile) && (
                            <div className="mb-4">
                                {resumeUrl && (
                                    <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline font-medium p-2 bg-slate-50 rounded-lg w-fit border border-slate-200">
                                        <Upload size={16} /> View Uploaded Resume
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Section 1: Basic Information */}
                        <div className="space-y-4">
                            <h3 className="text-base font-semibold text-slate-800 pb-2 border-b border-slate-200">1. Basic Candidate Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Candidate Name *</label>
                                    <input
                                        type="text"
                                        name="candidateName"
                                        value={formData.candidateName}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        required
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Email *</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        onBlur={(e) => checkDuplicate('email', e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all ${dupCheck.email && dupCheck.email !== 'checking'
                                            ? 'border-red-400 bg-red-50'
                                            : 'border-slate-300'
                                            }`}
                                        required
                                        disabled={isViewMode}
                                    />
                                    {dupCheck.email === 'checking' && (
                                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">⏳ Checking for duplicates...</p>
                                    )}
                                    {dupCheck.email && dupCheck.email !== 'checking' && (
                                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                                            ⚠️ {dupCheck.email}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Mobile Number *</label>
                                    <input
                                        type="tel"
                                        name="mobile"
                                        value={formData.mobile}
                                        onChange={handleChange}
                                        onBlur={(e) => checkDuplicate('mobile', e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all ${dupCheck.mobile && dupCheck.mobile !== 'checking'
                                            ? 'border-red-400 bg-red-50'
                                            : 'border-slate-300'
                                            }`}
                                        required
                                        disabled={isViewMode}
                                    />
                                    {dupCheck.mobile === 'checking' && (
                                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">⏳ Checking for duplicates...</p>
                                    )}
                                    {dupCheck.mobile && dupCheck.mobile !== 'checking' && (
                                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                                            ⚠️ {dupCheck.mobile}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Qualification</label>
                                    <input
                                        type="text"
                                        name="qualification"
                                        value={formData.qualification}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Current Location</label>
                                    <input
                                        type="text"
                                        name="currentLocation"
                                        value={formData.currentLocation}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Preferred Location</label>
                                    <input
                                        type="text"
                                        name="preferredLocation"
                                        value={formData.preferredLocation}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Recruitment Source Details */}
                        <div className="space-y-4 pt-6">
                            <h3 className="text-base font-semibold text-slate-800 pb-2 border-b border-slate-200">2. Recruitment Source Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Source *</label>
                                    <div className="relative" ref={dropdownRef}>
                                        <div
                                            onClick={() => !isViewMode && setShowSourceDropdown(!showSourceDropdown)}
                                            className={`w-full px-3 py-2 border rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                                                isViewMode ? 'bg-slate-50 cursor-not-allowed' : 'hover:border-blue-400 bg-white'
                                            } ${showSourceDropdown ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-300'}`}
                                        >
                                            <span className={formData.source ? 'text-slate-800' : 'text-slate-400'}>
                                                {formData.source || 'Select Source'}
                                            </span>
                                            <ChevronDown size={18} className={`text-slate-400 transition-transform ${showSourceDropdown ? 'rotate-180' : ''}`} />
                                        </div>

                                        {showSourceDropdown && (
                                            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                {/* Search Input */}
                                                <div className="p-2 border-b border-slate-100 bg-slate-50">
                                                    <div className="relative">
                                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            value={sourceSearch}
                                                            onChange={(e) => setSourceSearch(e.target.value)}
                                                            placeholder="Search sources..."
                                                            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>

                                                {/* Options List */}
                                                <div className="max-h-60 overflow-y-auto">
                                                    {sourceOptions
                                                        .filter(opt => opt.name.toLowerCase().includes(sourceSearch.toLowerCase()))
                                                        .map(opt => (
                                                            <div
                                                                key={opt.name}
                                                                onClick={() => {
                                                                    setFormData(prev => ({ ...prev, source: opt.name }));
                                                                    setShowSourceDropdown(false);
                                                                    setSourceSearch('');
                                                                }}
                                                                className="px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 flex items-center justify-between group cursor-pointer"
                                                            >
                                                                <span>{opt.name}</span>
                                                                {opt.isCustom && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleDeleteSource(opt._id, e)}
                                                                        className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        <Trash size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    
                                                    <div
                                                        onClick={() => {
                                                            setFormData(prev => ({ ...prev, source: 'Other' }));
                                                            setShowSourceDropdown(false);
                                                            setSourceSearch('');
                                                        }}
                                                        className="px-3 py-2 text-sm text-slate-500 italic hover:bg-slate-50 border-t border-slate-50 cursor-pointer"
                                                    >
                                                        Other (Specify)
                                                    </div>
                                                </div>

                                                {/* Add New Footer */}
                                                <div className="p-2 border-t border-slate-100 bg-slate-50 mt-1">
                                                    {showAddSource ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={newSourceName}
                                                                onChange={(e) => setNewSourceName(e.target.value)}
                                                                placeholder="New Source Name"
                                                                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                                autoFocus
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={handleAddSource}
                                                                disabled={addingSource || !newSourceName.trim()}
                                                                className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                                            >
                                                                {addingSource ? <Loader size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowAddSource(false)}
                                                                className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowAddSource(true);
                                                            }}
                                                            className="w-full py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100/50 rounded flex items-center justify-center gap-1"
                                                        >
                                                            <Plus size={14} /> Add New Source
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Additional Inputs for Specific Sources */}
                                    <div className="space-y-3 mt-3">
                                        {formData.source === 'Referral' && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Referral Name *</label>
                                                <input
                                                    type="text"
                                                    name="referralName"
                                                    value={formData.referralName || ''}
                                                    onChange={handleChange}
                                                    placeholder="Who referred this candidate?"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                                    required
                                                    disabled={isViewMode}
                                                />
                                            </div>
                                        )}

                                        {(formData.source === 'Other' || (formData.source && !sourceOptions.some(s => s.name === formData.source))) && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Specify Source *</label>
                                                <input
                                                    type="text"
                                                    name="source"
                                                    value={formData.source === 'Other' ? '' : formData.source}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                                                    placeholder="Enter source name"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                                    required
                                                    disabled={isViewMode}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Profile Pulled By</label>
                                    <select
                                        name="profilePulledBy"
                                        value={formData.profilePulledBy}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    >
                                        <option value="">Select Recruiter</option>
                                        {users.map(u => (
                                            <option key={u._id} value={`${u.firstName || ''} ${u.lastName || ''}`.trim()}>
                                                {u.firstName} {u.lastName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Called By</label>
                                    <select
                                        name="calledBy"
                                        value={formData.calledBy}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    >
                                        <option value="">Select Recruiter</option>
                                        {users.map(u => (
                                            <option key={u._id} value={`${u.firstName || ''} ${u.lastName || ''}`.trim()}>
                                                {u.firstName} {u.lastName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Rate</label>
                                    <input
                                        type="number"
                                        name="rate"
                                        value={formData.rate}
                                        onChange={handleChange}
                                        min="0"
                                        step="any"
                                        placeholder="Enter rate"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Skill Experience */}
                        <div className="space-y-4 pt-6">
                            <h3 className="text-base font-semibold text-slate-800 pb-2 border-b border-slate-200">3. Skill Experience (Years)</h3>
                            
                            {/* Must-Have Skills */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                    Must-Have Skills
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(formData.mustHaveSkills || []).map((skillObj, index) => (
                                        <div key={`must-${index}`} className="flex flex-col gap-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                            <label className="text-xs font-bold text-slate-500 uppercase">{skillObj.skill}</label>
                                            <input
                                                type="number"
                                                value={skillObj.experience}
                                                onChange={(e) => handleSkillExperienceChange('mustHaveSkills', index, e.target.value)}
                                                placeholder="Exp (Years)"
                                                min="0"
                                                step="any"
                                                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                                disabled={isViewMode}
                                            />
                                        </div>
                                    ))}
                                    {(!formData.mustHaveSkills || formData.mustHaveSkills.length === 0) && (
                                        <p className="text-sm text-slate-400 italic col-span-full">No must-have skills defined in requisition.</p>
                                    )}
                                </div>
                            </div>

                            {/* Nice-to-Have Skills */}
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                        Nice-to-Have Skills
                                    </h4>
                                    {!isViewMode && (
                                        <button
                                            type="button"
                                            onClick={addNiceToHaveSkill}
                                            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
                                        >
                                            <Plus size={14} /> Add Skill
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(formData.niceToHaveSkills || []).map((skillObj, index) => (
                                        <div key={`nice-${index}`} className="flex flex-col gap-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200 relative group">
                                            {!isViewMode && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeNiceToHaveSkill(index)}
                                                    className="absolute -top-2 -right-2 bg-white text-red-500 p-1 rounded-full border border-red-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                            <input
                                                type="text"
                                                value={skillObj.skill}
                                                onChange={(e) => handleSkillNameChange(index, e.target.value)}
                                                placeholder="Skill Name"
                                                className="text-xs font-bold text-slate-700 bg-transparent border-b border-slate-200 pb-1 mb-1 outline-none focus:border-blue-400"
                                                disabled={isViewMode}
                                            />
                                            <input
                                                type="number"
                                                value={skillObj.experience}
                                                onChange={(e) => handleSkillExperienceChange('niceToHaveSkills', index, e.target.value)}
                                                placeholder="Exp (Years)"
                                                min="0"
                                                step="any"
                                                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                                disabled={isViewMode}
                                            />
                                        </div>
                                    ))}
                                    {(!formData.niceToHaveSkills || formData.niceToHaveSkills.length === 0) && (
                                        <p className="text-sm text-slate-400 italic col-span-full">No nice-to-have skills added.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Professional Details */}
                        <div className="space-y-4 pt-6">
                            <h3 className="text-base font-semibold text-slate-800 pb-2 border-b border-slate-200">4. Professional Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Total Experience (years) *</label>
                                    <input
                                        type="number"
                                        name="totalExperience"
                                        value={formData.totalExperience}
                                        onChange={handleChange}
                                        min="0"
                                        step="any"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        required
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Current Company</label>
                                    <input
                                        type="text"
                                        name="currentCompany"
                                        value={formData.currentCompany}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div className="hidden lg:block"></div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Current CTC</label>
                                    <input
                                        type="number"
                                        name="currentCTC"
                                        value={formData.currentCTC}
                                        onChange={handleChange}
                                        min="0"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Expected CTC</label>
                                    <input
                                        type="number"
                                        name="expectedCTC"
                                        value={formData.expectedCTC}
                                        onChange={handleChange}
                                        min="0"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Preference</label>
                                    <select
                                        name="preference"
                                        value={formData.preference}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        disabled={isViewMode}
                                    >
                                        <option value="Highly Recommended">Highly Recommended (Interested)</option>
                                        <option value="Recommended">Recommended</option>
                                        <option value="Neutral / Average">Neutral / Average</option>
                                        <option value="Not Recommended">Not Recommended</option>
                                        <option value="Very Poor">Very Poor</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 5: Offer & Availability */}
                        <div className="space-y-4 pt-6">
                            <h3 className="text-base font-semibold text-slate-800 pb-2 border-b border-slate-200">5. Offer & Availability</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Notice Period (days)</label>
                                    <input
                                        type="number"
                                        name="noticePeriod"
                                        value={formData.noticePeriod}
                                        onChange={handleChange}
                                        min="0"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">TAT to Join (days)</label>
                                    <input
                                        type="number"
                                        name="tatToJoin"
                                        value={formData.tatToJoin}
                                        onChange={handleChange}
                                        min="0"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Last Working Day</label>
                                    <input
                                        type="date"
                                        name="lastWorkingDay"
                                        value={formData.lastWorkingDay}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    />
                                </div>
                            </div>
                            
                            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 mt-4">
                                <div className="flex items-center gap-3 mb-1">
                                    <button
                                        type="button"
                                        onClick={() => !isViewMode && setFormData(prev => ({ ...prev, inHandOffer: !prev.inHandOffer, offerCompany: !prev.inHandOffer ? prev.offerCompany : '', offerCTC: !prev.inHandOffer ? prev.offerCTC : '' }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.inHandOffer ? 'bg-amber-500' : 'bg-slate-300'
                                            } ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}
                                        disabled={isViewMode}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.inHandOffer ? 'translate-x-6' : 'translate-x-1'
                                            }`} />
                                    </button>
                                    <label className="text-sm font-semibold text-slate-700">
                                        Candidate has an In-Hand Offer
                                    </label>
                                </div>
                                {formData.inHandOffer && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Company That Offered *</label>
                                            <input
                                                type="text"
                                                name="offerCompany"
                                                value={formData.offerCompany}
                                                onChange={handleChange}
                                                placeholder="e.g. Infosys"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all text-sm"
                                                disabled={isViewMode}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Their Offered CTC</label>
                                            <input
                                                type="number"
                                                name="offerCTC"
                                                value={formData.offerCTC}
                                                onChange={handleChange}
                                                min="0"
                                                placeholder="e.g. 800000"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all text-sm"
                                                disabled={isViewMode}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 5: Past Experience */}
                        <div className="space-y-4 pt-6">
                            <h3 className="text-base font-semibold text-slate-800 pb-2 border-b border-slate-200">5. Past Experience</h3>
                            <div className="space-y-3">
                                {formData.pastExperience.map((exp, index) => (
                                    <div key={index} className="flex flex-col md:flex-row gap-4 items-start bg-slate-50 p-4 border border-slate-200 rounded-lg">
                                        <div className="flex-1 w-full">
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Company Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. TCS"
                                                value={exp.companyName}
                                                onChange={(e) => handleExperienceChange(index, 'companyName', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                                disabled={isViewMode}
                                            />
                                        </div>
                                        <div className="flex-1 w-full">
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Role / Designation</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Senior Developer"
                                                value={exp.role || ''}
                                                onChange={(e) => handleExperienceChange(index, 'role', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                                disabled={isViewMode}
                                            />
                                        </div>
                                        <div className="w-full md:w-32">
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Years Worked</label>
                                            <input
                                                type="number"
                                                placeholder="Years"
                                                min="0"
                                                step="any"
                                                value={exp.experienceYears}
                                                onChange={(e) => handleExperienceChange(index, 'experienceYears', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                                disabled={isViewMode}
                                            />
                                        </div>
                                        {!isViewMode && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveExperience(index)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-6 md:mt-5"
                                                title="Remove Experience"
                                            >
                                                <Trash size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {!isViewMode && (
                                    <button
                                        type="button"
                                        onClick={handleAddExperience}
                                        className="flex items-center gap-2 px-4 py-2 mt-2 border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium rounded-lg transition-colors w-fit"
                                    >
                                        <Plus size={16} /> Add Past Experience
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Section 6: Status & Remarks */}
                        <div className="space-y-4 pt-6 pb-6 border-b border-slate-200">
                            <h3 className="text-base font-semibold text-slate-800 pb-2 border-b border-slate-200">6. Status & Remarks</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Status *</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium text-blue-700 bg-blue-50"
                                        required
                                        disabled={isViewMode}
                                    >
                                        <option value="Interested">Interested</option>
                                        <option value="In Interview">In Interview</option>
                                        <option value="Not Interested">Not Interested</option>
                                        <option value="Not Relevant">Not Relevant</option>
                                        <option value="Not Picking">Not Picking</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Remark</label>
                                    <textarea
                                        name="remark"
                                        value={formData.remark}
                                        onChange={handleChange}
                                        rows={2}
                                        placeholder="Add any internal remarks or notes here..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                                        disabled={isViewMode}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 mt-2">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                {isViewMode ? 'Close' : 'Cancel'}
                            </button>
                            {!isViewMode && (
                                <>
                                    {isEditMode ? (
                                        (user?.roles?.includes('Admin') || user?.permissions?.includes('ta.edit')) && (
                                            <button
                                                type="submit"
                                                disabled={loading || uploading}
                                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {loading && <Loader className="animate-spin" size={16} />}
                                                Update Candidate
                                            </button>
                                        )
                                    ) : (
                                        (user?.roles?.includes('Admin') || user?.permissions?.includes('ta.create')) && (
                                            <button
                                                type="submit"
                                                disabled={loading || uploading}
                                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {loading && <Loader className="animate-spin" size={16} />}
                                                Add Candidate
                                            </button>
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CandidateForm;
