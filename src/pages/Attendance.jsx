import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Clock, Download, Briefcase, CheckSquare, Calendar, Edit2, Trash2 } from 'lucide-react';
import Skeleton from '../components/Skeleton';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from 'date-fns';
import AttendanceCalendar from '../components/AttendanceCalendar';

const Attendance = () => {
    const { user } = useAuth();
    const [status, setStatus] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [holidays, setHolidays] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(user?._id);

    // Task Integration
    const [assignedTasks, setAssignedTasks] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);
    const [showLogModal, setShowLogModal] = useState(false);
    const [logForm, setLogForm] = useState({ date: new Date().toISOString().split('T')[0], hours: '', description: '' });
    const [loggingTaskId, setLoggingTaskId] = useState(null);
    const [activeTab, setActiveTab] = useState('history'); // 'history', 'tasks'
    const [expandedLogTaskId, setExpandedLogTaskId] = useState(null);
    const [editingLogId, setEditingLogId] = useState(null);

    const fetchApprovals = async () => {
        // Removed for move to Timesheet page
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchTodayStatus = async () => {
        try {
            const res = await api.get('/attendance/today');
            setStatus(res.data);

            // If clocked in, fetch tasks
            if (res.data?.clockIn && !res.data?.clockOut && user) {
                // fetchAssignedTasks(); // Now fetched globally
            }
        } catch (error) {
            console.error('Error fetching status', error);
        }
    };

    const fetchAssignedTasks = async () => {
        try {
            if (!user) return;
            // Fetch tasks assigned to current user
            const res = await api.get(`/projects/tasks?assignees=${user._id}`);
            // Filter out completed tasks if backend doesn't
            const activeTasks = res.data.filter(t => t.module?.status !== 'COMPLETED' && (!t.status || t.status !== 'COMPLETED'));
            setAssignedTasks(activeTasks);
        } catch (error) {
            console.error('Error fetching tasks', error);
        }
    };



    const fetchMonthHistory = async (year, month) => {
        try {
            const userId = selectedUserId || user._id;
            const res = await api.get(`/attendance/history?year=${year}&month=${month}&userId=${userId}`);
            setHistory(res.data);
        } catch (error) {
            console.error('Error fetching history', error);
            toast.error('Could not load calendar data');
        }
    };

    const fetchRecentLogs = async () => {
        try {
            if (!user) return;
            const res = await api.get('/projects/worklogs');
            setRecentLogs(res.data);
        } catch (error) {
            console.error('Error fetching logs', error);
        }
    };

    const fetchHolidays = async () => {
        try {
            const res = await api.get('/holidays');
            setHolidays(res.data);
        } catch (error) {
            console.error('Error fetching holidays', error);
        }
    };



    useEffect(() => {
        if (user) {
            setSelectedUserId(user._id);
            fetchTodayStatus();
            fetchRecentLogs();
            fetchHolidays();
            fetchAssignedTasks(); // Fetch tasks immediately
        }
        setLoading(false);
    }, [user]);

    // Fetch Users (Admin/Manager)
    useEffect(() => {
        const fetchUsers = async () => {
            if (user && (user.roles?.includes('Admin') || user.roles?.includes('Manager'))) {
                try {
                    // Use correct admin endpoint
                    const res = await api.get('/admin/users/team');
                    setUsersList(res.data);
                } catch (error) {
                    // Fallback or ignore if not found (though /admin/users/team should exist)
                    console.error("Error fetching users list", error);
                }
            }
        };
        fetchUsers();
    }, [user]);

    // Refetch history when selected user changes
    useEffect(() => {
        const now = new Date();
        if (selectedUserId) {
            fetchMonthHistory(now.getFullYear(), now.getMonth() + 1);
        }
    }, [selectedUserId]);

    // Check if a task has a log for today
    const getTodayLogForTask = (taskId) => {
        const today = new Date().toISOString().split('T')[0];
        return recentLogs.find(log =>
            log.task &&
            log.task._id === taskId &&
            new Date(log.date).toISOString().split('T')[0] === today
        );
    };

    const handleClockIn = async () => {
        try {
            await api.post('/attendance/clock-in');
            toast.success('Clocked In Successfully');
            await fetchTodayStatus();
            // fetchAssignedTasks(); // Already fetched
            const now = new Date();
            fetchMonthHistory(now.getFullYear(), now.getMonth() + 1);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error Clocking In');
        }
    };

    const handleClockOut = async () => {
        try {
            await api.post('/attendance/clock-out');
            toast.success('Clocked Out Successfully');
            fetchTodayStatus();
            // setAssignedTasks([]); // Don't clear tasks so they remain visible
            const now = new Date();
            fetchMonthHistory(now.getFullYear(), now.getMonth() + 1);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error Clocking Out');
        }
    };

    const toggleLogForm = (taskId, existingLog = null) => {
        if (expandedLogTaskId === taskId) {
            setExpandedLogTaskId(null);
            setLoggingTaskId(null);
            setEditingLogId(null);
            setLogForm({ date: new Date().toISOString().split('T')[0], hours: '', description: '' });
        } else {
            setExpandedLogTaskId(taskId);
            setLoggingTaskId(taskId);
            if (existingLog) {
                setEditingLogId(existingLog._id);
                setLogForm({
                    date: new Date(existingLog.date).toISOString().split('T')[0],
                    hours: existingLog.hours,
                    description: existingLog.description
                });
            } else {
                setEditingLogId(null);
                setLogForm({ date: new Date().toISOString().split('T')[0], hours: '', description: '' });
            }
        }
    };

    const handleDeleteLog = async (logId) => {
        if (!window.confirm('Are you sure you want to delete this log?')) return;
        try {
            await api.delete(`/projects/worklogs/${logId}`);
            toast.success('Work Log Deleted');
            fetchRecentLogs();
        } catch (error) {
            toast.error('Failed to delete log');
        }
    };

    const handleLogWork = async (e) => {
        e.preventDefault();
        try {
            if (editingLogId) {
                await api.put(`/projects/worklogs/${editingLogId}`, logForm);
                toast.success('Work Log Updated');
            } else {
                await api.post(`/projects/tasks/${loggingTaskId}/log`, logForm);
                toast.success('Work Logged Successfully');
            }

            setExpandedLogTaskId(null);
            setLoggingTaskId(null);
            setEditingLogId(null);
            setLogForm({ date: new Date().toISOString().split('T')[0], hours: '', description: '' });
            fetchRecentLogs(); // Refresh logs
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to log work');
        }
    };

    const formatTime = (dateString, istString) => {
        if (istString && istString.includes(',')) {
            return istString.split(',')[1]?.trim() || '';
        }
        if (!dateString) return '--:--';
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit'
        });
    };

    const calculateDuration = (start, end) => {
        if (!start) return '--';
        const startTime = new Date(start);
        const endTime = end ? new Date(end) : currentTime;

        // Prevent negative duration if system time somehow lags (rare but possible)
        if (endTime < startTime) return '0h 0m';

        const diffString = Math.abs(endTime - startTime);
        const hours = Math.floor(diffString / (1000 * 60 * 60));
        const minutes = Math.floor((diffString % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffString % (1000 * 60)) / 1000); // Optional: add seconds

        return `${hours}h ${minutes}m ${isClockedIn ? `${seconds}s` : ''}`;
    };

    const handleExportAttendance = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Attendance Report');

        // Determine user to export
        const exportUser = (usersList.length > 0 && selectedUserId)
            ? usersList.find(u => u._id === selectedUserId) || user
            : user;

        // 1. Header Info (Rows 1-4)
        const titleStyle = { font: { bold: true, size: 12 }, alignment: { vertical: 'middle', horizontal: 'left' } };

        sheet.mergeCells('A1:C1');
        sheet.getCell('A1').value = `User Name: ${exportUser.firstName} ${exportUser.lastName || ''}`;
        sheet.getCell('A1').font = { bold: true, size: 14 };

        sheet.mergeCells('A2:C2');
        sheet.getCell('A2').value = `Joining Date: ${exportUser.joiningDate ? new Date(exportUser.joiningDate).toLocaleDateString() : 'N/A'}`;

        sheet.mergeCells('A3:C3');
        const managers = exportUser.reportingManagers || [];
        const mgrNames = managers.length > 0 ? managers.map(m => `${m.firstName} ${m.lastName}`).join(', ') : 'N/A';
        sheet.getCell('A3').value = `Supervisor(s): ${mgrNames}`;

        sheet.addRow([]); // Row 4 Empty Buffer

        // 2. Table Header (Row 5)
        const headerRow = sheet.addRow(['Date', 'Day', 'Status', 'In Time', 'Out Time', 'Duration']);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }; // Blue
        headerRow.alignment = { horizontal: 'center' };

        // 3. Data Generation
        const currentYear = new Date().getFullYear(); // Or use a selected date state if calendar navigation is tracked
        const currentMonth = new Date().getMonth();
        // Note: Ideally we should use the month currently displayed in 'history', but 'history' only gives us data, not the month itself explicitly unless we track it.
        // Assuming 'history' contains records for the *displayed* month. If 'history' is empty, we default to current month.
        // Let's infer month from the first history record or fallback to current.
        const referenceDate = history.length > 0 ? new Date(history[0].date) : new Date();

        const start = startOfMonth(referenceDate);
        const end = endOfMonth(referenceDate);
        const days = eachDayOfInterval({ start, end });

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const record = history.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);
            const isSunday = day.getDay() === 0; // Only Sunday is weekoff
            const isFuture = day > new Date();

            let status = 'Absent';
            let rowColor = 'FFF2DCDB'; // Red by default

            const joiningDate = exportUser.joiningDate ? new Date(exportUser.joiningDate) : null;
            // Normalize joining date to start of day for comparison
            if (joiningDate) joiningDate.setHours(0, 0, 0, 0);

            const holiday = holidays.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);

            if (joiningDate && day < joiningDate) {
                status = 'Not Applicable';
                rowColor = 'FFFFFFFF'; // White
            } else if (isFuture) {
                status = '-';
                rowColor = 'FFFFFFFF'; // White
            } else if (holiday) {
                status = holiday.name;
                rowColor = holiday.isOptional ? 'FFFFE0B2' : 'FFD1F2EB'; // Light Orange for Optional, Light Teal for Regular
            } else if (record) {
                status = 'Present';
                rowColor = 'FFEBF1DE'; // Green
            } else if (isSunday) {
                status = 'Weekoff';
                rowColor = 'FFF2F2F2'; // Gray
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
            { width: 15 }, // Date
            { width: 15 }, // Day
            { width: 15 }, // Status
            { width: 15 }, // In
            { width: 15 }, // Out
            { width: 15 }  // Duration
        ];

        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `Attendance_${format(start, 'MMMM_yyyy')}_${exportUser.firstName}.xlsx`;
        saveAs(new Blob([buffer]), fileName);
    };

    const handleExportTeamReport = async () => {
        try {
            const currentYear = new Date().getFullYear(); // Or based on selected navigation if implemented
            const currentMonth = new Date().getMonth() + 1;

            const res = await api.get(`/attendance/team-report?month=${currentMonth}&year=${currentYear}`);
            const { teamMembers, attendanceRecords } = res.data; // Note: Controller returns { teamMembers, attendanceRecords }

            if (!teamMembers || teamMembers.length === 0) {
                toast.error('No team members found');
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Team Attendance');

            // 1. Generate Date Columns
            const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
            const dateColumns = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(currentYear, currentMonth - 1, d);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                dateColumns.push({ header: `${String(d).padStart(2, '0')}-${dayName}`, key: `day_${d}`, width: 12 });
            }

            // Set Columns
            worksheet.columns = [
                { header: 'Employee / Details', key: 'name', width: 35 },
                ...dateColumns
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

            // Freeze first row and first column
            worksheet.views = [
                { state: 'frozen', xSplit: 1, ySplit: 1 }
            ];

            // 3. Add Data Rows (Grouped)
            teamMembers.forEach(user => {
                const userLogs = attendanceMap[user._id] || {};

                // --- PARENT ROW (Employee Name) ---
                const parentRow = worksheet.addRow({
                    name: `${user.firstName} ${user.lastName || ''}${user.employeeCode ? ` (${user.employeeCode})` : ''}`
                });
                parentRow.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
                parentRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Light Slate

                // --- CHILD ROWS ---
                const checkInRow = { name: '   ↳ Check In' };
                const checkOutRow = { name: '   ↳ Check Out' };
                const durationRow = { name: '   ↳ Duration' };

                for (let d = 1; d <= daysInMonth; d++) {
                    // Create date for column (Year, Month, Day)
                    // We need a formatted YYYY-MM-DD string to match the map key
                    const colDate = new Date(currentYear, currentMonth - 1, d);
                    const dateStr = format(colDate, 'yyyy-MM-dd');
                    const record = userLogs[dateStr];
                    const colKey = `day_${d}`;

                    if (record) {
                        checkInRow[colKey] = record.clockInIST ? extractTime(record.clockInIST) : (record.clockIn ? formatTimeSimple(record.clockIn) : '-');
                        checkOutRow[colKey] = record.clockOutIST ? extractTime(record.clockOutIST) : (record.clockOut ? formatTimeSimple(record.clockOut) : '-');

                        // Calculate duration
                        if (record.clockIn && record.clockOut) {
                            const dur = Math.abs(new Date(record.clockOut) - new Date(record.clockIn));
                            const hrs = Math.floor(dur / 3600000);
                            const mins = Math.floor((dur % 3600000) / 60000);
                            durationRow[colKey] = `${hrs}h ${mins}m`;
                        } else {
                            durationRow[colKey] = '-';
                        }
                    } else {
                        checkInRow[colKey] = '-';
                        checkOutRow[colKey] = '-';
                        durationRow[colKey] = '-';
                    }
                }

                const r1 = worksheet.addRow(checkInRow);
                const r2 = worksheet.addRow(checkOutRow);
                const r3 = worksheet.addRow(durationRow);

                // Grouping Logic - This makes them collapsible
                r1.outlineLevel = 1;
                r2.outlineLevel = 1;
                r3.outlineLevel = 1;

                // Child Row Styling
                [r1, r2, r3].forEach(row => {
                    row.getCell('name').font = { italic: true, color: { argb: 'FF64748B' } };
                    row.alignment = { horizontal: 'center' };
                    row.getCell('name').alignment = { horizontal: 'left' };
                });
            });

            // Enable Outline Property
            worksheet.properties.outlineProperties = {
                summaryBelow: false,
                summaryRight: false,
            };

            // Save File
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Team_Attendance_Report_${currentYear}_${currentMonth}.xlsx`);
            toast.success('Team Report Exported Successfully');

        } catch (error) {
            console.error(error);
            toast.error('Failed to export team report');
        }
    };

    // Helper for formatting time from IST string or Date
    const extractTime = (istString) => istString.split(',')[1]?.trim() || istString;
    const formatTimeSimple = (date) => new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    if (loading) return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="hidden sm:block">
                        <Skeleton className="h-10 w-32 mb-1" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    <div className="xl:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border-t-4 border-t-slate-200 flex flex-col items-center">
                            <Skeleton className="w-36 h-36 rounded-full mb-6" />
                            <Skeleton className="h-6 w-24 mb-2" />
                            <Skeleton className="h-8 w-32 mb-6" />
                            <Skeleton className="h-10 w-full mb-3" />
                        </div>
                        <div className="bg-white p-5 rounded-lg shadow-sm">
                            <Skeleton className="h-4 w-32 mb-4" />
                            <div className="space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        </div>
                    </div>
                    <div className="xl:col-span-3">
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 h-[500px]">
                            <div className="flex justify-between mb-6">
                                <Skeleton className="h-8 w-48" />
                                <div className="flex space-x-2">
                                    <Skeleton className="h-8 w-8 rounded" />
                                    <Skeleton className="h-8 w-8 rounded" />
                                </div>
                            </div>
                            <div className="grid grid-cols-7 gap-4">
                                {[...Array(35)].map((_, i) => (
                                    <Skeleton key={i} className="h-24 w-full rounded" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
    const isClockedIn = status?.clockIn && !status?.clockOut;
    const isClockedOut = status?.clockIn && status?.clockOut;

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
                        <p className="text-sm text-slate-500">Track and manage your work hours</p>
                    </div>
                    <div className="flex items-center space-x-6">
                        <div className="text-right hidden sm:block">
                            <div className="text-3xl font-mono font-bold text-slate-700 tracking-tight">
                                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                            </div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </div>
                        </div>





                        {/* Export Button - Permission Check */
                            (user?.roles?.includes('Admin') || user?.roles?.includes('Manager') || user?.role === 'Admin' || usersList.length > 0 || user?.permissions?.includes('attendance.export')) && (
                                <button
                                    onClick={handleExportAttendance}
                                    className="bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 p-2 rounded-lg shadow-sm transition-colors"
                                    title="Download Personal Report"
                                >
                                    <Download size={20} />
                                </button>
                            )}
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                    {/* Widget Column */}
                    <div className="xl:col-span-1 space-y-6">
                        {/* Clock Widget */}
                        <div className="zoho-card p-6 flex flex-col items-center justify-center text-center border-t-4 border-t-blue-500">
                            <div className="mb-6 relative group">
                                <div className={`h-36 w-36 rounded-full flex items-center justify-center border-[6px] transition-all duration-500 ${isClockedIn ? 'border-emerald-500 bg-emerald-50 shadow-emerald-200' : 'border-slate-200 bg-white shadow-sm'}`}>
                                    <Clock size={48} className={isClockedIn ? 'text-emerald-500' : 'text-slate-400'} />
                                </div>
                                {isClockedIn && (
                                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse shadow-md">
                                        Active
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1 mb-6">
                                <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Status</div>
                                <div className={`text-xl font-bold ${isClockedIn ? 'text-emerald-600' : isClockedOut ? 'text-slate-500' : 'text-slate-700'}`}>
                                    {isClockedIn ? 'Clocked In' : isClockedOut ? 'Shift Ended' : 'Not Started'}
                                </div>
                            </div>

                            <div className="w-full space-y-3">
                                {!isClockedIn && !isClockedOut && (
                                    <button onClick={handleClockIn} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold shadow-md active:scale-95 transition-all">
                                        Check In
                                    </button>
                                )}

                                {isClockedIn && (
                                    <button onClick={handleClockOut} className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded font-semibold shadow-md active:scale-95 transition-all">
                                        Check Out
                                    </button>
                                )}

                                {isClockedOut && (
                                    <div className="w-full py-2.5 bg-slate-100 text-slate-500 rounded font-medium border border-slate-200 text-sm">
                                        Output Logged
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 w-full bg-slate-50 rounded border border-slate-100 divide-y divide-slate-100">
                                <div className="flex justify-between p-3 text-sm">
                                    <span className="text-slate-500">In Time</span>
                                    <span className="font-mono font-medium text-slate-700">
                                        {formatTime(status?.clockIn, status?.clockInIST)}
                                    </span>
                                </div>
                                <div className="flex justify-between p-3 text-sm">
                                    <span className="text-slate-500">Out Time</span>
                                    <span className="font-mono font-medium text-slate-700">
                                        {formatTime(status?.clockOut, status?.clockOutIST)}
                                    </span>
                                </div>
                                <div className="flex justify-between p-3 text-sm bg-slate-100/50">
                                    <span className="font-bold text-slate-600">Total Hours</span>
                                    <span className="font-mono font-bold text-blue-600">
                                        {status?.clockIn ? calculateDuration(status.clockIn, status.clockOut) : '--'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="zoho-card p-5 mt-6">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Recent Activity</h4>
                            {recentLogs.length > 0 ? (
                                <div className="space-y-4">
                                    {recentLogs.slice(0, 5).map(log => (
                                        <div key={log._id} className="flex gap-3 text-sm border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                                            <div className="mt-1">
                                                <CheckSquare size={14} className="text-blue-500" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-700">
                                                    {log.task?.name || 'Unknown Task'}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5">
                                                    {log.hours} hrs • {new Date(log.date).toLocaleDateString()}
                                                </div>
                                                {log.description && (
                                                    <div className="text-xs text-slate-400 mt-1 italic">
                                                        "{log.description}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="pt-2 text-center">
                                        <a href="/timesheet" className="text-xs text-blue-600 hover:underline">View All in Timesheet</a>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-xs text-slate-400 py-2">
                                    No work logged recently.
                                </div>
                            )}
                        </div>

                        {!isClockedIn && (
                            <div className="zoho-card p-5 opacity-75 mt-6">
                                <div className="text-center space-y-2">
                                    <Briefcase size={32} className="mx-auto text-slate-300" />
                                    <h4 className="font-medium text-slate-600">Your Tasks</h4>
                                    <p className="text-xs text-slate-400">Clock in to view and manage your assigned tasks.</p>
                                </div>
                            </div>
                        )}

                        {/* Legend */}
                        <div className="zoho-card p-5">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Legend</h4>
                            <div className="space-y-3">
                                <div className="flex items-center text-sm">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 mr-3"></div>
                                    <span className="text-slate-600">Present</span>
                                </div>
                                <div className="flex items-center text-sm">
                                    <div className="w-3 h-3 rounded-full bg-red-500 mr-3"></div>
                                    <span className="text-slate-600">Absent</span>
                                </div>
                                <div className="flex items-center text-sm">
                                    <div className="w-3 h-3 rounded-full bg-orange-500 mr-3"></div>
                                    <span className="text-slate-600">Half Day</span>
                                </div>
                                <div className="flex items-center text-sm">
                                    <div className="w-3 h-3 rounded-full bg-purple-500 mr-3"></div>
                                    <span className="text-slate-600">Leave</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Column with Tabs */}
                    <div className="xl:col-span-3">
                        {/* Tab Navigation */}
                        <div className="flex border-b border-slate-200 bg-white rounded-t-lg px-4 pt-2 mb-0">
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                <Calendar size={16} /> Attendance History
                            </button>
                            <button
                                onClick={() => setActiveTab('tasks')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tasks' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                <Briefcase size={16} /> Assigned to Me <span className="bg-slate-100 text-slate-600 text-xs py-0.5 px-2 rounded-full ml-1">{assignedTasks.length}</span>
                            </button>
                        </div>

                        <div className="bg-white rounded-b-lg shadow-sm border border-t-0 border-slate-200 p-6 min-h-[500px]">
                            {activeTab === 'history' ? (
                                <AttendanceCalendar history={history} onMonthChange={fetchMonthHistory} user={user} holidays={holidays} />
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-slate-800">My Assigned Tasks</h3>
                                        {!isClockedIn && <span className="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full border border-amber-200">⚠️ Clock in to log work</span>}
                                    </div>

                                    {assignedTasks.length > 0 ? (
                                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs">
                                                    <tr>
                                                        <th className="px-4 py-3 border-b border-slate-200">Project</th>
                                                        <th className="px-4 py-3 border-b border-slate-200">Module</th>
                                                        <th className="px-4 py-3 border-b border-slate-200">Task Name</th>
                                                        <th className="px-4 py-3 border-b border-slate-200 w-1/3">Description</th>
                                                        <th className="px-4 py-3 border-b border-slate-200 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {assignedTasks.map(task => {
                                                        const existingLog = getTodayLogForTask(task._id);
                                                        return (
                                                            <React.Fragment key={task._id}>
                                                                <tr className={`hover:bg-slate-50 transition-colors group ${expandedLogTaskId === task._id ? 'bg-blue-50/30' : ''}`}>
                                                                    <td className="px-4 py-3 font-medium text-blue-600">{task.module?.project?.name || 'Unknown Project'}</td>
                                                                    <td className="px-4 py-3 text-slate-600">{task.module?.name}</td>
                                                                    <td className="px-4 py-3 font-medium text-slate-800">{task.name}</td>
                                                                    <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{task.description || '-'}</td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        {existingLog ? (
                                                                            <div className="flex items-center justify-end gap-2">
                                                                                <button
                                                                                    onClick={() => toggleLogForm(task._id, existingLog)}
                                                                                    className={`p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-blue-600 ${expandedLogTaskId === task._id ? 'bg-blue-100 text-blue-600' : ''}`}
                                                                                    title="Edit Log"
                                                                                >
                                                                                    <Edit2 size={14} />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleDeleteLog(existingLog._id)}
                                                                                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                                                                                    title="Delete Log"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => toggleLogForm(task._id)}
                                                                                disabled={!isClockedIn}
                                                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${isClockedIn ? (expandedLogTaskId === task._id ? 'bg-slate-200 text-slate-700' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200') : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                                                            >
                                                                                {expandedLogTaskId === task._id ? 'Cancel' : <><Clock size={14} /> Log Work</>}
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                                {expandedLogTaskId === task._id && (
                                                                    <tr className="bg-slate-50/50">
                                                                        <td colSpan="5" className="px-4 py-3 border-b border-slate-100">
                                                                            <form onSubmit={handleLogWork} className="flex flex-col sm:flex-row gap-4 items-end bg-white p-4 rounded border border-slate-200 shadow-sm">
                                                                                <div className="flex-1 w-full">
                                                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                                                                    <input
                                                                                        required
                                                                                        className="zoho-input w-full"
                                                                                        placeholder="What did you work on?"
                                                                                        value={logForm.description}
                                                                                        onChange={e => setLogForm({ ...logForm, description: e.target.value })}
                                                                                    />
                                                                                </div>
                                                                                <div className="w-32">
                                                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hours</label>
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.1"
                                                                                        required
                                                                                        className="zoho-input w-full"
                                                                                        placeholder="0.0"
                                                                                        value={logForm.hours}
                                                                                        onChange={e => setLogForm({ ...logForm, hours: e.target.value })}
                                                                                    />
                                                                                </div>
                                                                                <button type="submit" className="zoho-btn-primary bg-emerald-600 hover:bg-emerald-700 h-[38px] px-6">
                                                                                    {editingLogId ? 'Update' : 'Save'}
                                                                                </button>
                                                                            </form>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-slate-400">
                                            <CheckSquare size={48} className="mx-auto text-slate-200 mb-3" />
                                            <p>No tasks currently assigned to you.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Attendance;
