import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Users, User, Plus, Trash2 } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const EMPTY_CONTACT = { name: '', email: '', phone: '' };

const INITIAL_FORM = {
    // Company Details
    companyName: '',
    companyUrl: '',
    companyLocation: '',
    // Client Details
    name: '',
    email: '',
    businessUnit: '',
    location: '',

    
};








const ClientForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);

    const [formData, setFormData] = useState(INITIAL_FORM);
    const [contacts, setContacts] = useState([{ ...EMPTY_CONTACT }]);
    const [businessUnits, setBusinessUnits] = useState([]);
    const [loading, setLoading] = useState(isEditing);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    /* ── Fetch reference data ───────────────────── */
    useEffect(() => {
        const init = async () => {
            try {
                const buRes = await api.get('/projects/business-units');
                setBusinessUnits(buRes.data);
            } catch {
                toast.error('Failed to load business units');
            }

            if (isEditing) {
                try {
                    const res = await api.get('/projects/clients');
                    const client = res.data.find(c => c._id === id);
                    if (client) {
                        setFormData({
                            companyName: client.companyName || '',
                            companyUrl: client.companyUrl || '',
                            companyLocation: client.companyLocation || '',
                            name: client.name || '',
                            email: client.email || '',
                            businessUnit: client.businessUnit?._id || '',
                            location: client.location || '',
                        });
                        setContacts(
                            client.contactPersons?.length
                                ? client.contactPersons.map(cp => ({
                                    name: cp.name || '',
                                    email: cp.email || '',
                                    phone: cp.phone || '',
                                }))
                                : [{ ...EMPTY_CONTACT }]
                        );
                    } else {
                        toast.error('Client not found');
                        navigate('/clients');
                    }
                } catch {
                    toast.error('Failed to load client');
                    navigate('/clients');
                } finally {
                    setLoading(false);
                }
            }
        };
        init();
    }, [id, isEditing, navigate]);

    /* ── Contact person helpers ─────────────────── */
    const addContact = () => setContacts(prev => [...prev, { ...EMPTY_CONTACT }]);

    const removeContact = (idx) =>
        setContacts(prev => prev.filter((_, i) => i !== idx));

    const handleContactChange = (idx, field, value) => {
        setContacts(prev => {
            const updated = [...prev];
            if (field === 'phone') {
                updated[idx] = { ...updated[idx], phone: value.replace(/\D/g, '').slice(0, 10) };
            } else {
                updated[idx] = { ...updated[idx], [field]: value };
            }
            return updated;
        });
        // clear contact-level error
        setErrors(prev => {
            const next = { ...prev };
            delete next[`contact_${idx}_${field}`];
            return next;
        });
    };

    /* ── Validation ─────────────────────────────── */
    const validate = () => {
        const errs = {};
        if (!formData.name.trim()) errs.name = 'Client name is required';

        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
            errs.email = 'Invalid email address';

        if (formData.companyUrl && !/^https?:\/\/.+/.test(formData.companyUrl))
            errs.companyUrl = 'URL must start with http:// or https://';

        contacts.forEach((cp, idx) => {
            if (cp.phone && !/^\d{10}$/.test(cp.phone))
                errs[`contact_${idx}_phone`] = 'Must be exactly 10 digits';
            if (cp.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cp.email))
                errs[`contact_${idx}_email`] = 'Invalid email address';
        });

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    /* ── Form field handler ─────────────────────── */
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
    };

    /* ── Submit ─────────────────────────────────── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setSubmitting(true);

        // filter out fully empty contact rows
        const contactPersons = contacts.filter(
            cp => cp.name.trim() || cp.email.trim() || cp.phone.trim()
        );

        const payload = { ...formData, contactPersons };

        try {
            if (isEditing) {
                await api.put(`/projects/clients/${id}`, payload);
                toast.success('Client updated successfully');
            } else {
                await api.post('/projects/clients', payload);
                toast.success('Client created successfully');
            }
            navigate('/clients');
        } catch {
            toast.error(isEditing ? 'Failed to update client' : 'Failed to create client');
        } finally {
            setSubmitting(false);
        }
    };

    /* ── Loading ────────────────────────────────── */
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="text-slate-400 animate-pulse">Loading...</div>
            </div>
        );
    }

    /* ── Render ─────────────────────────────────── */
    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => navigate('/clients')}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            {isEditing ? 'Edit Client' : 'Add New Client'}
                        </h1>
                        <p className="text-sm text-slate-500">
                            {isEditing ? 'Update client information' : 'Fill in the details below to add a new client'}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* ── Section 1: Company Details ── */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="flex items-center space-x-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Building2 size={16} />
                            </div>
                            <h2 className="font-semibold text-slate-700">Company Details</h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Company Name</label>
                                <input name="companyName" value={formData.companyName} onChange={handleChange}
                                    placeholder="e.g. Acme Corporation" className="zoho-input" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Company URL</label>
                                <input name="companyUrl" value={formData.companyUrl} onChange={handleChange}
                                    placeholder="https://example.com"
                                    className={`zoho-input ${errors.companyUrl ? 'border-red-400' : ''}`} />
                                {errors.companyUrl && <p className="text-red-500 text-xs mt-1">{errors.companyUrl}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Company Location</label>
                                <input name="companyLocation" value={formData.companyLocation} onChange={handleChange}
                                    placeholder="City, Country" className="zoho-input" />
                            </div>
                        </div>
                    </div>

                    {/* ── Section 2: Client Details ── */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="flex items-center space-x-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Users size={16} />
                            </div>
                            <h2 className="font-semibold text-slate-700">Client Details</h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                                    Client Name <span className="text-red-500">*</span>
                                </label>
                                <input name="name" value={formData.name} onChange={handleChange}
                                    placeholder="Client name"
                                    className={`zoho-input ${errors.name ? 'border-red-400' : ''}`} />
                                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Client Email</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange}
                                    placeholder="client@example.com"
                                    className={`zoho-input ${errors.email ? 'border-red-400' : ''}`} />
                                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Business Unit</label>
                                <select name="businessUnit" value={formData.businessUnit} onChange={handleChange} className="zoho-input">
                                    <option value="">Select Business Unit</option>
                                    {businessUnits.map(bu => (
                                        <option key={bu._id} value={bu._id}>{bu.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Location</label>
                                <input name="location" value={formData.location} onChange={handleChange}
                                    placeholder="City, Country" className="zoho-input" />
                            </div>
                        </div>
                    </div>

                    {/* ── Section 3: Contact Persons (dynamic) ── */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-center space-x-3">
                                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <User size={16} />
                                </div>
                                <h2 className="font-semibold text-slate-700">Contact Persons</h2>
                                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {contacts.length}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={addContact}
                                className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
                            >
                                <Plus size={14} />
                                <span>Add Contact</span>
                            </button>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {contacts.map((cp, idx) => (
                                <div key={idx} className="p-6">
                                    {/* Contact row header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            Contact {idx + 1}
                                        </span>
                                        {contacts.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeContact(idx)}
                                                className="flex items-center space-x-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                            >
                                                <Trash2 size={13} />
                                                <span>Remove</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Name */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Full Name</label>
                                            <input
                                                value={cp.name}
                                                onChange={e => handleContactChange(idx, 'name', e.target.value)}
                                                placeholder="Full name"
                                                className="zoho-input"
                                            />
                                        </div>
                                        {/* Email */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
                                            <input
                                                type="email"
                                                value={cp.email}
                                                onChange={e => handleContactChange(idx, 'email', e.target.value)}
                                                placeholder="contact@example.com"
                                                className={`zoho-input ${errors[`contact_${idx}_email`] ? 'border-red-400' : ''}`}
                                            />
                                            {errors[`contact_${idx}_email`] && (
                                                <p className="text-red-500 text-xs mt-1">{errors[`contact_${idx}_email`]}</p>
                                            )}
                                        </div>
                                        {/* Phone */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone</label>
                                            <input
                                                value={cp.phone}
                                                onChange={e => handleContactChange(idx, 'phone', e.target.value)}
                                                placeholder="10-digit number"
                                                inputMode="numeric"
                                                maxLength={10}
                                                className={`zoho-input ${errors[`contact_${idx}_phone`] ? 'border-red-400' : ''}`}
                                            />
                                            <p className={`text-xs mt-1 ${errors[`contact_${idx}_phone`] ? 'text-red-500' : 'text-slate-400'}`}>
                                                {errors[`contact_${idx}_phone`] || `${cp.phone.length}/10 digits`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex justify-end space-x-3 pb-6">
                        <button
                            type="button"
                            onClick={() => navigate('/clients')}
                            className="zoho-btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="zoho-btn-primary disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {submitting && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            {submitting ? 'Saving...' : isEditing ? 'Update Client' : 'Create Client'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default ClientForm;
