import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Briefcase, Plus, Search, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';

import { useAuth } from '../context/AuthContext';

const Projects = () => {
    const { user } = useAuth();
    const canCreate = user?.roles?.includes('Admin') || user?.permissions?.includes('project.create');
    const canUpdate = user?.roles?.includes('Admin') || user?.permissions?.includes('project.update');
    const [projects, setProjects] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', client: '', description: '', status: 'Active', startDate: '', dueDate: '', members: [] });

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch Projects (Main Data)
            try {
                const projRes = await api.get('/projects');
                setProjects(projRes.data);
            } catch (err) {
                console.error("Failed to load projects", err);
                toast.error('Failed to load projects');
            }

            // Fetch Clients (For Dropdown - Optional)
            try {
                const clientRes = await api.get('/projects/clients');
                setClients(clientRes.data);
            } catch (err) {
                console.warn("Failed to load clients for dropdown (likely no permission)", err);
            }

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Employees Helper
    const [employees, setEmployees] = useState([]);
    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await api.get('/projects/employees');
                setEmployees(res.data);
            } catch (err) {
                console.warn("Failed to load employees for assignment", err);
            }
        };
        if (canCreate || canUpdate) {
            fetchEmployees();
        }
    }, [canCreate, canUpdate]);

    useEffect(() => {
        fetchData();
    }, []);

    const [editingId, setEditingId] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/projects/${editingId}`, formData);
                toast.success('Project Updated');
            } else {
                await api.post('/projects', formData);
                toast.success('Project Created');
            }
            setShowModal(false);
            setFormData({ name: '', client: '', description: '', status: 'Active', startDate: '', dueDate: '', members: [] });
            setEditingId(null);
            fetchData();
        } catch (error) {
            toast.error(editingId ? 'Failed to update' : 'Failed to create');
        }
    };

    const handleEdit = (proj) => {
        setFormData({
            name: proj.name,
            client: proj.client?._id || '',
            description: proj.description || '',
            status: proj.isActive ? 'Active' : 'Inactive',
            startDate: proj.startDate ? new Date(proj.startDate).toISOString().split('T')[0] : '',
            dueDate: proj.dueDate ? new Date(proj.dueDate).toISOString().split('T')[0] : '',
            members: proj.members?.map(m => m._id) || []
        });
        setEditingId(proj._id);
        setShowModal(true);
    };

    const openCreateModal = () => {
        setFormData({ name: '', client: '', description: '', status: 'Active', startDate: '', dueDate: '', members: [] });
        setEditingId(null);
        setShowModal(true);
    };

    // if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">

                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Projects</h1>
                        <p className="text-sm text-slate-500">Track initiatives and jobs</p>
                    </div>
                    {canCreate && (
                        <button
                            onClick={openCreateModal}
                            className="flex items-center space-x-2 zoho-btn-primary"
                        >
                            <Plus size={18} />
                            <span>New Project</span>
                        </button>
                    )}
                </div>

                <div className="zoho-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">Project Name</th>
                                    <th className="px-6 py-3">Client</th>
                                    <th className="px-6 py-3">Manager</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}>
                                            <td className="px-6 py-3"><Skeleton className="h-8 w-48" /></td>
                                            <td className="px-6 py-3"><Skeleton className="h-6 w-32" /></td>
                                            <td className="px-6 py-3"><Skeleton className="h-6 w-32" /></td>
                                            <td className="px-6 py-3"><Skeleton className="h-6 w-16" /></td>
                                            <td className="px-6 py-3"><Skeleton className="h-6 w-24 ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : projects.length > 0 ? (
                                    projects.map((project) => (
                                        <tr key={project._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-3 font-medium text-slate-800">
                                                <div className="flex items-center space-x-2">
                                                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded">
                                                        <Briefcase size={16} />
                                                    </div>
                                                    <span>{project.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-slate-600">
                                                {project.client?.name || <span className="text-slate-400 italic">Internal</span>}
                                            </td>
                                            <td className="px-6 py-3 text-slate-600">
                                                {project.manager ? `${project.manager.firstName} ${project.manager.lastName}` : '-'}
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${project.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {project.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-right space-x-3">
                                                {canUpdate && <button onClick={() => handleEdit(project)} className="text-slate-500 hover:text-blue-600 text-xs font-medium">Edit</button>}
                                                <a href={`/projects/${project._id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">View Modules</a>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-slate-500">
                                            No Projects found.
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
                            <h3 className="font-bold text-slate-800">{editingId ? 'Edit Project' : 'New Project'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* ... inputs same ... */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
                                <input
                                    required
                                    className="zoho-input"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client</label>
                                <select
                                    className="zoho-input"
                                    value={formData.client}
                                    onChange={e => setFormData({ ...formData, client: e.target.value })}
                                >
                                    <option value="">Internal / No Client</option>
                                    {clients.map(c => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                </select>
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        className="zoho-input"
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        className="zoho-input"
                                        value={formData.dueDate}
                                        onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            {/* Status Input for Edit */}
                            {editingId && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                                    <select
                                        className="zoho-input"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            )}

                            {/* Assign Members */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Project Members (Visibility)</label>
                                <div className="h-32 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50 grid grid-cols-2 gap-2">
                                    {employees.map(emp => (
                                        <label key={emp._id} className="flex items-center space-x-2 text-sm bg-white p-2 rounded border border-slate-100 shadow-sm cursor-pointer hover:border-blue-300">
                                            <input
                                                type="checkbox"
                                                value={emp._id}
                                                checked={formData.members?.includes(emp._id)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const id = emp._id;
                                                    setFormData(prev => {
                                                        const current = prev.members || [];
                                                        if (checked) return { ...prev, members: [...current, id] };
                                                        return { ...prev, members: current.filter(x => x !== id) };
                                                    });
                                                }}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-700">{emp.firstName} {emp.lastName}</span>
                                                <span className="text-[10px] text-slate-400">{emp.email}</span>
                                            </div>
                                        </label>
                                    ))}
                                    {employees.length === 0 && <div className="col-span-2 text-xs text-slate-400 italic text-center p-4">No employees found</div>}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Select users who should have access to this project.</p>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="zoho-btn-secondary">Cancel</button>
                                <button type="submit" className="zoho-btn-primary">{editingId ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div >
            )}
        </div >
    );
};

export default Projects;
