import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { UserPlus, Search, Edit2, Shield, Calendar } from 'lucide-react';
import Skeleton from '../components/Skeleton';
import toast from 'react-hot-toast';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        roleId: '',
        department: '',
        employeeCode: '',
        joiningDate: '',
        directReports: []
    });

    const fetchData = async () => {
        try {
            // Try fetching all users (Admin)
            // If 403, try fetching team
            let usersData = [];
            let rolesData = [];

            try {
                const res = await api.get('/admin/users');
                console.log('Admin users fetch success');
                usersData = res.data;
            } catch (err) {
                console.log('Admin users fetch failed', err.response?.status);
                if (err.response && err.response.status === 403) {
                    console.log('Attempting to fetch my team...');
                    toast('Viewing My Team (Not Admin)', { icon: '👥' });
                    const teamRes = await api.get('/admin/users/team');
                    console.log('Team fetch success', teamRes.data);
                    usersData = teamRes.data;
                } else {
                    throw err;
                }
            }

            // Try fetching roles (Admin only)
            try {
                const rolesRes = await api.get('/admin/roles');
                rolesData = rolesRes.data;
            } catch (err) {
                // If 403, just ignore roles (read-only view)
                console.log('Roles access denied, switching to view-only');
            }

            setUsers(usersData);
            setRoles(rolesData);
        } catch (error) {
            toast.error('Failed to load data');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const canEdit = roles.length > 0; // If we can see roles, we are likely Admin

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        // Find users who currently report to this user
        const currentReports = users.filter(u => u.reportingManager === user._id || (u.reportingManager?._id === user._id)).map(u => u._id);

        setFormData({
            firstName: user.firstName,
            lastName: user.lastName || '',
            email: user.email,
            password: '',
            roleId: user.roles[0]?._id || '',
            department: user.department || '',
            employeeCode: user.employeeCode || '',
            joiningDate: user.joiningDate ? new Date(user.joiningDate).toISOString().split('T')[0] : '',
            directReports: currentReports
        });
        setShowModal(true);
    };

    const handleAdd = () => {
        setEditingUser(null);
        setFormData({
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            roleId: '',
            department: '',
            employeeCode: '',
            joiningDate: ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await api.put(`/admin/users/${editingUser._id}`, formData);
                toast.success('User Updated Successfully');
            } else {
                await api.post('/admin/users', formData);
                toast.success('User Created Successfully');
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Operation failed');
        }
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
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <Skeleton className="h-9 w-64 rounded-md" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="p-0">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-slate-50 last:border-0">
                                <div className="flex items-center space-x-3 w-1/4">
                                    <Skeleton className="h-9 w-9 rounded-full" />
                                    <div className="space-y-1">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-20" />
                                    </div>
                                </div>
                                <Skeleton className="h-4 w-1/6" />
                                <Skeleton className="h-6 w-20 rounded" />
                                <Skeleton className="h-4 w-1/6" />
                                <Skeleton className="h-4 w-1/6" />
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

                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{canEdit ? 'User Management' : 'My Team'}</h1>
                        <p className="text-sm text-slate-500">{canEdit ? 'Manage employees and their access roles' : 'View your direct reports'}</p>
                    </div>
                    {canEdit && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-all"
                        >
                            <UserPlus size={18} />
                            <span>Add User</span>
                        </button>
                    )}
                </div>

                {/* Users List */}
                <div className="zoho-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                className="pl-9 pr-4 py-1.5 w-64 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div className="text-sm text-slate-500">
                            Total Users: <strong>{users.length}</strong>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3">Employee</th>
                                    <th className="px-6 py-3">Email</th>
                                    <th className="px-6 py-3">Role</th>
                                    <th className="px-6 py-3">Department</th>
                                    <th className="px-6 py-3">Reporting To</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map((user) => (
                                    <tr key={user._id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center space-x-3">
                                                <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                    {user.firstName.charAt(0)}{user.lastName?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-800">{user.firstName} {user.lastName}</div>
                                                    <div className="text-xs text-slate-500">{user.employeeCode || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">{user.email}</td>
                                        <td className="px-6 py-3">
                                            {user.roles.map(r => (
                                                <span key={r._id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 mr-1">
                                                    <Shield size={10} className="mr-1" /> {r.name}
                                                </span>
                                            ))}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">{user.department || '-'}</td>
                                        <td className="px-6 py-3 text-slate-600">
                                            {user.reportingManager ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-xs text-slate-700">{user.reportingManager.firstName} {user.reportingManager.lastName}</span>
                                                    <span className="text-[10px] text-slate-400">{user.reportingManager.email}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">None</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                {user.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            {canEdit && (
                                                <button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                                            )}
                                            {/* View Timesheet Action (Visible if user reports to me or if I am Admin) */}
                                            {(!canEdit || canEdit) && (user.reportingManager?._id !== user._id) && (
                                                <button
                                                    onClick={() => {
                                                        // Navigate to timesheet with user context
                                                        window.location.href = `/timesheet?userId=${user._id}&name=${user.firstName} ${user.lastName}`;
                                                    }}
                                                    className="text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-50 rounded ml-2"
                                                    title="View Timesheet"
                                                >
                                                    <Calendar size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden animate-blob">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">{editingUser ? 'Edit Employee' : 'Add New Employee'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">First Name</label>
                                    <input name="firstName" required value={formData.firstName} onChange={handleChange} className="zoho-input" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Last Name</label>
                                    <input name="lastName" value={formData.lastName} onChange={handleChange} className="zoho-input" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                                    <input name="email" type="email" required value={formData.email} onChange={handleChange} className="zoho-input" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password {editingUser && '(Leave blank to keep)'}</label>
                                    <input name="password" type="password" required={!editingUser} onChange={handleChange} className="zoho-input" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department</label>
                                    <input name="department" value={formData.department} onChange={handleChange} className="zoho-input" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employee Code</label>
                                    <input name="employeeCode" value={formData.employeeCode} onChange={handleChange} className="zoho-input" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date of Joining</label>
                                <input name="joiningDate" type="date" value={formData.joiningDate} onChange={handleChange} className="zoho-input" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Role</label>
                                <select name="roleId" required value={formData.roleId} onChange={handleChange} className="zoho-input">
                                    <option value="">Select Role</option>
                                    {roles.map(r => (
                                        <option key={r._id} value={r._id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Direct Reports Multi-Select */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Subordinates (Direct Reports)</label>
                                <div className="h-40 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50 grid grid-cols-2 gap-2">
                                    {users.filter(u => !editingUser || u._id !== editingUser._id).map(user => (
                                        <label key={user._id} className="flex items-center space-x-2 text-sm bg-white p-2 rounded border border-slate-100 shadow-sm cursor-pointer hover:border-blue-300">
                                            <input
                                                type="checkbox"
                                                value={user._id}
                                                checked={formData.directReports?.includes(user._id)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const id = user._id;
                                                    setFormData(prev => {
                                                        const current = prev.directReports || [];
                                                        if (checked) return { ...prev, directReports: [...current, id] };
                                                        return { ...prev, directReports: current.filter(x => x !== id) };
                                                    });
                                                }}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-700">{user.firstName} {user.lastName}</span>
                                                <span className="text-[10px] text-slate-400">{user.email}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Selected users will have this person set as their Reporting Manager.</p>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 mt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="zoho-btn-secondary">Cancel</button>
                                <button type="submit" className="zoho-btn-primary">{editingUser ? 'Update User' : 'Create User'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
