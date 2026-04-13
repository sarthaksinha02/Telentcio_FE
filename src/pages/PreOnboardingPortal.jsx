import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { CheckCircle, Clock, Upload, ChevronRight, ChevronLeft, LogOut, FileText, AlertTriangle, User, Phone, Building, CreditCard, FileSignature, Loader, Eye, Plus, X } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL}/api/onboarding`;

const ALL_STEPS = [
  { id: 'personalDetails', label: 'Personal & Contact', icon: <User size={18} />, hrLabel: 'Personal Details' },
  { id: 'emergencyContact', label: 'Emergency Contact', icon: <Phone size={18} />, hrLabel: 'Emergency Contact' },
  { id: 'documents', label: 'Documents', icon: <FileText size={18} />, hrLabel: 'Documents' },
  { id: 'bankDetails', label: 'Bank Details', icon: <CreditCard size={18} />, hrLabel: 'Bank Details' },
  { id: 'policies', label: 'Company Policies', icon: <FileText size={18} />, hrLabel: 'Policies' },
  { id: 'offerDeclaration', label: 'Offer Declaration', icon: <FileSignature size={18} />, hrLabel: 'Offer Declaration' }
];

const PreOnboardingPortal = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const autoSaveTimer = useRef(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extensionRequest, setExtensionRequest] = useState({ reason: '', requestedDays: 7 });
  const [docPreview, setDocPreview] = useState({}); // { docId: { file, previewUrl } }

  // Filtered Steps based on HR selection
  const [visibleSteps, setVisibleSteps] = useState(ALL_STEPS);

  // Memoized requested labels for easy access
  const reqSectionsLabels = React.useMemo(() => (profile?.requestedSections || []).map(rs => typeof rs === 'string' ? rs : rs.label), [profile]);
  const reqDocsLabels = React.useMemo(() => (profile?.requestedDocuments || []).map(rd => typeof rd === 'string' ? rd : rd.label), [profile]);

  const [offerAcceptedCheckbox, setOfferAcceptedCheckbox] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(10);
  const logoutTimerRef = useRef(null);

  useEffect(() => {
    if (profile) {
      // Use pre-calculated memo labels
      let filtered = ALL_STEPS;

      if (reqSectionsLabels.length > 0 || reqDocsLabels.length > 0) {
        filtered = ALL_STEPS.filter(step => {
          if (reqSectionsLabels.includes(step.hrLabel)) return true;
          if (step.id === 'documents') return profile.documents?.some(d => reqDocsLabels.includes(d.label));
          if (step.id === 'policies') return profile.companyPolicies?.some(p => reqDocsLabels.includes(p.name));
          if (step.id === 'offerDeclaration') {
            if (reqSectionsLabels.includes('Offer Declaration')) return true;
            return profile.dynamicTemplates?.some(t => reqDocsLabels.includes(t.name)) || reqDocsLabels.includes('Offer Letter');
          }
          return false;
        });
        if (filtered.length === 0) filtered = ALL_STEPS;
      }

      // Only update if the IDs have changed to avoid redundant re-renders
      setVisibleSteps(prev => {
        const prevIds = prev.map(s => s.id).join(',');
        const nextIds = filtered.map(s => s.id).join(',');
        return prevIds === nextIds ? prev : filtered;
      });
    }
  }, [profile, reqDocsLabels, reqSectionsLabels]);

  // Safety clamp to ensure currentStep is always within bounds of visibleSteps
  useEffect(() => {
    if (visibleSteps.length > 0 && currentStep >= visibleSteps.length) {
      setCurrentStep(visibleSteps.length - 1);
    }
  }, [visibleSteps, currentStep]);


  // Handle landing on specific step (e.g. Documents if flagged or specifically requested)
  const hasNavigatedInitial = useRef(false);
  useEffect(() => {
    if (profile && visibleSteps.length > 0 && !hasNavigatedInitial.current) {
      const flaggedDocs = profile.documents?.filter(d => d.status === 'Re-upload Required');
      
      // If there are flagged docs OR if documents were specifically requested (and not yet complete)
      if (flaggedDocs && flaggedDocs.length > 0) {
        const docStepIndex = visibleSteps.findIndex(s => s.id === 'documents');
        if (docStepIndex !== -1) setCurrentStep(docStepIndex);
      } else if (reqDocsLabels.length > 0) {
        // If documents were requested, check if the document section is actually complete
        const docStepIndex = visibleSteps.findIndex(s => s.id === 'documents');
        if (docStepIndex !== -1) {
          const isComplete = (() => {
            const targetDocs = profile?.documents?.filter(d => reqDocsLabels.includes(d.label)) || [];
            if (targetDocs.length === 0) return false;
            return targetDocs.every(d => (d.status === 'Uploaded' || d.status === 'Approved' || d.type === 'passport'));
          })();
          if (!isComplete) setCurrentStep(docStepIndex);
        }
      }
      hasNavigatedInitial.current = true;
    }
  }, [profile, reqDocsLabels, reqSectionsLabels, visibleSteps]);

  // Form states
  const [personalDetails, setPersonalDetails] = useState({});
  const [emergencyContact, setEmergencyContact] = useState({});
  const [bankDetails, setBankDetails] = useState({});
  const [offerDeclaration, setOfferDeclaration] = useState({});

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('onboardingToken');
    const headers = { Authorization: `Bearer ${token}` };
    const hostname = window.location.hostname;
    const urlParams = new URLSearchParams(window.location.search);
    let tenant = urlParams.get('tenant');
    const parts = hostname.split('.');
    if (!tenant && hostname.endsWith('localhost') && parts.length > 1 && parts[0] !== 'localhost') {
      tenant = parts[0];
    }
    if (tenant && !['telentcio', 'telentcio-demo', 'talentcio'].includes(tenant.toLowerCase())) {
      headers['x-tenant-id'] = tenant.toLowerCase();
    }
    return headers;
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/my-profile`, { headers: getHeaders() });
      setProfile(res.data);
      setPersonalDetails(res.data.personalDetails || {});
      setEmergencyContact(res.data.emergencyContact || {});
      setOfferDeclaration(res.data.offerDeclaration || {});
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error(err.response?.data?.message || 'Session expired');
        localStorage.removeItem('onboardingToken');
        navigate('/pre-onboarding/login');
      } else {
        toast.error('Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  }, [getHeaders, navigate]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Refresh token periodically (before 15 min expiry)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.post(`${API_URL}/refresh-token`, {}, { headers: getHeaders() });
        localStorage.setItem('onboardingToken', res.data.token);
      } catch { /* ignore */ }
    }, 12 * 60 * 1000); // every 12 min
    return () => clearInterval(interval);
  }, [getHeaders]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!unsavedChanges || !profile || profile.submittedAt) return;
    autoSaveTimer.current = setTimeout(() => {
      if (visibleSteps[currentStep]) {
        handleSaveSection(visibleSteps[currentStep].id, true);
      }
    }, 30000);
    return () => clearTimeout(autoSaveTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsavedChanges, personalDetails, emergencyContact, bankDetails, offerDeclaration, currentStep]);

  // Handle countdown for success screen
  useEffect(() => {
    if (showSuccessScreen && logoutCountdown > 0) {
      logoutTimerRef.current = setTimeout(() => {
        setLogoutCountdown(prev => prev - 1);
      }, 1000);
    } else if (showSuccessScreen && logoutCountdown === 0) {
      handleLogout();
    }
    return () => clearTimeout(logoutTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuccessScreen, logoutCountdown]);

  const getSectionData = (sectionId) => {
    switch (sectionId) {
      case 'personalDetails': return personalDetails;
      case 'emergencyContact': return emergencyContact;
      case 'bankDetails': return bankDetails;
      case 'offerDeclaration': return offerDeclaration;
      default: return {};
    }
  };

  const handleSaveSection = async (sectionId, isAuto = false, dataOverride = null) => {
    if (sectionId === 'documents') return; // docs are saved via uploads
    try {
      setSaving(true);
      const data = dataOverride || getSectionData(sectionId);
      await axios.patch(`${API_URL}/my-profile/${sectionId}`, data, { headers: getHeaders() });
      setUnsavedChanges(false);
      if (!isAuto) toast.success('Saved!');
      if (data.isComplete || data.hasReadPolicies) fetchProfile();
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/pre-onboarding/login');
      } else if (!isAuto) {
        toast.error('Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDocument = async (docId, file) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PDF, JPG, PNG allowed');
      return;
    }
    const fd = new FormData();
    fd.append('document', file);
    try {
      toast.loading('Uploading...', { id: `upload-${docId}` });
      await axios.post(`${API_URL}/my-profile/upload/${docId}`, fd, {
        headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' }
      });
      toast.dismiss(`upload-${docId}`);
      toast.success('Uploaded!');
      fetchProfile();
    } catch (err) {
      toast.dismiss(`upload-${docId}`);
      toast.error(err.response?.data?.message || 'Upload failed');
    }
  };

  const handleAddDocSlot = async (type, label) => {
    try {
      await axios.post(`${API_URL}/my-profile/add-document-slot`, { type, label }, { headers: getHeaders() });
      toast.success('Additional slot added!');
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add slot');
    }
  };

  const handleDeleteDocSlot = async (docId) => {
    try {
      await axios.delete(`${API_URL}/my-profile/delete-document-slot/${docId}`, { headers: getHeaders() });
      toast.success('Slot removed');
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove slot');
    }
  };

  const handleDownloadDynamicTemplate = async (templateId, name) => {
    try {
      toast.loading(`Preparing ${name}...`, { id: 'template-dl' });
      const res = await axios.get(`${API_URL}/my-profile/download-template/${templateId}`, {
        headers: getHeaders(),
        responseType: 'blob'
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${name.replace(/\s+/g, '_')}.docx`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Downloaded!', { id: 'template-dl' });
    } catch {
      toast.error('Download failed', { id: 'template-dl' });
    }
  };

  const handleAcceptTemplate = async (templateId) => {
    try {
      await axios.post(`${API_URL}/my-profile/templates/${templateId}/accept`, {}, { headers: getHeaders() });
      toast.success('Document accepted!');
      fetchProfile();
    } catch {
      toast.error('Failed to accept document');
    }
  };

  const handleUploadCheque = async (file) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('File size must be under 5MB'); return; }
    const fd = new FormData();
    fd.append('document', file);
    try {
      toast.loading('Uploading...', { id: 'cheque' });
      const res = await axios.post(`${API_URL}/my-profile/upload-cheque`, fd, {
        headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' }
      });
      toast.dismiss('cheque');
      toast.success('Uploaded!');
      setBankDetails(prev => ({ ...prev, cancelledChequeUrl: res.data.url }));
      fetchProfile();
    } catch {
      toast.dismiss('cheque');
      toast.error('Upload failed');
    }
  };

  const handleAcceptPolicy = async (policyId) => {
    try {
      await axios.post(`${API_URL}/my-profile/policies/${policyId}/accept`, {}, { headers: getHeaders() });
      toast.success('Policy accepted');
      fetchProfile();
    } catch {
      toast.error('Failed to accept policy');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Save current section first
      if (visibleSteps[currentStep]?.id !== 'documents') {
        await handleSaveSection(visibleSteps[currentStep].id);
      }
      await axios.post(`${API_URL}/my-profile/submit`, {}, { headers: getHeaders() });
      toast.success('Submitted successfully!');
      fetchProfile();
    } catch (err) {
      if (err.response?.data?.errors) {
        err.response.data.errors.forEach(e => toast.error(e));
      } else {
        toast.error(err.response?.data?.message || 'Submission failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const jumpToSubmit = async () => {
    if (visibleSteps[currentStep]?.id !== 'documents' && unsavedChanges) {
      await handleSaveSection(visibleSteps[currentStep].id, true);
    }
    setCurrentStep(visibleSteps.length - 1);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const handleLogout = () => {
    localStorage.removeItem('onboardingToken');
    localStorage.removeItem('onboardingEmployee');
    navigate('/pre-onboarding/login');
  };

  const handleRequestExtension = async (e) => {
    e.preventDefault();
    if (!extensionRequest.reason || !extensionRequest.requestedDays) return;
    try {
      setLoading(true);
      await axios.post(`${API_URL}/my-profile/request-extension`, extensionRequest, { headers: getHeaders() });
      toast.success('Extension request submitted! HR will review it soon.');
      setShowExtensionModal(false);
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request extension');
    } finally {
      setLoading(false);
    }
  };

  const [accepting, setAccepting] = useState(false);

  const handleDownloadDocx = async () => {
    try {
      toast.loading(`Downloading offer letter...`, { id: 'docx' });
      const res = await axios.get(`${API_URL}/my-offer-letter`, { headers: getHeaders(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `OfferLetter.docx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.dismiss('docx');
      toast.success('Downloaded!');
    } catch {
      toast.dismiss('docx');
      toast.error('Download failed');
    }
  };

  const handleAcceptOffer = async () => {
    try {
      setAccepting(true);
      await axios.post(`${API_URL}/my-profile/accept-offer`, {}, { headers: getHeaders() });
      toast.success('Offer Accepted!');
      
      // Fetch fresh profile to see if there are other sections to fill
      const res = await axios.get(`${API_URL}/my-profile`, { headers: getHeaders() });
      setProfile(res.data);
      
      // Check progress of the newly fetched profile
      const updatedProgress = calculateProgress(res.data);
      if (updatedProgress === 100) {
        setShowSuccessScreen(true);
      } else {
        // If not 100%, reveal the form and land on the first incomplete visible step
        // (The conditional rendering in the main return will now skip the Welcome screen 
        // because offerStatus is 'Accepted')
        const newVisibleSteps = ALL_STEPS.filter(step => {
          const rsLabels = (res.data.requestedSections || []).map(rs => typeof rs === 'string' ? rs : rs.label);
          const rdLabels = (res.data.requestedDocuments || []).map(rd => typeof rd === 'string' ? rd : rd.label);
          if (rsLabels.includes(step.hrLabel)) return true;
          if (step.id === 'documents') return res.data.documents?.some(d => rdLabels.includes(d.label));
          if (step.id === 'policies') return res.data.companyPolicies?.some(p => rdLabels.includes(p.name));
          if (step.id === 'offerDeclaration') return res.data.dynamicTemplates?.some(t => rdLabels.includes(t.name)) || rdLabels.includes('Offer Letter');
          return false;
        });

        const firstIncompleteIdx = newVisibleSteps.findIndex(step => !isStepComplete(step, res.data));
        if (firstIncompleteIdx !== -1) setCurrentStep(firstIncompleteIdx);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept offer');
    } finally {
      setAccepting(false);
    }
  };

  const getDeadlineInfo = () => {
    if (!profile?.documentDeadline) return null;
    const deadline = new Date(profile.documentDeadline);
    const now = new Date();
    const diff = deadline - now;
    if (diff <= 0) return { text: 'Deadline passed!', color: '#ef4444', urgent: true };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return {
      text: `${days}d ${hours}h remaining`,
      color: days <= 2 ? '#f59e0b' : '#10b981',
      urgent: days <= 2,
      passed: false
    };
  };

  const hasPendingExtension = profile?.extensionRequests?.some(r => r.status === 'Pending');
  const isGlobalReadOnly = profile?.status === 'Submitted' || profile?.status === 'Reviewed';
  
  const isSectionReadOnly = (sectionId) => {
    const labelMap = { personalDetails: 'Personal Details', emergencyContact: 'Emergency Contact', bankDetails: 'Bank Details', offerDeclaration: 'Offer Declaration' };
    const reqLabels = (profile?.requestedSections || []).map(rs => typeof rs === 'string' ? rs : rs.label);
    
    // PRIORITY 1: If the section was marked as complete by the candidate, it's read-only.
    // (This ensures previously filled sections stay locked even during document resubmission)
    // We check local state first for immediate UI responsiveness.
    let isComplete = false;
    if (sectionId === 'personalDetails') isComplete = !!personalDetails?.isComplete;
    else if (sectionId === 'emergencyContact') isComplete = !!emergencyContact?.isComplete;
    else if (sectionId === 'bankDetails') isComplete = !!bankDetails?.isComplete;
    else if (sectionId === 'offerDeclaration') isComplete = !!offerDeclaration?.isComplete;
    else {
      // Fallback to profile for non-form sections
      isComplete = sectionId === 'personalDetails' ? !!profile?.personalDetails?.isComplete :
        sectionId === 'emergencyContact' ? !!profile?.emergencyContact?.isComplete :
        sectionId === 'bankDetails' ? !!profile?.bankDetails?.isComplete :
        sectionId === 'offerDeclaration' ? !!profile?.offerDeclaration?.isComplete : false;
    }

    if (isComplete) return true;

    // PRIORITY 2: If HR explicitly requested this section (and it is NOT complete), it MUST be editable.
    if (reqLabels.includes(labelMap[sectionId])) return false;
    
    // PRIORITY 3: Global read-only status for submitted/reviewed profiles.
    return isGlobalReadOnly;
  };
  const isReadOnly = isGlobalReadOnly;
  const deadlineInfo = getDeadlineInfo();

  const isStepComplete = (step, customProfile = null) => {
    const p = customProfile || profile;
    if (!p) return false;
    const rdLabels = (p.requestedDocuments || []).map(rd => typeof rd === 'string' ? rd : rd.label);

    switch (step.id) {
      case 'personalDetails': return !!p.personalDetails?.isComplete;
      case 'emergencyContact': return !!p.emergencyContact?.isComplete;
      case 'bankDetails': return !!p.bankDetails?.isComplete;
      case 'offerDeclaration': return !!p.offerDeclaration?.isComplete;
      case 'documents': {
        const targetDocs = p.documents?.filter(d => rdLabels.length === 0 || rdLabels.includes(d.label)) || [];
        if (targetDocs.length === 0) return true;
        return targetDocs.every(d => (d.status === 'Uploaded' || d.status === 'Approved' || d.type === 'passport'));
      }
      case 'policies': {
        const targetPolicies = p.companyPolicies?.filter(p => rdLabels.length === 0 || rdLabels.includes(p.name)) || [];
        if (targetPolicies.length === 0) return true;
        return targetPolicies.every(pol => !pol.isRequired || p.offerDeclaration?.acceptedPolicies?.some(ap => ap.policyId === pol._id));
      }
      default: return false;
    }
  };

  const calculateProgress = (customProfile = null) => {
    const p = customProfile || profile;
    if (!p || visibleSteps.length === 0) return 0;
    
    let completedCount = 0;
    visibleSteps.forEach(step => {
      if (isStepComplete(step, p)) completedCount++;
    });

    return Math.round((completedCount / visibleSteps.length) * 100);
  };

  const currentProgress = calculateProgress();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <Loader className="animate-spin" size={32} style={{ color: '#3b82f6' }} />
      </div>
    );
  }

  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: isReadOnly ? '#f1f5f9' : '#fff' };
  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' };

  const markChange = () => setUnsavedChanges(true);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <Toaster position="top-right" />

      {/* Top Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>{profile?.firstName} {profile?.lastName}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{profile?.tempEmployeeId} • {profile?.designation}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {deadlineInfo && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: deadlineInfo.urgent ? '#fef2f2' : '#f0fdf4', border: `1px solid ${deadlineInfo.urgent ? '#fecaca' : '#bbf7d0'}` }}>
                <Clock size={14} style={{ color: deadlineInfo.color }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: deadlineInfo.color }}>{deadlineInfo.text}</span>
              </div>
              {!isReadOnly && (deadlineInfo.urgent || deadlineInfo.passed) && (
                <button
                  onClick={() => setShowExtensionModal(true)}
                  disabled={hasPendingExtension}
                  style={{ background: 'none', border: 'none', color: hasPendingExtension ? '#94a3b8' : '#3b82f6', fontSize: '11px', fontWeight: '600', cursor: hasPendingExtension ? 'not-allowed' : 'pointer', marginTop: '4px', textDecoration: 'underline' }}
                >
                  {hasPendingExtension ? 'Extension Requested' : 'Request Extension'}
                </button>
              )}
            </div>
          )}
          {saving && <span style={{ fontSize: '12px', color: '#94a3b8' }}>Auto-saving...</span>}
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* Submitted Banner */}
      {isReadOnly && (
        <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', padding: '16px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CheckCircle size={20} />
            <strong>Your onboarding form has been submitted!</strong>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
            Submitted on {new Date(profile.submittedAt).toLocaleString('en-IN')}. Your form is now read-only.
          </p>
        </div>
      )}

      {/* Ready to Submit Banner */}
      {!isReadOnly && currentProgress === 100 && (
        <div style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', padding: '16px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CheckCircle size={20} />
            <strong>You've completed all sections!</strong>
            <button
              onClick={currentStep === visibleSteps.length - 1 ? handleSubmit : jumpToSubmit}
              disabled={submitting}
              style={{ background: '#fff', color: '#2563eb', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: submitting ? 'wait' : 'pointer', marginLeft: '12px' }}
            >
              {submitting ? 'Submitting...' : currentStep === visibleSteps.length - 1 ? 'Submit Now' : 'Go to Final Step & Submit'}
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        {showSuccessScreen ? (
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '60px 40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ width: '80px', height: '80px', background: '#ecfdf5', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle size={48} />
            </div>
            <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px' }}>Welcome to the Team!</h2>
            <p style={{ fontSize: '18px', color: '#475569', margin: '0 0 32px', lineHeight: '1.6' }}>
              Your offer has been successfully accepted. We are thrilled to have you on board!
            </p>
            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                You will be automatically logged out in <strong style={{ color: '#0f172a', fontSize: '18px' }}>{logoutCountdown}</strong> seconds...
              </p>
              <button onClick={handleLogout} style={{ marginTop: '16px', background: 'none', border: 'none', color: '#3b82f6', fontWeight: '600', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>
                Logout Now
              </button>
            </div>
          </div>
        ) : ((profile?.offerStatus === 'Pending' && (reqDocsLabels.includes('Offer Letter') || profile.dynamicTemplates?.some(t => reqDocsLabels.includes(t.name)) || (reqDocsLabels.length === 0 && reqSectionsLabels.length === 0))) || profile?.offerStatus === 'Rejected') ? (
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '40px', textAlign: 'center' }}>
            {profile?.offerStatus === 'Rejected' ? (
              <>
                <div style={{ width: '80px', height: '80px', background: '#fef2f2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <XCircle size={40} />
                </div>
                <h2 style={{ fontSize: '24px', color: '#0f172a', margin: '0 0 16px' }}>Offer Declined</h2>
                <p style={{ color: '#475569', fontSize: '15px', marginBottom: '32px' }}>You have declined the offer. If this was a mistake, please contact HR.</p>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '24px', color: '#0f172a', margin: '0 0 16px' }}>Welcome to Resource Gateway!</h2>
                <p style={{ color: '#475569', fontSize: '15px', marginBottom: '32px' }}>Please review and accept your Offer Letter and associated documents to proceed.</p>
                
                <div style={{ display: 'grid', gap: '12px', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
                  {/* Primary Offer Letter */}
                  {(reqDocsLabels.length === 0 || reqDocsLabels.includes('Offer Letter')) && (
                    <button onClick={() => handleDownloadDocx('offer-letter')} style={{ width: '100%', padding: '14px', background: '#eff6ff', color: '#2563eb', border: '1px solid #3b82f6', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                      <FileText size={20} /> Download Offer Letter
                    </button>
                  )}

                  {/* Dynamic Templates (like demo) */}
                  {profile.dynamicTemplates?.filter(t => reqDocsLabels.includes(t.name)).map(temp => (
                    <button key={temp._id} onClick={() => handleDownloadDynamicTemplate(temp._id, temp.name)} style={{ width: '100%', padding: '14px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #c4b5fd', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                      <FileText size={20} /> Download {temp.name}
                    </button>
                  ))}

                  {/* Fallback if nothing requested, show mandatory text */}
                  {reqDocsLabels.length === 0 && !profile.dynamicTemplates?.length && (
                    <p style={{ fontSize: '14px', color: '#64748b', fontStyle: 'italic' }}>Please acknowledge our standard employment terms below.</p>
                  )}
                </div>

                <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '32px', textAlign: 'left' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={offerAcceptedCheckbox} style={{ marginTop: '4px', width: '18px', height: '18px', accentColor: '#10b981' }} onChange={(e) => setOfferAcceptedCheckbox(e.target.checked)} />
                    <span style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>
                      I acknowledge that I have downloaded, read, and understood the Offer Letter. I accept the terms and conditions outlined within, and agree to proceed with the onboarding process.
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                  <button disabled={!offerAcceptedCheckbox || accepting} onClick={handleAcceptOffer} style={{ padding: '12px 32px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: (!offerAcceptedCheckbox || accepting) ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.3)', opacity: !offerAcceptedCheckbox ? 0.7 : 1 }}>
                    {accepting ? 'Accepting...' : 'I Accept the Offer'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Step Progress */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', overflowX: 'auto', paddingBottom: '4px' }}>
              {visibleSteps.map((step, i) => {
                const sectionComplete =
                  step.id === 'personalDetails' ? profile?.personalDetails?.isComplete :
                    step.id === 'emergencyContact' ? profile?.emergencyContact?.isComplete :
                      step.id === 'documents' ? (() => { 
                        const targetDocs = profile?.documents?.filter(d => reqDocsLabels.length === 0 || reqDocsLabels.includes(d.label)) || [];
                        if (targetDocs.length === 0) return true;
                        // Section is only complete if ALL requested docs are Uploaded or Approved (and not flagged)
                        return targetDocs.every(d => (d.status === 'Uploaded' || d.status === 'Approved' || d.type === 'passport')); 
                      })() :
                        step.id === 'bankDetails' ? profile?.bankDetails?.isComplete :
                          step.id === 'policies' ? (() => { 
                            const targetPolicies = profile?.companyPolicies?.filter(p => reqDocsLabels.length === 0 || reqDocsLabels.includes(p.name)) || [];
                            if (targetPolicies.length === 0) return true;
                            return targetPolicies.every(p => !p.isRequired || profile?.offerDeclaration?.acceptedPolicies?.some(ap => ap.policyId === p._id)); 
                          })() :
                            step.id === 'offerDeclaration' ? profile?.offerDeclaration?.isComplete : false;

                return (
                  <button key={step.id} onClick={() => { if (visibleSteps[currentStep].id !== 'documents' && unsavedChanges) handleSaveSection(visibleSteps[currentStep].id, true); setCurrentStep(i); }}
                    style={{ 
                      flex: 1, 
                      minWidth: '120px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: '6px', 
                      padding: '12px 8px', 
                      borderRadius: '12px', 
                      border: currentStep === i ? '2px solid #3b82f6' : '2px solid transparent', 
                      background: currentStep === i ? '#eff6ff' : sectionComplete ? '#f0fdf4' : '#fff', 
                      cursor: 'pointer', 
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', 
                      transition: 'all 0.2s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: currentStep === i ? '#2563eb' : sectionComplete ? '#16a34a' : '#94a3b8' }}>
                      {sectionComplete ? <CheckCircle size={16} /> : step.icon}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: currentStep === i ? '#1e40af' : sectionComplete ? '#16a34a' : '#475569', textAlign: 'center' }}>{step.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Form Content */}
            <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '28px', marginBottom: '24px' }}>

              {/* Step 0: Personal Details */}
              {visibleSteps[currentStep]?.id === 'personalDetails' && (() => { const sRO = isSectionReadOnly('personalDetails'); return (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '20px' }}>Personal & Contact Details</h3>
                  {sRO && <div style={{ padding: '8px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>✅ This section has been completed and is now read-only.</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} readOnly={sRO} value={personalDetails.fullName || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, fullName: e.target.value }); markChange(); }} /></div>
                    <div><label style={labelStyle}>Date of Birth</label><input type="date" style={inputStyle} readOnly={sRO} value={personalDetails.dateOfBirth?.split('T')[0] || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, dateOfBirth: e.target.value }); markChange(); }} /></div>
                    <div>
                      <label style={labelStyle}>Gender</label>
                      <select style={inputStyle} disabled={sRO} value={personalDetails.gender || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, gender: e.target.value }); markChange(); }}>
                        <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                      </select>
                    </div>
                    <div><label style={labelStyle}>Blood Group</label><input style={inputStyle} readOnly={sRO} value={personalDetails.bloodGroup || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, bloodGroup: e.target.value }); markChange(); }} /></div>
                    <div><label style={labelStyle}>Personal Email</label><input type="email" style={inputStyle} readOnly={sRO} value={personalDetails.personalEmail || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, personalEmail: e.target.value }); markChange(); }} /></div>
                    <div><label style={labelStyle}>Personal Mobile *</label><input style={inputStyle} readOnly={sRO} value={personalDetails.personalMobile || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, personalMobile: e.target.value }); markChange(); }} /></div>
                  </div>

                  <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', margin: '24px 0 12px' }}>Current Address</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Address Line 1</label><input style={inputStyle} readOnly={sRO} value={personalDetails.currentAddress?.line1 || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, currentAddress: { ...personalDetails.currentAddress, line1: e.target.value } }); markChange(); }} /></div>
                    <div><label style={labelStyle}>City</label><input style={inputStyle} readOnly={sRO} value={personalDetails.currentAddress?.city || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, currentAddress: { ...personalDetails.currentAddress, city: e.target.value } }); markChange(); }} /></div>
                    <div><label style={labelStyle}>State</label><input style={inputStyle} readOnly={sRO} value={personalDetails.currentAddress?.state || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, currentAddress: { ...personalDetails.currentAddress, state: e.target.value } }); markChange(); }} /></div>
                    <div><label style={labelStyle}>Pincode</label><input style={inputStyle} readOnly={sRO} value={personalDetails.currentAddress?.pincode || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, currentAddress: { ...personalDetails.currentAddress, pincode: e.target.value } }); markChange(); }} /></div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '20px 0 12px' }}>
                    <input type="checkbox" id="sameAddr" disabled={sRO} checked={personalDetails.sameAsCurrent || false} onChange={(e) => {
                      const checked = e.target.checked;
                      setPersonalDetails(prev => ({
                        ...prev, sameAsCurrent: checked,
                        permanentAddress: checked ? { ...prev.currentAddress } : { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' }
                      }));
                      markChange();
                    }} />
                    <label htmlFor="sameAddr" style={{ fontSize: '14px', color: '#475569', cursor: 'pointer' }}>Permanent address same as current</label>
                  </div>

                  {!personalDetails.sameAsCurrent && (
                    <>
                      <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>Permanent Address</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Address Line 1</label><input style={inputStyle} readOnly={sRO} value={personalDetails.permanentAddress?.line1 || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, permanentAddress: { ...personalDetails.permanentAddress, line1: e.target.value } }); markChange(); }} /></div>
                        <div><label style={labelStyle}>City</label><input style={inputStyle} readOnly={sRO} value={personalDetails.permanentAddress?.city || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, permanentAddress: { ...personalDetails.permanentAddress, city: e.target.value } }); markChange(); }} /></div>
                        <div><label style={labelStyle}>State</label><input style={inputStyle} readOnly={sRO} value={personalDetails.permanentAddress?.state || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, permanentAddress: { ...personalDetails.permanentAddress, state: e.target.value } }); markChange(); }} /></div>
                        <div><label style={labelStyle}>Pincode</label><input style={inputStyle} readOnly={sRO} value={personalDetails.permanentAddress?.pincode || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, permanentAddress: { ...personalDetails.permanentAddress, pincode: e.target.value } }); markChange(); }} /></div>
                      </div>
                    </>
                  )}

                  <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', margin: '24px 0 12px' }}>Social Links (Optional)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div><label style={labelStyle}>LinkedIn URL</label><input style={inputStyle} readOnly={sRO} value={personalDetails.linkedinUrl || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, linkedinUrl: e.target.value }); markChange(); }} /></div>
                    <div><label style={labelStyle}>Portfolio URL</label><input style={inputStyle} readOnly={sRO} value={personalDetails.portfolioUrl || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, portfolioUrl: e.target.value }); markChange(); }} /></div>
                  </div>

                  {!isGlobalReadOnly && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                      <input type="checkbox" id="pd_complete" checked={personalDetails.isComplete || false} onChange={(e) => { 
                        const isChecked = e.target.checked;
                        const updated = { ...personalDetails, isComplete: isChecked };
                        setPersonalDetails(updated); 
                        if (isChecked) handleSaveSection('personalDetails', false, updated); 
                        else markChange(); 
                      }} />
                      <label htmlFor="pd_complete" style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a', cursor: 'pointer' }}>Mark this section as complete</label>
                    </div>
                  )}
                </div>
              ); })()}

              {/* Step 1: Emergency Contact */}
              {visibleSteps[currentStep]?.id === 'emergencyContact' && (() => { const sRO = isSectionReadOnly('emergencyContact'); return (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '20px' }}>Emergency Contact</h3>
                  {sRO && <div style={{ padding: '8px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>✅ This section has been completed and is now read-only.</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div><label style={labelStyle}>Contact Person Name *</label><input style={inputStyle} readOnly={sRO} value={emergencyContact.contactName || ''} onChange={(e) => { setEmergencyContact({ ...emergencyContact, contactName: e.target.value }); markChange(); }} /></div>
                    <div><label style={labelStyle}>Relationship *</label><input style={inputStyle} readOnly={sRO} value={emergencyContact.relationship || ''} onChange={(e) => { setEmergencyContact({ ...emergencyContact, relationship: e.target.value }); markChange(); }} /></div>
                    <div><label style={labelStyle}>Phone Number *</label><input style={inputStyle} readOnly={sRO} value={emergencyContact.phoneNumber || ''} onChange={(e) => { setEmergencyContact({ ...emergencyContact, phoneNumber: e.target.value }); markChange(); }} /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Address</label><textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} readOnly={sRO} value={emergencyContact.address || ''} onChange={(e) => { setEmergencyContact({ ...emergencyContact, address: e.target.value }); markChange(); }} /></div>
                  </div>
                  {!isGlobalReadOnly && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                      <input type="checkbox" id="ec_complete" checked={emergencyContact.isComplete || false} onChange={(e) => { 
                        const isChecked = e.target.checked;
                        const updated = { ...emergencyContact, isComplete: isChecked };
                        setEmergencyContact(updated); 
                        if (isChecked) handleSaveSection('emergencyContact', false, updated); 
                        else markChange(); 
                      }} />
                      <label htmlFor="ec_complete" style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a', cursor: 'pointer' }}>Mark this section as complete</label>
                    </div>
                  )}
                </div>
              ); })()}

              {/* Step 2: Documents */}
              {visibleSteps[currentStep]?.id === 'documents' && (() => {
                const multiFileTypes = ['salary_slip', 'graduation'];
                
                // Get original order of types to preserve base section layout
                const typeOrder = [];
                (profile?.documents || []).forEach(d => { if (!typeOrder.includes(d.type)) typeOrder.push(d.type); });

                const filteredDocs = (profile?.documents?.filter(d => {
                  return reqDocsLabels.length === 0 || reqDocsLabels.includes(d.label) || reqDocsLabels.some(rl => d.label.startsWith(rl));
                }) || []).sort((a, b) => {
                  const orderA = typeOrder.indexOf(a.type);
                  const orderB = typeOrder.indexOf(b.type);
                  if (orderA !== orderB) return orderA - orderB;
                  // Within same type, sort numerically by label if possible (e.g. Slip (2) after Slip)
                  return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
                });

                const docsByType = {};
                filteredDocs.forEach(d => { if (!docsByType[d.type]) docsByType[d.type] = []; docsByType[d.type].push(d); });

                return (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '6px' }}>Document Upload</h3>
                  <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>Upload PDF, JPG, or PNG files (max 5MB each)</p>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {filteredDocs.map((doc) => {
                      const isApproved = doc.status === 'Approved';
                      const isUploaded = doc.status === 'Uploaded';
                      const needsUpload = doc.status === 'Pending' || doc.status === 'Mail Sent' || doc.status === 'Re-upload Required';
                      const isDocRequested = reqDocsLabels.includes(doc.label) || reqDocsLabels.some(rl => doc.label.startsWith(rl));
                      const canUpload = (doc.status === 'Re-upload Required') || (!isGlobalReadOnly && needsUpload && isDocRequested);
                      const badgeColor = isUploaded ? { bg: '#dbeafe', text: '#1d4ed8' } : isApproved ? { bg: '#dcfce7', text: '#16a34a' } : doc.status === 'Re-upload Required' ? { bg: '#fee2e2', text: '#dc2626' } : { bg: '#f1f5f9', text: '#64748b' };
                      const preview = docPreview[doc._id];
                      const isLastOfMultiType = multiFileTypes.includes(doc.type) && docsByType[doc.type]?.[docsByType[doc.type].length - 1]?._id === doc._id;
                      const isDynamicSlot = /\(\d+\)$/.test(doc.label);

                      return (
                        <React.Fragment key={doc._id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: isApproved ? '1px solid #bbf7d0' : doc.status === 'Re-upload Required' ? '1px solid #fecaca' : '1px solid #e2e8f0', borderRadius: '10px', background: isApproved ? '#f0fdf4' : doc.status === 'Re-upload Required' ? '#fef2f2' : '#fff', flexWrap: 'wrap' }}>
                            <FileText size={16} style={{ color: isApproved ? '#16a34a' : '#64748b', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: '120px' }}>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{doc.label}</div>
                              {doc.rejectionReason && <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '1px' }}><AlertTriangle size={10} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {doc.rejectionReason}</div>}
                              {preview && <div style={{ fontSize: '11px', color: '#6366f1', marginTop: '1px' }}>📄 {preview.fileName} ({(preview.file.size / 1024).toFixed(0)} KB)</div>}
                            </div>
                            
                            {doc.status !== 'Mail Sent' && (
                              <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', background: badgeColor.bg, color: badgeColor.text, whiteSpace: 'nowrap' }}>{doc.status}</span>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              {/* View uploaded file */}
                              {doc.url && (
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#3b82f6', fontSize: '11px', textDecoration: 'none', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}><Eye size={12} /> View</a>
                              )}

                              {/* Choose / Replace file */}
                              {canUpload && (
                                <label style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #d1d5db', color: '#475569', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', background: '#fff' }}>
                                  <Upload size={12} /> {preview ? 'Replace' : 'Choose'}
                                  <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5MB'); return; }
                                    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
                                    if (!allowed.includes(file.type)) { toast.error('Only PDF, JPG, PNG'); return; }
                                    const previewUrl = URL.createObjectURL(file);
                                    setDocPreview(prev => ({ ...prev, [doc._id]: { file, previewUrl, fileName: file.name, fileType: file.type } }));
                                  }} />
                                </label>
                              )}

                              {/* View chosen file (before upload) */}
                              {preview && (
                                <button onClick={() => window.open(preview.previewUrl, '_blank')} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #c7d2fe', color: '#4f46e5', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', background: '#eef2ff' }}>
                                  <Eye size={12} /> View
                                </button>
                              )}

                              {/* Upload button */}
                              {preview && (
                                <button onClick={() => { handleUploadDocument(doc._id, preview.file); setDocPreview(prev => { const n = { ...prev }; if (n[doc._id]?.previewUrl) URL.revokeObjectURL(n[doc._id].previewUrl); delete n[doc._id]; return n; }); }}
                                  style={{ padding: '5px 12px', borderRadius: '6px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <Upload size={12} /> Upload
                                </button>
                              )}

                              {/* Cancel chosen file selection */}
                              {preview && (
                                <button onClick={() => { setDocPreview(prev => { const n = { ...prev }; if (n[doc._id]?.previewUrl) URL.revokeObjectURL(n[doc._id].previewUrl); delete n[doc._id]; return n; }); }}
                                  style={{ padding: '5px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', background: '#fff' }}>
                                  <X size={12} />
                                </button>
                              )}

                              {/* Delete dynamic slot - same visibility logic as Choose button */}
                              {isDynamicSlot && canUpload && !isUploaded && !isApproved && (
                                <button onClick={() => handleDeleteDocSlot(doc._id)}
                                  style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #fee2e2', color: '#ef4444', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', background: '#fef2f2' }}
                                  title="Delete added field">
                                  <X size={12} /> Delete Slot
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Add More button - show only if not submitted OR if explicitly requested via flagging */}
                          {isLastOfMultiType && (!isGlobalReadOnly || (isDocRequested && docsByType[doc.type]?.some(d => d.status === 'Re-upload Required'))) && (
                            <button onClick={() => handleAddDocSlot(doc.type, doc.type === 'salary_slip' ? 'Salary Slip' : 'Graduation Marksheet / Certificate')}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', marginLeft: '30px', borderRadius: '8px', border: '1px dashed #cbd5e1', background: '#f8fafc', color: '#64748b', fontSize: '12px', fontWeight: '500', cursor: 'pointer', marginTop: '4px' }}>
                              <Plus size={14} /> Add More {doc.type === 'salary_slip' ? 'Salary Slips' : 'Certificates'}
                            </button>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
                );
              })()}

              {/* Step 3: Bank Details */}
              {visibleSteps[currentStep]?.id === 'bankDetails' && (() => { const sRO = isSectionReadOnly('bankDetails'); return (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '20px' }}>Bank / Payroll Details</h3>
                  {sRO && <div style={{ padding: '8px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>✅ This section has been completed and is now read-only.</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div><label style={labelStyle}>Bank Name *</label><input style={inputStyle} readOnly={sRO} value={bankDetails.bankName || ''} onChange={(e) => { setBankDetails({ ...bankDetails, bankName: e.target.value }); markChange(); }} /></div>
                    <div><label style={labelStyle}>Account Number *</label><input style={inputStyle} readOnly={sRO} value={bankDetails.accountNumber || ''} onChange={(e) => { setBankDetails({ ...bankDetails, accountNumber: e.target.value }); markChange(); }} /></div>
                    <div><label style={labelStyle}>Confirm Account Number *</label><input style={inputStyle} readOnly={sRO} value={bankDetails.confirmAccountNumber || ''} onChange={(e) => { setBankDetails({ ...bankDetails, confirmAccountNumber: e.target.value }); markChange(); }} /></div>
                    <div><label style={labelStyle}>IFSC Code *</label><input style={inputStyle} readOnly={sRO} value={bankDetails.ifscCode || ''} onChange={(e) => { setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() }); markChange(); }} /></div>
                    <div><label style={labelStyle}>Branch Name</label><input style={inputStyle} readOnly={sRO} value={bankDetails.branchName || ''} onChange={(e) => { setBankDetails({ ...bankDetails, branchName: e.target.value }); markChange(); }} /></div>
                    <div>
                      <label style={labelStyle}>Account Type *</label>
                      <select style={inputStyle} disabled={sRO} value={bankDetails.accountType || ''} onChange={(e) => { setBankDetails({ ...bankDetails, accountType: e.target.value }); markChange(); }}>
                        <option value="">Select</option><option value="Savings">Savings</option><option value="Current">Current</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <label style={labelStyle}>Cancelled Cheque / Passbook Front Page</label>
                    {bankDetails.cancelledChequeUrl || profile?.bankDetails?.cancelledChequeUrl ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <a href={bankDetails.cancelledChequeUrl || profile?.bankDetails?.cancelledChequeUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: '13px' }}>View uploaded file</a>
                        {!sRO && (
                          <label style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', cursor: 'pointer', fontWeight: '600', color: '#475569' }}>
                            Re-upload <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { if (e.target.files[0]) handleUploadCheque(e.target.files[0]); }} />
                          </label>
                        )}
                      </div>
                    ) : !sRO ? (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '2px dashed #d1d5db', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}>
                        <Upload size={16} /> Upload cheque / passbook
                        <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { if (e.target.files[0]) handleUploadCheque(e.target.files[0]); }} />
                      </label>
                    ) : <span style={{ color: '#94a3b8', fontSize: '13px' }}>Not uploaded</span>}
                  </div>

                  {!isGlobalReadOnly && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                      <input type="checkbox" id="bd_complete" checked={bankDetails.isComplete || false} onChange={(e) => { 
                        const isChecked = e.target.checked;
                        const updated = { ...bankDetails, isComplete: isChecked };
                        setBankDetails(updated); 
                        if (isChecked) handleSaveSection('bankDetails', false, updated); 
                        else markChange(); 
                      }} />
                      <label htmlFor="bd_complete" style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a', cursor: 'pointer' }}>Mark this section as complete</label>
                    </div>
                  )}
                </div>
              ); })()}

              {/* Step 4: Company Policies */}
              {visibleSteps[currentStep]?.id === 'policies' && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '6px' }}>Company Policies</h3>
                  <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>Please review and accept modern workplace policies before proceeding.</p>

                  <div style={{ display: 'grid', gap: '12px' }}>
                    {profile?.companyPolicies?.filter(p => {
                      return reqDocsLabels.length === 0 || reqDocsLabels.includes(p.name);
                    }).map((policy) => {
                      const isAccepted = profile?.offerDeclaration?.acceptedPolicies?.some(p => p.policyId === policy._id);
                      return (
                        <div key={policy._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', background: isAccepted ? '#f0fdf4' : '#fff' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isAccepted ? '#dcfce7' : '#f1f5f9', color: isAccepted ? '#16a34a' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={20} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>{policy.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{policy.isRequired ? 'Mandatory acknowledgment' : 'Optional review'}</div>
                          </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <a href={policy.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#3b82f6', textDecoration: 'none', fontSize: '13px', fontWeight: '600', background: '#fff' }}>
                                View Policy ↗
                              </a>
                              {!isAccepted && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                                  <input type="checkbox" style={{ width: '16px', height: '16px', accentColor: '#10b981' }} onChange={() => handleAcceptPolicy(policy._id)} />
                                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Accept the policy / Mark as read</span>
                                </label>
                              )}
                              {isAccepted && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '13px', fontWeight: '600', padding: '8px' }}>
                                  <CheckCircle size={16} /> Accepted
                                </div>
                              )}
                            </div>
                        </div>
                      );
                    })}

                    {(() => {
                      const targetPolicies = profile?.companyPolicies?.filter(p => reqDocsLabels.length === 0 || reqDocsLabels.includes(p.name)) || [];
                      if (targetPolicies.length === 0) {
                        return (
                          <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <CheckCircle size={32} style={{ color: '#10b981', marginBottom: '12px' }} />
                            <p style={{ color: '#475569', margin: 0 }}>No specific policies require your attention at this time.</p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {!isReadOnly && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px', padding: '16px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a' }}>
                      <input type="checkbox" id="policies_complete" checked={offerDeclaration.hasReadPolicies || false} onChange={(e) => { 
                        const isChecked = e.target.checked;
                        const updated = { ...offerDeclaration, hasReadPolicies: isChecked };
                        setOfferDeclaration(updated); 
                        if (isChecked) handleSaveSection('offerDeclaration', false, updated); 
                        else markChange(); 
                      }} />
                      <label htmlFor="policies_complete" style={{ fontSize: '14px', fontWeight: '600', color: '#92400e' }}>I confirm that I have reviewed all the policies listed above.</label>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Offer Declaration */}
              {visibleSteps[currentStep]?.id === 'offerDeclaration' && (() => { const sRO = isSectionReadOnly('offerDeclaration'); return (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '6px' }}>Offer & Declaration Documents</h3>
                  <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>Please download, review, and acknowledge the following dynamic documents.</p>

                  <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                    {(() => {
                      if (reqDocsLabels.length === 0 || reqDocsLabels.includes('Offer Letter')) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', background: offerDeclaration.hasReadOfferLetter ? '#f0fdf4' : '#fff' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f0f9ff', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <FileText size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>Primary Offer Letter</div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>System Generated document</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <a href={profile.offerLetterUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#3b82f6', textDecoration: 'none', fontSize: '13px', fontWeight: '600', background: '#fff' }}>View</a>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {profile?.dynamicTemplates?.filter(t => {
                      return reqDocsLabels.length === 0 || reqDocsLabels.includes(t.name);
                    }).map((temp) => {
                      const isAccepted = profile?.offerDeclaration?.acceptedTemplates?.some(t => t.templateId === temp._id);
                      return (
                        <div key={temp._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', background: isAccepted ? '#f0fdf4' : '#fff' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isAccepted ? '#dcfce7' : '#f8fafc', color: isAccepted ? '#16a34a' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={20} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>{temp.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>Customized for you</div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => handleDownloadDynamicTemplate(temp._id, temp.name)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #3b82f6', color: '#3b82f6', background: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                              Download
                            </button>
                            {( !sRO && !isAccepted) && (
                              <button onClick={() => handleAcceptTemplate(temp._id)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                                Acknowledge
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                    {
                      (() => {
                        return [
                          { key: 'hasReadOfferLetter', label: 'I have read and understood the terms of my offer letter', show: reqDocsLabels.length === 0 || reqDocsLabels.includes('Offer Letter') },
                          { key: 'hasProvidedTrueInfo', label: 'All information I have provided is true and accurate', show: reqSectionsLabels.length === 0 || reqSectionsLabels.includes('Offer Declaration') },
                          { key: 'agreesToOriginalVerification', label: 'I agree to submit original documents for verification on joining day', show: reqSectionsLabels.length === 0 || reqSectionsLabels.includes('Offer Declaration') }
                        ].filter(item => item.show).map((item) => (
                          <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: sRO ? 'default' : 'pointer', background: offerDeclaration[item.key] ? '#f0fdf4' : '#fff' }}>
                            <input type="checkbox" disabled={sRO} checked={offerDeclaration[item.key] || false} onChange={(e) => { setOfferDeclaration({ ...offerDeclaration, [item.key]: e.target.checked }); markChange(); }} style={{ marginTop: '2px', accentColor: '#16a34a' }} />
                            <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>{item.label}</span>
                          </label>
                        ));
                      })()
                    }
                  </div>

                  {(() => {
                    return (reqSectionsLabels.length === 0 || reqSectionsLabels.includes('Offer Declaration')) && (
                    <>
                      <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>E-Signature</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} readOnly={sRO} placeholder="Type your full name" value={offerDeclaration.eSignName || ''} onChange={(e) => { setOfferDeclaration({ ...offerDeclaration, eSignName: e.target.value }); markChange(); }} /></div>
                        <div><label style={labelStyle}>Date *</label><input type="date" style={inputStyle} readOnly={sRO} value={offerDeclaration.eSignDate?.split('T')[0] || ''} onChange={(e) => { setOfferDeclaration({ ...offerDeclaration, eSignDate: e.target.value }); markChange(); }} /></div>
                      </div>

                      {!isGlobalReadOnly && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                          <input type="checkbox" id="od_complete" checked={offerDeclaration.isComplete || false} onChange={(e) => { 
                            const isChecked = e.target.checked;
                            const updated = { ...offerDeclaration, isComplete: isChecked };
                            setOfferDeclaration(updated); 
                            if (isChecked) handleSaveSection('offerDeclaration', false, updated); 
                            else markChange(); 
                          }} />
                          <label htmlFor="od_complete" style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a', cursor: 'pointer' }}>Mark this section as complete</label>
                        </div>
                      )}
                    </>
                    );
                  })()}
                </div>
              ); })()}
            </div>

            {/* Navigation */}
            {(!isReadOnly || (profile?.requestedSections?.length > 0 || profile?.requestedDocuments?.length > 0)) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button disabled={currentStep === 0} onClick={() => { if (unsavedChanges && visibleSteps[currentStep]?.id && !['documents', 'policies'].includes(visibleSteps[currentStep].id)) handleSaveSection(visibleSteps[currentStep].id, true); setCurrentStep(s => s - 1); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '10px', border: '1px solid #d1d5db', background: '#fff', cursor: currentStep === 0 ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '14px', color: '#475569', opacity: currentStep === 0 ? 0.5 : 1 }}>
                  <ChevronLeft size={18} /> Previous
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {visibleSteps[currentStep]?.id && !['documents', 'policies'].includes(visibleSteps[currentStep].id) && !isSectionReadOnly(visibleSteps[currentStep].id) && (
                    <button onClick={() => handleSaveSection(visibleSteps[currentStep].id)} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: '#475569' }}>
                      Save
                    </button>
                  )}

                  {currentStep < visibleSteps.length - 1 ? (
                    <button onClick={() => { if (unsavedChanges && visibleSteps[currentStep]?.id && !['documents', 'policies'].includes(visibleSteps[currentStep].id)) handleSaveSection(visibleSteps[currentStep].id, true); setCurrentStep(s => s + 1); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '14px', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                      Next <ChevronRight size={18} />
                    </button>
                  ) : (
                    !isGlobalReadOnly && (
                      <button onClick={handleSubmit} disabled={submitting}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', cursor: submitting ? 'wait' : 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', opacity: submitting ? 0.7 : 1 }}>
                        <CheckCircle size={18} /> {submitting ? 'Submitting...' : 'Submit Onboarding'}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )
      }
      </div>

      {/* Extension Modal */}
      {showExtensionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a' }}>Request Deadline Extension</h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '13px' }}>If you need more time to gather your documents, you can request an extension from HR.</p>

            <form onSubmit={handleRequestExtension}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Reason for extension</label>
                <textarea
                  required
                  rows={3}
                  value={extensionRequest.reason}
                  onChange={(e) => setExtensionRequest({ ...extensionRequest, reason: e.target.value })}
                  placeholder="E.g., Waiting for university degree certificate..."
                  style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'vertical' }}
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Additional days needed</label>
                <select
                  value={extensionRequest.requestedDays}
                  onChange={(e) => setExtensionRequest({ ...extensionRequest, requestedDays: parseInt(e.target.value) })}
                  style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fff' }}
                >
                  <option value={3}>3 Days</option>
                  <option value={7}>1 Week</option>
                  <option value={14}>2 Weeks</option>
                  <option value={30}>1 Month</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowExtensionModal(false)} style={{ padding: '10px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreOnboardingPortal;
