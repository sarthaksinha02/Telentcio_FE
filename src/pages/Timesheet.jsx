import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Calendar, ChevronLeft, ChevronRight, Save, Send, Clock, Download, FileText } from 'lucide-react';
import Skeleton from '../components/Skeleton';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import AttendanceCalendar from '../components/AttendanceCalendar';
import Button from '../components/Button';

const Timesheet = ({ propUserId, propUserName, initialTab, isEmbedded = false }) => {
    const { user } = useAuth();
    const [viewDate, setViewDate] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const m = params.get('month');
        return m ? new Date(m) : new Date();
    });
    const [timesheet, setTimesheet] = useState(null);
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [viewUser, setViewUser] = useState(user);
    const [holidays, setHolidays] = useState([]);
    const [usersList, setUsersList] = useState([]); // List of users for dropdown


    // Approval Logic
    const [activeTab, setActiveTab] = useState(initialTab || 'timesheet');
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [loadingApprovals, setLoadingApprovals] = useState(false);

    const canApprove = user?.roles?.includes('Admin') || user?.permissions?.includes('attendance.approve');

    // Permission to edit own attendance
    const canEditAttendance = user?.roles?.includes('Admin') || user?.permissions?.includes('attendance.update_self');

    // Rejection Modal State
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [selectedTimesheet, setSelectedTimesheet] = useState(null); // Full object
    const [rejectionType, setRejectionType] = useState('FULL'); // 'FULL' or 'PARTIAL'
    const [rejectedEntryIds, setRejectedEntryIds] = useState([]);

    const handleRejectClick = (timesheet) => {
        setSelectedTimesheet(timesheet);
        setRejectReason('');
        setRejectionType('FULL');
        setRejectedEntryIds([]);
        setShowRejectModal(true);
    };

    const toggleEntryRejection = (entryId) => {
        setRejectedEntryIds(prev =>
            prev.includes(entryId)
                ? prev.filter(id => id !== entryId)
                : [...prev, entryId]
        );
    };

    const submitRejection = async () => {
        if (!rejectReason.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }
        if (rejectionType === 'PARTIAL' && rejectedEntryIds.length === 0) {
            toast.error('Please select at least one entry to reject');
            return;
        }

        try {
            await api.put(`/timesheet/${selectedTimesheet._id}/approve`, {
                status: 'REJECTED',
                reason: rejectReason,
                type: rejectionType,
                rejectedEntryIds: rejectionType === 'PARTIAL' ? rejectedEntryIds : []
            });
            toast.success('Timesheet rejection processed');
            setShowRejectModal(false);
            fetchApprovals();
        } catch (error) {
            toast.error('Failed to process rejection');
        }
    };

    // Edit/Regularize Logic
    const [entryToEdit, setEntryToEdit] = useState(null);
    const [editHours, setEditHours] = useState(0);
    const [editMinutes, setEditMinutes] = useState(0);
    const [editDescription, setEditDescription] = useState('');
    const [editStartTime, setEditStartTime] = useState('');
    const [editEndTime, setEditEndTime] = useState('');
    // Enhanced Edit State
    const [editProjectId, setEditProjectId] = useState('');
    const [editModuleId, setEditModuleId] = useState('');
    const [editTaskId, setEditTaskId] = useState('');
    const [editFilteredModules, setEditFilteredModules] = useState([]);
    const [editFilteredTasks, setEditFilteredTasks] = useState([]);

    // New Entry State
    const [isAddingEntry, setIsAddingEntry] = useState(false);
    const [newEntry, setNewEntry] = useState({
        projectId: '',
        moduleId: '',
        taskId: '',
        hours: '',
        minutes: '',
        description: ''
    });
    const [filteredModules, setFilteredModules] = useState([]);
    const [filteredTasks, setFilteredTasks] = useState([]);
    const [availableProjects, setAvailableProjects] = useState([]);


    const calculateHours = (start, end) => {
        if (start && end) {
            const s = new Date(`2000/01/01 ${start}`);
            const e = new Date(`2000/01/01 ${end}`);
            let diff = (e - s) / 3600000; // milliseconds to hours
            if (diff < 0) diff += 24;
            return diff.toFixed(2);
        }
        return null;
    };

    const handleEditClick = (entry) => {
        setEntryToEdit(entry);

        // Parse decimal hours to H:M
        const total = parseFloat(entry.hours) || 0;
        const h = Math.floor(total);
        const m = Math.round((total - h) * 60);

        setEditHours(h);
        setEditMinutes(m);
        setEditDescription(entry.description || '');

        // Fix: Also open the cell so the edit form is visible
        if (entry.date && entry.project) {
            const entryDate = new Date(entry.date);
            const dateKey = format(entryDate, 'yyyy-MM-dd');
            const pid = entry.project._id || entry.project;

            // Find all logs for this cell to populate the view
            const logsForCell = timesheet.entries.filter(e => {
                const eDateKey = format(new Date(e.date), 'yyyy-MM-dd');
                const ePid = e.project._id || e.project;
                return eDateKey === dateKey && ePid === pid;
            });

            setSelectedCell({
                date: entryDate,
                project: entry.project,
                logs: logsForCell
            });
        }

        if (entry.startTime && entry.endTime) {
            setEditStartTime(entry.startTime);
            setEditEndTime(entry.endTime);
        } else {
            const entryDateKey = format(new Date(entry.date), 'yyyy-MM-dd');
            const log = attendanceLogs.find(l => format(new Date(l.date), 'yyyy-MM-dd') === entryDateKey);

            if (log && log.clockIn && log.clockOut) {
                const fmtTime = (dateStr) => {
                    const d = new Date(dateStr);
                    return d.toTimeString().substring(0, 5);
                };
                setEditStartTime(fmtTime(log.clockIn));
                setEditEndTime(fmtTime(log.clockOut));
            } else {
                setEditStartTime('');
                setEditEndTime('');
            }
        }

        // Initialize Hierarchy Selectors for Edit
        if (entry.type !== 'ATTENDANCE' && entry.type !== 'ATTENDANCE_CREATE') {
            const pid = entry.project?._id || entry.project;
            const mid = entry.module?._id || entry.module;
            const tid = entry.task?._id || entry.task;

            setEditProjectId(pid || '');
            setEditModuleId(mid || '');
            setEditTaskId(tid || '');

            // Fetch dependent dropdowns
            if (pid) {
                api.get(`/projects/${pid}/modules`).then(res => setEditFilteredModules(res.data));
            }
            if (mid) {
                api.get(`/projects/tasks?moduleId=${mid}`).then(res => setEditFilteredTasks(res.data));
            }
        }
    };

    const handleEditProjectChange = async (projectId) => {
        setEditProjectId(projectId);
        setEditModuleId('');
        setEditTaskId('');
        setEditFilteredModules([]);
        setEditFilteredTasks([]);
        if (projectId) {
            try {
                const res = await api.get(`/projects/${projectId}/modules`);
                setEditFilteredModules(res.data);
            } catch (error) { console.error(error); }
        }
    };

    const handleEditModuleChange = async (moduleId) => {
        setEditModuleId(moduleId);
        setEditTaskId('');
        setEditFilteredTasks([]);
        if (moduleId) {
            try {
                const res = await api.get(`/projects/tasks?moduleId=${moduleId}`);
                setEditFilteredTasks(res.data);
            } catch (error) { console.error(error); }
        }
    };

    const submitEdit = async () => {
        try {
            // Validation: Check Joining Date
            const targetDate = startOfDay(new Date(entryToEdit.date));
            const joiningDate = user?.joiningDate ? startOfDay(new Date(user.joiningDate)) : null;
            if (joiningDate && targetDate < joiningDate) {
                toast.error('Cannot edit timesheet before joining date');
                return;
            }

            if (entryToEdit.type === 'ATTENDANCE_CREATE') {
                if (!editStartTime || !editEndTime) {
                    toast.error('Both Check-In and Check-Out times are required');
                    return;
                }
                // Create New
                const baseDate = format(new Date(entryToEdit.date), 'yyyy-MM-dd');

                // Construct Dates
                const inTime = editStartTime ? new Date(`${baseDate}T${editStartTime}:00`) : null; // Append seconds
                const outTime = editEndTime ? new Date(`${baseDate}T${editEndTime}:00`) : null;

                if ((editStartTime && isNaN(inTime.getTime())) || (editEndTime && isNaN(outTime.getTime()))) {
                    toast.error('Invalid time format');
                    return;
                }

                await api.post('/attendance', {
                    date: entryToEdit.date,
                    clockIn: inTime, // Axios will serialize to ISO string
                    clockOut: outTime,
                    userId: targetUserId || undefined
                });
                toast.success('Attendance created');

            } else if (entryToEdit.type === 'ATTENDANCE') {
                // Update Existing
                // Formatting dates back to ISO with correct date
                const baseDate = format(new Date(entryToEdit.date), 'yyyy-MM-dd');

                const inTime = editStartTime ? new Date(`${baseDate}T${editStartTime}:00`) : null;
                const outTime = editEndTime ? new Date(`${baseDate}T${editEndTime}:00`) : null;

                if ((editStartTime && isNaN(inTime.getTime())) || (editEndTime && isNaN(outTime.getTime()))) {
                    toast.error('Invalid time format');
                    return;
                }

                await api.put(`/attendance/${entryToEdit._id}`, {
                    clockIn: inTime,
                    clockOut: outTime
                });
                toast.success('Attendance updated');
            } else {
                const h = parseFloat(editHours) || 0;
                const m = parseFloat(editMinutes) || 0;
                const totalHours = h + (m / 60);

                await api.put(`/timesheet/entry/${entryToEdit._id}`, {
                    hours: totalHours.toFixed(2),
                    description: editDescription,
                    startTime: editStartTime,
                    endTime: editEndTime,
                    // Send hierarchy updates
                    projectId: editProjectId,
                    moduleId: editModuleId,
                    taskId: editTaskId
                });
                toast.success('Entry updated');
            }
            setEntryToEdit(null);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to update entry');
        }
    };

    const fetchApprovals = async () => {
        try {
            setLoadingApprovals(true);
            // Fetch Timesheet Approvals instead of Attendance
            const res = await api.get('/timesheet/approvals');
            setPendingApprovals(res.data);
        } catch (error) {
            console.error('Fetch approvals failed', error);
        } finally {
            setLoadingApprovals(false);
        }
    };

    const handleApprove = async (ts, status) => {
        if (status === 'REJECTED') {
            handleRejectClick(ts);
            return;
        }

        if (!window.confirm(`Are you sure you want to ${status} this timesheet?`)) return;
        try {
            await api.put(`/timesheet/${ts._id}/approve`, { status });
            toast.success(`Timesheet ${status.toLowerCase()}`);
            fetchApprovals(); // Refresh list
        } catch (error) {
            toast.error('Action failed');
        }
    };

    useEffect(() => {
        if (canApprove) fetchApprovals();
    }, [user]);


    // Check for userId in URL (for Manager view)
    const queryParams = new URLSearchParams(window.location.search);
    const targetUserId = propUserId || queryParams.get('userId');
    const targetUserName = propUserName || queryParams.get('name');

    const fetchData = async () => {
        try {
            const formattedMonth = format(viewDate, 'yyyy-MM');
            const [tsRes, projRes, holRes] = await Promise.all([
                targetUserId
                    ? api.get(`/timesheet/user/${targetUserId}?month=${formattedMonth}`)
                    : api.get(`/timesheet/current?month=${formattedMonth}`),
                api.get('/timesheet/projects'),
                api.get('/holidays')
            ]);
            if (targetUserId) {
                // Fetch target user details for correct joining date/etc
                try {
                    const userRes = await api.get(`/admin/users/${targetUserId}`);
                    setViewUser(userRes.data);
                } catch (e) {
                    console.error("Failed to fetch user details", e);
                    // Fallback to basic info if needed or handling error
                }
            } else {
                setViewUser(user);
            }

            setTimesheet(tsRes.data);
            setAttendanceLogs(tsRes.data.attendanceLog || []);
            setProjects(projRes.data);
            setAvailableProjects(projRes.data); // Store for dropdowns
            setHolidays(holRes.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load timesheet');
        } finally {
            setLoading(false);
        }
    };

    // Load Modules/Tasks when Project Changes for New Entry
    const handleProjectChange = async (projectId) => {
        setNewEntry(prev => ({ ...prev, projectId, moduleId: '', taskId: '' }));
        if (!projectId) {
            setFilteredModules([]);
            return;
        }
        try {
            const res = await api.get(`/projects/${projectId}/modules`);
            setFilteredModules(res.data);
        } catch (error) {
            console.error("Failed to fetch modules", error);
        }
    };

    const handleModuleChange = async (moduleId) => {
        setNewEntry(prev => ({ ...prev, moduleId, taskId: '' }));
        if (!moduleId) {
            setFilteredTasks([]);
            return;
        }
        try {
            // Check getTasks API signature in projectController.
            // It accepts moduleId query param.
            const res = await api.get(`/projects/tasks?moduleId=${moduleId}`);
            setFilteredTasks(res.data);
        } catch (error) {
            console.error("Failed to fetch tasks", error);
        }
    };

    const submitNewEntry = async () => {
        const h = parseFloat(newEntry.hours) || 0;
        const m = parseFloat(newEntry.minutes) || 0;
        const totalHours = h + (m / 60);

        if (!newEntry.projectId || totalHours <= 0 || !newEntry.date) {
            toast.error("Project, valid Duration (hours/minutes) and Date are required");
            return;
        }
        if (!newEntry.taskId && !newEntry.moduleId) {
            // toast.warning("Task is recommended");
        }

        try {
            await api.post('/timesheet/entry', {
                date: newEntry.date,
                hours: totalHours.toFixed(2), // Send total
                description: newEntry.description,
                projectId: newEntry.projectId,
                moduleId: newEntry.moduleId,
                taskId: newEntry.taskId,
                userId: targetUserId || undefined // Pass target user ID if Admin view
            });
            toast.success("Work Log Added");
            setIsAddingEntry(false);
            setNewEntry({ projectId: '', moduleId: '', taskId: '', hours: '', minutes: '', description: '' });
            fetchData(); // Refresh
            // Update selected cell logs? fetchData will update timesheet, but we might need to locally update selectedCell or close it.
            // Closing it is easiest to ensure consistency.
            setSelectedCell(null);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to add entry");
        }
    };

    // Fetch Users List for Dropdown (Admin/Manager/timesheet.view)
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                if (user.roles.includes('Admin') || user.permissions?.includes('timesheet.view')) {
                    const res = await api.get('/admin/users');
                    setUsersList(res.data);
                } else if (user.roles.includes('Manager')) {
                    const res = await api.get('/admin/users/team');
                    setUsersList(res.data);
                }
            } catch (error) {
                console.error("Failed to fetch users list", error);
            }
        };

        if (user && (user.roles.includes('Admin') || user.roles.includes('Manager') || user.permissions?.includes('timesheet.view'))) {
            fetchUsers();
        }
    }, [user]);

    const handleUserChange = (e) => {
        const selectedId = e.target.value;
        if (!selectedId) return;

        const selectedUser = usersList.find(u => u._id === selectedId);
        if (selectedUser) {
            // Update URL and reload (or trigger re-render if handled via state)
            const url = new URL(window.location);
            url.searchParams.set('userId', selectedId);
            url.searchParams.set('name', `${selectedUser.firstName} ${selectedUser.lastName}`);
            window.history.pushState({}, '', url);
            // We need to force a re-fetch since our main fetch depends on window.location.search which might not react to pushState immediately in this component structure
            // Or better, we can reload or use a navigation hook if available.
            // For now, reloading is safe to ensure clean state.
            window.location.reload();
        }
    };

    useEffect(() => {
        fetchData();
    }, [viewDate, targetUserId]); // Re-fetch when month or user changes

    // Generate days for current view (Monthly)
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // State for Details Modal
    const [selectedCell, setSelectedCell] = useState(null); // { date: Date, project: ProjectObj, logs: [] }

    const handleExportAttendance = async () => {
        // Use the component-level targetUserId which already accounts for propUserId or query params
        const exportUserId = targetUserId || user?._id;

        if (!exportUserId) {
            toast.error('User not identified');
            return;
        }

        const toastId = toast.loading('Generating Attendance Report...');
        try {
            // Fetch User Details
            let userDetails;
            if (exportUserId === user._id) {
                // Fetch self details using profile endpoint
                const res = await api.get('/auth/profile');
                userDetails = res.data;
            } else {
                // Fetch other user details (Admin/Manager)
                const res = await api.get(`/admin/users/${exportUserId}`);
                userDetails = res.data;
            }

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Attendance Report');

            // Header Info
            sheet.mergeCells('A1:C1');
            sheet.getCell('A1').value = `User Name: ${userDetails.firstName} ${userDetails.lastName || ''}`;
            sheet.getCell('A1').font = { bold: true, size: 14 };

            sheet.mergeCells('A2:C2');
            sheet.getCell('A2').value = `Joining Date: ${userDetails.joiningDate ? new Date(userDetails.joiningDate).toLocaleDateString() : 'N/A'}`;

            sheet.mergeCells('A3:C3');
            const managers = userDetails.reportingManagers || [];
            const mgrNames = managers.length > 0 ? managers.map(m => `${m.firstName} ${m.lastName}`).join(', ') : 'N/A';
            sheet.getCell('A3').value = `Supervisor(s): ${mgrNames}`;

            sheet.addRow([]);

            // Table Header
            const headerRow = sheet.addRow(['Date', 'Day', 'Status', 'In Time', 'Out Time', 'Duration']);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
            headerRow.alignment = { horizontal: 'center' };

            const start = startOfMonth(viewDate);
            const end = endOfMonth(viewDate);
            const days = eachDayOfInterval({ start, end });

            // Helpers
            const formatTime = (dateString, istString) => {
                if (!dateString) return '--:--';
                return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            };
            const calculateDuration = (start, end, recordDate) => {
                if (!start) return '--';
                const s = new Date(start);
                let e;

                if (end) {
                    e = new Date(end);
                } else {
                    const today = new Date();
                    const rDate = recordDate ? new Date(recordDate) : today;
                    const isToday = rDate.toDateString() === today.toDateString();

                    if (isToday) {
                        e = new Date(); // Live time for today
                    } else {
                        // Auto-checkout at midnight for past dates
                        e = new Date(rDate);
                        e.setHours(23, 59, 59, 999);
                    }
                }

                if (e < s) return '0h 0m';
                const diff = Math.abs(e - s);
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                return `${h}h ${m}m`;
            };

            days.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const record = attendanceLogs.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);
                const isSunday = day.getDay() === 0;
                const isFuture = day > new Date();

                let status = 'Absent';
                let rowColor = 'FFF2DCDB'; // Red

                const joiningDate = userDetails.joiningDate ? new Date(userDetails.joiningDate) : null;
                if (joiningDate) joiningDate.setHours(0, 0, 0, 0);
                const holiday = holidays.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);

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
                    record ? calculateDuration(record.clockIn, record.clockOut, day) : '-'
                ]);
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
                row.alignment = { horizontal: 'center' };
            });

            sheet.columns = [{ width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];

            const exportUserName = userDetails.firstName || 'User';
            const buffer = await workbook.xlsx.writeBuffer();
            const fileName = `Attendance_${format(start, 'MMMM_yyyy')}_${exportUserName}.xlsx`;
            saveAs(new Blob([buffer]), fileName);
            toast.success('Downloaded', { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Export Failed', { id: toastId });
        }
    };

    // Group entries by Project
    const getEntriesByProject = () => {
        if (!timesheet) return {};
        const groups = {};

        timesheet.entries.forEach(entry => {
            const pid = entry.project._id || entry.project; // Handle populated or id
            if (!groups[pid]) {
                groups[pid] = {
                    project: entry.project,
                    hours: {}, // Key: YYYY-MM-DD, Value: Total Hours
                    logs: {}   // Key: YYYY-MM-DD, Value: [Entries]
                };
            }
            const dateKey = format(new Date(entry.date), 'yyyy-MM-dd');

            // Sum hours
            const current = groups[pid].hours[dateKey] || 0;
            groups[pid].hours[dateKey] = current + entry.hours;

            // Store logs
            if (!groups[pid].logs[dateKey]) groups[pid].logs[dateKey] = [];
            groups[pid].logs[dateKey].push(entry);
        });

        return groups;
    };

    const projectGroups = getEntriesByProject();

    const handleCellClick = (project, date, logs = [], force = false) => {
        if (!force && logs.length === 0) return;
        setEntryToEdit(null); // Reset edit state when switching cells
        setSelectedCell({
            project,
            date,
            logs
        });
    };

    // Calculate Total per day
    const getTotalPerDay = (date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        let total = 0;
        Object.values(projectGroups).forEach(group => {
            if (group.hours[dateKey]) total += group.hours[dateKey];
        });
        return total;
    };

    const handleSubmit = async () => {
        if (!window.confirm('Are you sure you want to submit this timesheet for approval? You cannot edit it afterwards.')) {
            return;
        }
        try {
            const formattedMonth = format(viewDate, 'yyyy-MM');
            await api.post('/timesheet/submit', { month: formattedMonth });
            toast.success('Timesheet Submitted Successfully');
            fetchData(); // Refresh to update status
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to submit timesheet');
        }
    };

    const handleExport = async () => {
        if (!timesheet) return;

        const workbook = new ExcelJS.Workbook();

        // --- SHEET 1: WORK LOGS (HIERARCHICAL) ---
        const wsLogs = workbook.addWorksheet('Detailed Report');

        // Columns setup
        wsLogs.columns = [
            { header: 'Item Name / Description', key: 'name', width: 50 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Hours', key: 'hours', width: 10 },
            { header: 'Start Time', key: 'start', width: 12 },
            { header: 'End Time', key: 'end', width: 12 },
            { header: 'Client', key: 'client', width: 20 },
        ];

        // Header Styling
        const headerRow = wsLogs.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } }; // Dark Blue
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // --- 0. SUMMARY ROW (Inserted at top) ---
        // Debugging: Check what we received
        const u = timesheet.userDetails || timesheet.user || {};
        const managers = u.reportingManagers || [];
        console.log('Export Debug - User:', u);

        wsLogs.insertRow(1, { name: 'Timesheet Report' });
        wsLogs.insertRow(2, {
            name: `Employee: ${u.firstName || u.email || 'Unknown'} ${u.lastName || ''}`
        });
        wsLogs.insertRow(3, {
            name: `Supervisor(s): ${managers.length > 0 ? managers.map(m => `${m.firstName} ${m.lastName}`).join(', ') : 'N/A'}`
        });
        wsLogs.insertRow(4, { name: '' }); // Spacer

        // Style Summary
        wsLogs.getRow(1).font = { bold: true, size: 16 };
        wsLogs.getRow(2).font = { size: 12 };
        wsLogs.getRow(3).font = { size: 12 };

        // Fix Header Row Index after insertion (Original Row 1 is now Row 5)
        const newHeaderRow = wsLogs.getRow(5);
        newHeaderRow.values = ['Item Name / Description', 'Status', 'Date', 'Hours', 'Start Time', 'End Time', 'Client'];
        newHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        newHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } };
        newHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // 1. Group Data: Project -> Module -> Task -> Logs
        const hierarchy = {};

        timesheet.entries.forEach(entry => {
            const pId = entry.project?._id || entry.project || 'UNKNOWN_PROJECT';
            const pName = entry.project?.name || 'Unknown Project';
            const clientName = entry.project?.client?.name || 'Internal';

            if (!hierarchy[pId]) {
                hierarchy[pId] = { name: pName, client: clientName, modules: {}, totalHours: 0 };
            }
            hierarchy[pId].totalHours += entry.hours;

            const mId = entry.module?._id || 'NO_MODULE';
            const mName = entry.module?.name || 'General / No Module';

            if (!hierarchy[pId].modules[mId]) {
                hierarchy[pId].modules[mId] = { name: mName, tasks: {}, totalHours: 0 };
            }
            hierarchy[pId].modules[mId].totalHours += entry.hours;

            const tId = entry.task?._id || 'NO_TASK';
            const tName = entry.task?.name || entry.taskName || 'General Task';

            if (!hierarchy[pId].modules[mId].tasks[tId]) {
                hierarchy[pId].modules[mId].tasks[tId] = { name: tName, logs: [], totalHours: 0 };
            }
            hierarchy[pId].modules[mId].tasks[tId].totalHours += entry.hours;
            hierarchy[pId].modules[mId].tasks[tId].logs.push(entry);
        });

        // 2. Build Rows
        Object.values(hierarchy).forEach(proj => {
            // Level 0: Project
            const pRow = wsLogs.addRow({
                name: `PROJECT: ${proj.name}`,
                status: '',
                date: '',
                hours: proj.totalHours,
                start: '',
                end: '',
                client: proj.client
            });
            pRow.outlineLevel = 0;
            pRow.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
            pRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC5D9F1' } }; // Light Blue

            Object.values(proj.modules).forEach(mod => {
                // Level 1: Module
                const mRow = wsLogs.addRow({
                    name: `  MODULE: ${mod.name}`,
                    status: '',
                    date: '',
                    hours: mod.totalHours,
                    start: '',
                    end: '',
                    client: ''
                });
                mRow.outlineLevel = 1;
                mRow.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
                mRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } }; // Pale Blue

                Object.values(mod.tasks).forEach(task => {
                    // Level 2: Task
                    const tRow = wsLogs.addRow({
                        name: `    TASK: ${task.name}`,
                        status: '',
                        date: '',
                        hours: task.totalHours,
                        start: '',
                        end: '',
                        client: ''
                    });
                    tRow.outlineLevel = 2;
                    tRow.font = { bold: true, color: { argb: 'FF44546A' } };
                    tRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1DE' } }; // Light Green

                    task.logs.forEach(log => {
                        // Level 3: Work Log
                        const lRow = wsLogs.addRow({
                            name: `      ${log.description || '(No Description)'}`,
                            status: log.status || 'Draft',
                            date: format(new Date(log.date), 'yyyy-MM-dd'),
                            hours: log.hours,
                            start: log.startTime || '-',
                            end: log.endTime || '-',
                            client: ''
                        });
                        lRow.outlineLevel = 3;
                        lRow.font = { italic: false, color: { argb: 'FF444444' } };
                        lRow.getCell('name').alignment = { indent: 2 }; // Visual Indent

                        if (log.status === 'REJECTED') {
                            lRow.font = { color: { argb: 'FFFF0000' }, strike: true };
                            lRow.getCell('status').font = { bold: true, color: { argb: 'FFFF0000' } };
                        }
                    });
                });
            });
        });

        // Auto-Filter
        wsLogs.autoFilter = { from: 'A1', to: { row: 1, column: 7 } };


        // --- SHEET 2: ATTENDANCE (Same as before) ---
        const wsAtt = workbook.addWorksheet('Attendance');
        wsAtt.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Check In', key: 'in', width: 15 },
            { header: 'Check Out', key: 'out', width: 15 },
            { header: 'Duration (Hrs)', key: 'duration', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        const attHeader = wsAtt.getRow(1);
        attHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        attHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF228B22' } }; // Green
        attHeader.alignment = { vertical: 'middle', horizontal: 'center' };

        attendanceLogs.forEach(log => {
            const inTime = log.clockIn ? new Date(log.clockIn) : null;
            const outTime = log.clockOut ? new Date(log.clockOut) : null;
            let duration = 0;
            if (log.duration) duration = (log.duration / 60).toFixed(2);
            else if (inTime && outTime) duration = ((outTime - inTime) / 3600000).toFixed(2);

            wsAtt.addRow({
                date: format(new Date(log.date), 'yyyy-MM-dd'),
                in: inTime ? format(inTime, 'HH:mm:ss') : '-',
                out: outTime ? format(outTime, 'HH:mm:ss') : '-',
                duration: duration,
                status: (inTime && outTime) ? 'Present' : 'Incomplete'
            });
        });

        // Export
        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `Timesheet_${targetUserName || 'User'}_${format(viewDate, 'MMM_yyyy')}_Detailed.xlsx`;
        saveAs(new Blob([buffer]), fileName);
    };

    const canViewAttendance = user?.roles?.includes('Admin') || user?.permissions?.includes('attendance.view');
    const canViewTimesheets = user?.roles?.includes('Admin') || user?.permissions?.includes('timesheet.view');

    return (
        <div className={`${isEmbedded ? 'w-full' : 'min-h-screen bg-slate-100 p-6 md:p-10'} font-sans overflow-x-hidden`}>
            <div className={`w-full ${isEmbedded ? '' : 'max-w-7xl mx-auto space-y-6'} overflow-x-hidden`}>

                {/* Tabs & Header */}
                <div className="flex flex-col space-y-4">
                    <div className="flex justify-between items-center">
                        {!isEmbedded && (
                            <div className="flex space-x-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                <button
                                    onClick={() => setActiveTab('timesheet')}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'timesheet' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Timesheet View
                                </button>
                                {(canApprove) && (
                                    <button
                                        onClick={() => setActiveTab('approvals')}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center space-x-2 ${activeTab === 'approvals' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <span>Pending Approvals</span>
                                        {pendingApprovals.length > 0 && (
                                            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                                {pendingApprovals.length}
                                            </span>
                                        )}
                                    </button>
                                )}
                                {canViewAttendance && (
                                    <button
                                        onClick={() => setActiveTab('attendance')}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center space-x-2 ${activeTab === 'attendance' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <FileText size={16} />
                                        <span>Attendance View</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* User Picker — visible to Admin, Manager, or timesheet.view permission */}
                        {!isEmbedded && (canViewTimesheets || user?.roles?.includes('Manager')) && usersList.length > 0 && (
                            <div className="flex items-center space-x-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Viewing:</label>
                                <select
                                    onChange={handleUserChange}
                                    value={targetUserId || ''}
                                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-400 outline-none"
                                >
                                    <option value="">— Select User —</option>
                                    {usersList.map(u => (
                                        <option key={u._id} value={u._id}>
                                            {u.firstName} {u.lastName}
                                        </option>
                                    ))}
                                </select>
                                {targetUserId && (
                                    <button
                                        onClick={() => {
                                            const url = new URL(window.location);
                                            url.searchParams.delete('userId');
                                            url.searchParams.delete('name');
                                            window.history.pushState({}, '', url);
                                            window.location.reload();
                                        }}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        View Own
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {activeTab === 'timesheet' && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                            {loading ? (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <Skeleton className="h-8 w-64 mb-2" />
                                            <Skeleton className="h-4 w-48" />
                                        </div>
                                        <div className="flex space-x-2">
                                            <Skeleton className="h-9 w-24 rounded" />
                                            <Skeleton className="h-9 w-24 rounded" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-[400px] w-full rounded-xl" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h1 className="text-2xl font-bold text-slate-800">
                                                {targetUserName ? `${targetUserName}'s Timesheet` : 'Timesheet'}
                                            </h1>
                                            <div className="flex items-center space-x-2 text-sm text-slate-500">
                                                <span>{format(viewDate, 'MMMM yyyy')}</span>
                                                <span>•</span>
                                                <span className={`font-bold ${timesheet?.status === 'APPROVED' ? 'text-emerald-600' : timesheet?.status === 'REJECTED' ? 'text-red-600' : 'text-blue-600'}`}>
                                                    {timesheet?.status || 'DRAFT'}
                                                </span>
                                                {targetUserName && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">Manager View</span>}
                                            </div>
                                        </div>

                                        <div className="flex space-x-3 items-center">


                                            <Button
                                                onClick={() => setViewDate(d => addDays(d, -30))}
                                                variant="secondary"
                                                className="flex items-center space-x-2"
                                            >
                                                <ChevronLeft size={16} /> <span>Prev</span>
                                            </Button>
                                            <Button
                                                onClick={() => setViewDate(d => addDays(d, 30))}
                                                variant="secondary"
                                                className="flex items-center space-x-2"
                                            >
                                                <span>Next</span> <ChevronRight size={16} />
                                            </Button>
                                            {(timesheet?.status === 'DRAFT' || timesheet?.status === 'REJECTED') && !targetUserId && (
                                                <Button
                                                    onClick={handleSubmit}
                                                    className="flex items-center space-x-2"
                                                >
                                                    <Send size={16} /> <span>{timesheet?.status === 'REJECTED' ? 'Resubmit' : 'Submit'} for Approval</span>
                                                </Button>
                                            )}
                                            {(user?.role === 'Admin' || user?.permissions?.includes('timesheet.export')) && (
                                                <Button
                                                    onClick={handleExport}
                                                    variant="secondary"
                                                    className="flex items-center space-x-2 bg-white text-green-700 border-green-200 hover:bg-green-50"
                                                >
                                                    <Save size={16} /> <span>Export Excel</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Rejection Feedback */}
                                    {timesheet?.status === 'REJECTED' && (
                                        <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-sm text-red-800 mb-4">
                                            <div className="flex items-start mb-2">
                                                <div className="font-bold mr-2">Rejection Reason:</div>
                                                <div>{timesheet.rejectionReason}</div>
                                            </div>

                                            {/* Rejected Entries List */}
                                            {timesheet.entries.filter(e => e.status === 'REJECTED').length > 0 && (
                                                <div className="mt-2 bg-white rounded border border-red-100 p-2">
                                                    <div className="text-xs font-bold text-red-600 mb-1">Items requiring correction:</div>
                                                    <div className="space-y-1">
                                                        {timesheet.entries.filter(e => e.status === 'REJECTED').map(entry => (
                                                            <div key={entry._id} className="flex justify-between items-center text-xs p-1 hover:bg-red-50 rounded">
                                                                <span>{format(new Date(entry.date), 'MMM d')} - {entry.project?.name} ({entry.hours}h)</span>
                                                                <Button
                                                                    onClick={() => handleEditClick(entry)}
                                                                    variant="ghost"
                                                                    className="px-2 py-0.5 bg-red-100 text-red-700 hover:bg-red-200 rounded font-bold border border-red-200 h-auto text-xs"
                                                                >
                                                                    Regularize
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {activeTab === 'approvals' && (
                    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-slate-700">Attendance Requests</h3>
                        </div>
                        {loadingApprovals ? (
                            <div className="divide-y divide-slate-100">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="px-6 py-4 flex justify-between items-center">
                                        <div className="space-y-2">
                                            <Skeleton className="h-5 w-32" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-6 w-16 rounded-full" />
                                        <div className="flex space-x-2">
                                            <Skeleton className="h-6 w-16" />
                                            <Skeleton className="h-6 w-16" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : pendingApprovals.length > 0 ? (
                            <div className="overflow-x-auto scrollbar-hide">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                                            <th className="px-6 py-4 font-semibold">Employee</th>
                                            <th className="px-6 py-4 font-semibold">Month</th>
                                            <th className="px-6 py-4 font-semibold">Submitted On</th>
                                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pendingApprovals.map(ts => (
                                            <tr key={ts._id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-6 py-4 align-middle">
                                                    <div className="font-semibold text-slate-800">{ts.user?.firstName} {ts.user?.lastName}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">{ts.user?.employeeCode}</div>
                                                </td>
                                                <td className="px-6 py-4 align-middle">
                                                    <span className="font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded text-xs">{ts.month}</span>
                                                </td>
                                                <td className="px-6 py-4 align-middle">
                                                    {ts.submittedAt ? (
                                                        <div>
                                                            <div className="text-slate-700 font-medium">{format(new Date(ts.submittedAt), 'dd MMM yyyy')}</div>
                                                            <div className="text-xs text-slate-400 mt-0.5">{format(new Date(ts.submittedAt), 'hh:mm a')}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 align-middle">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                const u = new URL(window.location);
                                                                u.searchParams.set('userId', ts.user._id);
                                                                u.searchParams.set('name', `${ts.user.firstName} ${ts.user.lastName}`);
                                                                u.searchParams.set('month', ts.month);
                                                                window.history.pushState({}, '', u);
                                                                window.location.reload();
                                                            }}
                                                            className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md text-xs font-semibold transition-colors border border-blue-100"
                                                        >
                                                            View Details
                                                        </button>
                                                        <button
                                                            onClick={() => handleApprove(ts, 'APPROVED')}
                                                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md text-xs font-semibold transition-colors border border-emerald-100"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleApprove(ts, 'REJECTED')}
                                                            className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-xs font-semibold transition-colors border border-red-100"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-12 text-center text-slate-400">
                                <Clock size={48} className="mx-auto mb-3 text-slate-200" />
                                <p>No pending approvals found.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'timesheet' && (
                    <>
                        {/* Inline Detail View */}
                        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden mb-6">
                            <div className="overflow-x-auto scrollbar-hide">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                                            <th className="p-4 border-r border-slate-200 min-w-[250px] sticky left-0 z-30 bg-slate-50 font-bold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                Project / Task
                                            </th>
                                            {daysInMonth.map(day => {
                                                const dateKey = format(day, 'yyyy-MM-dd');
                                                const holiday = holidays.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateKey);
                                                return (
                                                    <th key={day.toString()} className={`p-2 border-r border-slate-200 min-w-[60px] text-center ${holiday ? 'bg-green-50' : ['Sat', 'Sun'].includes(format(day, 'EEE')) ? 'bg-slate-100/50' : ''}`}>
                                                        <div className="text-[10px] text-slate-400">{format(day, 'EEE')}</div>
                                                        <div className={`font-bold ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-slate-700'}`}>{format(day, 'd')}</div>
                                                        {holiday && (
                                                            <div className="text-[8px] text-green-600 font-bold truncate max-w-[50px] mt-1" title={holiday.name}>
                                                                {holiday.name}
                                                            </div>
                                                        )}
                                                    </th>
                                                );
                                            })}
                                            <th className="p-4 border-l border-slate-200 min-w-[100px] font-bold text-center bg-slate-50 sticky right-0 z-30 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {/* Attendance Row */}
                                        <tr className="bg-slate-50/80 border-b border-slate-200">
                                            <td className="p-4 border-r border-slate-200 font-bold text-slate-700 sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                <div className="flex flex-col">
                                                    <span>Attendance</span>
                                                    <span className="text-[10px] text-slate-400 font-normal uppercase">Check-in / Out</span>
                                                </div>
                                            </td>
                                            {daysInMonth.map(day => {
                                                const dateKey = format(day, 'yyyy-MM-dd');
                                                const log = attendanceLogs.find(l => format(new Date(l.date), 'yyyy-MM-dd') === dateKey);
                                                const isWeekend = ['Sat', 'Sun'].includes(format(day, 'EEE'));

                                                // Joining Date Check
                                                const joiningDate = user?.joiningDate ? startOfDay(new Date(user.joiningDate)) : null;
                                                const isBeforeJoining = joiningDate && day < joiningDate;
                                                const isFutureDate = day > new Date();

                                                return (
                                                    <td
                                                        key={'att-' + day}
                                                        onClick={() => {
                                                            if (isFutureDate) return;
                                                            if (isBeforeJoining) {
                                                                toast.error('Cannot edit attendance before joining date');
                                                                return;
                                                            }
                                                            handleCellClick({ name: 'Attendance Log' }, day, [], true);
                                                        }}
                                                        className={`p-1 border-r border-slate-200 text-center text-xs transition-colors ${isBeforeJoining || isFutureDate
                                                            ? 'bg-slate-50 cursor-not-allowed opacity-50'
                                                            : `cursor-pointer hover:bg-blue-50 ${isWeekend ? 'bg-slate-100/50' : ''}`
                                                            }`}
                                                        title={isBeforeJoining ? 'Before Joining Date' : isFutureDate ? 'Future Date' : ''}
                                                    >
                                                        {isBeforeJoining || isFutureDate ? (
                                                            <span className="text-slate-200 select-none text-[10px]">{isFutureDate ? '-' : 'N/A'}</span>
                                                        ) : log ? (
                                                            <div className="flex flex-col items-center justify-center">
                                                                <span className={`font-bold px-2 py-1 rounded text-[10px] min-w-[32px] ${log.clockOutIST || isSameDay(new Date(log.date), new Date())
                                                                    ? 'bg-slate-200 text-slate-800'
                                                                    : 'bg-red-100 text-red-700'
                                                                    }`}>
                                                                    {log.duration
                                                                        ? (log.duration / 60).toFixed(1)
                                                                        : (log.clockOut && log.clockIn
                                                                            ? ((new Date(log.clockOut) - new Date(log.clockIn)) / 3600000).toFixed(1)
                                                                            : '-')}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="p-4 border-l border-slate-200 font-bold text-center bg-slate-50 sticky right-0 z-20 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                {/* Total Attendance Hours */}
                                                {(attendanceLogs.reduce((acc, log) => {
                                                    if (log.duration) return acc + (log.duration / 60);
                                                    if (log.clockIn && log.clockOut) {
                                                        const dur = (new Date(log.clockOut) - new Date(log.clockIn)) / 3600000;
                                                        return acc + dur;
                                                    }
                                                    return acc;
                                                }, 0)).toFixed(1)}
                                            </td>
                                        </tr>
                                        {Object.values(projectGroups).length > 0 ? (
                                            Object.values(projectGroups).map((group, idx) => {
                                                const projectTotal = Object.values(group.hours).reduce((a, b) => a + b, 0);
                                                return (
                                                    <tr key={group.project._id || idx} className="hover:bg-blue-50/30 transition-colors group">
                                                        <td className="p-4 border-r border-slate-200 font-medium text-slate-700 sticky left-0 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm text-slate-800">{group.project.name || 'Unknown Project'}</span>
                                                                <span className="text-xs text-slate-400 font-normal">{group.project.client?.name || 'Internal'}</span>
                                                            </div>
                                                        </td>
                                                        {daysInMonth.map(day => {
                                                            const dateKey = format(day, 'yyyy-MM-dd');
                                                            const hours = group.hours[dateKey];
                                                            const logs = group.logs[dateKey] || [];
                                                            const isWeekend = ['Sat', 'Sun'].includes(format(day, 'EEE'));
                                                            const isRejected = logs.some(l => l.status === 'REJECTED');
                                                            const holiday = holidays.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateKey);

                                                            // Joining Date Check
                                                            const joiningDate = user?.joiningDate ? startOfDay(new Date(user.joiningDate)) : null;
                                                            const isBeforeJoining = joiningDate && day < joiningDate;
                                                            const isFutureDate = day > new Date();

                                                            return (
                                                                <td
                                                                    key={day.toString()}
                                                                    onClick={() => {
                                                                        if (isFutureDate) return;
                                                                        if (holiday) {
                                                                            toast.error(`Cannot edit on holiday: ${holiday.name}`);
                                                                            return;
                                                                        }
                                                                        if (isBeforeJoining) {
                                                                            toast.error('Cannot edit timesheet before joining date');
                                                                            return;
                                                                        }
                                                                        handleCellClick(group.project, day, logs);
                                                                    }}
                                                                    className={`p-1 border-r border-slate-200 text-center transition-colors ${holiday ? 'bg-green-50/30 cursor-not-allowed'
                                                                        : isBeforeJoining || isFutureDate ? 'bg-slate-50 cursor-not-allowed opacity-50'
                                                                            : `cursor-pointer hover:bg-blue-100 ${isWeekend ? 'bg-slate-50/30' : ''}`
                                                                        }`}
                                                                    title={isBeforeJoining ? 'Before Joining Date' : isFutureDate ? 'Future Date' : ''}
                                                                >
                                                                    {holiday ? (
                                                                        <div className="flex justify-center items-center h-full">
                                                                            <span className="text-[10px] font-bold text-green-300 select-none" title={holiday.name}>HOL</span>
                                                                        </div>
                                                                    ) : isBeforeJoining || isFutureDate ? (
                                                                        <span className="text-slate-200 text-[10px] select-none">{isFutureDate ? '-' : 'N/A'}</span>
                                                                    ) : hours ? (
                                                                        <div className="flex flex-col items-center justify-center group/cell relative">
                                                                            <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full font-bold text-xs shadow-sm transition-all ${isRejected
                                                                                ? 'bg-red-100 text-red-700 ring-1 ring-red-500 group-hover/cell:bg-red-600 group-hover/cell:text-white'
                                                                                : 'bg-blue-100 text-blue-700 group-hover/cell:bg-blue-600 group-hover/cell:text-white'
                                                                                }`}>
                                                                                {hours}
                                                                            </span>
                                                                            {logs.length > 1 && (
                                                                                <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-slate-200 text-xs">•</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="p-4 border-l border-slate-200 font-bold text-center bg-white sticky right-0 z-20 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                            <span className={projectTotal > 0 ? 'text-slate-800' : 'text-slate-300'}>{projectTotal.toFixed(1)}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={daysInMonth.length + 2} className="p-12 text-center text-slate-500 bg-slate-50/50">
                                                    <div className="flex flex-col items-center">
                                                        <Calendar size={48} className="text-slate-300 mb-3" />
                                                        <p className="font-medium">No timesheet entries found</p>
                                                        <p className="text-xs mt-1">Clock in or log work to see data here</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}

                                        {/* Daily Totals Row */}
                                        <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs uppercase text-slate-700">
                                            <td className="p-3 border-r border-slate-300 sticky left-0 bg-slate-100 z-20">Daily Total</td>
                                            {daysInMonth.map(day => {
                                                const total = getTotalPerDay(day);
                                                return (
                                                    <td key={day.toString()} className="p-1 border-r border-slate-300 text-center">
                                                        {total > 0 && (
                                                            <span className={`block py-1 rounded ${total > 9 ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-800'}`}>
                                                                {total.toFixed(1)}
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="p-4 border-l border-slate-200 font-bold text-center text-white bg-slate-600 sticky right-0 z-20 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                {daysInMonth.reduce((acc, day) => acc + getTotalPerDay(day), 0).toFixed(1)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {selectedCell && (
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                                <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg">{format(selectedCell.date, 'EEEE, d MMM yyyy')}</h3>
                                        <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">{selectedCell.project.name}</p>
                                    </div>
                                    <button onClick={() => setSelectedCell(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {/* Attendance Section */}
                                    <div className="p-4 bg-slate-50/50">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                                            <div className="flex items-center"><Clock size={12} className="mr-1" /> Attendance</div>
                                            {attendanceLogs.find(a => isSameDay(new Date(a.date), new Date(selectedCell.date))) ? (
                                                (timesheet?.status === 'DRAFT' || timesheet?.status === 'REJECTED') && (!targetUserId || user?.roles?.includes('Admin')) && canEditAttendance && (
                                                    <button
                                                        onClick={() => {
                                                            const log = attendanceLogs.find(a => isSameDay(new Date(a.date), new Date(selectedCell.date)));
                                                            setEntryToEdit({ _id: log._id, type: 'ATTENDANCE', ...log });
                                                            const fmtTime = (d) => d ? new Date(d).toTimeString().substring(0, 5) : '';
                                                            setEditStartTime(fmtTime(log.clockIn));
                                                            setEditEndTime(fmtTime(log.clockOut));
                                                        }}
                                                        className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                                                    >
                                                        Edit Time
                                                    </button>
                                                )
                                            ) : (
                                                (timesheet?.status === 'DRAFT' || timesheet?.status === 'REJECTED' || !timesheet) && (!targetUserId || user?.roles?.includes('Admin')) && canEditAttendance && selectedCell.date <= new Date() && (
                                                    <button
                                                        onClick={() => {
                                                            setEntryToEdit({ type: 'ATTENDANCE_CREATE', date: selectedCell.date });
                                                            setEditStartTime('09:00');
                                                            setEditEndTime('18:00');
                                                        }}
                                                        className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                                                    >
                                                        Add Attendance
                                                    </button>
                                                )
                                            )}
                                        </h4>

                                        {/* Inline Attendance Edit Logic */
                                            (entryToEdit && (entryToEdit.type === 'ATTENDANCE' || entryToEdit.type === 'ATTENDANCE_CREATE')) ? (
                                                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Check In</label>
                                                            <input
                                                                type="time"
                                                                value={editStartTime}
                                                                onChange={e => setEditStartTime(e.target.value)}
                                                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Check Out</label>
                                                            <input
                                                                type="time"
                                                                value={editEndTime}
                                                                onChange={e => setEditEndTime(e.target.value)}
                                                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <div className="text-xs text-slate-400 italic">
                                                            Modifying attendance will auto-update calculated hours.
                                                        </div>
                                                        <div className="flex space-x-2">
                                                            <button
                                                                onClick={() => setEntryToEdit(null)}
                                                                className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-medium text-xs bg-white border border-slate-200 rounded"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={submitEdit}
                                                                className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-xs shadow-sm"
                                                            >
                                                                Save Attendance
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                attendanceLogs.find(a => isSameDay(new Date(a.date), new Date(selectedCell.date))) ? (
                                                    (() => {
                                                        const log = attendanceLogs.find(a => isSameDay(new Date(a.date), new Date(selectedCell.date)));
                                                        const start = log.clockIn ? new Date(log.clockIn) : null;
                                                        const end = log.clockOut ? new Date(log.clockOut) : null;
                                                        const duration = start && end ? ((end - start) / 3600000).toFixed(2) : '0.0';

                                                        return (
                                                            <div className="flex flex-col space-y-2">
                                                                <div className="flex justify-between items-center text-sm bg-white p-2 rounded border border-slate-200 shadow-sm">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-slate-400 text-[10px] font-bold uppercase">Check In</span>
                                                                        <span className="font-mono font-medium text-emerald-600">
                                                                            {start ? format(start, 'h:mm:ss a') : '--:--'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-8 w-px bg-slate-100"></div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-slate-400 text-[10px] font-bold uppercase">Check Out</span>
                                                                        <span className="font-mono font-medium text-red-600">
                                                                            {end ? format(end, 'h:mm:ss a') : 'Active'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()
                                                ) : (
                                                    <div className="text-center py-4 space-y-3">
                                                        <div className="text-xs text-slate-400 italic">No attendance record found for this date.</div>
                                                        {(timesheet?.status === 'DRAFT' || timesheet?.status === 'REJECTED') && !targetUserId && canEditAttendance && (
                                                            <Button
                                                                onClick={() => {
                                                                    setEntryToEdit({ type: 'ATTENDANCE_CREATE', date: selectedCell.date });
                                                                    setEditStartTime('');
                                                                    setEditEndTime('');
                                                                }}
                                                                variant="secondary"
                                                                className="text-xs w-full justify-center"
                                                            >
                                                                <Clock size={14} className="mr-1" /> Add Attendance Manually
                                                            </Button>
                                                        )}
                                                    </div>
                                                )
                                            )}
                                    </div>

                                    {/* Add Work Log Section */}
                                    <div className="p-4 bg-white border-t border-slate-100">
                                        {!isAddingEntry ? (
                                            ((timesheet?.status === 'DRAFT' || timesheet?.status === 'REJECTED') && (!targetUserId || user?.roles?.includes('Admin'))) && (
                                                <Button
                                                    onClick={() => {
                                                        setIsAddingEntry(true);
                                                        setNewEntry(prev => ({ ...prev, date: selectedCell.date }));
                                                    }}
                                                    variant="ghost"
                                                    className="w-full flex items-center justify-center space-x-2 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm h-auto"
                                                >
                                                    <div className="bg-slate-200 rounded-full p-0.5">
                                                        <span className="block h-4 w-4 leading-3 text-center">+</span>
                                                    </div>
                                                    <span>Add Work Log</span>
                                                </Button>
                                            )
                                        ) : (
                                            <div className="bg-slate-50 border border-blue-100 rounded-lg p-4 animate-in fade-in zoom-in-95 duration-200 relative">
                                                <button
                                                    onClick={() => setIsAddingEntry(false)}
                                                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
                                                >
                                                    &times;
                                                </button>
                                                <h4 className="text-xs font-bold text-blue-600 uppercase mb-3">New Work Log</h4>

                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 mb-1">Project <span className="text-red-500">*</span></label>
                                                            <select
                                                                value={newEntry.projectId}
                                                                onChange={(e) => handleProjectChange(e.target.value)}
                                                                className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                                                            >
                                                                <option value="">Select Project</option>
                                                                {availableProjects.map(p => (
                                                                    <option key={p._id} value={p._id}>{p.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 mb-1">Module</label>
                                                            <select
                                                                value={newEntry.moduleId}
                                                                onChange={(e) => handleModuleChange(e.target.value)}
                                                                disabled={!newEntry.projectId}
                                                                className="w-full p-2 border border-slate-300 rounded text-sm bg-white disabled:bg-slate-100"
                                                            >
                                                                <option value="">Select Module</option>
                                                                {filteredModules.map(m => (
                                                                    <option key={m._id} value={m._id}>{m.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 mb-1">Task</label>
                                                            <select
                                                                value={newEntry.taskId}
                                                                onChange={(e) => setNewEntry(prev => ({ ...prev, taskId: e.target.value }))}
                                                                disabled={!newEntry.moduleId}
                                                                className="w-full p-2 border border-slate-300 rounded text-sm bg-white disabled:bg-slate-100"
                                                            >
                                                                <option value="">Select Task</option>
                                                                {filteredTasks.map(t => (
                                                                    <option key={t._id} value={t._id}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="flex space-x-2">
                                                            <div className="flex-1">
                                                                <label className="block text-xs font-bold text-slate-500 mb-1">Hours <span className="text-red-500">*</span></label>
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    value={newEntry.hours}
                                                                    onChange={(e) => setNewEntry(prev => ({ ...prev, hours: e.target.value }))}
                                                                    className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                                                                    min="0"
                                                                />
                                                            </div>
                                                            <div className="flex-1">
                                                                <label className="block text-xs font-bold text-slate-500 mb-1">Minutes</label>
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    value={newEntry.minutes}
                                                                    onChange={(e) => setNewEntry(prev => ({ ...prev, minutes: e.target.value }))}
                                                                    className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                                                                    min="0" max="59"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                                                        <textarea
                                                            value={newEntry.description}
                                                            onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
                                                            className="w-full p-2 border border-slate-300 rounded text-sm bg-white h-16 resize-none"
                                                            placeholder="What did you work on?"
                                                        />
                                                    </div>

                                                    <div className="flex justify-end pt-2">
                                                        <Button
                                                            onClick={submitNewEntry}
                                                            className="px-4 py-2 font-bold text-sm shadow-sm"
                                                        >
                                                            Add Log
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {selectedCell.logs.map((log, i) => (
                                        <div key={i} className="p-4 hover:bg-slate-50 transition-colors">
                                            {/* Header Always Visible */}
                                            <div className="flex flex-wrap items-center text-xs text-slate-500 mb-2">
                                                <span className="font-bold text-slate-700">{log.project?.name || 'Unknown Project'}</span>
                                                {log.module && (
                                                    <>
                                                        <span className="mx-1 text-slate-300">/</span>
                                                        <span>{log.module.name}</span>
                                                    </>
                                                )}
                                                {log.task && (
                                                    <>
                                                        <span className="mx-1 text-slate-300">/</span>
                                                        <span className="text-blue-600 font-medium">{log.task.name}</span>
                                                    </>
                                                )}
                                                {!log.task && log.taskName && (
                                                    <>
                                                        <span className="mx-1 text-slate-300">/</span>
                                                        <span className="text-blue-600 font-medium">{log.taskName}</span>
                                                    </>
                                                )}
                                            </div>

                                            {entryToEdit && entryToEdit._id === log._id ? (
                                                // INLINE EDIT FORM
                                                <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm animate-in fade-in zoom-in-95 duration-150">
                                                    <div className="grid grid-cols-4 gap-3 mb-3">
                                                        <div className="col-span-4 grid grid-cols-3 gap-2">
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project</label>
                                                                <select
                                                                    value={editProjectId}
                                                                    onChange={(e) => handleEditProjectChange(e.target.value)}
                                                                    className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                                                                >
                                                                    <option value="">Select Project</option>
                                                                    {availableProjects.map(p => (
                                                                        <option key={p._id} value={p._id}>{p.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Module</label>
                                                                <select
                                                                    value={editModuleId}
                                                                    onChange={(e) => handleEditModuleChange(e.target.value)}
                                                                    disabled={!editProjectId}
                                                                    className="w-full p-2 border border-slate-300 rounded text-sm bg-white disabled:bg-slate-100"
                                                                >
                                                                    <option value="">Select Module</option>
                                                                    {editFilteredModules.map(m => (
                                                                        <option key={m._id} value={m._id}>{m.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task</label>
                                                                <select
                                                                    value={editTaskId}
                                                                    onChange={(e) => setEditTaskId(e.target.value)}
                                                                    disabled={!editModuleId}
                                                                    className="w-full p-2 border border-slate-300 rounded text-sm bg-white disabled:bg-slate-100"
                                                                >
                                                                    <option value="">Select Task</option>
                                                                    {editFilteredTasks.map(t => (
                                                                        <option key={t._id} value={t._id}>{t.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="col-span-1 grid grid-cols-2 gap-1">
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hrs</label>
                                                                <input
                                                                    type="number"
                                                                    value={editHours}
                                                                    onChange={e => setEditHours(e.target.value)}
                                                                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 text-sm"
                                                                    min="0"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Min</label>
                                                                <input
                                                                    type="number"
                                                                    value={editMinutes}
                                                                    onChange={e => setEditMinutes(e.target.value)}
                                                                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 text-sm"
                                                                    min="0" max="59"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="col-span-3">
                                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                                            <textarea
                                                                value={editDescription}
                                                                onChange={e => setEditDescription(e.target.value)}
                                                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none h-[38px] min-h-[38px] resize-none text-sm leading-tight"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end space-x-2">
                                                        <Button
                                                            onClick={() => setEntryToEdit(null)}
                                                            variant="secondary"
                                                            className="px-3 py-1 text-xs font-medium"
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            onClick={submitEdit}
                                                            className="px-3 py-1 text-xs font-bold"
                                                        >
                                                            Save
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // READ ONLY VIEW
                                                <>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="font-semibold text-slate-700 text-sm flex-1 mr-4">
                                                            {log.status === 'REJECTED' && <div className="text-red-500 text-xs font-bold mb-1">Status: Rejected</div>}
                                                            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                                {log.description || 'No description provided.'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${log.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {log.hours}h
                                                            </span>
                                                            {(timesheet.status === 'DRAFT' || timesheet.status === 'REJECTED') && !targetUserId && (
                                                                <button
                                                                    onClick={() => { handleEditClick(log); }}
                                                                    className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Total for Day</span>
                                    <span className="font-bold text-slate-800 text-lg">
                                        {(selectedCell.logs.length > 0
                                            ? selectedCell.logs.reduce((acc, l) => acc + l.hours, 0)
                                            : (() => {
                                                const log = attendanceLogs.find(a => isSameDay(new Date(a.date), new Date(selectedCell.date)));
                                                if (!log) return 0;
                                                return log.duration ? (log.duration / 60) : (log.clockOut && log.clockIn ? (new Date(log.clockOut) - new Date(log.clockIn)) / 3600000 : 0);
                                            })()
                                        ).toFixed(1)} Hours
                                    </span>
                                </div>
                            </div>
                        )}



                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start space-x-3">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-blue-800">Automated Sync Active</h4>
                                <p className="text-sm text-blue-600 mt-1">
                                    Your "Attendance" hours are automatically populated from your Attendance (Clock In/Out) duration.
                                    You can manually add other project entries if enabled.
                                </p>
                            </div>
                        </div>




                    </>
                )}

                {activeTab === 'attendance_deprecated' && (
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center space-x-4">
                                <h3 className="font-bold text-slate-700">Attendance Log</h3>
                                <div className="flex items-center space-x-2 text-sm bg-slate-50 rounded-lg p-1 border border-slate-200">
                                    <button
                                        onClick={() => setViewDate(d => addDays(d, -30))}
                                        className="p-1 text-slate-500 hover:text-slate-700 hover:bg-white rounded shadow-sm transition-all"
                                        title="Previous Month"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="font-bold w-32 text-center text-slate-700">{format(viewDate, 'MMMM yyyy')}</span>
                                    <button
                                        onClick={() => setViewDate(d => addDays(d, 30))}
                                        className="p-1 text-slate-500 hover:text-slate-700 hover:bg-white rounded shadow-sm transition-all"
                                        title="Next Month"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={handleExportAttendance}
                                className="flex items-center space-x-2 text-sm text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors border border-green-200"
                            >
                                <Download size={14} />
                                <span>Download Report</span>
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Clock In</th>
                                        <th className="px-4 py-3">Clock Out</th>
                                        <th className="px-4 py-3">Duration</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) }).map(day => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const record = attendanceLogs.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);
                                        const holiday = holidays.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);
                                        const isSunday = day.getDay() === 0;
                                        const isFuture = day > new Date();

                                        // Status Logic
                                        let status = 'Absent';
                                        let statusColor = 'bg-red-100 text-red-700';

                                        // const joiningDate ... needs user details. 
                                        // For now assume active.

                                        if (isFuture) {
                                            status = '-';
                                            statusColor = 'bg-slate-100 text-slate-500';
                                        } else if (holiday) {
                                            status = holiday.name;
                                            statusColor = holiday.isOptional ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700';
                                        } else if (record) {
                                            status = 'Present';
                                            statusColor = 'bg-green-100 text-green-700';
                                        } else if (isSunday) {
                                            status = 'Weekoff';
                                            statusColor = 'bg-slate-100 text-slate-500';
                                        }

                                        return (
                                            <tr key={dateStr} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-700">{format(day, 'dd MMM yyyy')}</div>
                                                    <div className="text-xs text-slate-400">{format(day, 'EEEE')}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusColor}`}>
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-slate-600">
                                                    {record ? (record.clockInIST?.split(',')[1]?.trim() || new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : '-'}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-slate-600">
                                                    {record && record.clockOut ? (record.clockOutIST?.split(',')[1]?.trim() || new Date(record.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : '-'}
                                                </td>
                                                <td className="px-4 py-3 font-mono font-bold text-slate-700">
                                                    {record ? (
                                                        (() => {
                                                            const start = new Date(record.clockIn);
                                                            const end = record.clockOut ? new Date(record.clockOut) : new Date();
                                                            if (end < start) return '-';
                                                            const diff = Math.abs(end - start);
                                                            const h = Math.floor(diff / (1000 * 60 * 60));
                                                            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                            return `${h}h ${m}m`;
                                                        })()
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'attendance' && (
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">Attendance Log</h3>
                            <Button
                                onClick={handleExportAttendance}
                                className="flex items-center space-x-2 text-sm bg-green-600 hover:bg-green-700 active:bg-green-800 px-4 py-2 rounded-lg shadow-sm transition-all text-white border-transparent"
                            >
                                <Download size={14} />
                                <span className="font-semibold">Download Report</span>
                            </Button>
                        </div>
                        <div className="p-4">
                            <AttendanceCalendar
                                history={attendanceLogs}
                                onMonthChange={(y, m) => {
                                    const newD = new Date(y, m - 1, 1);
                                    if (format(newD, 'yyyy-MM') !== format(viewDate, 'yyyy-MM')) {
                                        setViewDate(newD);
                                    }
                                }}
                                user={viewUser}
                                holidays={holidays}
                                date={viewDate}
                            />
                        </div>
                    </div>
                )}


                {/* Reject Modal */}
                {
                    showRejectModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                                <div className="p-6">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">Reject Timesheet</h3>

                                    <div className="flex space-x-4 mb-4">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="rejectionType"
                                                value="FULL"
                                                checked={rejectionType === 'FULL'}
                                                onChange={(e) => setRejectionType(e.target.value)}
                                                className="text-red-600 focus:ring-red-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700">Reject Entire Month</span>
                                        </label>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="rejectionType"
                                                value="PARTIAL"
                                                checked={rejectionType === 'PARTIAL'}
                                                onChange={(e) => setRejectionType(e.target.value)}
                                                className="text-red-600 focus:ring-red-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700">Reject Specific Entries</span>
                                        </label>
                                    </div>

                                    {rejectionType === 'PARTIAL' && (
                                        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                                            <div className="text-xs text-slate-500 font-bold uppercase mb-2">Select entries to reject:</div>
                                            <div className="space-y-2">
                                                {selectedTimesheet?.entries?.map((entry, idx) => (
                                                    <label key={entry._id || idx} className="flex items-start space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={rejectedEntryIds.includes(entry._id)}
                                                            onChange={() => toggleEntryRejection(entry._id)}
                                                            className="mt-1 text-red-600 rounded focus:ring-red-500"
                                                        />
                                                        <div className="text-sm">
                                                            <div className="font-mono text-xs text-slate-500">
                                                                {format(new Date(entry.date), 'MMM d, yyyy')} - {entry.hours}h
                                                            </div>
                                                            <div className="text-slate-700 font-medium">
                                                                {entry.project?.name || 'Unknown Project'}
                                                            </div>
                                                            {entry.description && (
                                                                <div className="text-slate-500 text-xs truncate max-w-[250px]">{entry.description}</div>
                                                            )}
                                                        </div>
                                                    </label>
                                                ))}
                                                {(!selectedTimesheet?.entries || selectedTimesheet.entries.length === 0) && (
                                                    <div className="text-xs text-slate-400 italic">No entries found.</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <p className="text-sm text-slate-500 mb-2">Reason for rejection:</p>
                                    <textarea
                                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none h-24"
                                        placeholder={rejectionType === 'PARTIAL' ? "Reason for rejecting selected entries..." : "Reason for rejecting entire timesheet..."}
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                    ></textarea>

                                    <div className="flex justify-end space-x-3 mt-4">
                                        <Button
                                            onClick={() => setShowRejectModal(false)}
                                            variant="secondary"
                                            className="px-4 py-2 text-sm"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={submitRejection}
                                            variant="danger"
                                            className="px-4 py-2 text-sm"
                                            disabled={!rejectReason.trim() || (rejectionType === 'PARTIAL' && rejectedEntryIds.length === 0)}
                                        >
                                            {rejectionType === 'PARTIAL' ? `Reject ${rejectedEntryIds.length} Entries` : 'Reject Entire Month'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

            </div>
        </div >
    );
};

export default Timesheet;