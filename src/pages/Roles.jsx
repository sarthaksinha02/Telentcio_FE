import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Check, Shield } from 'lucide-react';
import Skeleton from '../components/Skeleton';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Roles = () => {
    const { user } = useAuth();
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState({}); // Grouped permissions
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    const [roleName, setRoleName] = useState('');
    const [selectedPerms, setSelectedPerms] = useState([]);
    const [viewOnly, setViewOnly] = useState(false);

    const fetchData = async () => {
        try {
            const cacheKey = `role_data_${user?._id}`;
            const cachedData = sessionStorage.getItem(cacheKey);
            
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                setRoles(parsed.roles);
                setPermissions(parsed.permissions);
                setLoading(false);
            }

            const [rolesRes, permsRes] = await Promise.all([
                api.get('/admin/roles'),
                api.get('/admin/permissions')
            ]);

            const rolesData = rolesRes.data;
            const permsData = permsRes.data;

            // Fingerprint check
            const newFingerprint = JSON.stringify({ r: rolesData.length, p: Object.keys(permsData).length, lr: rolesData[0]?._id });
            const oldFingerprint = cachedData ? JSON.parse(cachedData).fingerprint : null;

            if (newFingerprint !== oldFingerprint) {
                setRoles(rolesData);
                setPermissions(permsData);
                sessionStorage.setItem(cacheKey, JSON.stringify({ 
                    roles: rolesData, 
                    permissions: permsData, 
                    fingerprint: newFingerprint 
                }));
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const isPermissionVisible = (perm) => {
        if (!perm || !perm.key) return false;
        const key = perm.key;
        let groupName = perm.module || 'OTHER';

        // Replicate backend grouping logic
        if (key.startsWith('business_unit.')) groupName = 'BUSINESS UNITS';
        else if (key.startsWith('client.')) groupName = 'CLIENTS';
        else if (key.startsWith('task.')) groupName = 'TASKS';
        else if (key.startsWith('project.') || key.startsWith('module.')) groupName = 'PROJECTS';
        else if (key.startsWith('user.')) groupName = 'USER MANAGEMENT';
        else if (key.startsWith('role.')) groupName = 'ROLE MANAGEMENT';
        else if (key.startsWith('timesheet.')) groupName = 'TIMESHEETS';
        else if (key.startsWith('attendance.')) groupName = 'ATTENDANCE';
        else if (key.startsWith('ta.')) groupName = 'TALENT ACQUISITION';
        else if (key.startsWith('helpdesk.')) groupName = 'HELP DESK';
        else if (key.startsWith('discussion.')) groupName = 'DISCUSSIONS';
        else if (key.startsWith('dossier.')) groupName = 'EMPLOYEE DOSSIER';
        else if (key.startsWith('leave.')) groupName = 'LEAVES';

        const moduleMapping = {
            'ATTENDANCE': 'attendance',
            'TIMESHEETS': 'timesheet',
            'PROJECTS': 'projectManagement',
            'BUSINESS UNITS': 'projectManagement',
            'CLIENTS': 'projectManagement',
            'TASKS': 'projectManagement',
            'USER MANAGEMENT': 'userManagement',
            'ROLE MANAGEMENT': 'userManagement',
            'TALENT ACQUISITION': 'talentAcquisition',
            'DISCUSSIONS': 'meetingsOfMinutes',
            'EMPLOYEE DOSSIER': 'employeeDossier',
            'HELP DESK': 'helpdesk',
            'LEAVES': 'leaves'
        };

        const moduleKey = moduleMapping[groupName];
        if (!moduleKey) return true;
        return user?.company?.enabledModules?.includes(moduleKey);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const togglePermission = (id) => {
        if (viewOnly) return;
        if (selectedPerms.includes(id)) {
            setSelectedPerms(selectedPerms.filter(p => p !== id));
        } else {
            setSelectedPerms([...selectedPerms, id]);
        }
    };

    const toggleGroup = (groupPerms) => {
        if (viewOnly) return;
        const groupIds = groupPerms.map(p => p._id);
        const allSelected = groupIds.every(id => selectedPerms.includes(id));

        if (allSelected) {
            // Deselect all in group
            setSelectedPerms(selectedPerms.filter(id => !groupIds.includes(id)));
        } else {
            // Select all in group
            const newSelected = new Set([...selectedPerms, ...groupIds]);
            setSelectedPerms(Array.from(newSelected));
        }
    };

    const [editingId, setEditingId] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/admin/roles/${editingId}`, {
                    name: roleName,
                    permissions: selectedPerms
                });
                toast.success('Role Updated Successfully');
            } else {
                await api.post('/admin/roles', {
                    name: roleName,
                    permissions: selectedPerms
                });
                toast.success('Role Created Successfully');
            }
            sessionStorage.removeItem(`role_data_${user?._id}`);
            setShowModal(false);
            setRoleName('');
            setSelectedPerms([]);
            setEditingId(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || (editingId ? 'Failed to update role' : 'Failed to create role'));
        }
    };


    const handleEdit = (role, isView = false) => {
        setRoleName(role.name);
        setSelectedPerms(role.permissions.map(p => p._id));
        setEditingId(role._id);
        setViewOnly(isView);
        setShowModal(true);
    };

    const openCreateModal = () => {
        setRoleName('');
        setSelectedPerms([]);
        setEditingId(null);
        setViewOnly(false);
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="zoho-card p-6 border-t-4 border-slate-200 flex flex-col justify-between h-48">
                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-2">
                                        <Skeleton className="h-6 w-32" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                    <Skeleton className="h-5 w-12" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-3/4" />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-20" />
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

                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Role Management</h1>
                        <p className="text-sm text-slate-500">Define roles and permission levels</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-all"
                    >
                        <Shield size={18} />
                        <span>Create Role</span>
                    </button>
                </div>

                {/* Roles Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {roles.map(role => (
                        <div key={role._id} className="zoho-card p-6 border-t-4 border-t-purple-500 hover:shadow-md transition-shadow flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">{role.name}</h3>
                                        <span className="text-xs text-slate-500">{role.permissions.filter(isPermissionVisible).length} Permissions</span>
                                    </div>
                                    {role.isSystem && (
                                        <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded uppercase font-bold tracking-wider">System</span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-600 line-clamp-3 overflow-hidden h-16">
                                    {role.permissions.filter(isPermissionVisible).map(p => p.description).join(', ')}
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end space-x-3">
                                {!role.isSystem && (
                                    <button
                                        onClick={() => handleEdit(role, false)}
                                        className="text-slate-500 hover:text-blue-600 text-sm font-medium"
                                    >
                                        Edit
                                    </button>
                                )}
                                <button
                                    onClick={() => handleEdit(role, true)}
                                    className="text-blue-600 text-sm font-medium hover:underline"
                                >
                                    View Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* Create/Edit Role Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-blob">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <h3 className="font-bold text-slate-800">
                                {viewOnly ? 'Role Details' : (editingId ? 'Edit Role' : 'Create New Role')}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
                        </div>

                        <div className="flex-1 overflow-auto p-6">
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role Name</label>
                                <input
                                    value={roleName}
                                    onChange={(e) => setRoleName(e.target.value)}
                                    className={`zoho-input text-lg font-semibold ${viewOnly ? 'bg-slate-50' : ''}`}
                                    placeholder="e.g. HR Manager"
                                    disabled={viewOnly || (editingId && roles.find(r => r._id === editingId)?.isSystem)}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {Object.entries(permissions)
                                    .filter(([moduleName]) => {
                                        // Mapping of backend group names to enabledModule keys
                                        const moduleMapping = {
                                            'ATTENDANCE': 'attendance',
                                            'TIMESHEETS': 'timesheet',
                                            'PROJECTS': 'projectManagement',
                                            'BUSINESS UNITS': 'projectManagement',
                                            'CLIENTS': 'projectManagement',
                                            'TASKS': 'projectManagement',
                                            'USER MANAGEMENT': 'userManagement',
                                            'ROLE MANAGEMENT': 'userManagement',
                                            'TALENT ACQUISITION': 'talentAcquisition',
                                            'DISCUSSIONS': 'meetingsOfMinutes',
                                            'EMPLOYEE DOSSIER': 'employeeDossier',
                                            'HELP DESK': 'helpdesk',
                                            'LEAVES': 'leaves'
                                        };

                                        const moduleKey = moduleMapping[moduleName];
                                        // If no mapping, show it (e.g. OTHER)
                                        if (!moduleKey) return true;

                                        // Check if module is enabled
                                        return user?.company?.enabledModules?.includes(moduleKey);
                                    })
                                    .map(([module, perms]) => (
                                        <div key={module} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                                            <div className="flex justify-between items-center mb-3 border-b border-slate-200 pb-2">
                                                <h4 className="font-bold text-slate-700 flex items-center">
                                                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                                    {module}
                                                </h4>
                                                {!viewOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleGroup(perms)}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                                                    >
                                                        {perms.every(p => selectedPerms.includes(p._id)) ? 'Unselect All' : 'Select All'}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                {perms.map(p => (
                                                    <label key={p._id} className={`flex items-start space-x-3 group ${viewOnly ? '' : 'cursor-pointer'}`}>
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors mt-0.5 ${selectedPerms.includes(p._id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                                            {selectedPerms.includes(p._id) && <Check size={12} className="text-white" />}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={selectedPerms.includes(p._id)}
                                                            onChange={() => togglePermission(p._id)}
                                                            disabled={viewOnly}
                                                        />
                                                        <div className="flex-1">
                                                            <div className="text-sm font-medium text-slate-700">{p.key}</div>
                                                            <div className="text-xs text-slate-500">{p.description}</div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end space-x-3">
                            <button onClick={() => setShowModal(false)} className="zoho-btn-secondary">
                                {viewOnly ? 'Close' : 'Cancel'}
                            </button>
                            {!viewOnly && (
                                <button onClick={handleSubmit} className="zoho-btn-primary px-8">
                                    {editingId ? 'Update Role' : 'Create Role'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Roles;
