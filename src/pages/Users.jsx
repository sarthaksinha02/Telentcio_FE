import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Search, Edit2, Shield, Calendar, Download } from 'lucide-react';
import Skeleton from '../components/Skeleton';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

const Users = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [holidays, setHolidays] = useState([]);

    // Helpers for Export
    const formatTime = (dateString, istString) => {
        if (istString && istString.includes(',')) return istString.split(',')[1]?.trim() || '';
        if (!dateString) return '--:--';
        return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const calculateDuration = (start, end) => {
        if (!start) return '--';
        const startTime = new Date(start);
        const endTime = end ? new Date(end) : new Date();
        if (endTime < startTime) return '0h 0m';
        const diffString = Math.abs(endTime - startTime);
        const hours = Math.floor(diffString / (1000 * 60 * 60));
        const minutes = Math.floor((diffString % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    const handleExportAttendance = async (targetUser) => {
        const toastId = toast.loading('Generating Report...');
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;

            // Fetch History and Holidays on demand if not present (Holidays could be fetched once, but safe here)
            const [historyRes, holidaysRes] = await Promise.all([
                api.get(`/attendance/history?year=${year}&month=${month}&userId=${targetUser._id}`),
                api.get('/holidays')
            ]);

            const history = historyRes.data;
            const holidaysData = holidaysRes.data;

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Attendance Report');

            // 1. Header Info (Rows 1-4)
            sheet.mergeCells('A1:C1');
            sheet.getCell('A1').value = `User Name: ${targetUser.firstName} ${targetUser.lastName || ''}`;
            sheet.getCell('A1').font = { bold: true, size: 14 };

            sheet.mergeCells('A2:C2');
            sheet.getCell('A2').value = `Joining Date: ${targetUser.joiningDate ? new Date(targetUser.joiningDate).toLocaleDateString() : 'N/A'}`;

            sheet.mergeCells('A3:C3');
            const managers = targetUser.reportingManagers || [];
            const mgrNames = managers.length > 0 ? managers.map(m => `${m.firstName} ${m.lastName}`).join(', ') : 'N/A';
            sheet.getCell('A3').value = `Supervisor(s): ${mgrNames}`;

            sheet.addRow([]); // Row 4 Empty Buffer

            // 2. Table Header (Row 5)
            const headerRow = sheet.addRow(['Date', 'Day', 'Status', 'In Time', 'Out Time', 'Duration']);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }; // Blue
            headerRow.alignment = { horizontal: 'center' };

            // 3. Data Generation
            const start = startOfMonth(now);
            const end = endOfMonth(now);
            const days = eachDayOfInterval({ start, end });

            days.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const record = history.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);
                const isSunday = day.getDay() === 0;
                const isFuture = day > new Date();

                let status = 'Absent';
                let rowColor = 'FFF2DCDB'; // Red by default

                const joiningDate = targetUser.joiningDate ? new Date(targetUser.joiningDate) : null;
                if (joiningDate) joiningDate.setHours(0, 0, 0, 0);

                const holiday = holidaysData.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);

                if (joiningDate && day < joiningDate) {
                    status = 'Not Applicable';
                    rowColor = 'FFFFFFFF';
                } else if (isFuture) {
                    status = '-';
                    rowColor = 'FFFFFFFF';
                } else if (holiday) {
                    status = holiday.name;
                    rowColor = holiday.isOptional ? 'FFFFE0B2' : 'FFD1F2EB';
                } else if (record) {
                    status = 'Present';
                    rowColor = 'FFEBF1DE';
                } else if (isSunday) {
                    status = 'Weekoff';
                    rowColor = 'FFF2F2F2';
                }

                const row = sheet.addRow([
                    format(day, 'dd-MMM-yyyy'),
                    format(day, 'EEEE'),
                    status,
                    record ? formatTime(record.clockIn, record.clockInIST) : '-',
                    record ? formatTime(record.clockOut, record.clockOutIST) : '-',
                    record ? calculateDuration(record.clockIn, record.clockOut) : '-'
                ]);

                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
                row.alignment = { horizontal: 'center' };
            });

            // 4. Columns Width
            sheet.columns = [
                { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }
            ];

            const buffer = await workbook.xlsx.writeBuffer();
            const fileName = `Attendance_${format(start, 'MMMM_yyyy')}_${targetUser.firstName}.xlsx`;
            saveAs(new Blob([buffer]), fileName);
            toast.success('Report Downloaded', { id: toastId });

        } catch (error) {
            console.error(error);
            toast.error('Failed to generate report', { id: toastId });
        }
    };



    const handleExportTeamAttendance = async () => {
        const toastId = toast.loading('Generating Team Report...');
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;

            const res = await api.get(`/attendance/team-report?year=${year}&month=${month}`);
            const { teamMembers, attendanceRecords } = res.data;

            if (!teamMembers || teamMembers.length === 0) {
                toast.error('No team members found', { id: toastId });
                return;
            }

            const start = startOfMonth(now);
            const end = endOfMonth(now);
            const daysOfMonth = eachDayOfInterval({ start, end });

            // Helpers
            const fmtTime = (d) => {
                if (!d) return '--:--';
                return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            };

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Team Attendance');

            // Iterate over each team member to create their own section
            teamMembers.forEach((member, index) => {
                // Add Space between users (except the first one)
                if (index > 0) {
                    sheet.addRow([]);
                    sheet.addRow([]);
                }

                // --- User Metadata Section ---
                const metaStartRow = sheet.rowCount + 1;

                // Name
                const nameRow = sheet.addRow(['Employee Name:', `${member.firstName} ${member.lastName}`]);
                nameRow.font = { bold: true, size: 11 };

                // Joining Date
                const joinDateStr = member.joiningDate ? new Date(member.joiningDate).toLocaleDateString() : 'N/A';
                const joinRow = sheet.addRow(['Joining Date:', joinDateStr]);
                joinRow.font = { bold: true };

                // Email
                const emailRow = sheet.addRow(['Email:', member.email]);
                emailRow.font = { bold: true };

                sheet.addRow([]); // Blank row before table

                // --- Table Header ---
                const headerRow = sheet.addRow([
                    'Date', 'Day', 'Status', 'In Time', 'Out Time', 'Duration (Hrs)'
                ]);
                headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }; // Blue Header
                headerRow.alignment = { horizontal: 'center' };

                // --- Attendance Rows ---
                daysOfMonth.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const record = attendanceRecords.find(r =>
                        r.user === member._id &&
                        format(new Date(r.date), 'yyyy-MM-dd') === dateStr
                    );

                    const isSunday = day.getDay() === 0;
                    const isFuture = day > new Date();
                    const holiday = holidays.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);

                    let status = 'Absent';
                    let rowColor = 'FFF2DCDB'; // default Red

                    const joiningDate = member.joiningDate ? new Date(member.joiningDate) : null;
                    if (joiningDate) joiningDate.setHours(0, 0, 0, 0);

                    if (joiningDate && day < joiningDate) {
                        status = 'N/A';
                        rowColor = 'FFFFFFFF'; // White
                    } else if (isFuture) {
                        status = '-';
                        rowColor = 'FFFFFFFF'; // White
                    } else if (holiday) {
                        status = holiday.name;
                        rowColor = holiday.isOptional ? 'FFFFE0B2' : 'FFD1F2EB';
                    } else if (record) {
                        status = 'Present';
                        rowColor = 'FFEBF1DE'; // Green
                    } else if (isSunday) {
                        status = 'Weekoff';
                        rowColor = 'FFF2F2F2'; // Light Gray
                    }

                    let inTime = record ? fmtTime(record.clockIn) : '-';
                    let outTime = record ? fmtTime(record.clockOut) : '-';

                    let duration = '-';
                    if (record) {
                        if (record.duration) duration = (record.duration / 60).toFixed(2);
                        else if (record.clockIn && record.clockOut) {
                            duration = ((new Date(record.clockOut) - new Date(record.clockIn)) / 3600000).toFixed(2);
                        }
                    }

                    const row = sheet.addRow([
                        format(day, 'dd-MMM-yyyy'),
                        format(day, 'EEEE'),
                        status,
                        inTime,
                        outTime,
                        duration
                    ]);

                    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
                    row.alignment = { horizontal: 'center' };

                    // Borders for table cells
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    });

                    if (status === 'Absent' || status === 'N/A' || status === '-') {
                        row.font = { color: { argb: 'FF888888' } };
                    }
                });
            });

            // Set Column Widths
            sheet.columns = [
                { width: 15 }, // Date
                { width: 15 }, // Day
                { width: 20 }, // Status
                { width: 15 }, // In
                { width: 15 }, // Out
                { width: 15 }  // Duration
            ];

            const buffer = await workbook.xlsx.writeBuffer();
            const fileName = `Team_Attendance_${format(now, 'MMM_yyyy')}.xlsx`;
            saveAs(new Blob([buffer]), fileName);
            toast.success('Downloaded', { id: toastId });

        } catch (error) {
            console.error(error);
            toast.error('Failed to export', { id: toastId });
        }
    };

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
        directReports: [],
        reportingManagers: []
    });

    const fetchData = async () => {
        try {
            const isAdmin = user?.roles?.includes('Admin') || user?.roles?.some(r => r.name === 'Admin');
            const canReadUsers = user?.permissions?.includes('user.read');
            const canReadRoles = user?.permissions?.includes('role.read') || isAdmin;

            let usersData = [];
            let rolesData = [];

            // 1. Fetch Users
            if (isAdmin || canReadUsers) {
                try {
                    const res = await api.get('/admin/users');
                    usersData = res.data;
                } catch (err) {
                    console.error('Admin users fetch failed', err);
                }
            } else {
                // Fallback for Managers/Team View
                try {
                    const teamRes = await api.get('/admin/users/team');
                    usersData = teamRes.data;
                } catch (err) {
                    console.log('Team fetch failed or empty');
                }
            }

            // 2. Fetch Roles (Admin only)
            if (canReadRoles) {
                try {
                    const rolesRes = await api.get('/admin/roles');
                    rolesData = rolesRes.data;
                } catch (err) {
                    console.log('Roles fetch silenced');
                }
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
        // Find users who currently report to this user
        const currentReports = users.filter(u => u.reportingManagers?.some(rm => rm._id === user._id || rm === user._id)).map(u => u._id);

        setFormData({
            firstName: user.firstName,
            lastName: user.lastName || '',
            email: user.email,
            password: '',
            roleId: user.roles[0]?._id || '',
            department: user.department || '',
            employeeCode: user.employeeCode || '',
            joiningDate: user.joiningDate ? new Date(user.joiningDate).toISOString().split('T')[0] : '',
            directReports: currentReports,
            reportingManagers: user.reportingManagers?.map(rm => rm._id) || []
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
                    <div className="flex space-x-2">
                        <button
                            onClick={handleExportTeamAttendance}
                            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow transition-all"
                        >
                            <Download size={18} />
                            <span>Export Attendance</span>
                        </button>
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
                                            {user.reportingManagers && user.reportingManagers.length > 0 ? (
                                                <div className="flex flex-col space-y-1">
                                                    {user.reportingManagers.map(mgr => (
                                                        <div key={mgr._id} className="flex flex-col border-l-2 border-slate-200 pl-2">
                                                            <span className="font-medium text-xs text-slate-700">{mgr.firstName} {mgr.lastName}</span>
                                                            <span className="text-[10px] text-slate-400">{mgr.email}</span>
                                                        </div>
                                                    ))}
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
                                            <div className="flex items-center justify-end space-x-2">
                                                {canEdit && (
                                                    <button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                                                )}

                                                {/* View Timesheet Action (Visible if user reports to me or if I am Admin) */}
                                                {(!canEdit || canEdit) && (!user.reportingManagers?.some(rm => rm._id === user._id)) && (
                                                    <button
                                                        onClick={() => {
                                                            // Navigate to timesheet with user context
                                                            window.location.href = `/timesheet?userId=${user._id}&name=${user.firstName} ${user.lastName}`;
                                                        }}
                                                        className="text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-50 rounded"
                                                        title="View Timesheet"
                                                    >
                                                        <Calendar size={16} />
                                                    </button>
                                                )}
                                            </div>
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
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden animate-blob max-h-[90vh] overflow-y-auto">
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

                            {/* Reporting Managers Multi-Select Removed per User Request */}

                            {/* Direct Reports Multi-Select */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Subordinates (Inverse: Who reports to this user)</label>
                                <div className="h-32 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50 grid grid-cols-2 gap-2">
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
