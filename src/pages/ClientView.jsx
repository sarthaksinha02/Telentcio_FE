import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Users, User, Globe, Mail, MapPin, Phone, Briefcase, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Field = ({ label, value, icon: Icon }) => (
    <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <div className="flex items-center space-x-2">
            {Icon && <Icon size={14} className="text-slate-400 flex-shrink-0" />}
            <p className="text-sm font-medium text-slate-700">{value || <span className="text-slate-300 font-normal">—</span>}</p>
        </div>
    </div>
);

const ClientView = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();
    const canUpdate = user?.roles?.includes('Admin') || user?.permissions?.includes('client.update');

    const [client, setClient] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Client
                const clientRes = await api.get('/projects/clients');
                const foundClient = clientRes.data.find(c => c._id === id);

                if (foundClient) {
                    setClient(foundClient);

                    // Fetch Projects
                    try {
                        const projectsRes = await api.get('/projects');
                        // Filter projects for this client
                        const clientProjects = projectsRes.data.filter(p =>
                            p.client && (typeof p.client === 'string' ? p.client === id : p.client._id === id)
                        );
                        setProjects(clientProjects);
                    } catch (err) {
                        console.error("Failed to load projects", err);
                        // Don't fail the whole page if projects fail
                    }
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
        };
        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="text-slate-400 animate-pulse">Loading...</div>
            </div>
        );
    }

    if (!client) return null;

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => navigate('/clients')}
                            className="text-slate-400 hover:text-slate-700 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">{client.name}</h1>
                            <p className="text-sm text-slate-500">Client Details</p>
                        </div>
                    </div>
                    {canUpdate && (
                        <button
                            onClick={() => navigate(`/clients/${id}/edit`)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md transition-colors"
                        >
                            Edit Client
                        </button>
                    )}
                </div>

                {/* Company Details */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center space-x-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Building2 size={16} />
                        </div>
                        <h2 className="font-semibold text-slate-700">Company Details</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Field label="Company Name" value={client.companyName} icon={Building2} />
                        <Field label="Company URL" value={client.companyUrl} icon={Globe} />
                        <div className="md:col-span-2">
                            <Field label="Company Location" value={client.companyLocation} icon={MapPin} />
                        </div>
                    </div>
                </div>

                {/* Client Details */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center space-x-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Users size={16} />
                        </div>
                        <h2 className="font-semibold text-slate-700">Client Details</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Field label="Client Name" value={client.name} icon={User} />
                        <Field label="Client Email" value={client.email} icon={Mail} />
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Business Unit</p>
                            {client.businessUnit?.name
                                ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{client.businessUnit.name}</span>
                                : <span className="text-slate-300 text-sm">—</span>
                            }
                        </div>
                        <Field label="Location" value={client.location} icon={MapPin} />
                    </div>
                </div>

                {/* Contact Persons */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center space-x-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <User size={16} />
                        </div>
                        <h2 className="font-semibold text-slate-700">Contact Persons</h2>
                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {client.contactPersons?.length || 0}
                        </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {client.contactPersons?.length > 0 ? (
                            client.contactPersons.map((cp, idx) => (
                                <div key={idx} className="p-6">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                                        Contact {idx + 1}
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Field label="Full Name" value={cp.name} icon={User} />
                                        <Field label="Email" value={cp.email} icon={Mail} />
                                        <Field label="Phone" value={cp.phone} icon={Phone} />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-6 text-center text-slate-400 text-sm">
                                No contact persons added.
                            </div>
                        )}
                    </div>
                </div>

                {/* Projects */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center space-x-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                            <Briefcase size={16} />
                        </div>
                        <h2 className="font-semibold text-slate-700">Projects</h2>
                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {projects.length}
                        </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {projects.length > 0 ? (
                            projects.map(project => (
                                <div key={project._id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/projects/${project._id}`)}>
                                    <div className="space-y-1">
                                        <h3 className="font-semibold text-slate-800 flex items-center space-x-2">
                                            <span>{project.name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${project.isActive
                                                ? 'bg-green-50 text-green-700 border-green-100'
                                                : 'bg-slate-100 text-slate-500 border-slate-200'
                                                }`}>
                                                {project.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </h3>
                                        <div className="flex items-center space-x-4 text-xs text-slate-500">
                                            {project.manager && (
                                                <span className="flex items-center space-x-1">
                                                    <User size={12} />
                                                    <span>{project.manager.firstName} {project.manager.lastName}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-6">
                                        <div className="text-right">
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Due Date</p>
                                            <p className="text-sm font-medium text-slate-700">
                                                {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : '—'}
                                            </p>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-300" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-6 text-center text-slate-400 text-sm">
                                No projects found for this client.
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ClientView;
