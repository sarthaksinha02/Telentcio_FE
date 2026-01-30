import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Users, Plus, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';

import { useAuth } from '../context/AuthContext';

const Clients = () => {
    const { user } = useAuth();
    const canCreate = user?.roles?.includes('Admin') || user?.permissions?.includes('client.create');
    const canUpdate = user?.roles?.includes('Admin') || user?.permissions?.includes('client.update');
    const [clients, setClients] = useState([]);
    const [businessUnits, setBusinessUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', businessUnit: '', location: '', email: '' });

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch Clients (Main Data)
            try {
                const clientsRes = await api.get('/projects/clients');
                setClients(clientsRes.data);
            } catch (err) {
                console.error("Failed to load clients", err);
                toast.error('Failed to load clients');
            }

            // Fetch Business Units (For Dropdown - Optional if just viewing)
            try {
                const buRes = await api.get('/projects/business-units');
                setBusinessUnits(buRes.data);
            } catch (err) {
                console.warn("Failed to load business units (likely no permission)", err);
                // Don't show error toast as it might be expected for read-only users
            }

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const [editingId, setEditingId] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/projects/clients/${editingId}`, formData);
                toast.success('Client Updated');
            } else {
                await api.post('/projects/clients', formData);
                toast.success('Client Created');
            }
            setShowModal(false);
            setFormData({ name: '', businessUnit: '', location: '', email: '' });
            setEditingId(null);
            fetchData();
        } catch (error) {
            toast.error(editingId ? 'Failed to update' : 'Failed to create');
        }
    };

    const handleEdit = (client) => {
        setFormData({
            name: client.name,
            businessUnit: client.businessUnit?._id || '',
            location: client.location || '',
            email: client.email || ''
        });
        setEditingId(client._id);
        setShowModal(true);
    };

    const openCreateModal = () => {
        setFormData({ name: '', businessUnit: '', location: '', email: '' });
        setEditingId(null);
        setShowModal(true);
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-10 w-32 rounded-lg" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="zoho-card p-5 relative">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <Skeleton className="h-10 w-10 rounded-lg" />
                                    <div className="space-y-1">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                                <div className="flex justify-between">
                                    <Skeleton className="h-3 w-20" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                                <div className="flex justify-between">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">

                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Clients</h1>
                        <p className="text-sm text-slate-500">External customers and partners</p>
                    </div>
                    {canCreate && (
                        <button
                            onClick={openCreateModal}
                            className="flex items-center space-x-2 zoho-btn-primary"
                        >
                            <Plus size={18} />
                            <span>Add Client</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clients.map(client => (
                        <div key={client._id} className="zoho-card p-5 hover:shadow-md transition-shadow relative group">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                {canUpdate && (
                                    <button onClick={() => handleEdit(client)} className="text-slate-400 hover:text-blue-600 text-xs font-bold bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                        Edit
                                    </button>
                                )}
                            </div>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{client.name}</h3>
                                        <div className="text-xs text-slate-500">{client.location || 'No Location'}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Business Unit</span>
                                    <span className="font-medium text-slate-700">{client.businessUnit?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Email</span>
                                    <span className="font-medium text-slate-700">{client.email || '-'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {clients.length === 0 && (
                        <div className="col-span-full p-8 text-center text-slate-500 border-2 border-dashed border-slate-300 rounded-lg">
                            No Clients found.
                        </div>
                    )}
                </div>

            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">{editingId ? 'Edit Client' : 'New Client'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client Name</label>
                                <input
                                    required
                                    className="zoho-input"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Business Unit</label>
                                <select
                                    className="zoho-input"
                                    value={formData.businessUnit}
                                    onChange={e => setFormData({ ...formData, businessUnit: e.target.value })}
                                >
                                    <option value="">Select Unit</option>
                                    {businessUnits.map(bu => (
                                        <option key={bu._id} value={bu._id}>{bu.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                                    <input
                                        type="email"
                                        className="zoho-input"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                                    <input
                                        className="zoho-input"
                                        value={formData.location}
                                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="zoho-btn-secondary">Cancel</button>
                                <button type="submit" className="zoho-btn-primary">{editingId ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clients;
