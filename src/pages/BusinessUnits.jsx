import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Building, Plus } from 'lucide-react';
import Skeleton from '../components/Skeleton';
import toast from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';
const BusinessUnits = () => {
    const { user } = useAuth();
    const canCreate = user?.roles?.includes('Admin') || user?.permissions?.includes('business_unit.create');
    const canUpdate = user?.roles?.includes('Admin') || user?.permissions?.includes('business_unit.update');
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [editingId, setEditingId] = useState(null);

    const fetchUnits = async () => {
        try {
            const cacheKey = `business_unit_data_${user?._id}`;
            const cachedData = sessionStorage.getItem(cacheKey);
            
            if (cachedData) {
                setUnits(JSON.parse(cachedData).units);
                setLoading(false);
            }

            const res = await api.get('/projects/business-units');
            const unitData = res.data;

            // Fingerprint check
            const newFingerprint = JSON.stringify({ u: unitData.length, lu: unitData[0]?._id });
            const oldFingerprint = cachedData ? JSON.parse(cachedData).fingerprint : null;

            if (newFingerprint !== oldFingerprint) {
                setUnits(unitData);
                sessionStorage.setItem(cacheKey, JSON.stringify({ 
                    units: unitData, 
                    fingerprint: newFingerprint 
                }));
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load Business Units');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUnits();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/projects/business-units/${editingId}`, formData);
                toast.success('Business Unit Updated');
            } else {
                await api.post('/projects/business-units', formData);
                toast.success('Business Unit Created');
            }
            sessionStorage.removeItem(`business_unit_data_${user?._id}`);
            setShowModal(false);
            setFormData({ name: '', description: '' });
            setEditingId(null);
            fetchUnits();
        } catch (error) {
            toast.error(editingId ? 'Failed to update' : 'Failed to create');
        }
    };

    const handleEdit = (unit) => {
        setFormData({ name: unit.name, description: unit.description || '' });
        setEditingId(unit._id);
        setShowModal(true);
    };

    const openCreateModal = () => {
        setFormData({ name: '', description: '' });
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
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="grid grid-cols-4 gap-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-24 ml-auto" />
                        </div>
                    </div>
                    <div className="p-0">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="px-6 py-4 border-b border-slate-50 last:border-0">
                                <div className="grid grid-cols-4 gap-4 items-center">
                                    <div className="flex items-center space-x-2">
                                        <Skeleton className="h-8 w-8 rounded" />
                                        <Skeleton className="h-5 w-32" />
                                    </div>
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="h-6 w-32 rounded-full" />
                                    <div className="flex justify-end space-x-2">
                                        <Skeleton className="h-4 w-12" />
                                        <Skeleton className="h-4 w-20" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );





    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">

                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Business Units</h1>
                        <p className="text-sm text-slate-500">Manage internal business divisions</p>
                    </div>
                    {canCreate && (
                        <button
                            onClick={openCreateModal}
                            className="flex items-center space-x-2 zoho-btn-primary"
                        >
                            <Plus size={18} />
                            <span>Add Unit</span>
                        </button>
                    )}
                </div>

                <div className="zoho-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Description</th>
                                    <th className="px-6 py-3">Head of Unit</th>
                                    <th className="px-6 py-3 text-right">Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {units.map((unit) => (
                                    <tr key={unit._id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-3 font-medium text-slate-800">
                                            <div className="flex items-center space-x-2">
                                                <div className="p-1.5 bg-blue-100 text-blue-600 rounded">
                                                    <Building size={16} />
                                                </div>
                                                <span>{unit.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">{unit.description || '-'}</td>
                                        <td className="px-6 py-3 text-slate-600">
                                            {unit.headOfUnit ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                                    {unit.headOfUnit.firstName} {unit.headOfUnit.lastName}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-right text-slate-500 space-x-2">
                                            {canUpdate && (
                                                <button onClick={() => handleEdit(unit)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                                            )}
                                            <span className="text-slate-300">|</span>
                                            <span className="text-xs">{new Date(unit.createdAt).toLocaleDateString()}</span>
                                        </td>
                                    </tr>
                                ))}
                                {units.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-slate-500">
                                            No Business Units found. Create one to get started.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">{editingId ? 'Edit Business Unit' : 'New Business Unit'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit Name</label>
                                <input
                                    required
                                    className="zoho-input"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Engineering, Sales"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                <textarea
                                    className="zoho-input"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows="3"
                                />
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

export default BusinessUnits;
