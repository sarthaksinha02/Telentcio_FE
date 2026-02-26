import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
    User, Briefcase, FileText, DollarSign, Calendar, Shield,
    ArrowLeft, Save, Upload, Download, Trash2, CheckCircle, AlertCircle, X, Search, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { format } from 'date-fns';
import Button from '../components/Button';

// Helper Components defined outside to prevent re-renders
const Field = ({ label, value, section, field, type = "text", options = null, isEditing, hideIfEmpty, onChangeOverride, valueOverride, placeholder, formData, onChange, maxLength, error, required }) => {
    if (!isEditing && !value && hideIfEmpty) return null;

    const currentValue = valueOverride !== undefined ? valueOverride : (formData?.[section]?.[field] || '');
    const handleChange = onChangeOverride || ((e) => onChange(section, field, e.target.value));

    return (
        <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {isEditing ? (
                <>
                    {options ? (
                        <select
                            value={currentValue}
                            onChange={handleChange}
                            className={`w-full p-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none ${error ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                        >
                            <option value="">Select</option>
                            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    ) : (
                        <input
                            type={type}
                            value={type === 'date' && currentValue ? new Date(currentValue).toISOString().split('T')[0] : currentValue}
                            onChange={handleChange}
                            placeholder={placeholder}
                            maxLength={maxLength}
                            className={`w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-100 outline-none ${error ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                        />
                    )}
                    {error && <p className="text-xs text-red-500 mt-1 flex items-center"><span className="mr-1">⚠️</span> {error}</p>}
                </>
            ) : (
                <div className={`text-sm font-medium ${!value ? 'text-slate-400 italic' : 'text-slate-800'}`}>
                    {type === 'date' && value ? format(new Date(value), 'dd MMM yyyy') : value || 'Not Set'}
                </div>
            )}
        </div>
    );
};

const SectionCard = ({ title, sectionName, icon: Icon, children, editMode, setEditMode, onSave, isLoading, canEdit = true }) => {
    const isEditing = editMode === sectionName;
    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                    {Icon && <Icon size={20} className="text-slate-400" />}
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                </div>
                {canEdit && !isEditing ? (
                    <button onClick={() => setEditMode(sectionName)} className="text-sm bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md font-medium transition flex items-center border border-slate-200">
                        <Save size={14} className="mr-1.5" /> Edit
                    </button>
                ) : isEditing ? (
                    <div className="flex space-x-2">
                        <Button variants="ghost" onClick={() => setEditMode(false)} disabled={isLoading} className="text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancel</Button>
                        <Button onClick={() => onSave(sectionName)} isLoading={isLoading} className="px-3 py-1.5 shadow-sm">Save</Button>
                    </div>
                ) : null}
            </div>
            {children(isEditing)}
        </div>
    );
};

const SkillsInput = ({ label, skills = [], onUpdate, placeholder }) => {
    const [input, setInput] = useState('');

    const handleAdd = () => {
        if (!input.trim()) return;
        if (skills.includes(input.trim())) {
            toast.error('Skill already exists');
            return;
        }
        onUpdate([...skills, input.trim()]);
        setInput('');
    };

    const handleRemove = (skillToRemove) => {
        onUpdate(skills.filter(skill => skill !== skillToRemove));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{label}</label>
            <div className="space-y-3">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="flex-1 p-2 border border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                        onClick={handleAdd}
                        type="button"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                        Add
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {skills.length > 0 ? (
                        skills.map((skill, index) => (
                            <span key={`${skill}-${index}`} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 group">
                                {skill}
                                <button
                                    onClick={() => handleRemove(skill)}
                                    className="ml-1.5 text-blue-400 hover:text-blue-600 focus:outline-none"
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        ))
                    ) : (
                        <span className="text-xs text-slate-400 italic">No skills added yet.</span>
                    )}
                </div>
            </div>
        </div>
    );
};


// Define document categories outside component for global access
const documentCategories = [
    {
        name: 'Identity Documents',
        category: 'ID Proof',
        allowMultiple: false,
        fixedDocs: ['Aadhaar Card (Front)', 'Aadhaar Card (Back)', 'Pan Card', 'Passport', 'Photo (Passport Size)']
    },
    {
        name: 'Qualification Certificates',
        category: 'Education',
        allowMultiple: true,
        fixedDocs: ['10th Marksheet', '12th Marksheet', 'Bachelor Degree'],
        icon: '🎓'
    },
    {
        name: 'Experience Letters',
        category: 'Employment',
        allowMultiple: true,
        icon: '💼'
    },
    {
        name: 'Offer Letters',
        category: 'Offer Letter',
        allowMultiple: true,
        icon: '📄'
    },
    {
        name: 'Relieving Letters',
        category: 'Relieving Letter',
        allowMultiple: true,
        icon: '✅'
    },
    {
        name: 'Bank Information',
        category: 'Bank',
        allowMultiple: false,
        fixedDocs: ['Cancelled Cheque'],
        icon: '🏦'
    },
    {
        name: 'Resume',
        category: 'Resume',
        allowMultiple: false,
        fixedDocs: ['Resume'],
        icon: '📄'
    }
];

const EmployeeDossier = ({ userId: propUserId, embedded = false }) => {
    const { userId: paramUserId } = useParams();
    const userId = propUserId || paramUserId;
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    // Permissions
    const canEdit = currentUser?.roles?.some(r => r === 'Admin' || r?.name === 'Admin') || currentUser?.permissions?.includes('dossier.edit');
    const canApprove = currentUser?.roles?.some(r => r === 'Admin' || r?.name === 'Admin') || currentUser?.permissions?.includes('dossier.approve');

    // State
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('personal');
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({});
    const [historyLogs, setHistoryLogs] = useState([]);
    const [uploadingDocTitle, setUploadingDocTitle] = useState(null);
    const [savingSection, setSavingSection] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingDocId, setDeletingDocId] = useState(null);
    // Preview State
    const [previewFile, setPreviewFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isDocumentDeclared, setIsDocumentDeclared] = useState(false);
    const [showUploadPreview, setShowUploadPreview] = useState(false);
    const [uploadCategory, setUploadCategory] = useState(null);
    const fileInputRef = useRef(null);

    // New state for custom document titles
    const [showTitleModal, setShowTitleModal] = useState(false);
    const [customDocTitle, setCustomDocTitle] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);

    // HRIS Requests State
    const [hrisRequests, setHrisRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [hrisSearchTerm, setHrisSearchTerm] = useState('');

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // If we have a fixed title (from old flow), use it
        if (uploadingDocTitle) {
            let category = 'Other';
            const titleLower = uploadingDocTitle.toLowerCase();

            // Allow dynamic resolution from config
            const foundCat = documentCategories.find(cat =>
                cat.fixedDocs?.some(doc => doc.toLowerCase() === titleLower)
            );
            if (foundCat) category = foundCat.category;

            // Fallback heuristics for legacy/undefined
            if (category === 'Other') {
                if (titleLower.includes('resume')) category = 'Resume';
                else if (titleLower.includes('offer letter')) category = 'Offer Letter';
                else if (titleLower.includes('appointment')) category = 'Appointment Letter';
                else if (titleLower.includes('experience')) category = 'Employment';
            }

            setPreviewFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setUploadCategory(category);
            setShowUploadPreview(true);
        }
        // If we have a selected category (new flow), show title modal
        else if (selectedCategory) {
            setPreviewFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setShowTitleModal(true);
        }
    };

    const handleCancelUpload = () => {
        setPreviewFile(null);
        setPreviewUrl(null);
        setUploadCategory(null);
        setShowUploadPreview(false);
        setUploadingDocTitle(null);
        setShowTitleModal(false);
        setCustomDocTitle('');
        setSelectedCategory(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmUpload = async () => {
        if (!previewFile) return;

        const title = uploadingDocTitle || customDocTitle;
        const category = uploadCategory || selectedCategory;

        if (!title || !category) {
            toast.error('Please provide document title');
            return;
        }

        const formData = new FormData();
        formData.append('file', previewFile);
        formData.append('title', title);
        formData.append('category', category);

        try {
            setIsUploading(true);
            const toastId = toast.loading('Uploading document...');
            await api.post(`/dossier/${userId}/documents`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.dismiss(toastId);
            toast.success('Document uploaded successfully');
            setIsDocumentDeclared(false);
            fetchDossier(); // Refresh
            if (activeTab === 'history') fetchHistory(); // Refresh history if needed
            handleCancelUpload(); // Close and reset
        } catch (error) {
            console.error('Upload failed', error);
            toast.error('Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const triggerUpload = (docTitle) => {
        setUploadingDocTitle(docTitle);
        setTimeout(() => {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
                fileInputRef.current.click();
            }
        }, 0);
    };

    // New function to trigger upload for a category with custom title
    const triggerCategoryUpload = (categoryName, categoryType) => {
        setSelectedCategory(categoryType);
        setTimeout(() => {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
                fileInputRef.current.click();
            }
        }, 0);
    };

    const handleDeleteDocument = async (docId) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;

        try {
            setDeletingDocId(docId);
            const toastId = toast.loading('Deleting document...');
            await api.delete(`/dossier/${userId}/documents/${docId}`);
            toast.dismiss(toastId);
            toast.success('Document deleted successfully');
            setIsDocumentDeclared(false);
            fetchDossier(); // Refresh
            if (activeTab === 'history') fetchHistory();
        } catch (error) {
            console.error('Delete failed', error);
            toast.error('Failed to delete document');
        } finally {
            setDeletingDocId(null);
        }
    };

    const fetchHistory = useCallback(async () => {
        try {
            const res = await api.get(`/dossier/${userId}/history`);
            setHistoryLogs(res.data);
        } catch (error) {
            console.error('Failed to fetch history', error);
            toast.error('Could not load history');
        }
    }, [userId]);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, userId, fetchHistory]);

    // Fetch Dossier Data
    const fetchDossier = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/dossier/${userId}`);
            setProfile(res.data);
            setFormData(res.data); // Initialize form data
        } catch (error) {
            console.error(error);
            toast.error('Failed to load employee dossier');
            if (error.response && error.response.status === 404) {
                navigate('/users');
            }
            if (error.response && error.response.status === 403) {
                navigate('/unauthorized');
            }
        } finally {
            setLoading(false);
        }
    }, [userId, navigate]);

    useEffect(() => {
        if (userId) fetchDossier();
    }, [userId, fetchDossier]);

    const fetchHRISRequests = async () => {
        try {
            setLoadingRequests(true);
            const res = await api.get('/dossier/requests');
            setHrisRequests(res.data);
        } catch (error) {
            console.error('Failed to fetch HRIS requests', error);
        } finally {
            setLoadingRequests(false);
        }
    };

    const handleHRISApproveOther = async (id) => {
        try {
            const toastId = toast.loading('Approving HRIS request...');
            await api.patch(`/dossier/${id}/approve-hris`);
            toast.dismiss(toastId);
            toast.success('HRIS Approved');
            fetchHRISRequests();
        } catch (error) {
            console.error(error);
            toast.error('Failed to approve HRIS');
        }
    };

    const handleHRISRejectOther = async (id) => {
        const reason = window.prompt('Please enter a reason for rejection:');
        if (reason === null) return;
        try {
            const toastId = toast.loading('Rejecting HRIS request...');
            await api.patch(`/dossier/${id}/reject-hris`, { reason });
            toast.dismiss(toastId);
            toast.success('HRIS Rejected');
            fetchHRISRequests();
        } catch (error) {
            console.error(error);
            toast.error('Failed to reject HRIS');
        }
    };

    useEffect(() => {
        const isManager = currentUser?.roles?.some(r => r.name === 'Admin') || currentUser?.directReportsCount > 0 || canApprove;
        if (isManager && activeTab === 'requests') {
            fetchHRISRequests();
        }
    }, [activeTab, currentUser]);

    // Handle Tab Change
    const tabs = [
        { id: 'personal', label: 'Personal', icon: User },
        { id: 'employment', label: 'Employment History', icon: Briefcase },
        { id: 'documents', label: 'Documents', icon: FileText },
        { id: 'hris', label: 'HRIS', icon: Shield },
        { id: 'history', label: 'Activities', icon: Calendar },
    ];

    const isManager = currentUser?.roles?.some(r => r.name === 'Admin') || currentUser?.directReportsCount > 0 || canApprove;
    if (isManager) {
        tabs.push({ id: 'requests', label: 'Requests', icon: AlertCircle });
    }

    // Handle Input Change for nested objects
    const handleInputChange = (section, field, value) => {
        setFormData(prev => {
            const newState = {
                ...prev,
                [section]: {
                    ...prev[section],
                    [field]: value
                }
            };

            // Auto-uncheck declaration on any change (unless we are toggling the declaration itself)
            if (section !== 'hris' || field !== 'isDeclared') {
                if (newState.hris) {
                    newState.hris = { ...newState.hris, isDeclared: false };
                }
            }

            return newState;
        });
    };

    const handleEmergencyChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            contact: {
                ...prev.contact,
                emergencyContact: {
                    ...prev.contact?.emergencyContact,
                    [field]: value
                }
            },
            hris: { ...prev.hris, isDeclared: false }
        }));
    };

    const handleAddressChange = (type, field, value) => {
        setFormData(prev => {
            const currentAddresses = prev.contact?.addresses || [];
            const existingIndex = currentAddresses.findIndex(a => a.type === type);
            let newAddresses = [...currentAddresses];

            if (existingIndex >= 0) {
                newAddresses[existingIndex] = { ...newAddresses[existingIndex], [field]: value };
            } else {
                newAddresses.push({ type, [field]: value });
            }

            return {
                ...prev,
                contact: {
                    ...prev.contact,
                    addresses: newAddresses
                },
                hris: { ...prev.hris, isDeclared: false }
            };
        });
    };

    const handleHRISSave = async () => {
        // HRIS Validation
        const p = formData.personal || {};
        const b = formData.compensation?.bankDetails || {};

        if (!p.firstName || !p.lastName || !p.fullName) return toast.error('All fields are required');

        if (!b.accountNumber || !b.ifscCode || !b.bankName || !b.accountHolderName || !b.branchAddress) {
            return toast.error('All fields are required');
        }

        try {
            setSavingSection('hris');
            const dataToSubmit = { ...formData };

            // Allow Admins to submit without explicit checkbox (forces status update)
            const isAdmin = currentUser?.roles?.some(r => r === 'Admin' || r?.name === 'Admin');
            if (isAdmin) {
                if (!dataToSubmit.hris) dataToSubmit.hris = {};
                dataToSubmit.hris.isDeclared = true;
            }

            await api.patch(`/dossier/${userId}/submit-hris`, dataToSubmit);
            toast.success('HRIS Form saved successfully');
            setEditMode(false);
            fetchDossier();
        } catch (error) {
            console.error(error);
            toast.error('Failed to save HRIS form');
        } finally {
            setSavingSection(null);
        }
    };


    const handleExcelExport = async (targetUserId = null) => {
        try {
            const toastId = toast.loading('Generating Excel...');
            const params = targetUserId ? { userId: targetUserId } : {};
            const response = await api.get('/dossier/export-excel', {
                params,
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `HRIS_Export_${format(new Date(), 'dd_MMM_yyyy')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.dismiss(toastId);
            toast.success('Excel exported successfully');
        } catch (error) {
            console.error(error);
            toast.error('Failed to export Excel');
        }
    };

    // Validation Helper
    const validateSectionData = (section) => {
        const data = formData[section] || {};

        const isEmpty = (val) => val === undefined || val === null || val === '';

        if (section === 'personal') {
            const required = ['dob', 'gender', 'maritalStatus', 'nationality', 'bloodGroup', 'disabilityStatus'];
            const missing = required.filter(f => isEmpty(data[f]));
            if (missing.length > 0) return 'All fields are required'; // Generic warning
        }
        if (section === 'contact') {
            if (isEmpty(data.personalEmail) || isEmpty(data.mobileNumber)) return 'Email and Mobile Number are required';

            // Check Emergency Contact
            const ec = data.emergencyContact || {};
            if (isEmpty(ec.name) || isEmpty(ec.relation) || isEmpty(ec.phone)) return 'Name, relation, and phone for emergency contact are required';

            // Validate Addresses
            const addresses = data.addresses || [];
            const hasCurrent = addresses.some(a => a.type === 'Current' && !isEmpty(a.street) && !isEmpty(a.city) && !isEmpty(a.state) && !isEmpty(a.zipCode) && !isEmpty(a.country));
            const hasPermanent = addresses.some(a => a.type === 'Permanent' && !isEmpty(a.street) && !isEmpty(a.city) && !isEmpty(a.state) && !isEmpty(a.zipCode) && !isEmpty(a.country));

            if (!hasCurrent || !hasPermanent) return 'All fields are required';
        }
        if (section === 'identity') {
            if (isEmpty(data.aadhaarNumber) || isEmpty(data.panNumber)) return 'All fields are required';
        }
        if (section === 'family') {
            if (isEmpty(data.fatherName) || isEmpty(data.motherName)) return 'All fields are required';
        }
        return null;
    };

    // Save Changes
    const handleSave = async (section) => {
        const error = validateSectionData(section);
        if (error) {
            toast.error(error);
            return;
        }

        try {
            setSavingSection(section);
            const updates = formData[section];
            await api.patch(`/dossier/${userId}/${section}`, updates);
            toast.success('Changes saved successfully');
            setEditMode(false);
            fetchDossier(); // Refresh to ensure sync
        } catch (error) {
            console.error(error);
            toast.error('Failed to save changes');
        } finally {
            setSavingSection(null);
        }
    };

    // --- RENDER SECTIONS ---



    const renderPersonal = () => {

        const getAddress = (type) => formData.contact?.addresses?.find(a => a.type === type) || {};
        const getProfileAddress = (type) => profile.contact?.addresses?.find(a => a.type === type) || {};

        return (
            <div className="space-y-6">
                {/* 1. Basic Personal Info */}
                <SectionCard
                    title="Basic Information"
                    sectionName="personal"
                    icon={User}
                    editMode={editMode}
                    setEditMode={setEditMode}
                    onSave={handleSave}
                    isLoading={savingSection === 'personal'}
                    canEdit={canEdit}
                >
                    {(isEditing) => (
                        <div className="space-y-4">
                            <p className="text-xs text-red-500 italic">* fields are mandatory</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Field section="personal" isEditing={isEditing} label="Date of Birth" field="dob" value={profile.personal?.dob} type="date" formData={formData} onChange={handleInputChange} required />
                                <Field section="personal" isEditing={isEditing} label="Gender" field="gender" value={profile.personal?.gender} options={['Male', 'Female', 'Other']} formData={formData} onChange={handleInputChange} required />
                                <Field section="personal" isEditing={isEditing} label="Marital Status" field="maritalStatus" value={profile.personal?.maritalStatus} options={['Single', 'Married', 'Divorced', 'Widowed']} formData={formData} onChange={handleInputChange} required />
                                <Field section="personal" isEditing={isEditing} label="Nationality" field="nationality" value={profile.personal?.nationality} formData={formData} onChange={handleInputChange} required />
                                <Field section="personal" isEditing={isEditing} label="Blood Group" field="bloodGroup" value={profile.personal?.bloodGroup} formData={formData} onChange={handleInputChange} required />
                                <Field
                                    section="personal"
                                    isEditing={isEditing}
                                    label="Disability Status"
                                    field="disabilityStatus"
                                    value={profile.personal?.disabilityStatus ? 'Yes' : 'No'}
                                    valueOverride={formData.personal?.disabilityStatus ? 'Yes' : 'No'}
                                    options={['No', 'Yes']}
                                    hideIfEmpty
                                    formData={formData}
                                    onChangeOverride={(e) => handleInputChange('personal', 'disabilityStatus', e.target.value === 'Yes')}
                                    required
                                />
                            </div>
                        </div>
                    )}
                </SectionCard>

                {/* 2. Contact Details */}
                <SectionCard
                    title="Contact Information"
                    sectionName="contact"
                    icon={Briefcase}
                    editMode={editMode}
                    setEditMode={setEditMode}
                    onSave={handleSave}
                    isLoading={savingSection === 'contact'}
                    canEdit={canEdit}
                >
                    {(isEditing) => (
                        <div className="space-y-6">
                            <p className="text-xs text-red-500 italic">* fields are mandatory</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field section="contact" isEditing={isEditing} label="Personal Email" field="personalEmail" value={profile.contact?.personalEmail} formData={formData} onChange={handleInputChange} required />
                                <Field
                                    section="contact" isEditing={isEditing} label="Mobile Number" field="mobileNumber"
                                    value={profile.contact?.mobileNumber} formData={formData}
                                    maxLength={10}
                                    error={formData.contact?.mobileNumber?.length > 0 && formData.contact?.mobileNumber?.length < 10 ? 'Must be 10 digits' : null}
                                    onChangeOverride={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        handleInputChange('contact', 'mobileNumber', val);
                                    }}
                                    required
                                />
                                <Field
                                    section="contact" isEditing={isEditing} label="Alternate Number" field="alternateNumber"
                                    value={profile.contact?.alternateNumber} formData={formData}
                                    maxLength={10}
                                    error={formData.contact?.alternateNumber?.length > 0 && formData.contact?.alternateNumber?.length < 10 ? 'Must be 10 digits' : null}
                                    onChangeOverride={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        handleInputChange('contact', 'alternateNumber', val);
                                    }}
                                />
                            </div>

                            {/* Emergency Contact Sub-section */}
                            <div className="pt-4 border-t border-slate-100">
                                <h4 className="text-sm font-bold text-slate-700 mb-4">Emergency Contact</h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                                    <Field
                                        section="contact" isEditing={isEditing}
                                        label="Name" field="EC_name"
                                        value={profile.contact?.emergencyContact?.name}
                                        valueOverride={formData.contact?.emergencyContact?.name}
                                        onChangeOverride={(e) => handleEmergencyChange('name', e.target.value)}
                                        formData={formData} onChange={handleInputChange}
                                        required
                                    />
                                    <Field
                                        section="contact" isEditing={isEditing}
                                        label="Relation" field="EC_relation"
                                        value={profile.contact?.emergencyContact?.relation}
                                        valueOverride={formData.contact?.emergencyContact?.relation}
                                        onChangeOverride={(e) => handleEmergencyChange('relation', e.target.value)}
                                        formData={formData} onChange={handleInputChange}
                                        required
                                    />
                                    <Field
                                        section="contact" isEditing={isEditing}
                                        label="Phone" field="EC_phone"
                                        value={profile.contact?.emergencyContact?.phone}
                                        valueOverride={formData.contact?.emergencyContact?.phone}
                                        maxLength={10}
                                        error={formData.contact?.emergencyContact?.phone?.length > 0 && formData.contact?.emergencyContact?.phone?.length < 10 ? 'Must be 10 digits' : null}
                                        onChangeOverride={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            handleEmergencyChange('phone', val);
                                        }}
                                        formData={formData} onChange={handleInputChange}
                                        required
                                    />
                                    <Field
                                        section="contact" isEditing={isEditing}
                                        label="Email" field="EC_email"
                                        value={profile.contact?.emergencyContact?.email}
                                        valueOverride={formData.contact?.emergencyContact?.email}
                                        onChangeOverride={(e) => handleEmergencyChange('email', e.target.value)}
                                        formData={formData} onChange={handleInputChange}
                                    />
                                </div>
                            </div>

                            {/* Address Sub-section */}
                            <div className="pt-4 border-t border-slate-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Current Address */}
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-700 mb-4">Current Address <span className="text-red-500">*</span></h4>
                                        <div className="space-y-3">
                                            <Field section="contact" isEditing={isEditing} label="Street" field="C_street" value={getProfileAddress('Current').street}
                                                valueOverride={getAddress('Current').street} onChangeOverride={(e) => handleAddressChange('Current', 'street', e.target.value)}
                                                formData={formData} onChange={handleInputChange} />
                                            <Field section="contact" isEditing={isEditing} label="Line 2" field="C_line2" value={getProfileAddress('Current').addressLine2}
                                                valueOverride={getAddress('Current').addressLine2} onChangeOverride={(e) => handleAddressChange('Current', 'addressLine2', e.target.value)}
                                                formData={formData} onChange={handleInputChange} />
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field section="contact" isEditing={isEditing} label="City" field="C_city" value={getProfileAddress('Current').city}
                                                    valueOverride={getAddress('Current').city} onChangeOverride={(e) => handleAddressChange('Current', 'city', e.target.value)}
                                                    formData={formData} onChange={handleInputChange} />
                                                <Field section="contact" isEditing={isEditing} label="State" field="C_state" value={getProfileAddress('Current').state}
                                                    valueOverride={getAddress('Current').state} onChangeOverride={(e) => handleAddressChange('Current', 'state', e.target.value)}
                                                    formData={formData} onChange={handleInputChange} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field section="contact" isEditing={isEditing} label="Pincode" field="C_zip" value={getProfileAddress('Current').zipCode}
                                                    valueOverride={getAddress('Current').zipCode} onChangeOverride={(e) => handleAddressChange('Current', 'zipCode', e.target.value)}
                                                    formData={formData} onChange={handleInputChange} />
                                                <Field section="contact" isEditing={isEditing} label="Country" field="C_country" value={getProfileAddress('Current').country}
                                                    valueOverride={getAddress('Current').country} onChangeOverride={(e) => handleAddressChange('Current', 'country', e.target.value)}
                                                    formData={formData} onChange={handleInputChange} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Permanent Address */}
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-bold text-slate-700">Permanent Address <span className="text-red-500">*</span></h4>
                                            {isEditing && (
                                                <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                const current = getAddress('Current');
                                                                // Batch update all fields in a single state update
                                                                setFormData(prev => {
                                                                    const currentAddresses = prev.contact?.addresses || [];
                                                                    const permIndex = currentAddresses.findIndex(a => a.type === 'Permanent');
                                                                    const permAddr = { type: 'Permanent', street: current.street, addressLine2: current.addressLine2, city: current.city, state: current.state, zipCode: current.zipCode, country: current.country };
                                                                    let newAddresses = [...currentAddresses];
                                                                    if (permIndex >= 0) { newAddresses[permIndex] = permAddr; } else { newAddresses.push(permAddr); }
                                                                    return { ...prev, contact: { ...prev.contact, addresses: newAddresses }, hris: { ...prev.hris, isDeclared: false } };
                                                                });
                                                            }
                                                        }}
                                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span>Same as Current</span>
                                                </label>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <Field section="contact" isEditing={isEditing} label="Street" field="P_street" value={getProfileAddress('Permanent').street}
                                                valueOverride={getAddress('Permanent').street} onChangeOverride={(e) => handleAddressChange('Permanent', 'street', e.target.value)}
                                                formData={formData} onChange={handleInputChange} />
                                            <Field section="contact" isEditing={isEditing} label="Line 2" field="P_line2" value={getProfileAddress('Permanent').addressLine2}
                                                valueOverride={getAddress('Permanent').addressLine2} onChangeOverride={(e) => handleAddressChange('Permanent', 'addressLine2', e.target.value)}
                                                formData={formData} onChange={handleInputChange} />
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field section="contact" isEditing={isEditing} label="City" field="P_city" value={getProfileAddress('Permanent').city}
                                                    valueOverride={getAddress('Permanent').city} onChangeOverride={(e) => handleAddressChange('Permanent', 'city', e.target.value)}
                                                    formData={formData} onChange={handleInputChange} />
                                                <Field section="contact" isEditing={isEditing} label="State" field="P_state" value={getProfileAddress('Permanent').state}
                                                    valueOverride={getAddress('Permanent').state} onChangeOverride={(e) => handleAddressChange('Permanent', 'state', e.target.value)}
                                                    formData={formData} onChange={handleInputChange} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field section="contact" isEditing={isEditing} label="Pincode" field="P_zip" value={getProfileAddress('Permanent').zipCode}
                                                    valueOverride={getAddress('Permanent').zipCode} onChangeOverride={(e) => handleAddressChange('Permanent', 'zipCode', e.target.value)}
                                                    formData={formData} onChange={handleInputChange} />
                                                <Field section="contact" isEditing={isEditing} label="Country" field="P_country" value={getProfileAddress('Permanent').country}
                                                    valueOverride={getAddress('Permanent').country} onChangeOverride={(e) => handleAddressChange('Permanent', 'country', e.target.value)}
                                                    formData={formData} onChange={handleInputChange} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </SectionCard>

                {/* 3. Identity (Sensitive) */}
                <SectionCard
                    title="Identity & Legal (Sensitive)"
                    sectionName="identity"
                    icon={Shield}
                    editMode={editMode}
                    setEditMode={setEditMode}
                    onSave={handleSave}
                    isLoading={savingSection === 'identity'}
                    canEdit={canEdit}
                >
                    {(isEditing) => (
                        <div className="space-y-4">
                            <p className="text-xs text-red-500 italic">* fields are mandatory</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field section="identity" isEditing={isEditing} label="Aadhaar Number" field="aadhaarNumber" value={profile.identity?.aadhaarNumber} formData={formData} onChange={handleInputChange} required />
                                <Field section="identity" isEditing={isEditing} label="PAN Number" field="panNumber" value={profile.identity?.panNumber} formData={formData} onChange={handleInputChange} required />
                                <Field section="identity" isEditing={isEditing} label="Passport Number" field="passportNumber" value={profile.identity?.passportNumber} formData={formData} onChange={handleInputChange} />
                            </div>
                        </div>
                    )}
                </SectionCard>
            </div>
        )
    }

    const renderEmployment = () => {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Employment Details</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Designation */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Designation</label>
                        <div className="text-slate-800 font-medium">{profile.employment?.designation || profile.user?.roles?.[0]?.name || '-'}</div>
                    </div>

                    {/* Department */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Department</label>
                        <div className="text-slate-800 font-medium">{profile.employment?.department || '-'}</div>
                    </div>

                    {/* Joining Date */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Joining Date</label>
                        <div className="text-slate-800 font-medium">{(profile.employment?.joiningDate || profile.user?.joiningDate) ? format(new Date(profile.employment?.joiningDate || profile.user?.joiningDate), 'dd MMM yyyy') : '-'}</div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            {profile.employment?.status || 'Active'}
                        </div>
                    </div>

                    {/* Work Location */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Work Location</label>
                        <div className="text-slate-800 font-medium">{profile.user?.workLocation || profile.employment?.workLocation || 'Office'}</div>
                    </div>

                    {/* Employment Type */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Employment Type</label>
                        <div className="text-slate-800 font-medium">{profile.user?.employmentType || 'Full Time'}</div>
                    </div>
                </div>
            </div>
        );
    };

    const renderDocuments = () => {
        const canVerify = currentUser?.roles?.some(r => r === 'Admin' || r?.name === 'Admin')
            || currentUser?.permissions?.includes('dossier.verify_documents')
            || currentUser?.permissions?.includes('dossier.approve');
        const hasPendingDocs = profile.documents?.some(d => d.verificationStatus === 'Pending');
        // Robust ID comparison
        const isSelf = currentUser?._id && userId && (currentUser._id.toString() === userId.toString());

        const handleVerifyAllDocuments = async () => {
            try {
                const targetUserId = userId || currentUser?._id;
                const response = await api.patch(`/dossier/${targetUserId}/documents/verify-all`, { status: 'Verified' });
                if (response.status === 200) {
                    toast.success(`All pending documents verified`);
                    // Optimistic update
                    setProfile(prev => ({
                        ...prev,
                        documentSubmissionStatus: response.data.submissionStatus,
                        documents: prev.documents.map(d => d.verificationStatus === 'Pending' ? { ...d, verificationStatus: 'Verified' } : d)
                    }));
                }
            } catch (error) {
                console.error('Verify All Documents Error:', error);
                toast.error(error.response?.data?.message || 'Failed to verify documents');
            }
        };

        const handleSubmitDocuments = async () => {
            // Validation: Check for mandatory documents
            const uploadedTitles = profile.documents?.map(d => d.title.toLowerCase()) || [];

            // 1. Mandatory Identity Docs (Except Passport)
            const identityCategory = documentCategories.find(c => c.name === 'Identity Documents');
            const requiredIdentityDocs = identityCategory?.fixedDocs.filter(doc => doc !== 'Passport') || [];

            const missingIdentityDocs = requiredIdentityDocs.filter(reqDoc =>
                !uploadedTitles.includes(reqDoc.toLowerCase())
            );

            // 2. Mandatory Qualification Docs
            const qualificationCategory = documentCategories.find(c => c.name === 'Qualification Certificates');
            const requiredQualificationDocs = qualificationCategory?.fixedDocs || [];

            const missingQualificationDocs = requiredQualificationDocs.filter(reqDoc =>
                !uploadedTitles.includes(reqDoc.toLowerCase())
            );

            const allMissing = [...missingIdentityDocs, ...missingQualificationDocs];

            if (allMissing.length > 0) {
                toast.error(`All fields are required.`);
                return;
            }

            try {
                const targetUserId = userId || currentUser?._id;
                const response = await api.patch(`/dossier/${targetUserId}/documents/submit`);
                if (response.status === 200) {
                    toast.success('Documents submitted for approval');
                    setProfile(prev => ({
                        ...prev,
                        documentSubmissionStatus: response.data.submissionStatus
                        // documents status doesn't change on submit, just global status
                    }));
                }
            } catch (error) {
                console.error('Submit Documents Error:', error);
                toast.error(error.response?.data?.message || 'Failed to submit documents');
            }
        };

        const handleVerifyDocument = async (docId, status) => {
            try {
                const targetUserId = userId || currentUser?._id;
                const response = await api.patch(`/dossier/${targetUserId}/documents/${docId}/verify`, { status });
                if (response.status === 200) {
                    toast.success(`Document marked as ${status}`);
                    setProfile(prev => ({
                        ...prev,
                        documentSubmissionStatus: response.data.submissionStatus,
                        documents: response.data.documents
                    }));
                }
            } catch (error) {
                console.error('Verify Document Error:', error);
                toast.error(error.response?.data?.message || 'Failed to verify document');
            }
        };

        const handleDownload = async (doc) => {
            try {
                const toastId = toast.loading('Preparing download...');
                const response = await api.get('/dossier/proxy-pdf', {
                    params: { url: doc.url, download: true },
                    responseType: 'blob'
                });

                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', doc.fileName || `${doc.title}.pdf`); // Fallback name
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast.dismiss(toastId);
                toast.success('Download started');
            } catch (error) {
                console.error('Download Error:', error);
                toast.error('Failed to download document');
            }
        };



        // Render a single document card
        const DocumentCard = ({ doc }) => (
            <div className="group relative bg-white border border-slate-200 rounded-xl p-4 hover:shadow-lg hover:border-blue-200 transition-all duration-300 flex flex-col justify-between min-w-[280px] max-w-[280px]">
                <div className="flex justify-between items-start mb-3">
                    <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
                        <FileText size={20} />
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${doc.verificationStatus === 'Verified' ? 'bg-emerald-100 text-emerald-700' :
                        doc.verificationStatus === 'Rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                        }`}>
                        {doc.verificationStatus || 'Pending'}
                    </div>
                </div>

                <div className="mb-3">
                    <h4 className="font-semibold text-slate-800 text-sm mb-1 line-clamp-2" title={doc.title}>{doc.title}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{doc.category || 'Document'}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span>{format(new Date(doc.uploadDate), 'MMM dd, yyyy')}</span>
                    </p>
                </div>

                {/* Action Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                    <div className="flex gap-1">
                        <button
                            onClick={() => window.open(doc.url, '_blank')}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View"
                        >
                            <Eye size={16} />
                        </button>
                        <button
                            onClick={() => handleDownload(doc)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Download"
                        >
                            <Download size={16} />
                        </button>
                    </div>

                    <div className="flex gap-1 pl-2 border-l border-slate-100">
                        {canVerify && (
                            <>
                                <button
                                    onClick={() => handleVerifyDocument(doc._id, 'Verified')}
                                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Approve"
                                >
                                    <CheckCircle size={16} />
                                </button>
                                <button
                                    onClick={() => handleVerifyDocument(doc._id, 'Rejected')}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Reject"
                                >
                                    <X size={16} />
                                </button>
                            </>
                        )}

                        <button
                            onClick={() => handleDeleteDocument(doc._id)}
                            disabled={deletingDocId === doc._id}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                        >
                            {deletingDocId === doc._id ? (
                                <span className="block h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                                <Trash2 size={16} />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );

        return (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-lg font-bold text-slate-800">Documents</h3>

                    {/* Approve All Button for Admins - Always Visible */}
                    {canVerify && (
                        <Button
                            onClick={handleVerifyAllDocuments}
                            disabled={!profile.documents?.some(d => d.verificationStatus === 'Pending')}
                            className={`flex items-center gap-2 shadow-sm ${!profile.documents?.some(d => d.verificationStatus === 'Pending')
                                ? 'bg-emerald-900 text-emerald-400'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                        >
                            <CheckCircle size={18} />
                            Approve All Pending
                        </Button>
                    )}
                </div>
                <p className="text-xs text-red-500 italic mb-6">* fields are mandatory</p>

                {/* Submission Status Banner */}
                {profile.documentSubmissionStatus && profile.documentSubmissionStatus !== 'Draft' && (
                    <div className={`mb-4 p-3 rounded-lg border flex items-center gap-3 shadow-sm transition-all duration-300 ${profile.documentSubmissionStatus === 'Approved' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' :
                        profile.documentSubmissionStatus === 'Changes Requested' ? 'bg-amber-50/80 border-amber-200 text-amber-900' :
                            'bg-blue-50/80 border-blue-200 text-blue-900'
                        }`}>
                        <div className={`p-1.5 rounded-full shrink-0 ${profile.documentSubmissionStatus === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                            profile.documentSubmissionStatus === 'Changes Requested' ? 'bg-amber-100 text-amber-600' :
                                'bg-blue-100 text-blue-600'
                            }`}>
                            {profile.documentSubmissionStatus === 'Approved' ? <CheckCircle size={18} /> :
                                profile.documentSubmissionStatus === 'Changes Requested' ? <AlertCircle size={18} /> :
                                    <Shield size={18} />}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-sm tracking-tight flex items-center gap-2">
                                Submission Status: {profile.documentSubmissionStatus}
                                {profile.documentSubmissionStatus === 'Approved' && <span className="text-xs font-normal opacity-80">(All documents verified)</span>}
                            </h4>
                            {profile.documentSubmissionStatus !== 'Approved' && (
                                <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                                    {profile.documentSubmissionStatus === 'Submitted' && "Documents submitted for review."}
                                    {profile.documentSubmissionStatus === 'Changes Requested' && "Action Required: Please review feedback."}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Hidden file input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                />

                {/* Document Categories */}
                <div className="space-y-8">
                    {documentCategories.map((catConfig) => {
                        const categoryDocs = profile.documents?.filter(d => d.category === catConfig.category) || [];

                        return (
                            <div key={catConfig.name} className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                        {catConfig.icon && <span className="text-xl">{catConfig.icon}</span>}
                                        {catConfig.name}
                                        <span className="text-xs font-normal text-slate-500">({categoryDocs.length})</span>
                                    </h4>
                                    {catConfig.allowMultiple && (
                                        <button
                                            onClick={() => triggerCategoryUpload(catConfig.name, catConfig.category)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors shadow-sm"
                                        >
                                            <Upload size={14} />
                                            Add Document
                                        </button>
                                    )}
                                </div>

                                {/* Document Row - Horizontal Scroll */}
                                <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                                    {/* Fixed documents for Identity */}
                                    {/* Fixed documents (Identity, Education, Bank etc.) */}
                                    {catConfig.fixedDocs?.map((docTitle) => {
                                        const doc = categoryDocs.find(d => d.title.toLowerCase() === docTitle.toLowerCase());
                                        const isMandatory = (catConfig.name === 'Identity Documents' && docTitle !== 'Passport') || (catConfig.name === 'Qualification Certificates');

                                        if (doc) {
                                            return <DocumentCard key={doc._id} doc={doc} />;
                                        }

                                        // Empty state for fixed docs
                                        return (
                                            <div
                                                key={docTitle}
                                                onClick={() => triggerUpload(docTitle)}
                                                className="group cursor-pointer border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-white hover:bg-blue-50/30 hover:border-blue-300 hover:shadow-md transition-all duration-300 min-w-[280px] max-w-[280px] min-h-[180px]"
                                            >
                                                <div className="p-3 bg-slate-100 rounded-full text-slate-400 mb-3 group-hover:text-blue-500 group-hover:bg-blue-100 group-hover:scale-110 transition-all">
                                                    <Upload size={20} />
                                                </div>
                                                <h4 className="font-semibold text-slate-700 text-sm mb-1 group-hover:text-blue-700 transition-colors">
                                                    {docTitle} {isMandatory && <span className="text-red-500">*</span>}
                                                </h4>
                                                <p className="text-xs text-slate-400">Click to upload</p>
                                            </div>
                                        );
                                    })}

                                    {/* Dynamic documents (exclude those that match fixedDocs titles) */}
                                    {catConfig.allowMultiple && categoryDocs
                                        .filter(doc => !catConfig.fixedDocs?.some(fixedTitle => fixedTitle.toLowerCase() === doc.title.toLowerCase()))
                                        .map(doc => (
                                            <DocumentCard key={doc._id} doc={doc} />
                                        ))}

                                    {/* Show empty state if no documents in dynamic category AND no fixed docs */}
                                    {catConfig.allowMultiple && categoryDocs.length === 0 && (!catConfig.fixedDocs || catConfig.fixedDocs.length === 0) && (
                                        <div className="flex items-center justify-center min-w-[280px] h-[180px] border-2 border-dashed border-slate-200 rounded-xl bg-white text-slate-400 text-sm">
                                            No documents uploaded yet
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Document Final Declaration */}
                {(!canVerify || isSelf) && profile.documentSubmissionStatus !== 'Approved' && (
                    <div className="mt-10 pt-10 border-t border-slate-200">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col items-center text-center">
                            <h3 className="font-bold text-slate-800 text-lg mb-2">Final Declaration</h3>
                            <p className="text-sm text-slate-600 max-w-2xl mb-6">
                                I hereby declare that all the documents provided above are true and accurate to the best of my knowledge.
                                I understand that any false information or forged documents may lead to disciplinary action or termination of employment.
                            </p>

                            {profile.documentSubmissionStatus === 'Submitted' ? (
                                <div className="space-y-4 flex flex-col items-center">
                                    <div className="flex items-center text-emerald-600 space-x-2 font-bold bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                                        <CheckCircle size={20} />
                                        <span>Declared on {profile.updatedAt ? format(new Date(profile.updatedAt), 'dd MMM yyyy') : 'Recently'}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 flex flex-col items-center">
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={isDocumentDeclared}
                                            onChange={(e) => setIsDocumentDeclared(e.target.checked)}
                                            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 group-hover:border-blue-400 transition"
                                        />
                                        <span className="text-sm font-semibold text-slate-700 select-none">I agree to the declaration</span>
                                    </label>
                                    {isDocumentDeclared && (
                                        <p className="text-xs text-blue-600 font-medium animate-pulse">
                                            Ready to submit! Click "Submit for Approval" below to finish.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Submit for Approval Button - Bottom */}
                {(!canVerify || isSelf) && !(profile.documentSubmissionStatus === 'Approved' && !hasPendingDocs) && (
                    <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
                        <button
                            onClick={handleSubmitDocuments}
                            disabled={!profile.documents?.length || profile.documentSubmissionStatus === 'Submitted' || !isDocumentDeclared}
                            className={`flex items-center gap-2 shadow-sm px-6 py-2.5 rounded-xl font-semibold outline-none ${!profile.documents?.length || profile.documentSubmissionStatus === 'Submitted' || !isDocumentDeclared
                                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            <Shield size={18} />
                            {profile.documentSubmissionStatus === 'Submitted' ? 'Submitted for Approval' :
                                profile.documentSubmissionStatus === 'Approved' && hasPendingDocs ? 'Submit New Documents' :
                                    'Submit for Approval'}
                        </button>
                    </div>
                )}

                {/* Fixed Document Upload Preview */}
                {showUploadPreview && previewFile && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleCancelUpload}>
                        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg font-bold text-slate-800">Confirm Upload</h3>
                                    <button onClick={handleCancelUpload} className="text-slate-400 hover:text-slate-600 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex items-center gap-4 mb-6">
                                    <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 text-blue-600">
                                        <FileText size={24} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-700 text-sm truncate" title={uploadingDocTitle}>{uploadingDocTitle}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {(previewFile.size / 1024 / 1024).toFixed(2)} MB • {previewFile.name.split('.').pop().toUpperCase()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        onClick={handleConfirmUpload}
                                        isLoading={isUploading}
                                        className="flex-1 shadow-lg shadow-blue-100"
                                    >
                                        Upload Now
                                    </Button>
                                    <Button
                                        variants="ghost"
                                        onClick={handleCancelUpload}
                                        disabled={isUploading}
                                        className="flex-1 border border-slate-200"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Custom Title Modal */}
                {
                    showTitleModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCancelUpload}>
                            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                                <h3 className="text-lg font-bold text-slate-800 mb-4">Enter Document Title</h3>
                                <input
                                    type="text"
                                    value={customDocTitle}
                                    onChange={(e) => setCustomDocTitle(e.target.value)}
                                    placeholder="e.g., B.Tech Degree Certificate"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-4"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && customDocTitle.trim()) {
                                            handleConfirmUpload();
                                        }
                                    }}
                                />
                                <div className="flex gap-3">
                                    <Button
                                        onClick={handleConfirmUpload}
                                        disabled={!customDocTitle.trim()}
                                        isLoading={isUploading}
                                        className="flex-1"
                                    >
                                        Upload
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={handleCancelUpload}
                                        disabled={isUploading}
                                        className="flex-1 border border-slate-200"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        );
    };
    const handleArrayChange = (section, index, field, value) => {
        setFormData(prev => {
            const newArray = [...(prev[section] || [])];
            newArray[index] = { ...newArray[index], [field]: value };
            return { ...prev, [section]: newArray, hris: { ...prev.hris, isDeclared: false } };
        });
    };

    const addArrayItem = (section, defaultObj = {}) => {
        setFormData(prev => ({
            ...prev,
            [section]: [...(prev[section] || []), defaultObj],
            hris: { ...prev.hris, isDeclared: false }
        }));
    };

    const removeArrayItem = (section, index) => {
        setFormData(prev => ({
            ...prev,
            [section]: prev[section].filter((_, i) => i !== index),
            hris: { ...prev.hris, isDeclared: false }
        }));
    };

    const getStatusBadge = (status) => {
        const badgeBase = "px-3 py-1.5 rounded-full text-[11px] font-bold border flex items-center shadow-sm transition-all";
        switch (status) {
            case 'Approved':
                return <span className={`${badgeBase} bg-emerald-50 text-emerald-700 border-emerald-200`}><CheckCircle size={14} className="mr-1.5 flex-shrink-0" /> Approved</span>;
            case 'Pending Approval':
                return <span className={`${badgeBase} bg-amber-50 text-amber-700 border-amber-200`}><AlertCircle size={14} className="mr-1.5 flex-shrink-0" /> Pending Approval</span>;
            case 'Rejected':
                return <span className={`${badgeBase} bg-red-50 text-red-700 border-red-200`}><X size={14} className="mr-1.5 flex-shrink-0" /> Rejected</span>;
            default:
                return <span className={`${badgeBase} bg-slate-50 text-slate-600 border-slate-200`}>Draft</span>;
        }
    };

    const renderHRIS = () => {
        if (!profile) return null;
        const isEditing = editMode === 'hris';
        const isAdmin = currentUser?.roles?.some(r => r === 'Admin' || r?.name === 'Admin');
        const isManager = profile.employment?.reportingManager?._id === currentUser?._id || profile.employment?.reportingManager === currentUser?._id;
        const hrisStatus = profile.hris?.status || 'Draft';

        return (
            <div className="space-y-8 bg-white p-4 md:p-8 rounded-xl border border-slate-200 shadow-sm transition-all animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 -m-4 md:-m-8 p-4 md:p-6 mb-12 border-b border-slate-200 rounded-t-xl gap-4">
                    <div className="flex items-center space-x-4">
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">HRIS Information Form</h2>
                            <div className="mt-4 flex items-center gap-4">
                                {getStatusBadge(hrisStatus)}
                                {profile.hris?.submittedAt && (
                                    <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                                        Submitted: {format(new Date(profile.hris.submittedAt), 'dd MMM yyyy')}
                                    </span>
                                )}
                            </div>
                            {hrisStatus === 'Rejected' && profile.hris?.rejectionReason && (
                                <div className="mt-4 bg-red-50/50 p-3 rounded-lg border border-red-100/50 flex items-start gap-2 max-w-xl">
                                    <AlertCircle size={14} className="text-red-500 mt-0.5" />
                                    <p className="text-xs text-red-700 leading-relaxed font-medium">
                                        <span className="font-bold">Rejection Reason:</span> {profile.hris.rejectionReason}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Admin Action: Export */}



                        {/* Edit Action for Self (and Admin) */}
                        {!isEditing && (hrisStatus === 'Draft' || hrisStatus === 'Rejected' || hrisStatus === 'Approved' || isAdmin) && (
                            <div className="flex space-x-2">
                                <Button onClick={() => setEditMode('hris')} className="flex items-center text-xs px-3 py-1.5 h-8">
                                    <Save size={14} className="mr-1.5" /> Edit Form
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 py-12">
                    <p className="text-xs text-red-500 italic px-1">* fields are mandatory</p>
                    {/* 1. Basic Details */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                            <User size={18} className="text-blue-500" />
                            <h3 className="font-bold text-slate-700">1. Basic Employee Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Field section="user" isEditing={false} label="Employee Code" field="employeeCode" value={profile.user?.employeeCode} />
                            <Field section="contact" isEditing={isEditing} label="Personal Email" field="personalEmail" value={profile.contact?.personalEmail} formData={formData} onChange={handleInputChange} required />
                            <Field section="identity" isEditing={isEditing} label="PAN Card Number" field="panNumber" value={profile.identity?.panNumber} formData={formData} onChange={handleInputChange} required />
                            <Field section="identity" isEditing={isEditing} label="Passport Number" field="passportNumber" value={profile.identity?.passportNumber} formData={formData} onChange={handleInputChange} />
                        </div>
                    </div>

                    {/* 2. Name Details */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                            <User size={18} className="text-blue-500" />
                            <h3 className="font-bold text-slate-700">2. Name Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Field section="personal" isEditing={isEditing} label="Full Name" field="fullName" value={profile.personal?.fullName} formData={formData} onChange={handleInputChange} required />
                            <Field section="personal" isEditing={isEditing} label="First Name" field="firstName" value={profile.personal?.firstName} formData={formData} onChange={handleInputChange} required />
                            <Field section="personal" isEditing={isEditing} label="Middle Name" field="middleName" value={profile.personal?.middleName} formData={formData} onChange={handleInputChange} />
                            <Field section="personal" isEditing={isEditing} label="Last Name" field="lastName" value={profile.personal?.lastName} formData={formData} onChange={handleInputChange} required />
                        </div>
                    </div>

                    {/* 3. Personal Info */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                            <Calendar size={18} className="text-blue-500" />
                            <h3 className="font-bold text-slate-700">3. Personal Information</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Field section="personal" isEditing={isEditing} label="Gender" field="gender" value={profile.personal?.gender} options={['Male', 'Female', 'Other']} formData={formData} onChange={handleInputChange} />
                            <Field section="personal" isEditing={isEditing} label="Date of Birth" field="dob" type="date" value={profile.personal?.dob} formData={formData} onChange={handleInputChange} />
                            <Field section="employment" isEditing={false} label="Date of Joining" field="joiningDate" type="date" value={profile.employment?.joiningDate} />
                        </div>
                    </div>

                    {/* 4. Bank Details */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                            <DollarSign size={18} className="text-blue-500" />
                            <h3 className="font-bold text-slate-700">4. Bank Account Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Field
                                section="compensation" isEditing={isEditing} label="Account Number" field="bankAccount"
                                value={profile.compensation?.bankDetails?.accountNumber}
                                valueOverride={formData.compensation?.bankDetails?.accountNumber}
                                onChangeOverride={(e) => setFormData(prev => ({ ...prev, compensation: { ...prev.compensation, bankDetails: { ...prev.compensation?.bankDetails, accountNumber: e.target.value } } }))}
                                required
                            />
                            <Field
                                section="compensation" isEditing={isEditing} label="IFSC Code" field="ifsc"
                                value={profile.compensation?.bankDetails?.ifscCode}
                                valueOverride={formData.compensation?.bankDetails?.ifscCode}
                                onChangeOverride={(e) => setFormData(prev => ({ ...prev, compensation: { ...prev.compensation, bankDetails: { ...prev.compensation?.bankDetails, ifscCode: e.target.value } } }))}
                                required
                            />
                            <Field
                                section="compensation" isEditing={isEditing} label="Bank Name" field="bankName"
                                value={profile.compensation?.bankDetails?.bankName}
                                valueOverride={formData.compensation?.bankDetails?.bankName}
                                onChangeOverride={(e) => setFormData(prev => ({ ...prev, compensation: { ...prev.compensation, bankDetails: { ...prev.compensation?.bankDetails, bankName: e.target.value } } }))}
                                required
                            />
                            <Field
                                section="compensation" isEditing={isEditing} label="Account Holder Name" field="holder"
                                value={profile.compensation?.bankDetails?.accountHolderName}
                                valueOverride={formData.compensation?.bankDetails?.accountHolderName}
                                onChangeOverride={(e) => setFormData(prev => ({ ...prev, compensation: { ...prev.compensation, bankDetails: { ...prev.compensation?.bankDetails, accountHolderName: e.target.value } } }))}
                                required
                            />
                            <Field
                                section="compensation" isEditing={isEditing} label="Branch Address" field="branchAddress"
                                value={profile.compensation?.bankDetails?.branchAddress}
                                valueOverride={formData.compensation?.bankDetails?.branchAddress}
                                onChangeOverride={(e) => setFormData(prev => ({ ...prev, compensation: { ...prev.compensation, bankDetails: { ...prev.compensation?.bankDetails, branchAddress: e.target.value } } }))}
                                required
                            />
                        </div>
                    </div>

                    {/* 5. Addresses */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                            <FileText size={18} className="text-blue-500" />
                            <h3 className="font-bold text-slate-700">5. Address Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {['Current', 'Permanent', 'Mailing'].map(type => (
                                <div key={type} className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest">{type} Address</h4>
                                    <div className="space-y-6">
                                        <Field section="contact" isEditing={isEditing} label="Street" field={`${type}_street`}
                                            value={profile.contact?.addresses?.find(a => a.type === type)?.street}
                                            valueOverride={formData.contact?.addresses?.find(a => a.type === type)?.street}
                                            onChangeOverride={(e) => handleAddressChange(type, 'street', e.target.value)}
                                        />
                                        <Field section="contact" isEditing={isEditing} label="City" field={`${type}_city`}
                                            value={profile.contact?.addresses?.find(a => a.type === type)?.city}
                                            valueOverride={formData.contact?.addresses?.find(a => a.type === type)?.city}
                                            onChangeOverride={(e) => handleAddressChange(type, 'city', e.target.value)}
                                        />
                                        <Field section="contact" isEditing={isEditing} label="State" field={`${type}_state`}
                                            value={profile.contact?.addresses?.find(a => a.type === type)?.state}
                                            valueOverride={formData.contact?.addresses?.find(a => a.type === type)?.state}
                                            onChangeOverride={(e) => handleAddressChange(type, 'state', e.target.value)}
                                        />
                                        <Field section="contact" isEditing={isEditing} label="Zip Code" field={`${type}_zip`}
                                            value={profile.contact?.addresses?.find(a => a.type === type)?.zipCode}
                                            valueOverride={formData.contact?.addresses?.find(a => a.type === type)?.zipCode}
                                            onChangeOverride={(e) => handleAddressChange(type, 'zipCode', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 6. Contact Details */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                            <Shield size={18} className="text-blue-500" />
                            <h3 className="font-bold text-slate-700">6. Contact Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Field section="contact" isEditing={isEditing} label="Personal Mobile" field="mobileNumber" value={profile.contact?.mobileNumber} formData={formData} onChange={handleInputChange} />
                            <Field section="contact" isEditing={isEditing} label="Alternate Mobile Number" field="alternateNumber" value={profile.contact?.alternateNumber} formData={formData} onChange={handleInputChange} />
                            <Field section="contact" isEditing={isEditing} label="Emergency Mobile (from Personal)" field="emergencyNumber" value={profile.contact?.emergencyContact?.phone} formData={formData} onChange={handleInputChange} />
                            <Field section="contact" isEditing={isEditing} label="Landline Number" field="landlineNumber" value={profile.contact?.landlineNumber} formData={formData} onChange={handleInputChange} />
                        </div>
                    </div>

                    {/* 7. Family Details */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                            <User size={18} className="text-blue-500" />
                            <h3 className="font-bold text-slate-700">7. Medical Insurance / Family Information</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Field section="family" isEditing={isEditing} label="Father's Name" field="fatherName" value={profile.family?.fatherName} formData={formData} onChange={handleInputChange} required />
                            <Field section="family" isEditing={isEditing} label="Father's Occupation" field="fatherOccupation" value={profile.family?.fatherOccupation} formData={formData} onChange={handleInputChange} />
                            <Field section="family" isEditing={isEditing} label="Mother's Name" field="motherName" value={profile.family?.motherName} formData={formData} onChange={handleInputChange} required />
                            <Field section="family" isEditing={isEditing} label="Mother's Occupation" field="motherOccupation" value={profile.family?.motherOccupation} formData={formData} onChange={handleInputChange} />
                            <Field section="family" isEditing={isEditing} label="Marital Status" field="parentsMaritalStatus" value={profile.family?.parentsMaritalStatus} options={['Married', 'Divorced', 'Widowed', 'Separated']} formData={formData} onChange={handleInputChange} />
                            <Field section="family" isEditing={isEditing} label="Total Siblings" field="totalSiblings" type="number" value={profile.family?.totalSiblings} formData={formData} onChange={handleInputChange} />
                            <Field section="personal" isEditing={isEditing} label="Date of Marriage" field="dateOfMarriage" type="date" value={profile.personal?.dateOfMarriage} formData={formData} onChange={handleInputChange} />
                            <Field section="family" isEditing={isEditing} label="Spouse Name" field="spouseName" value={profile.family?.spouseName} formData={formData} onChange={handleInputChange} />
                            <Field section="family" isEditing={isEditing} label="Spouse DOB" field="spouseDob" type="date" value={profile.family?.spouseDob} formData={formData} onChange={handleInputChange} />

                        </div>

                        {/* Children List */}
                        <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-700">Children Details</h4>
                                {isEditing && (
                                    <button
                                        onClick={() => setFormData(prev => ({ ...prev, family: { ...prev.family, children: [...(prev.family?.children || []), { name: '', dob: '' }] } }))}
                                        className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-100"
                                    >
                                        + Add Child
                                    </button>
                                )}
                            </div>
                            <div className="space-y-3">
                                {(formData.family?.children || profile.family?.children || []).map((child, idx) => (
                                    <div key={idx} className="flex gap-4 items-end bg-white p-3 rounded border border-slate-200">
                                        <div className="flex-1">
                                            <Field section="family" isEditing={isEditing} label="Child's Name" field={`child_${idx}_name`}
                                                value={child.name} valueOverride={formData.family?.children?.[idx]?.name}
                                                onChangeOverride={(e) => {
                                                    const newChildren = [...(formData.family?.children || [])];
                                                    newChildren[idx] = { ...newChildren[idx], name: e.target.value };
                                                    handleInputChange('family', 'children', newChildren);
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Field section="family" isEditing={isEditing} label="Date of Birth" field={`child_${idx}_dob`}
                                                value={child.dob} valueOverride={formData.family?.children?.[idx]?.dob} type="date"
                                                onChangeOverride={(e) => {
                                                    const newChildren = [...(formData.family?.children || [])];
                                                    newChildren[idx] = { ...newChildren[idx], dob: e.target.value };
                                                    handleInputChange('family', 'children', newChildren);
                                                }}
                                            />
                                        </div>
                                        {isEditing && (
                                            <button
                                                onClick={() => {
                                                    const newChildren = formData.family?.children.filter((_, i) => i !== idx);
                                                    handleInputChange('family', 'children', newChildren);
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 8. Education */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <div className="flex items-center space-x-2">
                                <FileText size={18} className="text-blue-500" />
                                <h3 className="font-bold text-slate-700">8. Educational Qualification</h3>
                            </div>
                            {isEditing && (
                                <button
                                    onClick={() => addArrayItem('education', { institution: '', degree: '', grade: '' })}
                                    className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-200"
                                >
                                    + Add Education
                                </button>
                            )}
                        </div>
                        <div className="space-y-6">
                            {(formData.education || profile.education || []).map((edu, idx) => (
                                <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex gap-6">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                                        <Field section="education" isEditing={isEditing} label="Institution" field={`inst_${idx}`}
                                            value={edu.institution} valueOverride={formData.education?.[idx]?.institution}
                                            onChangeOverride={(e) => handleArrayChange('education', idx, 'institution', e.target.value)}
                                        />
                                        <Field section="education" isEditing={isEditing} label="University" field={`univ_${idx}`}
                                            value={edu.university} valueOverride={formData.education?.[idx]?.university}
                                            onChangeOverride={(e) => handleArrayChange('education', idx, 'university', e.target.value)}
                                        />
                                        <Field section="education" isEditing={isEditing} label="Degree" field={`deg_${idx}`}
                                            value={edu.degree} valueOverride={formData.education?.[idx]?.degree}
                                            onChangeOverride={(e) => handleArrayChange('education', idx, 'degree', e.target.value)}
                                        />
                                        <Field section="education" isEditing={isEditing} label="Course Name" field={`course_${idx}`}
                                            value={edu.courseName} valueOverride={formData.education?.[idx]?.courseName}
                                            onChangeOverride={(e) => handleArrayChange('education', idx, 'courseName', e.target.value)}
                                        />
                                        <Field section="education" isEditing={isEditing} label="Grade/CGPA" field={`grade_${idx}`}
                                            value={edu.grade} valueOverride={formData.education?.[idx]?.grade}
                                            onChangeOverride={(e) => handleArrayChange('education', idx, 'grade', e.target.value)}
                                        />
                                        <Field section="education" isEditing={isEditing} label="College Rank" field={`rank_${idx}`}
                                            value={edu.collegeRank} valueOverride={formData.education?.[idx]?.collegeRank}
                                            onChangeOverride={(e) => handleArrayChange('education', idx, 'collegeRank', e.target.value)}
                                        />
                                        <Field section="education" isEditing={isEditing} label="From Date" field={`from_${idx}`} type="date"
                                            value={edu.fromDate} valueOverride={formData.education?.[idx]?.fromDate}
                                            onChangeOverride={(e) => handleArrayChange('education', idx, 'fromDate', e.target.value)}
                                        />
                                        <Field section="education" isEditing={isEditing} label="To Date" field={`to_${idx}`} type="date"
                                            value={edu.toDate} valueOverride={formData.education?.[idx]?.toDate}
                                            onChangeOverride={(e) => handleArrayChange('education', idx, 'toDate', e.target.value)}
                                        />
                                    </div>
                                    {isEditing && (
                                        <button onClick={() => removeArrayItem('education', idx)} className="self-center p-2 text-red-500"><Trash2 size={18} /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 9. Experience */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <div className="flex items-center space-x-2">
                                <Briefcase size={18} className="text-blue-500" />
                                <h3 className="font-bold text-slate-700">9. Work Experience</h3>
                            </div>
                            {isEditing && (
                                <button
                                    onClick={() => addArrayItem('experience', { companyName: '', designation: '', startDate: '', endDate: '' })}
                                    className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-200"
                                >
                                    + Add Work History
                                </button>
                            )}
                        </div>
                        <div className="space-y-6">
                            {(formData.experience || profile.experience || []).map((exp, idx) => (
                                <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex gap-6">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                                        <Field section="experience" isEditing={isEditing} label="Company Name" field={`comp_${idx}`}
                                            value={exp.companyName} valueOverride={formData.experience?.[idx]?.companyName}
                                            onChangeOverride={(e) => handleArrayChange('experience', idx, 'companyName', e.target.value)}
                                        />
                                        <Field section="experience" isEditing={isEditing} label="Designation" field={`desig_${idx}`}
                                            value={exp.designation} valueOverride={formData.experience?.[idx]?.designation}
                                            onChangeOverride={(e) => handleArrayChange('experience', idx, 'designation', e.target.value)}
                                        />
                                        <Field section="experience" isEditing={isEditing} label="Start Date" field={`start_${idx}`} type="date"
                                            value={exp.startDate} valueOverride={formData.experience?.[idx]?.startDate}
                                            onChangeOverride={(e) => handleArrayChange('experience', idx, 'startDate', e.target.value)}
                                        />
                                        <Field section="experience" isEditing={isEditing} label="End Date" field={`end_${idx}`} type="date"
                                            value={exp.endDate} valueOverride={formData.experience?.[idx]?.endDate}
                                            onChangeOverride={(e) => handleArrayChange('experience', idx, 'endDate', e.target.value)}
                                        />
                                        <Field section="experience" isEditing={isEditing} label="Total Work Experience" field={`total_${idx}`}
                                            value={exp.totalExperience} valueOverride={formData.experience?.[idx]?.totalExperience}
                                            onChangeOverride={(e) => handleArrayChange('experience', idx, 'totalExperience', e.target.value)}
                                        />
                                    </div>
                                    {isEditing && (
                                        <button onClick={() => removeArrayItem('experience', idx)} className="self-center p-2 text-red-500"><Trash2 size={18} /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 10. Skills */}
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                            <Shield size={18} className="text-blue-500" />
                            <h3 className="font-bold text-slate-700">10. Skills Information</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                {isEditing ? (
                                    <SkillsInput
                                        label="Technical Skills"
                                        skills={formData.skills?.technical || []}
                                        onUpdate={(newSkills) => handleInputChange('skills', 'technical', newSkills)}
                                        placeholder="e.g. React, Node.js"
                                    />
                                ) : (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Technical Skills</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(profile.skills?.technical || []).map((s, i) => <span key={`${s}-${i}`} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100">{s}</span>)}
                                            {profile.skills?.technical?.length === 0 && <span className="text-slate-400 italic text-sm">Not specified</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                {isEditing ? (
                                    <SkillsInput
                                        label="Behavioral Skills"
                                        skills={formData.skills?.behavioral || []}
                                        onUpdate={(newSkills) => handleInputChange('skills', 'behavioral', newSkills)}
                                        placeholder="e.g. Leadership, Teamwork"
                                    />
                                ) : (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Behavioral Skills</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(profile.skills?.behavioral || []).map((s, i) => <span key={`${s}-${i}`} className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs border border-emerald-100">{s}</span>)}
                                            {profile.skills?.behavioral?.length === 0 && <span className="text-slate-400 italic text-sm">Not specified</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                {isEditing ? (
                                    <SkillsInput
                                        label="Skill you would like to learn"
                                        skills={formData.skills?.learningInterests || []}
                                        onUpdate={(newSkills) => handleInputChange('skills', 'learningInterests', newSkills)}
                                        placeholder="e.g. AI, Machine Learning"
                                    />
                                ) : (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Skill you would like to learn</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(profile.skills?.learningInterests || []).map((s, i) => <span key={`${s}-${i}`} className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs border border-purple-100">{s}</span>)}
                                            {profile.skills?.learningInterests?.length === 0 && <span className="text-slate-400 italic text-sm">Not specified</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 11. Declaration */}
                    <div className="mt-10 pt-10 border-t border-slate-200">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col items-center text-center">
                            <h3 className="font-bold text-slate-800 text-lg mb-2">11. Final Declaration</h3>
                            <p className="text-sm text-slate-600 max-w-2xl mb-6">
                                I hereby declare that all the information provided above is true and accurate to the best of my knowledge.
                                I understand that any false information may lead to disciplinary action or termination of employment.
                            </p>
                            {isEditing ? (
                                <div className="space-y-4 flex flex-col items-center">
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={formData.hris?.isDeclared}
                                            onChange={(e) => handleInputChange('hris', 'isDeclared', e.target.checked)}
                                            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 group-hover:border-blue-400 transition"
                                        />
                                        <span className="text-sm font-semibold text-slate-700 select-none">I agree to the declaration</span>
                                    </label>
                                    {formData.hris?.isDeclared && (
                                        <p className="text-xs text-blue-600 font-medium animate-pulse">
                                            Ready to submit! Click "Submit for Approval" to finish.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4 flex flex-col items-center">
                                    <div className="flex items-center text-emerald-600 space-x-2 font-bold bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                                        <CheckCircle size={20} />
                                        <span>{profile.hris?.isDeclared ? `Declared on ${format(new Date(profile.hris.declarationDate || profile.updatedAt), 'dd MMM yyyy')}` : 'Not Declared Yet'}</span>
                                    </div>
                                    {profile.hris?.isDeclared && (hrisStatus === 'Draft' || hrisStatus === 'Rejected') && (
                                        <Button onClick={handleHRISSave} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center">
                                            <Shield size={18} className="mr-2" /> Submit HRIS for Approval
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {
                    isEditing && (
                        <div className="flex justify-end space-x-4 pt-8 mt-10 border-t border-slate-100">
                            <Button variants="ghost" onClick={() => { setEditMode(false); setFormData(profile); }}>Discard Changes</Button>
                            <Button onClick={handleHRISSave} isLoading={savingSection === 'hris'} className="px-8 flex items-center shadow-lg">
                                <Save size={18} className="mr-2" /> Complete & Save Form
                            </Button>
                        </div>
                    )
                }

                {/* Submit Logic Moved to Bottom */}
                {!isEditing && (hrisStatus === 'Draft' || hrisStatus === 'Rejected' || hrisStatus === 'Approved') && (profile.hris?.isDeclared || (currentUser?.roles?.some(r => r.name === 'Admin'))) && (
                    <div className="flex justify-end pt-8 mt-10 border-t border-slate-100">
                        <Button onClick={() => handleHRISSave()} className="bg-blue-600 hover:bg-blue-700 text-white border-none shadow-lg px-6 py-2.5 flex items-center">
                            <Shield size={18} className="mr-2" /> {profile.hris?.isDeclared ? 'Submit for Approval' : 'Submit as Admin'}
                        </Button>
                    </div>
                )}
            </div >
        );
    };

    const renderHistory = () => {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Activity History</h3>

                {historyLogs.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">No history available</div>
                ) : (
                    <div className="relative border-l border-slate-200 ml-3 space-y-8 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {historyLogs.map((log, idx) => (
                            <div key={log._id || idx} className="ml-6 relative">
                                <span className="absolute -left-[31px] bg-blue-100 h-4 w-4 rounded-full border-2 border-white ring-1 ring-blue-500"></span>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-sm font-semibold text-slate-800">
                                            {log.action === 'UPDATE_DOSSIER' ? `Updated ${log.details?.section || 'Dossier'}` :
                                                log.action === 'UPLOAD_DOCUMENT' ? 'Uploaded Document' : log.action}
                                        </p>
                                        <span className="text-xs text-slate-400 whitespace-nowrap">
                                            {format(new Date(log.createdAt), 'dd MMM yyyy, hh:mm a')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">
                                        by <span className="font-medium text-slate-700">
                                            {log.performedBy ? `${log.performedBy.firstName} ${log.performedBy.lastName}` : 'Unknown'}
                                        </span>
                                    </p>

                                    {log.details?.updates && (
                                        <div className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 mt-2">
                                            <div className="font-semibold mb-1">Changes:</div>
                                            {Array.isArray(log.details.updates) ? (
                                                <span>{log.details.updates.join(', ')}</span>
                                            ) : (
                                                <ul className="list-disc ml-4 space-y-0.5">
                                                    {Object.entries(log.details.updates).map(([key, val]) => (
                                                        <li key={key}>
                                                            <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span> {val !== null && val !== undefined ? String(val) : <em className="text-slate-400">Empty</em>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                    {log.details?.docTitle && (
                                        <div className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 mt-2">
                                            Document: <span className="font-medium">{log.details.docTitle}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderHRISRequests = () => {
        const filtered = hrisRequests.filter(req =>
            `${req.firstName} ${req.lastName}`.toLowerCase().includes(hrisSearchTerm.toLowerCase()) ||
            req.employeeCode?.toLowerCase().includes(hrisSearchTerm.toLowerCase())
        );

        return (
            <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">HRIS Requests Management</h3>
                            <p className="text-sm text-slate-500">View and manage HRIS submissions history</p>
                        </div>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={hrisSearchTerm}
                                onChange={(e) => setHrisSearchTerm(e.target.value)}
                                placeholder="Search by name or code..."
                                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none w-64"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-4 py-3">Employee</th>
                                    <th className="px-4 py-3">Dept</th>
                                    <th className="px-4 py-3">Submitted</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loadingRequests ? (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-10 text-center">
                                            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                                            <p className="text-slate-500">Fetching requests...</p>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-10 text-center text-slate-500 italic">
                                            No HRIS requests found
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(req => (
                                        <tr key={req._id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-800">{req.firstName} {req.lastName}</div>
                                                <div className="text-[11px] text-slate-500 font-medium">{req.employeeCode}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{req.department || '-'}</td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {req.employeeProfile?.hris?.submittedAt ? format(new Date(req.employeeProfile.hris.submittedAt), 'dd MMM yyyy') : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="scale-75 origin-left w-32">
                                                    {getStatusBadge(req.employeeProfile?.hris?.status)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end space-x-2">
                                                    {req.employeeProfile?.hris?.status === 'Pending Approval' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleHRISApproveOther(req._id)}
                                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                                                title="Approve"
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleHRISRejectOther(req._id)}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                                title="Reject"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            navigate(`/dossier/${req._id}`);
                                                            setActiveTab('hris');
                                                        }}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                        title="View Form"
                                                    >
                                                        <FileText size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleExcelExport(req._id)}
                                                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
                                                        title="Download Excel"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    // Loading State
    if (loading) return (
        <div className="min-h-screen bg-slate-50 p-6 flex justify-center">
            <div className="max-w-5xl w-full space-y-4">
                <Skeleton className="h-40 w-full rounded-xl" />
                <div className="flex space-x-4">
                    <Skeleton className="h-64 w-1/4 rounded-lg" />
                    <Skeleton className="h-64 w-3/4 rounded-lg" />
                </div>
            </div>
        </div>
    );

    return (
        <div className={embedded ? "w-full font-sans" : "min-h-screen bg-slate-50 font-sans"}>
            {/* Top Navigation Bar - Hidden if embedded */}
            {!embedded && (
                <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-lg font-bold text-slate-800">Employee Dossier</h1>
                    </div>
                </div>
            )}

            <div className={embedded ? "w-full" : "max-w-6xl mx-auto p-6 md:p-8"}>

                {/* Tabs */}
                <div className="mb-8 overflow-x-auto">
                    <div className="flex space-x-1 border-b border-slate-200 min-w-max">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                <tab.icon size={16} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="min-h-[400px]">

                    {activeTab === 'personal' && renderPersonal()}
                    {activeTab === 'employment' && renderEmployment()}

                    {activeTab === 'documents' && renderDocuments()}
                    {activeTab === 'hris' && renderHRIS()}
                    {activeTab === 'history' && renderHistory()}
                    {activeTab === 'requests' && renderHRISRequests()}
                </div>



            </div>
        </div>
    );
};

export default EmployeeDossier;
