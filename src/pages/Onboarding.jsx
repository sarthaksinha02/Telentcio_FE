import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FileText, Download, Upload, CheckCircle, Clock, AlertCircle, Eye, Trash2, Settings2, HelpCircle, X, RefreshCw, FileSignature, Briefcase, UserCheck, ScrollText, Check, ChevronDown, ChevronUp, MoreVertical, FileDown, Layout, Type, UserPlus, Search, Filter, AlertTriangle, Users, Send, UploadCloud, Square, CheckSquare, Mail, Edit2, Key, ArrowRightCircle } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  Pending: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  'In Progress': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  Submitted: { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  Reviewed: { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' }
};

const STATUS_ICONS = {
  Pending: <Clock size={16} />,
  'In Progress': <RefreshCw size={16} />,
  Submitted: <FileText size={16} />,
  Reviewed: <CheckCircle size={16} />
};

const Onboarding = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({ Pending: 0, 'In Progress': 0, Submitted: 0, Reviewed: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState('employees'); // 'employees' or 'settings'
  const [onboardingSettings, setOnboardingSettings] = useState({ offerLetterTemplateUrl: '', declarationTemplateUrl: '' });
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewType, setPreviewType] = useState('');
  const [previewWithData, setPreviewWithData] = useState(true);
  const [previewBlob, setPreviewBlob] = useState(null);
  const previewContainerRef = useRef(null);
  const [checkedSections, setCheckedSections] = useState(new Set());
  const [checkedDocuments, setCheckedDocuments] = useState(new Set());
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailDeadline, setEmailDeadline] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

  // Close menu when clicking outside or scrolling
  useEffect(() => {
    const handleClose = () => setActiveMenu(null);
    document.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      document.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, []);

  const toggleMenu = useCallback((e, employeeId) => {
    e.stopPropagation();
    if (activeMenu === employeeId) {
      setActiveMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuHeight = 200; // estimated

      let positionStyles = {
        right: window.innerWidth - rect.right
      };

      if (spaceBelow < menuHeight && rect.top > menuHeight) {
        positionStyles.bottom = window.innerHeight - rect.top + 5;
      } else {
        positionStyles.top = rect.bottom + 5;
      }

      setMenuPosition(positionStyles);
      setActiveMenu(employeeId);
    }
  }, [activeMenu]);

  const toggleSection = (id) => setExpandedSections(p => ({ ...p, [id]: !p[id] }));

  const toggleCheckedSection = (label) => {
    setCheckedSections(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const toggleCheckedDocument = (label) => {
    setCheckedDocuments(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const handleSendOnboardingEmail = async () => {
    if (checkedSections.size === 0 && checkedDocuments.size === 0) {
      toast.error('Please select at least one section or document');
      return;
    }
    try {
      setSendingEmail(true);
      const res = await api.post(`/onboarding/employees/${selectedEmployee._id}/send-onboarding-email`, {
        sections: [...checkedSections],
        documents: [...checkedDocuments],
        submissionDeadline: emailDeadline
      });
      toast.success('Pre-onboarding email sent successfully!');
      setCheckedSections(new Set());
      setCheckedDocuments(new Set());

      // Update local state instead of full openDetail refresh
      if (res.data.employee) {
        setSelectedEmployee(res.data.employee);
        setEmployees(prev => prev.map(e => e._id === selectedEmployee._id ? { ...e, status: res.data.employee.status } : e));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    designation: '', department: '', joiningDate: '', documentDeadline: '',
    workLocation: '', address: '', probationPeriod: '6 months',
    salary: { annualCTC: '', basic: '', hra: '', specialAllowance: '', monthlyGross: '', monthlyCTC: '' }
  });

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (statusFilter !== 'All') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const res = await api.get('/onboarding/employees', { params });
      setEmployees(res.data.employees || []);
      setStats(res.data.stats || { Pending: 0, 'In Progress': 0, Submitted: 0, Reviewed: 0 });
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchTerm]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/onboarding/settings');
      setOnboardingSettings(res.data || { offerLetterTemplateUrl: '', declarationTemplateUrl: '', policies: [], dynamicTemplates: [] });
    } catch (err) {
      console.error('Failed to fetch onboarding settings');
    }
  }, []);

  const handleDynamicTemplateUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      toast.error('Please upload a .docx file for dynamic templates');
      return;
    }
    const name = prompt('Enter a name for this dynamic template (e.g. Appointment Letter):');
    if (!name) return;

    const fd = new FormData();
    fd.append('document', file);
    fd.append('name', name);
    fd.append('isRequired', 'true');

    try {
      toast.loading('Uploading template...', { id: 'dynamic' });
      await api.post('/onboarding/settings/templates/dynamic/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Template uploaded!', { id: 'dynamic' });
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed', { id: 'dynamic' });
    }
  };

  const handleDeleteDynamicTemplate = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.delete(`/onboarding/settings/templates/dynamic/${id}`);
      toast.success('Template deleted');
      fetchSettings();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  useEffect(() => {
    if (activeTab === 'employees') fetchEmployees();
    if (activeTab === 'settings') fetchSettings();
  }, [fetchEmployees, fetchSettings, activeTab]);

  const handleTemplateUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      toast.error('Please upload a .docx file');
      return;
    }

    const formData = new FormData();
    formData.append('document', file);
    formData.append('type', type);

    try {
      toast.loading(`Uploading ${type === 'offerLetter' ? 'Offer Letter' : 'Declaration'}...`, { id: 'upload' });
      const res = await api.post('/onboarding/settings/templates/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message, { id: 'upload' });
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed', { id: 'upload' });
    }
  };

  const handlePolicyUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = prompt('Enter policy name (e.g. Employee Handbook):');
    if (!name) return;

    const formData = new FormData();
    formData.append('document', file);
    formData.append('name', name);
    formData.append('isRequired', 'true');

    try {
      toast.loading('Uploading policy...', { id: 'policy' });
      await api.post('/onboarding/settings/policies/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Policy uploaded!', { id: 'policy' });
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed', { id: 'policy' });
    }
  };

  const handleDeletePolicy = async (policyId) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    try {
      await api.delete(`/onboarding/settings/policies/${policyId}`);
      toast.success('Policy deleted');
      fetchSettings();
    } catch (err) {
      toast.error('Failed to delete policy');
    }
  };

  const handlePreview = async (type, withData = true) => {
    try {
      setPreviewLoading(true);
      setPreviewType(type);
      setPreviewWithData(withData);
      setShowPreviewModal(true);
      // Clean up previous blob URL if exists
      if (previewBlob) setPreviewBlob(null);

      const res = await api.get(`/onboarding/settings/templates/${type}/preview?withData=${withData}`, { responseType: 'blob' });
      setPreviewBlob(res.data);
    } catch (err) {
      console.error('Preview error:', err);
      toast.error('Failed to load preview');
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (previewBlob && previewContainerRef.current) {
      previewContainerRef.current.innerHTML = '';
      renderAsync(previewBlob, previewContainerRef.current, null, {
        className: "docx-content",
        inWrapper: false, // Don't allow docx-preview to create its own wrapper/shadows
        breakPages: false,
        ignoreWidth: true, // Let our container handle width
        ignoreHeight: true,
        debug: false
      }).catch(err => console.error('Docx-preview error:', err));
    }
  }, [previewBlob, showPreviewModal]);

  const handleDownloadTemplate = async (type) => {
    try {
      toast.loading('Preparing download...', { id: 'dl' });
      const res = await api.get(`/onboarding/settings/templates/${type}/download`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      const filename = `${type === 'offerLetter' ? 'OfferLetter' : 'Declaration'}_Template.docx`;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Downloaded successfully!', { id: 'dl' });
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Download failed', { id: 'dl' });
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      await api.post('/onboarding/employees', formData);
      toast.success('Employee added! Select sections and Send Email to notify candidate.');
      setShowAddModal(false);
      setFormData({
        firstName: '', lastName: '', email: '', phone: '',
        designation: '', department: '', joiningDate: '', documentDeadline: '',
        workLocation: '', address: '', probationPeriod: '6 months',
        salary: { annualCTC: '', basic: '', hra: '', specialAllowance: '', monthlyGross: '', monthlyCTC: '' }
      });
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add');
    }
  };

  const openDetail = async (emp) => {
    try {
      setDetailLoading(true);
      setShowDetailModal(true);
      fetchSettings(); // Refresh settings to show latest templates/policies in selection
      const res = await api.get(`/onboarding/employees/${emp._id}`);
      setSelectedEmployee(res.data);
      setEmailDeadline(res.data.documentDeadline ? res.data.documentDeadline.split('T')[0] : '');
    } catch (err) {
      toast.error('Failed to load details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleFlagDoc = async (empId, docId) => {
    const reason = prompt('Enter reason for re-upload:');
    if (!reason) return;
    try {
      const res = await api.patch(`/onboarding/employees/${empId}/documents/${docId}/flag`, { reason });
      toast.success('Document flagged');

      // Update local state instantly without full refresh
      const updatedEmp = res.data.employee;
      if (updatedEmp) {
        setSelectedEmployee(updatedEmp);
        setEmployees(prev => prev.map(e => e._id === empId ? { ...e, status: updatedEmp.status } : e));
      }
    } catch (err) {
      toast.error('Failed to flag');
    }
  };

  const handleApproveDoc = async (empId, docId) => {
    try {
      const res = await api.patch(`/onboarding/employees/${empId}/documents/${docId}/approve`);
      toast.success('Document approved');

      // Update local state instantly without full refresh
      const updatedEmp = res.data.employee;
      if (updatedEmp) {
        setSelectedEmployee(updatedEmp);
        setEmployees(prev => prev.map(e => e._id === empId ? { ...e, status: updatedEmp.status } : e));
      }
    } catch (err) {
      toast.error('Failed to approve');
    }
  };

  const handleDownloadZip = async (emp) => {
    try {
      toast.loading('Generating ZIP...', { id: 'zip' });
      const res = await api.get(`/onboarding/employees/${emp._id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${emp.tempEmployeeId}_documents.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.dismiss('zip');
      toast.success('Downloaded!');
    } catch (err) {
      toast.dismiss('zip');
      toast.error('Download failed');
    }
  };

  const handleEditEmployee = (emp) => {
    setFormData({
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      designation: emp.designation || '',
      department: emp.department || '',
      joiningDate: emp.joiningDate ? emp.joiningDate.split('T')[0] : '',
      documentDeadline: emp.documentDeadline ? emp.documentDeadline.split('T')[0] : '',
      workLocation: emp.workLocation || '',
      address: emp.address || emp.personalDetails?.currentAddress?.line1 || '',
      probationPeriod: emp.probationPeriod || '6 months',
      salary: {
        annualCTC: emp.salary?.annualCTC || '',
        basic: emp.salary?.basic || '',
        hra: emp.salary?.hra || '',
        specialAllowance: emp.salary?.specialAllowance || '',
        monthlyGross: emp.salary?.monthlyGross || '',
        monthlyCTC: emp.salary?.monthlyCTC || ''
      }
    });
    setSelectedEmployee(emp);
    setShowEditModal(true);
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/onboarding/employees/${selectedEmployee._id}`, formData);
      toast.success('Employee updated successfully!');
      setShowEditModal(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleRegenerateCredentials = async (empId) => {
    if (!confirm('Are you sure you want to regenerate credentials? The old password will stop working immediately.')) return;
    try {
      const res = await api.post(`/onboarding/employees/${empId}/regenerate-credentials`);
      toast.success(
        (t) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontWeight: 700 }}>Credentials Regenerated!</span>
            <div style={{ fontSize: '13px' }}>
              <div><strong>ID:</strong> {res.data.tempEmployeeId}</div>
              <div><strong>Password:</strong> {res.data.tempPassword}</div>
              <div style={{ color: '#059669', marginTop: '4px', fontSize: '11px' }}>Select sections and click Send Email to notify the candidate.</div>
            </div>
          </div>
        ),
        { duration: 10000 }
      );
      fetchEmployees();
    } catch (err) {
      toast.error('Failed to regenerate credentials');
    }
  };

  const handleDownloadDocx = async (empId, type) => {
    try {
      toast.loading(`Generating document...`, { id: 'docx' });
      const res = await api.get(`/onboarding/employees/${empId}/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}_${empId}.docx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.dismiss('docx');
      toast.success('Downloaded!');
    } catch (err) {
      toast.dismiss('docx');
      toast.error('Download failed');
    }
  };

  const getProgressPercent = (emp) => {
    if (!emp.documents) return 0;
    const uploaded = emp.documents.filter(d => d.url).length;
    let sectionsDone = 0;
    if (emp.personalDetails?.isComplete) sectionsDone++;
    if (emp.emergencyContact?.isComplete) sectionsDone++;
    if (emp.bankDetails?.isComplete) sectionsDone++;
    if (emp.offerDeclaration?.isComplete) sectionsDone++;
    const totalItems = emp.documents.length + 4;
    return Math.round(((uploaded + sectionsDone) / totalItems) * 100);
  };

  const DOC_BADGE = {
    Pending: { bg: '#f1f5f9', text: '#64748b' },
    'Mail Sent': { bg: '#fef3c7', text: '#92400e' },
    Uploaded: { bg: '#dbeafe', text: '#1d4ed8' },
    Approved: { bg: '#d1fae5', text: '#059669' },
    'Re-upload Required': { bg: '#fee2e2', text: '#dc2626' },
    Policy: { bg: '#f1f5f9', text: '#64748b' }
  };

  const handleTransferToActive = async (empId) => {
    if (!confirm('Transfer this onboarding employee to an active user account? This will create a new user with their data and documents.')) return;
    try {
      const res = await api.post(`/onboarding/employees/${empId}/transfer-to-active`);
      toast.success(
        (t) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontWeight: 700 }}>Employee Activated!</span>
            <div style={{ fontSize: '13px' }}>
              <div><strong>Name:</strong> {res.data.user.firstName} {res.data.user.lastName}</div>
              <div><strong>Code:</strong> {res.data.user.employeeCode}</div>
              <div><strong>Docs Transferred:</strong> {res.data.documentsTransferred}</div>
              <div><strong>Temp Password:</strong> {res.data.tempPassword}</div>
              <div style={{ color: '#059669', marginTop: '4px', fontSize: '11px' }}>A welcome email with login details has been sent.</div>
            </div>
          </div>
        ),
        { duration: 15000 }
      );
      setShowDetailModal(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Pre-Onboarding Portal</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>Manage new hire pre-onboarding and document collection</p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
          <UserPlus size={18} /> Add Employee
        </button>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <button onClick={() => setActiveTab('employees')} style={{ position: 'relative', padding: '12px 4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: '600', color: activeTab === 'employees' ? '#2563eb' : '#64748b' }}>
          Employees
          {activeTab === 'employees' && <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: '2px', background: '#2563eb' }} />}
        </button>
        <button onClick={() => setActiveTab('settings')} style={{ position: 'relative', padding: '12px 4px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: '600', color: activeTab === 'settings' ? '#2563eb' : '#64748b' }}>
          Template Settings
          {activeTab === 'settings' && <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: '2px', background: '#2563eb' }} />}
        </button>
      </div>

      {activeTab === 'employees' ? (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {Object.entries(stats).map(([key, val]) => (
              <div key={key} onClick={() => { setStatusFilter(key === statusFilter ? 'All' : key); setPage(1); }} style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: 'pointer', border: statusFilter === key ? `2px solid ${STATUS_COLORS[key].dot}` : '2px solid transparent', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: STATUS_COLORS[key].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: STATUS_COLORS[key].dot }}>{STATUS_ICONS[key]}</div>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{key}</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Search & Filter */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                placeholder="Search by name, email or ID..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {statusFilter !== 'All' && (
              <button onClick={() => { setStatusFilter('All'); setPage(1); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}>
                <X size={14} /> Clear filter
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Employee</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Temp ID</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Designation</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Joining Date</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Deadline</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Progress</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading...</td></tr>
                  ) : employees.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No onboarding employees found</td></tr>
                  ) : employees.map((emp) => {
                    const progress = getProgressPercent(emp);
                    const sc = STATUS_COLORS[emp.status] || STATUS_COLORS.Pending;
                    return (
                      <tr 
                        key={emp._id} 
                        onClick={() => openDetail(emp)}
                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s', cursor: 'pointer' }} 
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} 
                        onMouseLeave={(e) => e.currentTarget.style.background = ''}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {emp.sourcedFromTA && (
                              <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#fef2f2', color: '#b91c1c', fontSize: '10px', fontWeight: '700', border: '1px solid #fee2e2', textTransform: 'uppercase' }}>
                                Transfer
                              </span>
                            )}
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{emp.firstName} {emp.lastName}</div>
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{emp.email}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '13px', fontWeight: '600' }}>{emp.tempEmployeeId}</code>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569' }}>{emp.designation || '—'}</td>
                        <td style={{ padding: '14px 16px', color: '#475569' }}>{emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td style={{ padding: '14px 16px', color: '#475569' }}>{emp.documentDeadline ? new Date(emp.documentDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#10b981' : '#3b82f6', borderRadius: '3px', transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', minWidth: '32px' }}>{progress}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: sc.bg, color: sc.text }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc.dot }} />
                            {emp.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button
                              onClick={(e) => toggleMenu(e, emp._id)}
                              style={{
                                padding: '8px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                background: activeMenu === emp._id ? '#f1f5f9' : '#fff',
                                cursor: 'pointer',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                              }}
                              title="Actions"
                            >
                              <MoreVertical size={18} />
                            </button>

                            {/* Action Menu Portal */}
                            {activeMenu === emp._id && createPortal(
                              <div
                                style={{
                                  position: 'fixed',
                                  zIndex: 9999,
                                  width: '200px',
                                  background: '#fff',
                                  borderRadius: '12px',
                                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                  border: '1px solid #e2e8f0',
                                  padding: '4px',
                                  ...menuPosition
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => { openDetail(emp); setActiveMenu(null); }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', color: '#1e293b', fontSize: '14px', fontWeight: '500', borderRadius: '8px', textAlign: 'left', transition: 'background 0.1s' }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                  <Eye size={16} style={{ color: '#3b82f6' }} /> View Details
                                </button>

                                <button
                                  onClick={() => { handleEditEmployee(emp); setActiveMenu(null); }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', color: '#1e293b', fontSize: '14px', fontWeight: '500', borderRadius: '8px', textAlign: 'left', transition: 'background 0.1s' }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                  <Edit2 size={16} style={{ color: '#059669' }} /> Edit Details
                                </button>

                                <button
                                  onClick={() => { handleRegenerateCredentials(emp._id); setActiveMenu(null); }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', color: '#1e293b', fontSize: '14px', fontWeight: '500', borderRadius: '8px', textAlign: 'left', transition: 'background 0.1s' }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                  <Key size={16} style={{ color: '#f59e0b' }} /> Credentials
                                </button>

                                <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 8px' }} />

                                <button
                                  onClick={() => { handleDownloadZip(emp); setActiveMenu(null); }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', color: '#1e293b', fontSize: '14px', fontWeight: '500', borderRadius: '8px', textAlign: 'left', transition: 'background 0.1s' }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                  <Download size={16} style={{ color: '#8b5cf6' }} /> Export Docs
                                </button>
                              </div>,
                              document.body
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px', borderTop: '1px solid #e2e8f0' }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i + 1)} style={{ padding: '6px 12px', borderRadius: '6px', border: page === i + 1 ? '1px solid #3b82f6' : '1px solid #e2e8f0', background: page === i + 1 ? '#2563eb' : '#fff', color: page === i + 1 ? '#fff' : '#475569', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{i + 1}</button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: '0 0 4px' }}>Onboarding Document Settings</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Configure and manage all documents required for new employee onboarding.</p>
          </div>

          <div style={{ padding: '24px', display: 'grid', gap: '24px' }}>
            {/* Portion 1: Dynamic Documents */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={18} style={{ color: '#2563eb' }} /> Portion 1: Dynamic Document Templates
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Documents requiring placeholders populated with candidate data.</p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#2563eb', color: '#fff', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.2)' }}>
                  <Upload size={16} /> Upload .docx
                  <input type="file" accept=".docx" onChange={handleDynamicTemplateUpload} style={{ display: 'none' }} />
                </label>
              </div>

              <div style={{ padding: '16px' }}>
                {(onboardingSettings.dynamicTemplates?.length === 0 && !onboardingSettings.offerLetterTemplateUrl) ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>No dynamic templates uploaded yet.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {onboardingSettings.offerLetterTemplateUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px' }}>
                        <FileText size={20} style={{ color: '#0369a1' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0c4a6e' }}>Primary Offer Letter Template</div>
                          <div style={{ fontSize: '11px', color: '#0369a1' }}>Standard system-generated document</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handlePreview('offerLetter')} style={{ padding: '6px', borderRadius: '8px', border: '1px solid #bae6fd', background: '#fff', color: '#0369a1', display: 'flex' }} title="Preview"><Eye size={16} /></button>
                          <button onClick={() => handleDownloadTemplate('offerLetter')} style={{ padding: '6px', borderRadius: '8px', border: '1px solid #bae6fd', background: '#fff', color: '#0369a1', display: 'flex' }} title="Download Template"><Download size={16} /></button>
                        </div>
                      </div>
                    )}
                    {onboardingSettings.dynamicTemplates?.map((temp) => (
                      <div key={temp._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <FileText size={20} style={{ color: '#64748b' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{temp.name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Custom Dynamic Template</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <a href={temp.url} target="_blank" rel="noreferrer" style={{ padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#3b82f6', display: 'flex' }} title="View Original"><Eye size={16} /></a>
                          <button onClick={() => handleDeleteDynamicTemplate(temp._id)} style={{ padding: '6px', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', display: 'flex' }} title="Delete Template"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Portion 2: Static Policies */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={18} style={{ color: '#10b981' }} /> Portion 2: Static Company Policies
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Documents sent <b>without any changes</b> (e.g., Handbooks, Code of Conduct).</p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.2)' }}>
                  <Upload size={16} /> Upload Policy PDF
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handlePolicyUpload} style={{ display: 'none' }} />
                </label>
              </div>

              <div style={{ padding: '16px' }}>
                {!onboardingSettings.policies || onboardingSettings.policies.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>No policies uploaded yet.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {onboardingSettings.policies?.map((policy) => (
                      <div key={policy._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <FileText size={20} style={{ color: '#64748b' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{policy.name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{policy.isRequired ? 'Mandatory for candidates' : 'Optional'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <a href={policy.url} target="_blank" rel="noreferrer" style={{ padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#3b82f6', display: 'flex' }} title="View Policy"><Eye size={16} /></a>
                          <button onClick={() => handleDeletePolicy(policy._id)} style={{ padding: '6px', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fff', color: '#dc2626', cursor: 'pointer', display: 'flex' }} title="Delete Policy"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '24px', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: '#f59e0b' }} /> Available Placeholders Reference
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Copy and paste these exact tags into your Word document. The system will automatically replace them with real data.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                {[
                  { tag: '{employee_full_name}', desc: 'Full Name' }, { tag: '{employee_first_name}', desc: 'First Name' },
                  { tag: '{employee_last_name}', desc: 'Last Name' }, { tag: '{designation}', desc: 'Designation' },
                  { tag: '{joining_date}', desc: 'Joining Date' }, { tag: '{annual_ctc}', desc: 'Annual CTC' },
                  { tag: '{employee_address}', desc: 'Full Address' }, { tag: '{work_location}', desc: 'Work Location' },
                  { tag: '{probation_period}', desc: 'Probation Period' }, { tag: '{basic_salary}', desc: 'Basic Salary' },
                  { tag: '{hra}', desc: 'House Rent Allowance' }, { tag: '{monthly_gross}', desc: 'Monthly Gross' },
                  { tag: '{hr_name}', desc: 'Authorized Signatory Name' }
                ].map(p => (
                  <div key={p.tag} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <span style={{ fontFamily: 'Calibri, "Segoe UI", sans-serif', fontSize: '12pt', fontWeight: '600', color: '#0f172a' }}>{p.tag}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>Add New Employee</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEmployee} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>First Name *</label>
                  <input required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Last Name</label>
                  <input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Email *</label>
                  <input required type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Phone</label>
                  <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Designation</label>
                  <input value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Department</label>
                  <input value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Joining Date</label>
                  <input type="date" value={formData.joiningDate} onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>


                <div style={{ gridColumn: '1 / -1', marginTop: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>Employment Details</h3>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Work Location</label>
                  <input value={formData.workLocation} onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })} placeholder="e.g. Gurugram, HR" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Physical Address</label>
                  <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder={"House/Flat No., Street Name\nArea/Locality\nCity, State – PIN Code"} rows="3" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Probation Period</label>
                  <input value={formData.probationPeriod} onChange={(e) => setFormData({ ...formData, probationPeriod: e.target.value })} placeholder="e.g. 6 months" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ gridColumn: '1 / -1', marginTop: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>Salary Details</h3>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Annual CTC</label>
                  <input value={formData.salary.annualCTC} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, annualCTC: e.target.value } })} placeholder="e.g. 5,00,000" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Basic Salary (Monthly)</label>
                  <input value={formData.salary.basic} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, basic: e.target.value } })} placeholder="e.g. 25,000" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>HRA (Monthly)</label>
                  <input value={formData.salary.hra} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, hra: e.target.value } })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Special Allowance (Monthly)</label>
                  <input value={formData.salary.specialAllowance} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, specialAllowance: e.target.value } })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Monthly Gross</label>
                  <input value={formData.salary.monthlyGross} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, monthlyGross: e.target.value } })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Monthly CTC</label>
                  <input value={formData.salary.monthlyCTC} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, monthlyCTC: e.target.value } })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: '#475569' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 24px', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '14px', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Send size={16} /> Add & Send Credentials</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>Edit Employee Details</h2>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Update information for {selectedEmployee?.firstName} {selectedEmployee?.lastName}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateEmployee} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>First Name *</label>
                  <input required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Last Name</label>
                  <input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Email *</label>
                  <input required type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Phone</label>
                  <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Designation</label>
                  <input value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Department</label>
                  <input value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Joining Date</label>
                  <input type="date" value={formData.joiningDate} onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>


                <div style={{ gridColumn: '1 / -1', marginTop: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>Employment Details</h3>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Work Location</label>
                  <input value={formData.workLocation} onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })} placeholder="e.g. Gurugram, HR" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Physical Address</label>
                  <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder={"House/Flat No., Street Name\nArea/Locality\nCity, State – PIN Code"} rows="3" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Probation Period</label>
                  <input value={formData.probationPeriod} onChange={(e) => setFormData({ ...formData, probationPeriod: e.target.value })} placeholder="e.g. 6 months" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ gridColumn: '1 / -1', marginTop: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>Salary Details</h3>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Annual CTC</label>
                  <input value={formData.salary.annualCTC} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, annualCTC: e.target.value } })} placeholder="e.g. 5,00,000" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Basic Salary (Monthly)</label>
                  <input value={formData.salary.basic} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, basic: e.target.value } })} placeholder="e.g. 25,000" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>HRA (Monthly)</label>
                  <input value={formData.salary.hra} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, hra: e.target.value } })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Special Allowance (Monthly)</label>
                  <input value={formData.salary.specialAllowance} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, specialAllowance: e.target.value } })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Monthly Gross</label>
                  <input value={formData.salary.monthlyGross} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, monthlyGross: e.target.value } })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Monthly CTC</label>
                  <input value={formData.salary.monthlyCTC} onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, monthlyCTC: e.target.value } })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: '#475569' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 24px', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '14px', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><RefreshCw size={16} /> Update Details</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal / Slide-out */}
      {showDetailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '640px', height: '100vh', overflow: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', animation: 'slideIn 0.3s ease-out' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Employee Details</h2>
              <button onClick={() => { setShowDetailModal(false); setSelectedEmployee(null); setCheckedSections(new Set()); setCheckedDocuments(new Set()); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}><X size={20} /></button>
            </div>

            {detailLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
            ) : selectedEmployee && (
              <div style={{ padding: '24px' }}>
                {/* Employee Info */}
                <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '20px', color: '#0f172a' }}>{selectedEmployee.firstName} {selectedEmployee.lastName}</h3>
                      <p style={{ margin: '0 0 2px', color: '#64748b', fontSize: '14px' }}>{selectedEmployee.email}</p>
                      <code style={{ background: '#e0e7ff', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '13px' }}>{selectedEmployee.tempEmployeeId}</code>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: (STATUS_COLORS[selectedEmployee.status] || STATUS_COLORS.Pending).bg, color: (STATUS_COLORS[selectedEmployee.status] || STATUS_COLORS.Pending).text }}>
                      {selectedEmployee.status}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', fontSize: '13px' }}>
                    <div><span style={{ color: '#94a3b8' }}>Department:</span> <strong>{selectedEmployee.department || '—'}</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>Designation:</span> <strong>{selectedEmployee.designation || '—'}</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>Joining:</span> <strong>{selectedEmployee.joiningDate ? new Date(selectedEmployee.joiningDate).toLocaleDateString('en-IN') : '—'}</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>Deadline:</span> <strong>{selectedEmployee.documentDeadline ? new Date(selectedEmployee.documentDeadline).toLocaleDateString('en-IN') : '—'}</strong></div>
                  </div>


                </div>

                {/* Deadline & Expiry Alerts */}
                {selectedEmployee.credentialRegenerationRequest?.requested && !selectedEmployee.credentialRegenerationRequest?.resolved && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#b91c1c', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} />
                      <strong>Candidate Requested New Credentials:</strong> {selectedEmployee.credentialRegenerationRequest.reason || 'Expired or lost'}
                    </div>
                    <button onClick={() => handleGenerateCredentials(selectedEmployee._id)} style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '600', color: '#fff', background: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Regenerate & Resolve
                    </button>
                  </div>
                )}

                {selectedEmployee.extensionRequests?.map(ext => ext.status === 'Pending' && (
                  <div key={ext._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '13px', color: '#1d4ed8', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} />
                      <div>
                        <strong>Extension Requested:</strong> {ext.requestedDays} days. Reason: "{ext.reason}"
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={async () => {
                        try {
                          await axios.post(`${API_URL}/onboarding/employees/${selectedEmployee._id}/extension/${ext._id}/resolve`, { status: 'Rejected' }, { headers: getHeaders() });
                          toast.success('Extension rejected');
                          fetchEmployees();
                          setSelectedEmployee(prev => ({ ...prev, extensionRequests: prev.extensionRequests.map(r => r._id === ext._id ? { ...r, status: 'Rejected' } : r) }));
                        } catch (e) { toast.error('Failed to reject extension'); }
                      }} style={{ padding: '4px 8px', fontSize: '12px', fontWeight: '600', color: '#1d4ed8', background: 'none', border: '1px solid #1d4ed8', borderRadius: '4px', cursor: 'pointer' }}>Reject</button>
                      <button onClick={() => {
                        // Open edit modal to let HR extend deadline, then we resolve it.
                        // For simplicity, let's just approve it right here by adding days to current deadline.
                        const currentDeadline = selectedEmployee.documentDeadline ? new Date(selectedEmployee.documentDeadline) : new Date();
                        currentDeadline.setDate(currentDeadline.getDate() + ext.requestedDays);
                        axios.post(`${API_URL}/onboarding/employees/${selectedEmployee._id}/extension/${ext._id}/resolve`, { status: 'Approved', newDeadline: currentDeadline.toISOString() }, { headers: getHeaders() })
                          .then(() => {
                            toast.success(`Extension approved. New deadline: ${currentDeadline.toLocaleDateString()}`);
                            fetchEmployees();
                            const updatedExt = { ...ext, status: 'Approved' };
                            setSelectedEmployee(prev => ({
                              ...prev,
                              documentDeadline: currentDeadline.toISOString(),
                              extensionRequests: prev.extensionRequests.map(r => r._id === ext._id ? updatedExt : r)
                            }));
                          })
                          .catch(() => toast.error('Failed to approve extension'));
                      }} style={{ padding: '4px 8px', fontSize: '12px', fontWeight: '600', color: '#fff', background: '#2563eb', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Approve ({ext.requestedDays} Days)</button>
                    </div>
                  </div>
                ))}

                {selectedEmployee.documentDeadline && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '13px', color: '#92400e', marginBottom: '8px' }}>
                    <Clock size={16} />
                    <strong>Document Deadline:</strong> {new Date(selectedEmployee.documentDeadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}

                {selectedEmployee.credentialsExpireAt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#991b1b', marginBottom: '12px' }}>
                    <AlertTriangle size={16} />
                    <strong>Credentials Expire:</strong> {new Date(selectedEmployee.credentialsExpireAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}

                {/* Section Completion & Details */}
                <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>Form Sections</h4>
                <div style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
                  {[
                    { id: 'personal', label: 'Personal Details', done: selectedEmployee.personalDetails?.isComplete, data: selectedEmployee.personalDetails },
                    { id: 'emergency', label: 'Emergency Contact', done: selectedEmployee.emergencyContact?.isComplete, data: selectedEmployee.emergencyContact },
                    { id: 'bank', label: 'Bank Details', done: selectedEmployee.bankDetails?.isComplete, data: selectedEmployee.bankDetails },
                    { id: 'offer', label: 'Offer Declaration', done: selectedEmployee.offerDeclaration?.isComplete, data: selectedEmployee.offerDeclaration }
                  ].map((s) => {
                    const isRequested = Array.isArray(selectedEmployee.requestedSections) && selectedEmployee.requestedSections.find(rs => (typeof rs === 'string' ? rs === s.label : rs.label === s.label));
                    const isComplete = s.done;
                    const sentDate = isRequested?.emailSentAt;
                    let statusText = isComplete ? 'Complete' : (sentDate ? 'Mail Sent' : 'Pending');
                    let badgeBg = isComplete ? '#dcfce7' : (statusText === 'Mail Sent' ? '#fef3c7' : '#f1f5f9');
                    let badgeColor = isComplete ? '#16a34a' : (statusText === 'Mail Sent' ? '#d97706' : '#64748b');
                    let iconColor = isComplete ? '#22c55e' : (statusText === 'Mail Sent' ? '#f59e0b' : '#94a3b8');

                    return (
                      <div key={s.id} style={{ borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', cursor: 'pointer', background: s.done ? '#f0fdf4' : '#fefce8' }}>
                          <div onClick={(e) => { e.stopPropagation(); toggleCheckedSection(s.label); }} style={{ cursor: 'pointer', flexShrink: 0 }}>
                            {checkedSections.has(s.label) ? <CheckSquare size={18} color="#2563eb" /> : <Square size={18} color="#94a3b8" />}
                          </div>
                          <div onClick={() => toggleSection(s.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            {s.done ? <CheckCircle size={16} style={{ color: iconColor }} /> : <Clock size={16} style={{ color: iconColor }} />}
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{s.label}</span>
                            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ fontSize: '11px', fontWeight: '600', color: badgeColor, background: badgeBg, padding: '2px 8px', borderRadius: '4px' }}>{statusText}</span>
                              {statusText === 'Mail Sent' && sentDate && <span style={{ fontSize: '10px', color: '#92400e', marginTop: '2px' }}>📧 Sent: {new Date(sentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
                            </div>
                            <ChevronDown size={16} style={{ color: '#94a3b8', transform: expandedSections[s.id] ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
                          </div>
                        </div>

                        {expandedSections[s.id] && (
                          <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', background: '#fff', fontSize: '13px' }}>
                            {s.id === 'personal' && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div><span style={{ color: '#94a3b8' }}>Full Name:</span> <br /> <strong>{s.data?.fullName || '—'}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>DOB:</span> <br /> <strong>{s.data?.dateOfBirth ? new Date(s.data.dateOfBirth).toLocaleDateString('en-IN') : '—'}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>Gender:</span> <br /> <strong>{s.data?.gender || '—'}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>Blood Group:</span> <br /> <strong>{s.data?.bloodGroup || '—'}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>Email:</span> <br /> <strong>{s.data?.personalEmail || '—'}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>Mobile:</span> <br /> <strong>{s.data?.personalMobile || '—'}</strong></div>
                                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#94a3b8' }}>Current Address:</span> <br /> <strong>{s.data?.currentAddress && s.data.currentAddress.line1 ? `${s.data.currentAddress.line1}, ${s.data.currentAddress.city}, ${s.data.currentAddress.state} - ${s.data.currentAddress.pincode}` : (selectedEmployee.address || '—')}</strong></div>
                                {s.data?.linkedinUrl && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#94a3b8' }}>LinkedIn:</span> <br /> <a href={s.data.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>{s.data.linkedinUrl}</a></div>}
                              </div>
                            )}
                            {s.id === 'emergency' && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div><span style={{ color: '#94a3b8' }}>Name:</span> <br /> <strong>{s.data?.contactName || '—'}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>Relationship:</span> <br /> <strong>{s.data?.relationship || '—'}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>Phone:</span> <br /> <strong>{s.data?.phoneNumber || '—'}</strong></div>
                                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#94a3b8' }}>Address:</span> <br /> <strong>{s.data?.address || '—'}</strong></div>
                              </div>
                            )}
                            {s.id === 'bank' && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div><span style={{ color: '#94a3b8' }}>Bank Name:</span> <br /> <strong>{s.data?.bankName || '—'}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>A/C Number:</span> <br /> <strong>{s.data?.accountNumber || '—'}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>IFSC Code:</span> <br /> <strong>{s.data?.ifscCode || '—'}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>Type:</span> <br /> <strong>{s.data?.accountType || '—'}</strong></div>
                                {s.data?.cancelledChequeUrl && <div style={{ gridColumn: '1 / -1' }}><a href={s.data.cancelledChequeUrl} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontWeight: '600' }}>View Cancelled Cheque ↗</a></div>}
                              </div>
                            )}
                            {s.id === 'offer' && (
                              <div style={{ display: 'grid', gap: '8px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>{s.data?.hasReadOfferLetter ? <Check size={14} color="#22c55e" /> : <X size={14} color="#ef4444" />} <span>Read Offer Letter</span></div>
                                <div style={{ display: 'flex', gap: '8px' }}>{s.data?.hasProvidedTrueInfo ? <Check size={14} color="#22c55e" /> : <X size={14} color="#ef4444" />} <span>Provided True Info</span></div>
                                <div style={{ display: 'flex', gap: '8px' }}>{s.data?.agreesToOriginalVerification ? <Check size={14} color="#22c55e" /> : <X size={14} color="#ef4444" />} <span>Agrees to Verification</span></div>
                                <div style={{ marginTop: '8px', borderTop: '1px dashed #e2e8f0', paddingTop: '8px' }}>
                                  <span style={{ color: '#94a3b8' }}>E-Signature:</span> <br />
                                  <strong>{s.data?.eSignName}</strong> <br />
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>Signed on {s.data?.eSignDate ? new Date(s.data.eSignDate).toLocaleDateString('en-IN') : '—'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Documents */}
                <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>Documents & Requirements</h4>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {[
                    ...(selectedEmployee.documents || []).map(d => ({ ...d, itemType: 'document' })),
                    ...(onboardingSettings.policies || [])
                      .filter(p => (selectedEmployee.requestedDocuments || []).some(rd => rd.label === p.name))
                      .map(p => {
                        const req = (selectedEmployee.requestedDocuments || []).find(rd => rd.label === p.name);
                        return {
                          label: p.name,
                          status: 'Policy',
                          itemType: 'policy',
                          _id: p._id,
                          isAccepted: (selectedEmployee.offerDeclaration?.acceptedPolicies || []).some(ap => ap.policyId === p._id),
                          emailSentAt: req?.emailSentAt
                        };
                      }),
                    ...(onboardingSettings.dynamicTemplates || []).map(t => {
                      const req = (selectedEmployee.requestedDocuments || []).find(rd => rd.label === t.name);
                      return {
                        label: t.name,
                        status: 'Template',
                        itemType: 'template',
                        _id: t._id,
                        isAccepted: (selectedEmployee.offerDeclaration?.acceptedTemplates || []).some(at => at.templateId === t._id),
                        emailSentAt: req?.emailSentAt
                      };
                    }),
                    ...(onboardingSettings.offerLetterTemplateUrl ? (() => {
                      const req = (selectedEmployee.requestedDocuments || []).find(rd => rd.label === 'Offer Letter');
                      return [{
                        label: 'Offer Letter',
                        status: 'Template',
                        itemType: 'template',
                        _id: 'offer-letter-default',
                        isAccepted: selectedEmployee.offerDeclaration?.hasReadOfferLetter,
                        emailSentAt: req?.emailSentAt
                      }];
                    })() : [])
                  ].map((item, idx) => {
                    const isDoc = item.itemType === 'document';
                    const badge = isDoc ? (DOC_BADGE[item.status] || DOC_BADGE.Pending) : { bg: '#f0fdf4', text: '#16a34a' };
                    return (
                      <div key={item._id || idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap' }}>
                        <div onClick={() => toggleCheckedDocument(item.label)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                          {checkedDocuments.has(item.label) ? <CheckSquare size={18} color="#2563eb" /> : <Square size={18} color="#94a3b8" />}
                        </div>
                        {item.itemType === 'policy' ? <ScrollText size={16} style={{ color: item.isAccepted ? '#059669' : '#f59e0b', flexShrink: 0 }} /> :
                          item.itemType === 'template' ? <FileSignature size={16} style={{ color: item.isAccepted ? '#059669' : '#f59e0b', flexShrink: 0 }} /> :
                            <FileText size={16} style={{ color: '#64748b', flexShrink: 0 }} />}

                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{item.label}</div>
                          {item.rejectionReason && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '2px' }}>⚠️ {item.rejectionReason}</div>}
                          {(item.itemType === 'policy' || item.itemType === 'template') && !item.isAccepted && (
                            <div style={{ fontSize: '11px', color: item.emailSentAt ? '#92400e' : '#d97706', marginTop: '2px' }}>
                              {item.emailSentAt ? 'Awaiting candidate acceptance' : 'Pending selection'}
                            </div>
                          )}
                          {item.emailSentAt && <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>📧 Sent: {new Date(item.emailSentAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>}
                          {isDoc && item.uploadedAt && <div style={{ fontSize: '11px', color: '#1d4ed8', marginTop: '2px' }}>📤 Uploaded: {new Date(item.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>}
                        </div>
                        {item.itemType === 'policy' || item.itemType === 'template' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: item.isAccepted ? '#dcfce7' : (item.emailSentAt ? '#fef3c7' : '#f1f5f9'), color: item.isAccepted ? '#15803d' : (item.emailSentAt ? '#92400e' : '#64748b'), whiteSpace: 'nowrap' }}>
                            {item.isAccepted ? <><Check size={12} /> Accepted</> : item.emailSentAt ? <><Send size={12} /> Mail Sent</> : <><Clock size={12} /> Pending</>}
                          </span>
                        ) : (
                          <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: badge.bg, color: badge.text, whiteSpace: 'nowrap' }}>{item.status}</span>
                        )}

                        {isDoc && (
                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#3b82f6', fontSize: '12px', textDecoration: 'none', fontWeight: '600', transition: 'all 0.2s' }}>View</a>
                            )}
                            {item.status === 'Uploaded' && (
                              <>
                                <button onClick={() => handleApproveDoc(selectedEmployee._id, item._id)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #dcfce7, #d1fae5)', color: '#15803d', fontSize: '12px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>✓ Approve</button>
                                <button onClick={() => handleFlagDoc(selectedEmployee._id, item._id)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #fee2e2, #fecaca)', color: '#dc2626', fontSize: '12px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>✕ Flag</button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Submission Deadline Selection */}
                <div style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} style={{ color: '#3b82f6' }} /> Submission Deadline for Candidate
                  </label>
                  <input
                    type="date"
                    value={emailDeadline}
                    onChange={(e) => setEmailDeadline(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fff' }}
                  />
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>The candidate's portal access and deadline in the email will be updated to this date.</p>
                </div>

                {/* Send Pre-Onboarding Email Button */}
                <div style={{ marginTop: '24px', marginBottom: '24px' }}>
                  <button
                    onClick={handleSendOnboardingEmail}
                    disabled={sendingEmail}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', cursor: sendingEmail ? 'wait' : 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', opacity: sendingEmail ? 0.7 : 1, transition: 'all 0.2s' }}
                  >
                    <Mail size={18} /> {sendingEmail ? 'Sending...' : 'Send Pre-Onboarding Email'}
                  </button>
                  {(checkedSections.size > 0 || checkedDocuments.size > 0) && (
                    <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', marginTop: '8px' }}>
                      {checkedSections.size + checkedDocuments.size} item(s) selected
                    </p>
                  )}
                </div>

                {/* Transfer to Active Employee */}
                {!selectedEmployee.transferredToUserId && (
                  <div style={{ marginBottom: '24px' }}>
                    <button
                      onClick={() => handleTransferToActive(selectedEmployee._id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 14px rgba(5,150,105,0.3)', transition: 'all 0.2s' }}
                    >
                      <ArrowRightCircle size={18} /> Transfer to Active Employee
                    </button>
                    <p style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', marginTop: '6px' }}>
                      This will create a user account and migrate all documents to their dossier.
                    </p>
                  </div>
                )}

                {selectedEmployee.transferredToUserId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', fontSize: '13px', color: '#166534' }}>
                    <CheckCircle size={16} />
                    <strong>Transferred to Active Employee</strong>
                  </div>
                )}

                {/* Audit Log */}
                {selectedEmployee.auditLog && selectedEmployee.auditLog.length > 0 && (
                  <>
                    <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '24px 0 12px' }}>Audit Log</h4>
                    <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      {selectedEmployee.auditLog.slice().reverse().map((log, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                          <span style={{ color: '#94a3b8', minWidth: '130px' }}>{new Date(log.timestamp).toLocaleString('en-IN')}</span>
                          <span style={{ fontWeight: '600', color: '#475569' }}>{log.action}</span>
                          <span style={{ color: '#64748b' }}>{log.details}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template Preview Modal */}
      {showPreviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '900px', height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                    {previewType === 'offerLetter' ? 'Offer Letter' : 'Declaration'} Template Preview
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>{previewWithData ? 'Showing with sample data' : 'Showing with raw placeholders'}</p>
                </div>

                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '4px' }}>
                  <button onClick={() => handlePreview(previewType, true)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: previewWithData ? '#fff' : 'transparent', color: previewWithData ? '#2563eb' : '#64748b', fontSize: '12px', fontWeight: '600', cursor: 'pointer', boxShadow: previewWithData ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Populated</button>
                  <button onClick={() => handlePreview(previewType, false)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: !previewWithData ? '#fff' : 'transparent', color: !previewWithData ? '#2563eb' : '#64748b', fontSize: '12px', fontWeight: '600', cursor: 'pointer', boxShadow: !previewWithData ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Raw Tags</button>
                </div>
              </div>
              <button onClick={() => { setShowPreviewModal(false); setPreviewBlob(null); }} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '8px', borderRadius: '8px' }}><X size={20} /></button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '40px', background: '#f1f5f9', display: 'flex', justifyContent: 'center' }}>
              <style>{`
                .docx-content {
                  padding: 0 !important;
                  background: transparent !important;
                }
                /* Force constant black text and standard size for EVERY element inside the doc */
                #docx-preview-root span, 
                #docx-preview-root p, 
                #docx-preview-root div {
                  color: #000 !important;
                  font-family: 'Inter', system-ui, sans-serif !important;
                  font-size: 11.5pt !important;
                  line-height: 1.5 !important;
                }
                #docx-preview-root strong,
                #docx-preview-root b {
                  font-weight: 700 !important;
                }
              `}</style>

              {previewLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#64748b' }}>
                  <RefreshCw size={32} className="animate-spin" />
                  <span>Generating high-fidelity preview...</span>
                </div>
              ) : (
                <div
                  id="docx-preview-root"
                  className="template-preview-container"
                  style={{
                    width: '100%',
                    maxWidth: '850px',
                    background: '#fff',
                    padding: '80px',
                    borderRadius: '4px',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 'fit-content'
                  }}
                >
                  {/* Manual logo injection for maximum visibility */}
                  {user?.company?.logo ? (
                    <div style={{ textAlign: 'left', marginBottom: '30px', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                      <img
                        src={user.company.logo}
                        alt="Company Logo"
                        style={{ maxHeight: '55px', maxWidth: '220px', objectFit: 'contain' }}
                      />
                    </div>
                  ) : (
                    <div style={{ marginBottom: '30px', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                      <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{user?.company?.name || 'Resource Gateway'}</span>
                    </div>
                  )}
                  <div ref={previewContainerRef} style={{ width: '100%' }} />
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => { setShowPreviewModal(false); setPreviewHtml(''); }} style={{ padding: '10px 24px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: '#475569' }}>
                Close Preview
              </button>
              <button onClick={() => handleDownloadTemplate(previewType)} style={{ padding: '10px 24px', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={16} /> Download to Edit
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .template-preview-content p { margin-bottom: 1em; }
        .template-preview-content h1, .template-preview-content h2 { margin-top: 1.5em; margin-bottom: 0.5em; }
        .template-preview-content table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        .template-preview-content th, .template-preview-content td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
      `}</style>
    </div>
  );
};

export default Onboarding;
