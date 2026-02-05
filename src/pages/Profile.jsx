import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { User, Mail, Briefcase, Shield, Hash, Users, MapPin, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/auth/profile');
                setProfile(res.data);
            } catch (error) {
                console.error(error);
                toast.error('Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading Profile...</div>;
    if (!profile) return <div className="p-8 text-center text-red-500">Profile not found</div>;

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header Card */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
                    <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
                    <div className="px-8 pb-8">
                        <div className="relative flex justify-between items-end -mt-12 mb-6">
                            <div className="flex items-end">
                                <div className="h-24 w-24 rounded-full bg-white p-1 shadow-lg">
                                    <div className="h-full w-full rounded-full bg-slate-200 flex items-center justify-center text-3xl font-bold text-slate-500">
                                        {profile.firstName?.charAt(0)}
                                    </div>
                                </div>
                                <div className="ml-4 mb-1">
                                    <h1 className="text-2xl font-bold text-slate-800">{profile.firstName} {profile.lastName}</h1>
                                    <p className="text-slate-500 flex items-center text-sm">
                                        <Mail size={14} className="mr-1" /> {profile.email}
                                    </p>
                                </div>
                            </div>
                            <div className="hidden sm:block">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${profile.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {profile.isActive ? 'Active Employee' : 'Inactive'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Role</label>
                                    <div className="flex items-center mt-1 text-slate-700">
                                        <Shield size={18} className="mr-2 text-blue-500" />
                                        <span className="font-medium">{profile.roles?.map(r => r.name).join(', ') || 'No Role'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee ID</label>
                                    <div className="flex items-center mt-1 text-slate-700">
                                        <Hash size={18} className="mr-2 text-slate-400" />
                                        <span className="font-mono">{profile.employeeCode || 'N/A'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employment Type</label>
                                    <div className="flex items-center mt-1 text-slate-700">
                                        <Briefcase size={18} className="mr-2 text-slate-400" />
                                        <span>{profile.employmentType || 'Full Time'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Department</label>
                                    <div className="flex items-center mt-1 text-slate-700">
                                        <Briefcase size={18} className="mr-2 text-slate-400" />
                                        <span>{profile.department || 'General'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Location</label>
                                    <div className="flex items-center mt-1 text-slate-700">
                                        <MapPin size={18} className="mr-2 text-slate-400" />
                                        <span>Headquarters</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reporting To</label>
                                    {profile.reportingManagers && profile.reportingManagers.length > 0 ? (
                                        <div className="space-y-2 mt-2">
                                            {profile.reportingManagers.map(manager => (
                                                <div key={manager._id} className="flex items-center p-2 bg-blue-50 rounded border border-blue-100">
                                                    <div className="h-8 w-8 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs mr-2">
                                                        {manager.firstName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800">{manager.firstName} {manager.lastName}</div>
                                                        <div className="text-xs text-slate-500">{manager.email}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="mt-1 text-slate-400 text-sm italic">No Reporting Manager</div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date of Joining</label>
                                    <div className="flex items-center mt-1 text-slate-700">
                                        <Calendar size={18} className="mr-2 text-slate-400" />
                                        <span className="font-medium">{profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Subordinates Section */}
                {profile.directReports && profile.directReports.length > 0 && (
                    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center">
                                <Users size={18} className="mr-2 text-blue-600" />
                                My Team (Direct Reports)
                            </h3>
                            <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">
                                {profile.directReports.length}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                    <tr>
                                        <th className="px-6 py-3">Employee</th>
                                        <th className="px-6 py-3">Email</th>
                                        <th className="px-6 py-3">Department</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {profile.directReports.map((report) => (
                                        <tr key={report._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center space-x-3">
                                                    <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs">
                                                        {report.firstName.charAt(0)}
                                                    </div>
                                                    <span className="font-medium text-slate-700">{report.firstName} {report.lastName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-slate-600">{report.email}</td>
                                            <td className="px-6 py-3 text-slate-600">{report.department || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;
