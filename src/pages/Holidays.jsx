import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, Calendar, X, Save, CalendarCheck, CalendarOff, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const Holidays = () => {
    const { user } = useAuth();
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        date: '',
        isOptional: false
    });

    // Determine stats
    const totalHolidays = holidays.length;
    const upcomingHolidays = holidays.filter(h => new Date(h.date) >= new Date() && !h.isOptional).length;
    const optionalHolidays = holidays.filter(h => h.isOptional).length;

    const isAdmin = user?.roles?.includes('Admin') || user?.roles?.some(r => r.name === 'Admin');
    const canCreateHoliday = isAdmin || user?.permissions?.includes('holiday.create') || user?.hasAllPermissions;
    const canEditHoliday = isAdmin || user?.permissions?.includes('holiday.edit') || user?.hasAllPermissions;
    const canDeleteHoliday = isAdmin || user?.permissions?.includes('holiday.delete') || user?.hasAllPermissions;

    useEffect(() => {
        fetchHolidays();
    }, []);

    const fetchHolidays = async (isBackground = false) => {
        const CACHE_KEY = `holiday_data_${user?._id}_${new Date().getFullYear()}`;

        // Helper: Generate fingerprint for change detection
        const buildFingerprint = (data) => {
            if (!Array.isArray(data)) return '';
            return data.map(h => `${h._id}-${h.name}-${h.date}-${h.isOptional}`).join('|');
        };

        // 1. Initial Load from Cache
        if (!isBackground) {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    setHolidays(parsed);
                    setLoading(false);
                } catch (e) {
                    sessionStorage.removeItem(CACHE_KEY);
                }
            }
        }

        try {
            if (!isBackground && !sessionStorage.getItem(CACHE_KEY)) setLoading(true);
            const res = await api.get('/holidays');
            const freshData = res.data;

            // 2. Check for changes via fingerprint
            const oldFingerprint = buildFingerprint(JSON.parse(sessionStorage.getItem(CACHE_KEY) || '[]'));
            const newFingerprint = buildFingerprint(freshData);

            if (newFingerprint !== oldFingerprint) {
                setHolidays(freshData);
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
            }
        } catch (error) {
            console.error(error);
            if (!isBackground) toast.error("Failed to load holidays");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (holiday = null) => {
        if (holiday) {
            setEditingHoliday(holiday);
            setFormData({
                name: holiday.name,
                date: new Date(holiday.date).toISOString().split('T')[0],
                isOptional: holiday.isOptional
            });
        } else {
            setEditingHoliday(null);
            setFormData({ name: '', date: '', isOptional: false });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingHoliday) {
                await api.put(`/holidays/${editingHoliday._id}`, formData);
                toast.success("Holiday updated");
            } else {
                await api.post('/holidays', formData);
                toast.success("Holiday added");
            }
            setIsModalOpen(false);
            fetchHolidays();
        } catch (error) {
            toast.error(error.response?.data?.message || "Operation failed");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this holiday?")) return;
        try {
            await api.delete(`/holidays/${id}`);
            toast.success("Holiday deleted");
            fetchHolidays();
        } catch (error) {
            toast.error("Failed to delete holiday");
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Holiday Calendar</h1>
                    <p className="text-slate-500 mt-1">Manage annual holidays and optional leaves for your organization.</p>
                </div>
                {canCreateHoliday && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all font-medium"
                    >
                        <Plus size={20} />
                        <span>Add New Holiday</span>
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <CalendarDays size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Total Holidays</p>
                        <p className="text-2xl font-bold text-slate-800">{totalHolidays}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                        <CalendarCheck size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Upcoming Holidays</p>
                        <p className="text-2xl font-bold text-slate-800">{upcomingHolidays}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                        <CalendarOff size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Optional Leaves</p>
                        <p className="text-2xl font-bold text-slate-800">{optionalHolidays}</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12 bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ring-1 ring-black/5">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left bg-white">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 font-semibold text-slate-700 text-sm tracking-wide uppercase">Date</th>
                                    <th className="px-6 py-4 font-semibold text-slate-700 text-sm tracking-wide uppercase">Holiday Name</th>
                                    <th className="px-6 py-4 font-semibold text-slate-700 text-sm tracking-wide uppercase">Type</th>
                                    <th className="px-6 py-4 font-semibold text-slate-700 text-sm tracking-wide uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {holidays.length > 0 ? (
                                    holidays.map((holiday) => {
                                        const isPast = new Date(holiday.date) < new Date().setHours(0, 0, 0, 0);
                                        return (
                                            <tr
                                                key={holiday._id}
                                                // Make row clickable for admins to edit
                                                onClick={() => canEditHoliday && handleOpenModal(holiday)}
                                                className={`hover:bg-slate-50/80 transition-colors group ${canEditHoliday ? 'cursor-pointer' : ''}`}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center space-x-4">
                                                        <div className={`p-2 rounded-lg ${isPast ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                                                            <Calendar size={20} />
                                                        </div>
                                                        <div>
                                                            <p className={`font-semibold ${isPast ? 'text-slate-500' : 'text-slate-900'}`}>
                                                                {format(new Date(holiday.date), 'MMMM d, yyyy')}
                                                            </p>
                                                            <p className="text-xs text-slate-400 font-medium">
                                                                {format(new Date(holiday.date), 'EEEE')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-base font-medium ${isPast ? 'text-slate-500' : 'text-slate-800'}`}>{holiday.name}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${holiday.isOptional
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : 'bg-green-50 text-green-700 border-green-200'
                                                        }`}>
                                                        {holiday.isOptional ? 'Optional' : 'Fixed'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-sm ${isPast ? 'text-slate-400 italic' : 'text-blue-600 font-medium'}`}>
                                                        {isPast ? 'Completed' : 'Upcoming'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <CalendarOff size={48} className="mb-4 text-slate-300" />
                                                <p className="text-lg font-medium text-slate-500">No holidays found for this year</p>
                                                <p className="text-sm mt-1">Get started by adding a new holiday to the calendar.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {holidays.length > 0 && (
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between uppercase tracking-wider font-semibold">
                            <span>Total: {totalHolidays}</span>
                            {/* <span>Powered by HRCODE</span> */}
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100">
                        <div className="bg-white px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-xl text-slate-800">
                                    {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">Enter holiday details below</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">Holiday Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800 placeholder:font-normal"
                                    placeholder="e.g. Independence Day"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
                                    />
                                </div>
                                <div className="flex flex-col justify-end">
                                    <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                                        <input
                                            type="checkbox"
                                            id="isOptional"
                                            checked={formData.isOptional}
                                            onChange={(e) => setFormData({ ...formData, isOptional: e.target.checked })}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                                        />
                                        <span className="text-sm font-medium text-slate-700 select-none">
                                            Optional / Floating
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-6 flex justify-between items-center border-t border-slate-100 mt-4">
                                <div>
                                    {editingHoliday && canDeleteHoliday && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm("Are you sure you want to delete this holiday?")) {
                                                    handleDelete(editingHoliday._id);
                                                    setIsModalOpen(false);
                                                }
                                            }}
                                            className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center space-x-1"
                                        >
                                            <Trash2 size={16} />
                                            <span>Delete Holiday</span>
                                        </button>
                                    )}
                                </div>
                                <div className="flex space-x-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg transition text-sm font-semibold border border-transparent hover:border-slate-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-semibold shadow-lg shadow-blue-500/30 flex items-center space-x-2"
                                    >
                                        <Save size={18} />
                                        <span>{editingHoliday ? 'Update Changes' : 'Save Holiday'}</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Holidays;
