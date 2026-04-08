import React, { useCallback, useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { Briefcase, Plus, Search, Building, MoreVertical, Edit2, Trash2, XCircle, CheckCircle, PauseCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';
import { createCachePayload, isCacheFresh, readSessionCache } from '../utils/cache';

import { useAuth } from '../context/AuthContext';

const Projects = () => {
    const { user } = useAuth();
    const canCreate = user?.roles?.includes('Admin') || user?.permissions?.includes('project.create');
    const canUpdate = user?.roles?.includes('Admin') || user?.permissions?.includes('project.update');
    const [projects, setProjects] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // stores the id of the project being acted on
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', client: '', description: '', status: 'Active', startDate: '', dueDate: '', members: [] });
    const initialFetchDoneRef = useRef(false);
    const PROJECT_CACHE_TTL_MS = 30 * 1000;
    const cacheKey = `project_data_${user?._id}`;
    const [employees, setEmployees] = useState([]);

    const fetchData = useCallback(async ({ force = false } = {}) => {
        try {
            const cachedData = readSessionCache(cacheKey);

            if (cachedData) {
                const data = cachedData.data || cachedData;
                setProjects(data.projects || []);
                setClients(data.clients || []);
                setEmployees(data.employees || []);
                setLoading(false);
                if (!force && isCacheFresh(cachedData, PROJECT_CACHE_TTL_MS)) return;
            }

            const bootstrapRes = await api.get('/projects/bootstrap');
            const projData = bootstrapRes.data?.projects || [];
            const clientsData = bootstrapRes.data?.clients || [];
            const employeesData = bootstrapRes.data?.employees || [];

            const newFingerprint = JSON.stringify({ p: projData.length, c: clientsData.length, e: employeesData.length, lp: projData[0]?._id });
            const oldFingerprint = cachedData?.fingerprint || null;

            setProjects(projData);
            setClients(clientsData);
            setEmployees(employeesData);

            if (newFingerprint !== oldFingerprint || force) {
                const minimalProjects = projData.map(p => ({
                    _id: p._id,
                    name: p.name,
                    status: p.status,
                    isActive: p.isActive,
                    description: p.description,
                    startDate: p.startDate,
                    dueDate: p.dueDate,
                    client: p.client ? { _id: p.client._id, name: p.client.name } : null,
                    members: p.members?.map(m => ({ _id: m._id }))
                }));

                const minimalClients = clientsData.map(c => ({ _id: c._id, name: c.name }));
                const minimalEmployees = employeesData.map(employee => ({
                    _id: employee._id,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    email: employee.email
                }));

                const payload = createCachePayload({
                    projects: minimalProjects,
                    clients: minimalClients,
                    employees: minimalEmployees
                }, newFingerprint);

                sessionStorage.setItem(cacheKey, JSON.stringify(payload));
            }

        } catch (error) {
            console.error(error);
            toast.error('Failed to load projects');
        } finally {
            setLoading(false);
        }
    }, [PROJECT_CACHE_TTL_MS, cacheKey]);

    useEffect(() => {
        if (initialFetchDoneRef.current) return;
        initialFetchDoneRef.current = true;
        fetchData();
    }, [fetchData]);

    const [editingId, setEditingId] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (openMenuId && !event.target.closest('.action-menu-container')) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openMenuId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        try {
            // Prepare payload: Convert empty strings to null for ObjectId/Date fields
            const payload = { ...formData };
            if (!payload.client) payload.client = null;
            if (!payload.startDate) payload.startDate = null;
            if (!payload.dueDate) payload.dueDate = null;

            if (editingId) {
                await api.put(`/projects/${editingId}`, payload);
                toast.success('Project Updated');
            } else {
                await api.post('/projects', payload);
                toast.success('Project Created');
            }
            sessionStorage.removeItem(`project_data_${user?._id}`);
            setShowModal(false);
            setFormData({ name: '', client: '', description: '', status: 'Active', startDate: '', dueDate: '', members: [] });
            setEditingId(null);
            fetchData({ force: true });
        } catch {
            toast.error(editingId ? 'Failed to update' : 'Failed to create');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleEdit = (proj) => {
        setFormData({
            name: proj.name,
            client: proj.client?._id || '',
            description: proj.description || '',
            status: proj.status || (proj.isActive ? 'Active' : 'Completed'),
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

    const handleStatusChange = async (project, newStatus) => {
        const isActive = newStatus !== 'Completed';
        setActionLoading(project._id);
        try {
            await api.put(`/projects/${project._id}`, { status: newStatus, isActive });
            toast.success(`Project marked as ${newStatus}`);
            sessionStorage.removeItem(`project_data_${user?._id}`);
            await fetchData({ force: true });
        } catch {
            toast.error('Failed to update project status');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">

                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Projects</h1>
                        <p className="text-sm text-slate-500">Track initiatives and jobs</p>
                    </div>
                    {canCreate && (
                        <Button
                            onClick={openCreateModal}
                            className="flex items-center space-x-2"
                        >
                            <Plus size={18} />
                            <span>New Project</span>
                        </Button>
                    )}
                </div>

                <div className="zoho-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">Project Name</th>


                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}>
                                            <td className="px-6 py-3"><Skeleton className="h-8 w-48" /></td>


                                            <td className="px-6 py-3"><Skeleton className="h-6 w-16" /></td>
                                            <td className="px-6 py-3"><Skeleton className="h-6 w-24 ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : projects.length > 0 ? (
                                    projects.map((project, index) => (
                                        <tr key={project._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-3 font-medium text-slate-800">
                                                <div className="flex items-center space-x-2">
                                                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded">
                                                        <Briefcase size={16} />
                                                    </div>
                                                    <span>{project.name}</span>
                                                </div>
                                            </td>



                                            <td className="px-6 py-3">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${project.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    project.status === 'On Hold' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                        'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                    {project.status || (project.isActive ? 'Active' : 'Completed')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center justify-end gap-3 action-menu-container relative">
                                                    <a href={`/projects/${project._id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium whitespace-nowrap">View Modules</a>

                                                    {canUpdate && (
                                                        <div className="relative">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenMenuId(openMenuId === project._id ? null : project._id);
                                                                }}
                                                                disabled={actionLoading === project._id}
                                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
                                                            >
                                                                {actionLoading === project._id ? (
                                                                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                                                                ) : (
                                                                    <MoreVertical size={16} />
                                                                )}
                                                            </button>

                                                            {openMenuId === project._id && (
                                                                <div className={`absolute right-0 ${index >= projects.length - 2 ? 'bottom-full mb-1' : 'top-full mt-1'} w-40 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50`}>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleEdit(project);
                                                                            setOpenMenuId(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2"
                                                                    >
                                                                        <Edit2 size={13} />
                                                                        Edit
                                                                    </button>

                                                                    {project.status !== 'Completed' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                handleStatusChange(project, 'Completed');
                                                                                setOpenMenuId(null);
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-emerald-600 flex items-center gap-2"
                                                                        >
                                                                            <XCircle size={13} />
                                                                            Close
                                                                        </button>
                                                                    )}

                                                                    {project.status === 'Active' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                handleStatusChange(project, 'On Hold');
                                                                                setOpenMenuId(null);
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-orange-600 flex items-center gap-2"
                                                                        >
                                                                            <PauseCircle size={13} />
                                                                            On Hold
                                                                        </button>
                                                                    )}

                                                                    {(project.status === 'On Hold' || project.status === 'Completed' || project.status === 'Inactive') && (
                                                                        <button
                                                                            onClick={() => {
                                                                                handleStatusChange(project, 'Active');
                                                                                setOpenMenuId(null);
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2"
                                                                        >
                                                                            <Briefcase size={13} />
                                                                            Mark as Active
                                                                        </button>
                                                                    )}

                                                                    {user?.permissions?.includes('project.delete') && (
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (window.confirm('Are you sure you want to delete this project? This will delete all modules and tasks within it.')) {
                                                                                    setActionLoading(project._id);
                                                                                     try {
                                                                                         await api.delete(`/projects/${project._id}`);
                                                                                         toast.success('Project deleted');
                                                                                         sessionStorage.removeItem(`project_data_${user?._id}`);
                                                                                         await fetchData();
                                                                                     } catch {
                                                                                         toast.error('Failed to delete project');
                                                                                     } finally {
                                                                                         setActionLoading(null);
                                                                                     }
                                                                                }
                                                                                setOpenMenuId(null);
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-red-600 flex items-center gap-2 border-t border-slate-50 mt-1 pt-2"
                                                                        >
                                                                            <Trash2 size={13} />
                                                                            Delete
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
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
                                        <option value="On Hold">On Hold</option>
                                        <option value="Completed">Completed</option>
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
                                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                                <Button type="submit" isLoading={submitLoading}>{editingId ? 'Update' : 'Create'}</Button>
                            </div>
                        </form>
                    </div>
                </div >
            )}
        </div >
    );
};

export default Projects;
