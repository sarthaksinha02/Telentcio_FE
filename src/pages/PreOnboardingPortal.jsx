import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { CheckCircle, Clock, Upload, ChevronRight, ChevronLeft, LogOut, FileText, AlertTriangle, User, Phone, Building, CreditCard, FileSignature, Loader } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL}/api/onboarding`;

const STEPS = [
  { id: 'personalDetails', label: 'Personal & Contact', icon: <User size={18} /> },
  { id: 'emergencyContact', label: 'Emergency Contact', icon: <Phone size={18} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={18} /> },
  { id: 'bankDetails', label: 'Bank Details', icon: <CreditCard size={18} /> },
  { id: 'offerDeclaration', label: 'Offer Declaration', icon: <FileSignature size={18} /> }
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
      setBankDetails(res.data.bankDetails || {});
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
      handleSaveSection(STEPS[currentStep].id, true);
    }, 30000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [unsavedChanges, personalDetails, emergencyContact, bankDetails, offerDeclaration, currentStep]);

  const getSectionData = (sectionId) => {
    switch (sectionId) {
      case 'personalDetails': return personalDetails;
      case 'emergencyContact': return emergencyContact;
      case 'bankDetails': return bankDetails;
      case 'offerDeclaration': return offerDeclaration;
      default: return {};
    }
  };

  const handleSaveSection = async (sectionId, isAuto = false) => {
    if (sectionId === 'documents') return; // docs are saved via uploads
    try {
      setSaving(true);
      const data = getSectionData(sectionId);
      await axios.patch(`${API_URL}/my-profile/${sectionId}`, data, { headers: getHeaders() });
      setUnsavedChanges(false);
      if (!isAuto) toast.success('Saved!');
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
    } catch (err) {
      toast.dismiss('cheque');
      toast.error('Upload failed');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Save current section first
      if (STEPS[currentStep].id !== 'documents') {
        await handleSaveSection(STEPS[currentStep].id);
      }
      const res = await axios.post(`${API_URL}/my-profile/submit`, {}, { headers: getHeaders() });
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
    if (STEPS[currentStep].id !== 'documents' && unsavedChanges) {
      await handleSaveSection(STEPS[currentStep].id, true);
    }
    setCurrentStep(4);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const handleLogout = () => {
    localStorage.removeItem('onboardingToken');
    localStorage.removeItem('onboardingEmployee');
    navigate('/pre-onboarding/login');
  };

  const [accepting, setAccepting] = useState(false);

  const handleDownloadDocx = async (type) => {
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
    } catch (err) {
      toast.dismiss('docx');
      toast.error('Download failed');
    }
  };

  const handleAcceptOffer = async () => {
    try {
      setAccepting(true);
      await axios.post(`${API_URL}/my-profile/accept-offer`, {}, { headers: getHeaders() });
      toast.success('Offer Accepted! You can now complete your onboarding details.');
      fetchProfile();
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
      urgent: days <= 2
    };
  };

  const isReadOnly = profile?.status === 'Submitted' || profile?.status === 'Reviewed';
  const deadlineInfo = getDeadlineInfo();

  const calculateProgress = () => {
    if (!profile) return 0;
    let completed = 0;
    const total = 5;
    if (personalDetails.isComplete) completed++;
    if (emergencyContact.isComplete) completed++;
    if (bankDetails.isComplete) completed++;
    if (offerDeclaration.isComplete) completed++;
    const docsUploaded = profile.documents?.filter(d => d.status !== 'Pending' || d.type === 'passport').length;
    const totalDocs = profile.documents?.length || 0;
    if (totalDocs > 0 && docsUploaded === totalDocs) completed++;
    return Math.round((completed / total) * 100);
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: deadlineInfo.urgent ? '#fef2f2' : '#f0fdf4', border: `1px solid ${deadlineInfo.urgent ? '#fecaca' : '#bbf7d0'}` }}>
              <Clock size={14} style={{ color: deadlineInfo.color }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: deadlineInfo.color }}>{deadlineInfo.text}</span>
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
              onClick={currentStep === 4 ? handleSubmit : jumpToSubmit}
              disabled={submitting}
              style={{ background: '#fff', color: '#2563eb', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: submitting ? 'wait' : 'pointer', marginLeft: '12px' }}
            >
              {submitting ? 'Submitting...' : currentStep === 4 ? 'Submit Now' : 'Go to Final Step & Submit'}
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        {profile?.offerStatus !== 'Accepted' ? (
           <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '40px', textAlign: 'center' }}>
             <h2 style={{ fontSize: '24px', color: '#0f172a', margin: '0 0 16px' }}>Welcome to Resource Gateway!</h2>
             <p style={{ color: '#475569', fontSize: '15px', marginBottom: '32px' }}>Please review and accept your Offer Letter to proceed with the onboarding process.</p>
             <button onClick={() => handleDownloadDocx('offer-letter')} style={{ padding: '12px 24px', background: '#eff6ff', color: '#2563eb', border: '1px solid #3b82f6', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto 32px' }}>
               <FileText size={20} /> Download & Review Offer Letter
             </button>
             
             <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '32px', textAlign: 'left' }}>
               <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                 <input type="checkbox" id="acceptCheckbox" style={{ marginTop: '4px', width: '18px', height: '18px', accentColor: '#10b981' }} onChange={(e) => {
                   const btn = document.getElementById('acceptBtn');
                   if(btn) btn.disabled = !e.target.checked;
                 }} />
                 <span style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>
                   I acknowledge that I have downloaded, read, and understood the Offer Letter. I accept the terms and conditions outlined within, and agree to proceed with the onboarding process.
                 </span>
               </label>
             </div>
             
             <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button id="acceptBtn" disabled onClick={handleAcceptOffer} style={{ padding: '12px 32px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: accepting ? 'wait' : 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.3)', opacity: 1 }}>
                  {accepting ? 'Accepting...' : 'I Accept the Offer'}
                </button>
             </div>
           </div>
        ) : (
          <>
            {/* Step Progress */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', overflowX: 'auto', paddingBottom: '4px' }}>
          {STEPS.map((step, i) => {
            const sectionComplete =
              i === 0 ? profile?.personalDetails?.isComplete :
              i === 1 ? profile?.emergencyContact?.isComplete :
              i === 2 ? profile?.documents?.every(d => d.status !== 'Pending' || d.type === 'passport') :
              i === 3 ? profile?.bankDetails?.isComplete :
              i === 4 ? profile?.offerDeclaration?.isComplete : false;

            return (
              <button key={step.id} onClick={() => { if (STEPS[currentStep].id !== 'documents' && unsavedChanges) handleSaveSection(STEPS[currentStep].id, true); setCurrentStep(i); }}
                style={{ flex: 1, minWidth: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 8px', borderRadius: '12px', border: currentStep === i ? '2px solid #3b82f6' : '2px solid transparent', background: currentStep === i ? '#eff6ff' : sectionComplete ? '#f0fdf4' : '#fff', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: currentStep === i ? '#2563eb' : sectionComplete ? '#16a34a' : '#94a3b8' }}>
                  {sectionComplete ? <CheckCircle size={16} /> : step.icon}
                </div>
                <span style={{ fontSize: '11px', fontWeight: '600', color: currentStep === i ? '#1e40af' : '#475569', textAlign: 'center' }}>{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Content */}
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '28px', marginBottom: '24px' }}>

          {/* Step 0: Personal Details */}
          {currentStep === 0 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '20px' }}>Personal & Contact Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.fullName || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, fullName: e.target.value }); markChange(); }} /></div>
                <div><label style={labelStyle}>Date of Birth</label><input type="date" style={inputStyle} readOnly={isReadOnly} value={personalDetails.dateOfBirth?.split('T')[0] || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, dateOfBirth: e.target.value }); markChange(); }} /></div>
                <div>
                  <label style={labelStyle}>Gender</label>
                  <select style={inputStyle} disabled={isReadOnly} value={personalDetails.gender || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, gender: e.target.value }); markChange(); }}>
                    <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Blood Group</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.bloodGroup || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, bloodGroup: e.target.value }); markChange(); }} /></div>
                <div><label style={labelStyle}>Personal Email</label><input type="email" style={inputStyle} readOnly={isReadOnly} value={personalDetails.personalEmail || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, personalEmail: e.target.value }); markChange(); }} /></div>
                <div><label style={labelStyle}>Personal Mobile *</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.personalMobile || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, personalMobile: e.target.value }); markChange(); }} /></div>
              </div>

              <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', margin: '24px 0 12px' }}>Current Address</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Address Line 1</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.currentAddress?.line1 || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, currentAddress: { ...personalDetails.currentAddress, line1: e.target.value } }); markChange(); }} /></div>
                <div><label style={labelStyle}>City</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.currentAddress?.city || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, currentAddress: { ...personalDetails.currentAddress, city: e.target.value } }); markChange(); }} /></div>
                <div><label style={labelStyle}>State</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.currentAddress?.state || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, currentAddress: { ...personalDetails.currentAddress, state: e.target.value } }); markChange(); }} /></div>
                <div><label style={labelStyle}>Pincode</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.currentAddress?.pincode || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, currentAddress: { ...personalDetails.currentAddress, pincode: e.target.value } }); markChange(); }} /></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '20px 0 12px' }}>
                <input type="checkbox" id="sameAddr" disabled={isReadOnly} checked={personalDetails.sameAsCurrent || false} onChange={(e) => {
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
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Address Line 1</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.permanentAddress?.line1 || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, permanentAddress: { ...personalDetails.permanentAddress, line1: e.target.value } }); markChange(); }} /></div>
                    <div><label style={labelStyle}>City</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.permanentAddress?.city || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, permanentAddress: { ...personalDetails.permanentAddress, city: e.target.value } }); markChange(); }} /></div>
                    <div><label style={labelStyle}>State</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.permanentAddress?.state || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, permanentAddress: { ...personalDetails.permanentAddress, state: e.target.value } }); markChange(); }} /></div>
                    <div><label style={labelStyle}>Pincode</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.permanentAddress?.pincode || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, permanentAddress: { ...personalDetails.permanentAddress, pincode: e.target.value } }); markChange(); }} /></div>
                  </div>
                </>
              )}

              <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', margin: '24px 0 12px' }}>Social Links (Optional)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div><label style={labelStyle}>LinkedIn URL</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.linkedinUrl || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, linkedinUrl: e.target.value }); markChange(); }} /></div>
                <div><label style={labelStyle}>Portfolio URL</label><input style={inputStyle} readOnly={isReadOnly} value={personalDetails.portfolioUrl || ''} onChange={(e) => { setPersonalDetails({ ...personalDetails, portfolioUrl: e.target.value }); markChange(); }} /></div>
              </div>

              {!isReadOnly && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                  <input type="checkbox" id="pd_complete" checked={personalDetails.isComplete || false} onChange={(e) => { setPersonalDetails({ ...personalDetails, isComplete: e.target.checked }); markChange(); }} />
                  <label htmlFor="pd_complete" style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>Mark this section as complete</label>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Emergency Contact */}
          {currentStep === 1 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '20px' }}>Emergency Contact</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div><label style={labelStyle}>Contact Person Name *</label><input style={inputStyle} readOnly={isReadOnly} value={emergencyContact.contactName || ''} onChange={(e) => { setEmergencyContact({ ...emergencyContact, contactName: e.target.value }); markChange(); }} /></div>
                <div><label style={labelStyle}>Relationship *</label><input style={inputStyle} readOnly={isReadOnly} value={emergencyContact.relationship || ''} onChange={(e) => { setEmergencyContact({ ...emergencyContact, relationship: e.target.value }); markChange(); }} /></div>
                <div><label style={labelStyle}>Phone Number *</label><input style={inputStyle} readOnly={isReadOnly} value={emergencyContact.phoneNumber || ''} onChange={(e) => { setEmergencyContact({ ...emergencyContact, phoneNumber: e.target.value }); markChange(); }} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Address</label><textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} readOnly={isReadOnly} value={emergencyContact.address || ''} onChange={(e) => { setEmergencyContact({ ...emergencyContact, address: e.target.value }); markChange(); }} /></div>
              </div>
              {!isReadOnly && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                  <input type="checkbox" id="ec_complete" checked={emergencyContact.isComplete || false} onChange={(e) => { setEmergencyContact({ ...emergencyContact, isComplete: e.target.checked }); markChange(); }} />
                  <label htmlFor="ec_complete" style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>Mark this section as complete</label>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Documents */}
          {currentStep === 2 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '6px' }}>Document Upload</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>Upload PDF, JPG, or PNG files (max 5MB each)</p>
              <div style={{ display: 'grid', gap: '10px' }}>
                {profile?.documents?.map((doc) => {
                  const badgeColor = doc.status === 'Uploaded' ? { bg: '#dbeafe', text: '#1d4ed8' } : doc.status === 'Approved' ? { bg: '#dcfce7', text: '#16a34a' } : doc.status === 'Re-upload Required' ? { bg: '#fee2e2', text: '#dc2626' } : { bg: '#f1f5f9', text: '#64748b' };
                  return (
                    <div key={doc._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', background: doc.status === 'Re-upload Required' ? '#fef2f2' : '#fff', flexWrap: 'wrap' }}>
                      <FileText size={18} style={{ color: '#64748b', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{doc.label}</div>
                        {doc.rejectionReason && (
                          <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={12} /> {doc.rejectionReason}
                          </div>
                        )}
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: badgeColor.bg, color: badgeColor.text }}>{doc.status}</span>
                      {doc.url && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#3b82f6', fontSize: '12px', textDecoration: 'none', fontWeight: '600' }}>View</a>
                      )}
                      {!isReadOnly && (doc.status === 'Pending' || doc.status === 'Re-upload Required') && (
                        <label style={{ padding: '6px 12px', borderRadius: '6px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Upload size={14} /> Upload
                          <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { if (e.target.files[0]) handleUploadDocument(doc._id, e.target.files[0]); }} />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Bank Details */}
          {currentStep === 3 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '20px' }}>Bank / Payroll Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div><label style={labelStyle}>Bank Name *</label><input style={inputStyle} readOnly={isReadOnly} value={bankDetails.bankName || ''} onChange={(e) => { setBankDetails({ ...bankDetails, bankName: e.target.value }); markChange(); }} /></div>
                <div><label style={labelStyle}>Account Number *</label><input style={inputStyle} readOnly={isReadOnly} value={bankDetails.accountNumber || ''} onChange={(e) => { setBankDetails({ ...bankDetails, accountNumber: e.target.value }); markChange(); }} /></div>
                <div><label style={labelStyle}>Confirm Account Number *</label><input style={inputStyle} readOnly={isReadOnly} value={bankDetails.confirmAccountNumber || ''} onChange={(e) => { setBankDetails({ ...bankDetails, confirmAccountNumber: e.target.value }); markChange(); }} /></div>
                <div><label style={labelStyle}>IFSC Code *</label><input style={inputStyle} readOnly={isReadOnly} value={bankDetails.ifscCode || ''} onChange={(e) => { setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() }); markChange(); }} /></div>
                <div><label style={labelStyle}>Branch Name</label><input style={inputStyle} readOnly={isReadOnly} value={bankDetails.branchName || ''} onChange={(e) => { setBankDetails({ ...bankDetails, branchName: e.target.value }); markChange(); }} /></div>
                <div>
                  <label style={labelStyle}>Account Type *</label>
                  <select style={inputStyle} disabled={isReadOnly} value={bankDetails.accountType || ''} onChange={(e) => { setBankDetails({ ...bankDetails, accountType: e.target.value }); markChange(); }}>
                    <option value="">Select</option><option value="Savings">Savings</option><option value="Current">Current</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <label style={labelStyle}>Cancelled Cheque / Passbook Front Page</label>
                {bankDetails.cancelledChequeUrl || profile?.bankDetails?.cancelledChequeUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <a href={bankDetails.cancelledChequeUrl || profile?.bankDetails?.cancelledChequeUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: '13px' }}>View uploaded file</a>
                    {!isReadOnly && (
                      <label style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', cursor: 'pointer', fontWeight: '600', color: '#475569' }}>
                        Re-upload <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { if (e.target.files[0]) handleUploadCheque(e.target.files[0]); }} />
                      </label>
                    )}
                  </div>
                ) : !isReadOnly ? (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '2px dashed #d1d5db', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}>
                    <Upload size={16} /> Upload cheque / passbook
                    <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { if (e.target.files[0]) handleUploadCheque(e.target.files[0]); }} />
                  </label>
                ) : <span style={{ color: '#94a3b8', fontSize: '13px' }}>Not uploaded</span>}
              </div>

              {!isReadOnly && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                  <input type="checkbox" id="bd_complete" checked={bankDetails.isComplete || false} onChange={(e) => { setBankDetails({ ...bankDetails, isComplete: e.target.checked }); markChange(); }} />
                  <label htmlFor="bd_complete" style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>Mark this section as complete</label>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Offer Declaration */}
          {currentStep === 4 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '20px' }}>Offer Letter Declaration</h3>

              {profile?.offerLetterUrl && (
                <div style={{ marginBottom: '24px', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} style={{ color: '#3b82f6' }} />
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Offer Letter</span>
                    <a href={profile.offerLetterUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: '600' }}>Open in new tab ↗</a>
                  </div>
                  <iframe src={profile.offerLetterUrl} style={{ width: '100%', height: '400px', border: 'none' }} title="Offer Letter" />
                </div>
              )}

              <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                {[
                  { key: 'hasReadOfferLetter', label: 'I have read and understood the terms of my offer letter' },
                  { key: 'hasProvidedTrueInfo', label: 'All information I have provided is true and accurate' },
                  { key: 'agreesToOriginalVerification', label: 'I agree to submit original documents for verification on joining day' }
                ].map((item) => (
                  <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: isReadOnly ? 'default' : 'pointer', background: offerDeclaration[item.key] ? '#f0fdf4' : '#fff' }}>
                    <input type="checkbox" disabled={isReadOnly} checked={offerDeclaration[item.key] || false} onChange={(e) => { setOfferDeclaration({ ...offerDeclaration, [item.key]: e.target.checked }); markChange(); }} style={{ marginTop: '2px', accentColor: '#16a34a' }} />
                    <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>{item.label}</span>
                  </label>
                ))}
              </div>

              <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>E-Signature</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} readOnly={isReadOnly} placeholder="Type your full name" value={offerDeclaration.eSignName || ''} onChange={(e) => { setOfferDeclaration({ ...offerDeclaration, eSignName: e.target.value }); markChange(); }} /></div>
                <div><label style={labelStyle}>Date *</label><input type="date" style={inputStyle} readOnly={isReadOnly} value={offerDeclaration.eSignDate?.split('T')[0] || ''} onChange={(e) => { setOfferDeclaration({ ...offerDeclaration, eSignDate: e.target.value }); markChange(); }} /></div>
              </div>

              {!isReadOnly && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                  <input type="checkbox" id="od_complete" checked={offerDeclaration.isComplete || false} onChange={(e) => { setOfferDeclaration({ ...offerDeclaration, isComplete: e.target.checked }); markChange(); }} />
                  <label htmlFor="od_complete" style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>Mark this section as complete</label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        {!isReadOnly && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button disabled={currentStep === 0} onClick={() => { if (unsavedChanges && STEPS[currentStep].id !== 'documents') handleSaveSection(STEPS[currentStep].id, true); setCurrentStep(s => s - 1); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '10px', border: '1px solid #d1d5db', background: '#fff', cursor: currentStep === 0 ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '14px', color: '#475569', opacity: currentStep === 0 ? 0.5 : 1 }}>
              <ChevronLeft size={18} /> Previous
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              {STEPS[currentStep].id !== 'documents' && (
                <button onClick={() => handleSaveSection(STEPS[currentStep].id)} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: '#475569' }}>
                  Save
                </button>
              )}

              {currentStep < STEPS.length - 1 ? (
                <button onClick={() => { if (unsavedChanges && STEPS[currentStep].id !== 'documents') handleSaveSection(STEPS[currentStep].id, true); setCurrentStep(s => s + 1); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '14px', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                  Next <ChevronRight size={18} />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', cursor: submitting ? 'wait' : 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', opacity: submitting ? 0.7 : 1 }}>
                  <CheckCircle size={18} /> {submitting ? 'Submitting...' : 'Submit Onboarding'}
                </button>
              )}
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default PreOnboardingPortal;
