import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
    User, Briefcase, FileText, DollarSign, Calendar, Shield,
    ArrowLeft, Save, Upload, Download, Trash2, CheckCircle, AlertCircle, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { format } from 'date-fns';
import Button from '../components/Button';

// Helper Components defined outside to prevent re-renders
const Field = ({ label, value, section, field, type = "text", options = null, isEditing, hideIfEmpty, onChangeOverride, valueOverride, placeholder, formData, onChange, maxLength, error }) => {
    if (!isEditing && !value && hideIfEmpty) return null;

    const currentValue = valueOverride !== undefined ? valueOverride : (formData?.[section]?.[field] || '');
    const handleChange = onChangeOverride || ((e) => onChange(section, field, e.target.value));

    return (
        <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
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

const SectionCard = ({ title, sectionName, icon: Icon, children, editMode, setEditMode, onSave, isLoading }) => {
    const isEditing = editMode === sectionName;
    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                    {Icon && <Icon size={20} className="text-slate-400" />}
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                </div>
                {!isEditing ? (
                    <button onClick={() => setEditMode(sectionName)} className="text-sm bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md font-medium transition flex items-center border border-slate-200">
                        <Save size={14} className="mr-1.5" /> Edit
                    </button>
                ) : (
                    <div className="flex space-x-2">
                        <Button variants="ghost" onClick={() => setEditMode(false)} disabled={isLoading} className="text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancel</Button>
                        <Button onClick={() => onSave(sectionName)} isLoading={isLoading} className="px-3 py-1.5 shadow-sm">Save</Button>
                    </div>
                )}
            </div>
            {children(isEditing)}
        </div>
    );
};

const EmployeeDossier = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    // State
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
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
    const [showUploadPreview, setShowUploadPreview] = useState(false);
    const [uploadCategory, setUploadCategory] = useState(null);
    const fileInputRef = useRef(null);

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file || !uploadingDocTitle) return;

        let category = 'Other';
        const titleLower = uploadingDocTitle.toLowerCase();

        if (titleLower.includes('aadhaar') || titleLower.includes('pan')) category = 'ID Proof';
        else if (titleLower.includes('marksheet') || titleLower.includes('certificate')) category = 'Education';
        else if (titleLower.includes('resume')) category = 'Resume';
        else if (titleLower.includes('offer letter')) category = 'Offer Letter';
        else if (titleLower.includes('appointment')) category = 'Appointment Letter';
        else if (titleLower.includes('experience')) category = 'Employment';

        setPreviewFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setUploadCategory(category);
        setShowUploadPreview(true);
    };

    const handleCancelUpload = () => {
        setPreviewFile(null);
        setPreviewUrl(null);
        setUploadCategory(null);
        setShowUploadPreview(false);
        setUploadingDocTitle(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmUpload = async () => {
        if (!previewFile || !uploadingDocTitle) return;

        const formData = new FormData();
        formData.append('file', previewFile);
        formData.append('title', uploadingDocTitle);
        formData.append('category', uploadCategory);

        try {
            setIsUploading(true);
            const toastId = toast.loading('Uploading document...');
            await api.post(`/dossier/${userId}/documents`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.dismiss(toastId);
            toast.success('Document uploaded successfully');
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
            fetchDossier(); // Refresh
            if (activeTab === 'history') fetchHistory();
        } catch (error) {
            console.error('Delete failed', error);
            toast.error('Failed to delete document');
        } finally {
            setDeletingDocId(null);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await api.get(`/dossier/${userId}/history`);
            setHistoryLogs(res.data);
        } catch (error) {
            console.error('Failed to fetch history', error);
            toast.error('Could not load history');
        }
    };

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, userId]);

    // Fetch Dossier Data
    const fetchDossier = async () => {
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
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) fetchDossier();
    }, [userId]);

    // Handle Tab Change
    const tabs = [
        { id: 'overview', label: 'Overview', icon: User },
        { id: 'personal', label: 'Personal', icon: User },
        { id: 'employment', label: 'Employment', icon: Briefcase },
        { id: 'financials', label: 'Financials', icon: DollarSign },
        { id: 'documents', label: 'Documents', icon: FileText },
        { id: 'history', label: 'History', icon: Calendar },
    ];

    // Handle Input Change for nested objects
    const handleInputChange = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
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
            }
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
                }
            };
        });
    };

    // Save Changes
    const handleSave = async (section) => {
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

    const renderOverview = () => {
        if (!profile) return null;

        // Completion Calculation
        const fields = [
            profile.personal?.dob, profile.personal?.gender,
            profile.contact?.mobileNumber, profile.contact?.personalEmail,
            profile.employment?.joiningDate, profile.documents?.length > 0
        ];
        const completed = fields.filter(Boolean).length;
        const total = fields.length;
        const percent = Math.round((completed / total) * 100);

        return (
            <div className="space-y-6">
                {/* Profile Header Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start space-x-6">
                    <div className="h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center text-3xl font-bold text-slate-400 border-4 border-white shadow-sm">
                        {profile.personal?.photo ? (
                            <img src={profile.personal.photo} alt="Profile" className="h-full w-full rounded-full object-cover" />
                        ) : (
                            <span>{profile.user?.firstName?.charAt(0) || 'U'}</span>
                        )}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-slate-800">
                            {/* Getting name from populated user object if available, otherwise fallback */}
                            {profile.user?.firstName || 'Employee'} {profile.user?.lastName}
                        </h2>
                        <div className="flex items-center space-x-4 mt-2 text-slate-600 text-sm">
                            <span className="flex items-center">
                                <Briefcase size={14} className="mr-1" />
                                {profile.employment?.designation || profile.user?.roles?.[0]?.name || 'Assign Role'}
                            </span>
                            <span className="flex items-center"><Shield size={14} className="mr-1" /> {profile.employment?.status || 'Active'}</span>
                            <span className="flex items-center">
                                <Calendar size={14} className="mr-1" />
                                Joined: {(profile.employment?.joiningDate || profile.user?.joiningDate) ? format(new Date(profile.employment?.joiningDate || profile.user?.joiningDate), 'dd MMM yyyy') : 'N/A'}
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4 max-w-md">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-semibold text-slate-500">Profile Completion</span>
                                <span className="font-bold text-emerald-600">{percent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Complete your profile to unlock all features.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center"><User size={18} className="mr-2" /> Essential Info</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                <span className="text-slate-500">Employee ID</span>
                                <span className="font-medium">{profile.user?.employeeCode || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                <span className="text-slate-500">Email (Work)</span>
                                <span className="font-medium">{profile.user?.email || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                <span className="text-slate-500">Department</span>
                                <span className="font-medium">{profile.employment?.department || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between pb-2">
                                <span className="text-slate-500">Reporting To</span>
                                <span className="font-medium text-blue-600 cursor-pointer">
                                    {profile.employment?.reportingManager ?
                                        `${profile.employment.reportingManager.firstName} ${profile.employment.reportingManager.lastName}` :
                                        'None'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center"><AlertCircle size={18} className="mr-2" /> Pending Actions</h3>
                        {/* Placeholder for pending actions */}
                        {percent < 100 ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start">
                                <AlertCircle size={16} className="mt-0.5 mr-2 shrink-0" />
                                <div>
                                    <p className="font-semibold">Profile Incomplete</p>
                                    <p className="mt-1 text-xs">Please visit the 'Personal' and 'Documents' tabs to complete your dossier.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 flex items-center">
                                <CheckCircle size={16} className="mr-2" />
                                <span>All set! Your profile is up to date.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

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
                >
                    {(isEditing) => (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Field section="personal" isEditing={isEditing} label="Date of Birth" field="dob" value={profile.personal?.dob} type="date" formData={formData} onChange={handleInputChange} />
                            <Field section="personal" isEditing={isEditing} label="Gender" field="gender" value={profile.personal?.gender} options={['Male', 'Female', 'Other']} formData={formData} onChange={handleInputChange} />
                            <Field section="personal" isEditing={isEditing} label="Marital Status" field="maritalStatus" value={profile.personal?.maritalStatus} options={['Single', 'Married', 'Divorced', 'Widowed']} formData={formData} onChange={handleInputChange} />
                            <Field section="personal" isEditing={isEditing} label="Nationality" field="nationality" value={profile.personal?.nationality} formData={formData} onChange={handleInputChange} />
                            <Field section="personal" isEditing={isEditing} label="Blood Group" field="bloodGroup" value={profile.personal?.bloodGroup} formData={formData} onChange={handleInputChange} />
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
                            />
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
                >
                    {(isEditing) => (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field section="contact" isEditing={isEditing} label="Personal Email" field="personalEmail" value={profile.contact?.personalEmail} formData={formData} onChange={handleInputChange} />
                                <Field
                                    section="contact" isEditing={isEditing} label="Mobile Number" field="mobileNumber"
                                    value={profile.contact?.mobileNumber} formData={formData}
                                    maxLength={10}
                                    error={formData.contact?.mobileNumber?.length > 0 && formData.contact?.mobileNumber?.length < 10 ? 'Must be 10 digits' : null}
                                    onChangeOverride={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        handleInputChange('contact', 'mobileNumber', val);
                                    }}
                                />
                                <Field
                                    section="contact" isEditing={isEditing} label="Alternate Number" field="alternateNumber"
                                    value={profile.contact?.alternateNumber} hideIfEmpty formData={formData}
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
                                    />
                                    <Field
                                        section="contact" isEditing={isEditing}
                                        label="Relation" field="EC_relation"
                                        value={profile.contact?.emergencyContact?.relation}
                                        valueOverride={formData.contact?.emergencyContact?.relation}
                                        onChangeOverride={(e) => handleEmergencyChange('relation', e.target.value)}
                                        formData={formData} onChange={handleInputChange}
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
                                        <h4 className="text-sm font-bold text-slate-700 mb-4">Current Address</h4>
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
                                            <h4 className="text-sm font-bold text-slate-700">Permanent Address</h4>
                                            {isEditing && (
                                                <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                const current = getAddress('Current');
                                                                // Batch update all fields
                                                                ['street', 'addressLine2', 'city', 'state', 'zipCode', 'country'].forEach(field => {
                                                                    handleAddressChange('Permanent', field, current[field]);
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
                >
                    {(isEditing) => (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Field section="identity" isEditing={isEditing} label="Aadhaar Number" field="aadhaarNumber" value={profile.identity?.aadhaarNumber} formData={formData} onChange={handleInputChange} />
                            <Field section="identity" isEditing={isEditing} label="PAN Number" field="panNumber" value={profile.identity?.panNumber} formData={formData} onChange={handleInputChange} />
                            <Field section="identity" isEditing={isEditing} label="Passport Number" field="passportNumber" value={profile.identity?.passportNumber} formData={formData} onChange={handleInputChange} />
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
                        <div className="text-slate-800 font-medium">{profile.employment?.workLocation || 'Office'}</div>
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
        const requiredDocs = [
            'Aadhaar Card (Front)',
            'Aadhaar Card (Back)',
            'Pan Card',
            '10th Marksheet',
            '12th Marksheet',
            'Highest Qualification Certificate',
            'Highest Qualification Marksheet',
            'Experience Letter',
            'Resume',
            'Offer Letter',
            'Appointment Letter'
        ];

        return (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Documents</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileSelect}
                    />
                    {requiredDocs.map((docTitle) => {
                        const doc = profile.documents?.find(d => d.title.toLowerCase() === docTitle.toLowerCase());

                        if (doc) {
                            return (
                                <div key={docTitle} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition bg-slate-50/50">
                                    <div className="flex items-start justify-between">
                                        <div className="p-2 bg-white rounded-md border border-slate-100 shadow-sm text-blue-500">
                                            <FileText size={24} />
                                        </div>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${doc.verificationStatus === 'Verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {doc.verificationStatus}
                                        </span>
                                    </div>
                                    <h4 className="mt-3 font-semibold text-slate-800 truncate" title={doc.title}>{doc.title}</h4>
                                    <p className="text-xs text-slate-500 mb-1">{doc.category || 'Document'} • {format(new Date(doc.uploadDate), 'dd MMM yyyy')}</p>
                                    {doc.fileName && (
                                        <p className="text-[10px] text-slate-400 truncate mb-3" title={doc.fileName}>{doc.fileName}</p>
                                    )}
                                    <div className={`flex space-x-2 ${!doc.fileName ? 'mt-4' : ''}`}>
                                        <button
                                            onClick={() => window.open(doc.url, '_blank')}
                                            className="flex-1 text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-1.5 rounded font-medium flex items-center justify-center"
                                        >
                                            <Download size={12} className="mr-1" /> View
                                        </button>
                                        <Button
                                            onClick={() => handleDeleteDocument(doc._id)}
                                            isLoading={deletingDocId === doc._id}
                                            variant="danger"
                                            className="text-xs bg-white border border-slate-200 hover:bg-red-50 text-red-600 px-3 py-1.5 shadow-sm"
                                            title="Delete Document"
                                        >
                                            <Trash2 size={12} />
                                        </Button>
                                    </div>
                                </div>
                            );
                        } else {
                            // Check if this document is currently being previewed
                            const isPreviewing = previewFile && uploadingDocTitle === docTitle;

                            if (isPreviewing) {
                                const isImage = previewFile.type.startsWith('image/');
                                return (
                                    <div key={docTitle} className="border border-blue-500 bg-white rounded-lg p-4 flex flex-col items-center justify-center text-center transition animate-in fade-in zoom-in duration-200 shadow-md">
                                        <div className="p-2 bg-blue-100 rounded-full text-blue-600 mb-2">
                                            <FileText size={20} />
                                        </div>
                                        <h4 className="font-semibold text-slate-700 text-sm mb-1 truncate max-w-full px-2">{previewFile.name}</h4>
                                        <div className="flex-1 w-full flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden mb-4 relative mt-2">
                                            {isImage ? (
                                                <img src={previewUrl} alt="Preview" className="max-w-full max-h-[250px] object-contain" />
                                            ) : (
                                                <iframe src={previewUrl} className="w-full h-[300px]" title="Preview" />
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleConfirmUpload}
                                                isLoading={isUploading}
                                                className="px-3 py-1.5 shadow-sm text-xs"
                                            >
                                                Submit
                                            </Button>
                                            <Button
                                                variants="ghost"
                                                onClick={handleCancelUpload}
                                                disabled={isUploading}
                                                className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 px-3 py-1.5 shadow-sm text-xs"
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={docTitle} className="border border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition min-h-[160px]">
                                    <div className="p-2 bg-slate-200 rounded-full text-slate-400 mb-2">
                                        <Upload size={20} />
                                    </div>
                                    <h4 className="font-semibold text-slate-700 text-sm mb-1">{docTitle}</h4>
                                    <p className="text-xs text-slate-400 mb-3">Not uploaded</p>
                                    <button
                                        onClick={() => triggerUpload(docTitle)}
                                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium shadow-sm"
                                    >
                                        Upload
                                    </button>
                                </div>
                            );
                        }
                    })}
                </div>
            </div>
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
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Top Navigation Bar */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-3 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-lg font-bold text-slate-800">Employee Dossier</h1>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-6 md:p-8">

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
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'personal' && renderPersonal()}
                    {activeTab === 'employment' && renderEmployment()}
                    {activeTab === 'financials' && (
                        <div className="bg-white p-10 text-center rounded-lg border border-dashed border-slate-300">
                            <DollarSign size={40} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-500 text-sm">Financials module under construction</p>
                        </div>
                    )}
                    {activeTab === 'documents' && renderDocuments()}
                    {activeTab === 'history' && renderHistory()}
                </div>



            </div>
        </div>
    );
};

export default EmployeeDossier;
