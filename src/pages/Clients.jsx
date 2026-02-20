import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Users, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Clients = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const canCreate = user?.roles?.includes('Admin') || user?.permissions?.includes('client.create');
    const canUpdate = user?.roles?.includes('Admin') || user?.permissions?.includes('client.update');
    const [clients, setClients] = useState([]);
    const [businessUnits, setBusinessUnits] = useState([]);
    const [loading, setLoading] = useState(true);

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
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                {['#', 'Client Name', 'Location', 'Business Unit', 'Email', 'Actions'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left">
                                        <Skeleton className="h-3 w-20" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[1, 2, 3, 4, 5].map(i => (
                                <tr key={i} className="border-b border-slate-50">
                                    {[1, 2, 3, 4, 5, 6].map(j => (
                                        <td key={j} className="px-4 py-3">
                                            <Skeleton className="h-4 w-full" />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                            onClick={() => navigate('/clients/new')}
                            className="flex items-center space-x-2 zoho-btn-primary"
                        >
                            <Plus size={18} />
                            <span>Add Client</span>
                        </button>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Client Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Business Unit</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {clients.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                        No clients found.
                                    </td>
                                </tr>
                            ) : (
                                clients.map((client, index) => (
                                    <tr key={client._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-400 font-medium">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center space-x-3">
                                                <div className="h-8 w-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <Users size={16} />
                                                </div>
                                                <span className="font-semibold text-slate-800">{client.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{client.location || <span className="text-slate-300">—</span>}</td>
                                        <td className="px-4 py-3">
                                            {client.businessUnit?.name
                                                ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{client.businessUnit.name}</span>
                                                : <span className="text-slate-300">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{client.email || <span className="text-slate-300">—</span>}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => navigate(`/clients/${client._id}/view`)}
                                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                                                >
                                                    View
                                                </button>
                                                {canUpdate && (
                                                    <button
                                                        onClick={() => navigate(`/clients/${client._id}/edit`)}
                                                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
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

export default Clients;
