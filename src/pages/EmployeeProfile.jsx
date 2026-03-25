import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
    User, Mail, Briefcase, Shield, Hash, Users, MapPin, Calendar,
    ArrowLeft, Edit2, Clock, FileText, Activity, AlertCircle, UserMinus, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { format } from 'date-fns';
import UserTADashboard from './TalentAcquisition/UserTADashboard';
import Timesheet from './Timesheet';
import EmployeeDossier from './EmployeeDossier';

const EmployeeProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, edit, timesheet, dossier, ta-analytics
    const [roles, setRoles] = useState([]);
    const [allUsers, setAllUsers] = useState([]); // for reporting managers/direct reports

    // Form State for Editing
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        roleId: '',
        department: '',
        employeeCode: '',
        joiningDate: '',
        employmentType: 'Full Time',
        workLocation: '',
        directReports: [],
        reportingManagers: []
    });

    const enabledModules = currentUser?.company?.enabledModules || [];
    const hasTA = enabledModules.includes('talentAcquisition');
    const hasAttendance = enabledModules.includes('attendance');
    const hasTimesheet = enabledModules.includes('timesheet');
    const hasDossier = enabledModules.includes('employeeDossier');

    const isAuthorizedForTA = (currentUser?.roles?.includes('Admin') || currentUser?.permissions?.includes('ta.read')) && hasTA;
    const isAuthorizedForEdit = currentUser?.roles?.includes('Admin') || currentUser?.permissions?.includes('user.update');

    // Reset active tab if it becomes unauthorized or module is disabled
    useEffect(() => {
        if (activeTab === 'ta-analytics' && !isAuthorizedForTA) setActiveTab('overview');
        if (activeTab === 'attendance' && !hasAttendance) setActiveTab('overview');
        if (activeTab === 'timesheet' && !hasTimesheet) setActiveTab('overview');
        if (activeTab === 'dossier' && !hasDossier) setActiveTab('overview');
    }, [activeTab, isAuthorizedForTA, hasAttendance, hasTimesheet, hasDossier]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch the specific user profile
            const res = await api.get(`/admin/users/${id}`);
            const userData = res.data;
            setProfile(userData);

            // Pre-fill form data
            setFormData({
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                email: userData.email || '',
                password: '', // Blank by default, only sent if changed
                roleId: userData.roles?.[0]?._id || '',
                department: userData.department || '',
                employeeCode: userData.employeeCode || '',
                joiningDate: userData.joiningDate ? new Date(userData.joiningDate).toISOString().split('T')[0] : '',
                employmentType: userData.employmentType || 'Full Time',
                workLocation: userData.workLocation || '',
                directReports: userData.directReports?.map(u => u._id) || [],
                reportingManagers: userData.reportingManagers?.map(u => u._id) || []
            });

            // Fetch roles and all users for edit form context if authorized
            if (isAuthorizedForEdit) {
                try {
                    const [rolesRes, usersRes] = await Promise.all([
                        api.get('/admin/roles'),
                        api.get('/admin/users')
                    ]);
                    setRoles(rolesRes.data);
                    setAllUsers(usersRes.data);
                } catch (err) {
                    console.log("Could not fetch roles/users context for edit form:", err);
                }
            }

        } catch (error) {
            console.error(error);
            toast.error('Failed to load employee profile');
            if (error.response?.status === 403 || error.response?.status === 404) {
                navigate('/users');
            }
        } finally {
            setLoading(false);
        }
    }, [id, isAuthorizedForEdit, navigate]);

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const handleToggleStatus = async () => {
        if (!window.confirm(`Are you sure you want to ${profile.isActive ? 'deactivate' : 'reactivate'} this user?`)) return;
        
        try {
            const loadingToast = toast.loading(`${profile.isActive ? 'Deactivating' : 'Activating'} user...`);
            const res = await api.patch(`/admin/users/${id}/status`);
            toast.success(res.data.message, { id: loadingToast });
            setProfile(prev => ({ ...prev, isActive: res.data.isActive }));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update status');
        }
    };

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const loadingToast = toast.loading('Updating user...');
            await api.put(`/admin/users/${id}`, formData);
            toast.success('User updated successfully', { id: loadingToast });
            // Refresh data and switch back to overview
            await fetchData();
            setActiveTab('overview');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update user');
        }
    };

    if (loading) {
        return (
            <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
                <div className="h-32 bg-slate-200 rounded-xl"></div>
                <div className="flex gap-4">
                    <div className="h-10 bg-slate-200 rounded w-24"></div>
                    <div className="h-10 bg-slate-200 rounded w-24"></div>
                    <div className="h-10 bg-slate-200 rounded w-24"></div>
                </div>
                <div className="h-64 bg-slate-200 rounded-xl"></div>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-4 sm:p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Back Button & Header */}
                <div className="flex items-center gap-4 mb-2">
                    <button
                        onClick={() => navigate('/users')}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Employee Details</h1>
                        <p className="text-sm text-slate-500">Manage profile and view analytics</p>
                    </div>
                </div>

                {/* Profile Header Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
                    <div className="h-24 bg-gradient-to-r from-slate-700 to-slate-900"></div>
                    <div className="px-6 sm:px-8 pb-6 bg-white relative">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-10 sm:-mt-12 gap-4">
                            <div className="flex items-end gap-4">
                                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center text-3xl font-bold text-slate-400 shadow-sm shrink-0">
                                    {profile.firstName?.charAt(0)}{profile.lastName?.charAt(0)}
                                </div>
                                <div className="pb-1 sm:pb-2">
                                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 whitespace-nowrap">
                                        {profile.firstName} {profile.lastName}
                                    </h2>
                                    <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                                        <Mail size={14} /> {profile.email}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:pb-2">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${profile.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    {profile.isActive ? 'Active' : 'Inactive'}
                                </span>
                                {profile.roles?.map(role => (
                                    <span key={role._id} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                        <Shield size={12} /> {role.name}
                                    </span>
                                ))}
                                {isAuthorizedForEdit && (
                                    <button
                                        onClick={handleToggleStatus}
                                        className={`ml-2 px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm border ${
                                            profile.isActive 
                                            ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' 
                                            : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                                        }`}
                                    >
                                        {profile.isActive ? <UserMinus size={14} /> : <UserCheck size={14} />}
                                        {profile.isActive ? 'Deactivate User' : 'Activate User'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex flex-nowrap overflow-x-auto hide-scrollbar gap-1">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${activeTab === 'overview' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                    >
                        <User size={16} /> Overview
                    </button>

                    {isAuthorizedForEdit && (
                        <button
                            onClick={() => setActiveTab('edit')}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${activeTab === 'edit' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                        >
                            <Edit2 size={16} /> Edit Details
                        </button>
                    )}

                    {hasTimesheet && (
                        <button
                            onClick={() => setActiveTab('timesheet')}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${activeTab === 'timesheet' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                        >
                            <Clock size={16} /> Timesheet
                        </button>
                    )}

                    {hasAttendance && (
                        <button
                            onClick={() => setActiveTab('attendance')}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${activeTab === 'attendance' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                        >
                            <Clock size={16} /> Attendance
                        </button>
                    )}

                    {hasDossier && (
                        <button
                            onClick={() => setActiveTab('dossier')}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${activeTab === 'dossier' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                        >
                            <FileText size={16} /> Dossier
                        </button>
                    )}

                    {isAuthorizedForTA && (
                        <button
                            onClick={() => setActiveTab('ta-analytics')}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${activeTab === 'ta-analytics' ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                        >
                            <Activity size={16} /> TA Analytics
                        </button>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="w-full">

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Basic Info Card */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
                                        <Briefcase size={18} className="text-blue-600" /> Work Information
                                    </h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Employee ID</p>
                                            <p className="text-[14px] font-semibold text-slate-800 flex items-center gap-2">
                                                <Hash size={16} className="text-slate-400" /> {profile.employeeCode || 'Not Assigned'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department</p>
                                            <p className="text-[14px] font-semibold text-slate-800 flex items-center gap-2">
                                                <Briefcase size={16} className="text-slate-400" /> {profile.department || 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Employment Type</p>
                                            <p className="text-[14px] font-semibold text-slate-800 flex items-center gap-2">
                                                <User size={16} className="text-slate-400" /> {profile.employmentType || 'Full Time'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Work Location</p>
                                            <p className="text-[14px] font-semibold text-slate-800 flex items-center gap-2">
                                                <MapPin size={16} className="text-slate-400" /> {profile.workLocation || 'Headquarters'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date of Joining</p>
                                            <p className="text-[14px] font-semibold text-slate-800 flex items-center gap-2">
                                                <Calendar size={16} className="text-slate-400" />
                                                {profile.joiningDate ? format(new Date(profile.joiningDate), 'MMM dd, yyyy') : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Organization Card */}
                            <div className="space-y-6">
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
                                        <Users size={18} className="text-blue-600" /> Organization
                                    </h3>

                                    <div className="space-y-5">
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Reporting Manager(s)</p>
                                            {profile.reportingManagers && profile.reportingManagers.length > 0 ? (
                                                <div className="space-y-2">
                                                    {profile.reportingManagers.map(manager => (
                                                        <div key={manager._id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer hover:bg-blue-50 transition-colors" onClick={() => navigate(`/users/${manager._id}`)}>
                                                            <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                                                                {manager.firstName.charAt(0)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-slate-800 truncate">{manager.firstName} {manager.lastName}</p>
                                                                <p className="text-[11px] text-slate-500 truncate">{manager.email}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-500 italic">No reporting manager assigned.</p>
                                            )}
                                        </div>

                                        {profile.directReports && profile.directReports.length > 0 && (
                                            <div>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Direct Reports ({profile.directReports.length})</p>
                                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                    {profile.directReports.map(report => (
                                                        <div key={report._id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer hover:bg-blue-50 transition-colors" onClick={() => navigate(`/users/${report._id}`)}>
                                                            <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                                                                {report.firstName.charAt(0)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-slate-800 truncate">{report.firstName} {report.lastName}</p>
                                                                <p className="text-[11px] text-slate-500 truncate">{report.department || report.employeeCode || '-'}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* EDIT TAB */}
                    {activeTab === 'edit' && isAuthorizedForEdit && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-4xl mx-auto">
                            <div className="mb-6 border-b border-slate-100 pb-4">
                                <h3 className="text-lg font-bold text-slate-800">Edit Employee Details</h3>
                                <p className="text-sm text-slate-500">Update system records and access for this user.</p>
                            </div>

                            <form onSubmit={handleEditSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">First Name</label>
                                        <input name="firstName" required value={formData.firstName} onChange={handleFormChange} className="zoho-input" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Last Name</label>
                                        <input name="lastName" value={formData.lastName} onChange={handleFormChange} className="zoho-input" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                                        <input name="email" type="email" required value={formData.email} onChange={handleFormChange} className="zoho-input" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password (Leave blank to keep current)</label>
                                        <input name="password" type="password" onChange={handleFormChange} className="zoho-input" placeholder="••••••••" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employee Code</label>
                                        <input name="employeeCode" value={formData.employeeCode} onChange={handleFormChange} className="zoho-input" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date of Joining</label>
                                        <input name="joiningDate" type="date" value={formData.joiningDate} onChange={handleFormChange} className="zoho-input" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department</label>
                                        <input name="department" value={formData.department} onChange={handleFormChange} className="zoho-input" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Work Location</label>
                                        <input name="workLocation" value={formData.workLocation} onChange={handleFormChange} className="zoho-input" placeholder="e.g. Remote, NY Office" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employment Type</label>
                                        <select name="employmentType" value={formData.employmentType} onChange={handleFormChange} className="zoho-input">
                                            <option value="Full Time">Full Time</option>
                                            <option value="Part Time">Part Time</option>
                                            <option value="Contract">Contract</option>
                                            <option value="Intern">Intern</option>
                                            <option value="Consultant">Consultant</option>
                                            <option value="Freelance">Freelance</option>
                                            <option value="Probation">Probation</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">System Role</label>
                                        <select name="roleId" required value={formData.roleId} onChange={handleFormChange} className="zoho-input">
                                            <option value="">Select Role</option>
                                            {roles.map(r => (
                                                <option key={r._id} value={r._id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Assign Subordinates (Users who report to this employee)</label>
                                    <div className="h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-2 custom-scrollbar">
                                        {allUsers.filter(u => u._id !== profile._id).map(userAcc => (
                                            <label key={userAcc._id} className="flex items-start space-x-3 text-sm bg-white p-2.5 rounded hover:bg-blue-50 cursor-pointer border border-transparent hover:border-blue-100 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    value={userAcc._id}
                                                    checked={formData.directReports?.includes(userAcc._id)}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        const uId = userAcc._id;
                                                        setFormData(prev => {
                                                            const current = prev.directReports || [];
                                                            if (checked) return { ...prev, directReports: [...current, uId] };
                                                            return { ...prev, directReports: current.filter(x => x !== uId) };
                                                        });
                                                    }}
                                                    className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-semibold text-slate-700 truncate">{userAcc.firstName} {userAcc.lastName}</span>
                                                    <span className="text-[11px] text-slate-500 truncate">{userAcc.email}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                                    <button type="button" onClick={() => setActiveTab('overview')} className="zoho-btn-secondary px-6">Cancel</button>
                                    <button type="submit" className="zoho-btn-primary px-6">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* TIMESHEET TAB */}
                    {activeTab === 'timesheet' && (
                        <div className="w-full">
                            <Timesheet
                                propUserId={profile._id}
                                propUserName={`${profile.firstName} ${profile.lastName}`}
                                initialTab="timesheet"
                                isEmbedded={true}
                            />
                        </div>
                    )}

                    {/* ATTENDANCE TAB */}
                    {activeTab === 'attendance' && (
                        <div className="w-full">
                            <Timesheet
                                propUserId={profile._id}
                                propUserName={`${profile.firstName} ${profile.lastName}`}
                                initialTab="attendance"
                                isEmbedded={true}
                            />
                        </div>
                    )}

                    {/* DOSSIER TAB */}
                    {activeTab === 'dossier' && (
                        <div className="w-full">
                            <EmployeeDossier userId={profile._id} embedded={true} />
                        </div>
                    )}

                    {/* TA ANALYTICS TAB */}
                    {activeTab === 'ta-analytics' && isAuthorizedForTA && (
                        <div className="w-full">
                            <UserTADashboard providedUserName={`${profile.firstName} ${profile.lastName}`} />
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default EmployeeProfile;
