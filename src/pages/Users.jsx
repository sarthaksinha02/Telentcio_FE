import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Search, Edit2, Shield, Calendar, Download, FileText } from 'lucide-react';
import Skeleton from '../components/Skeleton';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

const Users = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [holidays, setHolidays] = useState([]);

    // Export Options State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        status: true,
        checkInOut: true,
        duration: true,
        leaves: true
    });
    const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [searchTerm, setSearchTerm] = useState('');

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
            const [year, month] = exportMonth.split('-');

            // Fetch data
            const res = await api.get(`/attendance/team-report?year=${year}&month=${month}`);
            const { teamMembers, attendanceRecords, leaveRecords, holidays } = res.data;

            if (!teamMembers || teamMembers.length === 0) {
                toast.error('No team members found', { id: toastId });
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Team Attendance');

            // 1. Generate Date Columns (Horizontal)
            const daysInMonth = new Date(year, month, 0).getDate();
            const dateColumns = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month - 1, d);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                dateColumns.push({ header: `${String(d).padStart(2, '0')}-${dayName}`, key: `day_${d}`, width: 15 });
            }

            // Set Columns: Employee Name + Date Columns
            worksheet.columns = [
                { header: 'Employee / Details', key: 'name', width: 35 },
                ...dateColumns
            ];

            // Freeze first row and first column
            worksheet.views = [
                { state: 'frozen', xSplit: 1, ySplit: 1 }
            ];

            // Style Header
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Dark Slate

            // 2. Prepare Data Map
            const attendanceMap = {};
            attendanceRecords.forEach(record => {
                const userId = record.user.toString();
                // Use IST time for date mapping to fix mismatch
                const dateStr = new Date(record.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                if (!attendanceMap[userId]) attendanceMap[userId] = {};
                attendanceMap[userId][dateStr] = record;
            });

            // 3. Prepare Leave Map
            const leaveMap = {};
            if (leaveRecords && leaveRecords.length > 0) {
                leaveRecords.forEach(leave => {
                    const userId = leave.user.toString();
                    if (!leaveMap[userId]) leaveMap[userId] = {};

                    const start = new Date(leave.startDate);
                    const end = new Date(leave.endDate);
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                        const dStr = d.toISOString().split('T')[0];
                        leaveMap[userId][dStr] = leave.leaveType;
                    }
                });
            }

            // 4. Prepare Holiday Map
            const holidayMap = {};
            if (holidays && holidays.length > 0) {
                holidays.forEach(h => {
                    const dateStr = new Date(h.date).toISOString().split('T')[0];
                    holidayMap[dateStr] = h.name;
                });
            }

            // Helpers for this export
            const extractTime = (istString) => istString.split(',')[1]?.trim() || istString;
            const formatTimeSimple = (date) => new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            // 3. Add Data Rows (Grouped)
            // Filter teamMembers based on current filteredUsers
            const usersToExport = teamMembers.filter(tm =>
                filteredUsers.some(fu => fu._id === tm._id)
            );

            usersToExport.forEach(user => {
                const userLogs = attendanceMap[user._id] || {};
                const userLeaves = leaveMap[user._id] || {};

                // --- PARENT ROW (Employee Name) ---
                const parentRow = worksheet.addRow({
                    name: `${user.firstName} ${user.lastName || ''}${user.employeeCode ? ` (${user.employeeCode})` : ''}`
                });
                parentRow.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
                parentRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Light Slate

                // --- CHILD ROWS ---
                const rowsToAdd = [];
                const statusRow = { name: '   ↳ Status' };
                const checkInRow = { name: '   ↳ Check In' };
                const checkOutRow = { name: '   ↳ Check Out' };
                const durationRow = { name: '   ↳ Duration' };
                const leavesRow = { name: '   ↳ Leaves' };

                // Color Map for Cells
                const cellRefMap = {}; // store cell refs to apply color later (or apply directly if possible)

                for (let d = 1; d <= daysInMonth; d++) {
                    const dateObj = new Date(year, month - 1, d);
                    // Match the key format used in map (YYYY-MM-DD in IST/Local)
                    const dateStr = dateObj.toLocaleDateString('en-CA');
                    const record = userLogs[dateStr];
                    const colKey = `day_${d}`;

                    const isSunday = dateObj.getDay() === 0;
                    const isFuture = dateObj > new Date();
                    const leaveType = userLeaves[dateStr];
                    const holidayName = holidayMap[dateStr];

                    // -- Calculate Duration First --
                    let durationHours = 0;
                    if (record && record.clockIn && record.clockOut) {
                        const dur = Math.abs(new Date(record.clockOut) - new Date(record.clockIn));
                        durationHours = dur / 3600000; // milliseconds to hours
                    }

                    // -- 1. Status Logic --
                    let statusShort = 'Absent'; // Default
                    let cellColor = 'FFF2DCDB'; // Red (Absent)

                    if (isFuture) {
                        statusShort = '-';
                        cellColor = 'FFFFFFFF'; // White
                    }
                    else if (leaveType) {
                        statusShort = `L (${leaveType})`; // Show Leave Type
                        cellColor = 'FFFFE0B2'; // Orange/Yellowish
                    }
                    else if (holidayName) {
                        statusShort = holidayName; // Show Holiday Name
                        cellColor = 'FFD1F2EB'; // Light Cyan/Greenish
                    }
                    else if (record) {
                        statusShort = 'Present';
                        cellColor = 'FFEBF1DE'; // Light Green
                    }
                    else if (isSunday) {
                        statusShort = 'Sunday';
                        cellColor = 'FFF2F2F2'; // Light Grey
                    }

                    if (exportOptions.status) {
                        statusRow[colKey] = statusShort;
                        // We need row index to style specific cells, but here we only have row object *before* adding to sheet.
                        // Solution: Store needed colors in a parallel structure or style after adding.
                        // Better: Apply check and style *after* adding logic below.
                    }

                    // -- 2. Leaves Logic --
                    if (exportOptions.leaves) {
                        leavesRow[colKey] = leaveType || '-';
                    }

                    // -- 3. Time/Duration Data --
                    if (record) {
                        // Check In
                        if (record.clockInIST) checkInRow[colKey] = extractTime(record.clockInIST);
                        else if (record.clockIn) checkInRow[colKey] = formatTimeSimple(record.clockIn);
                        else checkInRow[colKey] = '-';

                        // Check Out
                        if (record.clockOutIST) checkOutRow[colKey] = extractTime(record.clockOutIST);
                        else if (record.clockOut) checkOutRow[colKey] = formatTimeSimple(record.clockOut);
                        else checkOutRow[colKey] = '-';

                        // Duration
                        if (record.clockIn && record.clockOut) {
                            const dur = Math.abs(new Date(record.clockOut) - new Date(record.clockIn));
                            const hrs = Math.floor(dur / 3600000);
                            const mins = Math.floor((dur % 3600000) / 60000);

                            let durationSuffix = '';
                            if (durationHours >= 5 && durationHours < 8) {
                                durationSuffix = ' (Half Day)';
                            }

                            durationRow[colKey] = `${hrs}h ${mins}m${durationSuffix}`;
                        } else {
                            durationRow[colKey] = '-';
                        }
                    } else {
                        checkInRow[colKey] = '-';
                        checkOutRow[colKey] = '-';
                        durationRow[colKey] = '-';
                    }
                }

                // Push selected rows to array in specific order
                if (exportOptions.status) rowsToAdd.push(statusRow);
                if (exportOptions.checkInOut) {
                    rowsToAdd.push(checkInRow);
                    rowsToAdd.push(checkOutRow);
                }
                if (exportOptions.duration) rowsToAdd.push(durationRow);
                if (exportOptions.leaves) rowsToAdd.push(leavesRow);

                // Add to Worksheet and Style
                rowsToAdd.forEach(rowData => {
                    const row = worksheet.addRow(rowData);
                    row.outlineLevel = 1; // Grouping
                    row.getCell('name').font = { italic: true, color: { argb: 'FF64748B' } };
                    row.alignment = { horizontal: 'center' };
                    row.getCell('name').alignment = { horizontal: 'left' };

                    // Apply Color Logic for Status Row
                    if (rowData.name === '   ↳ Status') {
                        for (let d = 1; d <= daysInMonth; d++) {
                            const dateObj = new Date(year, month - 1, d);
                            // Match the key format
                            const dateStr = dateObj.toLocaleDateString('en-CA');
                            const record = userLogs[dateStr];
                            const leaveType = userLeaves[dateStr];
                            const holidayName = holidayMap[dateStr];
                            const isSunday = dateObj.getDay() === 0;
                            const isFuture = dateObj > new Date();

                            // -- Apply Same Logic for Coloring --
                            let durationHours = 0;
                            if (record && record.clockIn && record.clockOut) {
                                const dur = Math.abs(new Date(record.clockOut) - new Date(record.clockIn));
                                durationHours = dur / 3600000;
                            }

                            let cellColor = 'FFF2DCDB'; // Red

                            if (isFuture) cellColor = 'FFFFFFFF';
                            else if (leaveType) cellColor = 'FFFFE0B2';
                            else if (holidayName) cellColor = 'FFD1F2EB';
                            else if (record) cellColor = 'FFEBF1DE';
                            else if (isSunday) cellColor = 'FFF2F2F2';

                            const colKey = `day_${d}`;
                            // This library might not support key-based cell access directly on 'row' object efficiently if strictly column indexed?
                            // Actually row.getCell(colKey) works if columns defined.
                            const cell = row.getCell(colKey);
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellColor } };
                        }
                    }
                });
            });

            // Enable Outline Property
            worksheet.properties.outlineProperties = {
                summaryBelow: false,
                summaryRight: false,
            };

            const buffer = await workbook.xlsx.writeBuffer();
            const fileName = `Team_Attendance_${format(new Date(year, month - 1), 'MMMM_yyyy')}.xlsx`;
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
        reportingManagers: [],
        employmentType: 'Full Time',
        workLocation: ''
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


    const [filterDate, setFilterDate] = useState('');

    const filteredUsers = users.filter(user => {
        const matchesSearch = (
            user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const matchesDate = !filterDate || (user.joiningDate && new Date(user.joiningDate).toISOString().split('T')[0] === filterDate);

        return matchesSearch && matchesDate;
    }).sort((a, b) => new Date(b.joiningDate || 0) - new Date(a.joiningDate || 0));

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
            employmentType: user.employmentType || 'Full Time',
            workLocation: user.workLocation || '',
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
            joiningDate: '',
            employmentType: 'Full Time',
            workLocation: ''
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
                    <div className="flex space-x-2 relative">
                        <button
                            onClick={() => setShowExportModal(!showExportModal)}
                            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow transition-all"
                        >
                            <Download size={18} />
                            <span>Export Attendance</span>
                        </button>

                        {/* Export Options Popover */}
                        {showExportModal && (
                            <div className="absolute top-12 right-0 w-80 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 animate-fade-in-down">
                                <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
                                    <h3 className="font-bold text-slate-800 text-sm">Export Options</h3>
                                    <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                                </div>
                                <div className="p-4 space-y-3">
                                    <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Settings:</p>

                                    <div className="mb-3">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Select Month</label>
                                        <input
                                            type="month"
                                            value={exportMonth}
                                            onChange={(e) => setExportMonth(e.target.value)}
                                            className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                                        />
                                    </div>

                                    <div className="h-px bg-slate-100 my-2"></div>

                                    <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Include Columns:</p>

                                    <label className="flex items-center space-x-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition">
                                        <input
                                            type="checkbox"
                                            checked={exportOptions.status}
                                            onChange={e => setExportOptions({ ...exportOptions, status: e.target.checked })}
                                            className="h-4 w-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Status (Present/Absent)</span>
                                    </label>

                                    <label className="flex items-center space-x-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition">
                                        <input
                                            type="checkbox"
                                            checked={exportOptions.checkInOut}
                                            onChange={e => setExportOptions({ ...exportOptions, checkInOut: e.target.checked })}
                                            className="h-4 w-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Check-In & Check-Out</span>
                                    </label>

                                    <label className="flex items-center space-x-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition">
                                        <input
                                            type="checkbox"
                                            checked={exportOptions.duration}
                                            onChange={e => setExportOptions({ ...exportOptions, duration: e.target.checked })}
                                            className="h-4 w-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Total Duration</span>
                                    </label>

                                    <label className="flex items-center space-x-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition">
                                        <input
                                            type="checkbox"
                                            checked={exportOptions.leaves}
                                            onChange={e => setExportOptions({ ...exportOptions, leaves: e.target.checked })}
                                            className="h-4 w-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Leaves (SL, CL)</span>
                                    </label>
                                </div>
                                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2 rounded-b-lg">
                                    <button onClick={() => setShowExportModal(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800">Close</button>
                                    <button onClick={handleExportTeamAttendance} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 shadow-sm flex items-center gap-1.5">
                                        <Download size={14} /> Download
                                    </button>
                                </div>
                            </div>
                        )}

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

                {/* Removed Global Modal */}

                {/* Users List */}
                <div className="zoho-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search employees..."
                                    className="pl-9 pr-4 py-1.5 w-64 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
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
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Reporting To</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.map((employee) => (
                                    <tr key={employee._id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center space-x-3">
                                                <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                    {employee.firstName.charAt(0)}{employee.lastName?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-800">{employee.firstName} {employee.lastName}</div>
                                                    <div className="text-xs text-slate-500">{employee.employeeCode || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">{employee.email}</td>
                                        <td className="px-6 py-3">
                                            {employee.roles.map(r => (
                                                <span key={r._id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 mr-1">
                                                    <Shield size={10} className="mr-1" /> {r.name}
                                                </span>
                                            ))}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">{employee.department || '-'}</td>
                                        <td className="px-6 py-3">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                {employee.employmentType || 'Full Time'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">
                                            {employee.reportingManagers && employee.reportingManagers.length > 0 ? (
                                                <div className="flex flex-col space-y-1">
                                                    {employee.reportingManagers.map(mgr => (
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
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${employee.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                {employee.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                {canEdit && (
                                                    <button onClick={() => handleEdit(employee)} className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                                                )}

                                                {/* View Timesheet Action (Visible if Admin, manager, or has timesheet.view) */}
                                                {(canEdit || user?.permissions?.includes('timesheet.view') || employee.reportingManagers?.some(rm => rm._id === user._id)) && (
                                                    <button
                                                        onClick={() => {
                                                            // Navigate to timesheet with user context
                                                            window.location.href = `/timesheet?userId=${employee._id}&name=${employee.firstName} ${employee.lastName}`;
                                                        }}
                                                        className="text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-50 rounded"
                                                        title="View Timesheet"
                                                    >
                                                        <Calendar size={16} />
                                                    </button>
                                                )}

                                                {/* View Dossier Action */}
                                                {(canEdit || user?.permissions?.includes('dossier.view')) && (
                                                    <button
                                                        onClick={() => navigate(`/dossier/${employee._id}`)}
                                                        className="text-purple-600 hover:text-purple-800 p-1 hover:bg-purple-50 rounded"
                                                        title="View Dossier"
                                                    >
                                                        <FileText size={16} />
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date of Joining</label>
                                    <input name="joiningDate" type="date" value={formData.joiningDate} onChange={handleChange} className="zoho-input" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employment Type</label>
                                    <select name="employmentType" value={formData.employmentType} onChange={handleChange} className="zoho-input">
                                        <option value="Full Time">Full Time</option>
                                        <option value="Part Time">Part Time</option>
                                        <option value="Contract">Contract</option>
                                        <option value="Intern">Intern</option>
                                        <option value="Consultant">Consultant</option>
                                        <option value="Freelance">Freelance</option>
                                        <option value="Probation">Probation</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Work Location</label>
                                    <input name="workLocation" value={formData.workLocation} onChange={handleChange} placeholder="e.g. Headquarters" className="zoho-input" />
                                </div>
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
