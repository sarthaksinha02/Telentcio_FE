import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { Clock, Download, Briefcase, CheckSquare, Calendar, Edit2, Trash2, ChevronRight, ChevronLeft, Layers, Loader2, LogOut, CheckCircle, XCircle, Info, X } from 'lucide-react';
import Skeleton from '../components/Skeleton';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay, subDays, startOfDay } from 'date-fns';
import AttendanceCalendar from '../components/AttendanceCalendar';
import Button from '../components/Button';

const Attendance = () => {
    const { user, hasModule } = useAuth();
    const location = useLocation();
    const [status, setStatus] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [holidays, setHolidays] = useState([]);
    const [approvedLeaves, setApprovedLeaves] = useState([]);
    const [usersList, setUsersList] = useState(user?.directReports || []);
    const [selectedUserId, setSelectedUserId] = useState(user?._id);
    const [viewUser, setViewUser] = useState(user); // Hold complete profile of user being viewed

    // Task Integration
    const [assignedTasks, setAssignedTasks] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);
    const [showLogModal, setShowLogModal] = useState(false);
    const [logForm, setLogForm] = useState({ date: new Date().toISOString().split('T')[0], hours: '', minutes: '', description: '' });
    const [loggingTaskId, setLoggingTaskId] = useState(null);
    const [activeTab, setActiveTab] = useState('history'); // 'history', 'tasks', 'regularize'

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab && ['history', 'tasks', 'regularize'].includes(tab)) {
            setActiveTab(tab);
        }
        
        const qUserId = params.get('userId');
        if (qUserId) {
            setSelectedUserId(qUserId);
        } else {
            setSelectedUserId(user?._id);
        }
    }, [location, user]);
    const [expandedLogTaskId, setExpandedLogTaskId] = useState(null);
    const [editingLogId, setEditingLogId] = useState(null);

    // Location Error State
    const [loadingLocation, setLoadingLocation] = useState(false);

    // Regularization State
    const [showRegModal, setShowRegModal] = useState(false);
    const [regDate, setRegDate] = useState(null);
    const [regForm, setRegForm] = useState({
        type: 'BOTH',
        checkIn: '',
        checkOut: '',
        reason: ''
    });
    const [regularizationRequests, setRegularizationRequests] = useState([]);
    const [processingRegId, setProcessingRegId] = useState(null);

    const fetchApprovals = async () => {
        // Removed for move to Timesheet page
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (activeTab === 'regularize') {
            fetchRegularizations();
        }
    }, [activeTab]);

    // Fetch Users List for Dropdown (Admin/Manager)
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                if (user?.roles?.includes('Admin') || user?.role === 'Admin' || user?.permissions?.includes('attendance.view_all')) {
                    const res = await api.get('/admin/users');
                    setUsersList(res.data);
                } else if (user?.roles?.includes('Manager') || (user?.directReports && user.directReports.length > 0)) {
                    // If backend doesn't have /admin/users/team, we use directReports
                    try {
                        const res = await api.get('/admin/users/team');
                        setUsersList(res.data);
                    } catch (e) {
                        setUsersList(user.directReports || []);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch users list", error);
            }
        };

        if (user && (user.roles?.includes('Admin') || user.role === 'Admin' || user.roles?.includes('Manager') || user.directReports?.length > 0)) {
            fetchUsers();
        }
    }, [user]);

    // Fetch target user details when selectedUserId changes
    useEffect(() => {
        if (!selectedUserId) return;
        
        if (selectedUserId === user?._id) {
            setViewUser(user);
            return;
        }

        const fetchTargetUser = async () => {
            try {
                const res = await api.get(`/admin/users/${selectedUserId}`);
                setViewUser(res.data);
            } catch (error) {
                console.error("Failed to fetch target user details", error);
                // Fallback to finding in usersList if already there
                const found = usersList.find(u => u._id === selectedUserId);
                if (found) setViewUser(found);
            }
        };

        fetchTargetUser();
    }, [selectedUserId, usersList, user]);

    const fetchRegularizations = async () => {
        try {
            const res = await api.get('/attendance/regularizations');
            setRegularizationRequests(res.data);
        } catch (error) {
            console.error('Error fetching regularizations', error);
        }
    };

    const handleRegularize = (day, record) => {
        const targetDate = startOfDay(new Date(day));
        const today = startOfDay(new Date());

        const weeklyOffs = user?.company?.settings?.attendance?.weeklyOff || ['Saturday', 'Sunday'];
        const holidayDates = (holidays || []).map(h => format(new Date(h.date), 'yyyy-MM-dd'));

        // 1. Check if it's a future date
        if (targetDate > today) {
            toast.error('Cannot regularize for future dates.');
            return;
        }

        // 2. Check if it's a Weekly Off or Holiday
        const dayOfWeekName = format(targetDate, 'EEEE');
        const dateStr = format(targetDate, 'yyyy-MM-dd');
        if (weeklyOffs.includes(dayOfWeekName)) {
            toast.error(`Attendance regularization is not available for your weekly off day (${dayOfWeekName}).`);
            return;
        }
        if (holidayDates.includes(dateStr)) {
            toast.error('Attendance regularization is not available for holidays.');
            return;
        }

        // 3. Calculate 4 working days ago
        let workingDaysCount = 0;
        let checkDate = new Date(today);
        let maxLookback = 30; // Safety break

        while (workingDaysCount < 4 && maxLookback > 0) {
            checkDate = subDays(checkDate, 1);
            const dName = format(checkDate, 'EEEE');
            const dStr = format(checkDate, 'yyyy-MM-dd');
            
            const isWeeklyOff = weeklyOffs.includes(dName);
            const isHoliday = holidayDates.includes(dStr);

            if (!isWeeklyOff && !isHoliday) {
                workingDaysCount++;
            }
            maxLookback--;
        }

        const fourWorkingDaysAgo = startOfDay(checkDate);

        if (targetDate < fourWorkingDaysAgo) {
            toast.error('Attendance regularization is only allowed for the last 4 working days.');
            return;
        }

        setRegDate(day);
        setRegForm({
            type: 'BOTH',
            checkIn: record?.clockIn ? new Date(record.clockIn).toISOString().slice(11, 16) : '09:00',
            checkOut: record?.clockOut ? new Date(record.clockOut).toISOString().slice(11, 16) : '18:00',
            reason: ''
        });
        setShowRegModal(true);
    };

    const submitRegularization = async (e) => {
        e.preventDefault();
        try {
            const reqDate = new Date(regDate);
            const [inH, inM] = regForm.checkIn.split(':');
            const [outH, outM] = regForm.checkOut.split(':');

            const requestedClockIn = new Date(reqDate);
            requestedClockIn.setHours(parseInt(inH), parseInt(inM), 0);

            const requestedClockOut = new Date(reqDate);
            requestedClockOut.setHours(parseInt(outH), parseInt(outM), 0);

            await api.post('/attendance/regularize', {
                date: regDate,
                type: regForm.type,
                requestedClockIn,
                requestedClockOut,
                reason: regForm.reason
            });

            toast.success('Regularization request submitted');
            setShowRegModal(false);
            fetchRegularizations();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error submitting request');
        }
    };

    const processRegularization = async (id, status, rejectionReason = '') => {
        setProcessingRegId(id);
        try {
            await api.patch(`/attendance/regularize/${id}`, { status, rejectionReason });
            toast.success(`Request ${status.toLowerCase()}ed`);
            fetchRegularizations();
            const now = new Date();
            fetchMonthHistory(now.getFullYear(), now.getMonth() + 1);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error processing request');
        } finally {
            setProcessingRegId(null);
        }
    };

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
            // Fetch attendance history, holidays, and leaves for the same month in parallel
            const fetchHistoryProm = api.get(`/attendance/history?year=${year}&month=${month}&userId=${userId}`);
            const fetchHolidaysProm = api.get(`/holidays?year=${year}&month=${month}`);
            const fetchLeavesProm = hasModule('leaves') 
                ? api.get(`/leaves/requests?status=Approved&limit=0&userId=${userId}`)
                : Promise.resolve({ data: { data: [] } });

            const [historyRes, holidaysRes, leavesRes] = await Promise.all([
                fetchHistoryProm,
                fetchHolidaysProm,
                fetchLeavesProm
            ]);
            setHistory(historyRes.data);
            setHolidays(holidaysRes.data);
            setApprovedLeaves(leavesRes.data.data || []);
        } catch (error) {
            console.error('Error fetching month data', error);
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



    // useRef guard: prevents React StrictMode from firing the effect twice.
    // StrictMode intentionally mounts → unmounts → remounts in dev. The cleanup
    // function sets the ref to false, which cancels the AbortController and
    // prevents the second invocation from writing stale state.
    const didFetchRef = useRef(false);

    useEffect(() => {
        if (!user?._id) return;

        // StrictMode guard: skip if already fetched in this mount cycle
        if (didFetchRef.current) return;
        didFetchRef.current = true;

        const controller = new AbortController();
        const signal = controller.signal;
        const now = new Date();

        setSelectedUserId(user._id);

        const safe = (promise) => promise.catch(e => {
            if (e?.code === 'ERR_CANCELED' || e?.name === 'AbortError' || e?.name === 'CanceledError') return; // cancelled — ignore
            console.error(e);
        });

        const CACHE_KEY = `attendance_v1_${user._id}_${now.toISOString().slice(0, 10)}`;

        const readCache = () => {
            try {
                const raw = sessionStorage.getItem(CACHE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch { return null; }
        };

        const writeCache = (payload) => {
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch { }
        };

        const buildFingerprint = (payload) => {
            // Simple string fingerprint based on current status and recent logs
            const statusStr = payload.status ? `${payload.status.status}|${payload.status.clockInIST}|${payload.status.clockOutIST}` : 'none';
            const logsStr = (payload.recentLogs || []).map(l => `${l._id}|${l.hours}`).join(',');
            const historyStr = (payload.history || []).length;
            const leavesStr = (payload.approvedLeaves || []).length;
            return `${statusStr}::${logsStr}::H${historyStr}::L${leavesStr}`;
        };

        const applyData = (payload) => {
            if (payload.status !== undefined) setStatus(payload.status);
            if (payload.recentLogs) setRecentLogs(payload.recentLogs);
            if (payload.history) setHistory(payload.history);
            if (payload.holidays) setHolidays(payload.holidays);
            if (payload.approvedLeaves) setApprovedLeaves(payload.approvedLeaves);
        };

        // 1. Try Cache First (Instant UI)
        const cached = readCache();
        if (cached?.data) {
            applyData(cached.data);
            setLoading(false);
        }

        // 2. Fetch Fresh Data (Background)
        const fetchStatus = safe(api.get('/attendance/today', { signal }).then(r => r.data));
        const fetchLogs = hasModule('projectManagement')
            ? safe(api.get('/projects/worklogs?limit=4', { signal }).then(r => r.data))
            : Promise.resolve([]);
        const fetchHistory = safe(api.get(`/attendance/history?year=${now.getFullYear()}&month=${now.getMonth() + 1}&userId=${user._id}`, { signal }).then(r => r.data));
        const fetchHolidays = safe(api.get(`/holidays?year=${now.getFullYear()}`, { signal }).then(r => r.data));
        const fetchLeaves = hasModule('leaves')
            ? safe(api.get(`/leaves/requests?status=Approved&limit=0&userId=${user._id}`, { signal }).then(r => r.data))
            : Promise.resolve({ data: [] });

        Promise.all([
            fetchStatus,
            fetchLogs,
            fetchHistory,
            fetchHolidays,
            fetchLeaves
        ]).then(([statusData, logsData, historyData, holidaysData, leavesData]) => {
            if (signal.aborted) return;

            const freshData = {
                status: statusData,
                recentLogs: logsData || [],
                history: historyData || [],
                holidays: holidaysData || [],
                approvedLeaves: leavesData?.data || []
            };

            const freshFingerprint = buildFingerprint(freshData);

            // 3. Update React only if data changed
            if (!cached || cached.fingerprint !== freshFingerprint) {
                applyData(freshData);
                writeCache({ data: freshData, fingerprint: freshFingerprint });
            }
        }).finally(() => {
            if (!signal.aborted) setLoading(false);
        });

        return () => {
            // Cleanup: cancel in-flight requests if component unmounts or effect re-runs
            controller.abort();
            didFetchRef.current = false; // reset so a real re-mount (logout→login) works
        };
    }, [user?._id]);

    // Refetch history only when Admin/Manager switches to a different user
    useEffect(() => {
        if (!selectedUserId || !user?._id) return;
        if (selectedUserId === user._id) return; // own data already fetched above

        const controller = new AbortController();
        const now = new Date();
        api.get(`/attendance/history?year=${now.getFullYear()}&month=${now.getMonth() + 1}&userId=${selectedUserId}`, { signal: controller.signal })
            .then(res => setHistory(res.data))
            .catch(e => { if (e?.code !== 'ERR_CANCELED' && e?.name !== 'CanceledError') console.error(e); });

        return () => controller.abort();
    }, [selectedUserId]);

    // Fetch Tasks only when the 'tasks' tab is clicked
    const tasksFetchedRef = useRef(false);
    useEffect(() => {
        if (activeTab === 'tasks' && user?._id && hasModule('projectManagement') && !tasksFetchedRef.current) {
            tasksFetchedRef.current = true;
            api.get(`/projects/tasks?assignees=${user._id}`)
                .then(r => {
                    const active = r.data.filter(t => t.module?.status !== 'COMPLETED' && t.status !== 'COMPLETED');
                    setAssignedTasks(active);
                })
                .catch(e => {
                    console.error('tasks fetch error', e);
                    tasksFetchedRef.current = false; // allow retry on fail
                });
        }
    }, [activeTab, user?._id]);
    
    // Fetch Regularizations only when that tab is clicked
    useEffect(() => {
        if (activeTab === 'regularize' && user?._id) {
            fetchRegularizations();
        }
    }, [activeTab, user?._id]);

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
        const attSettings = user?.company?.settings?.attendance || {};
        const isLocationRequired = attSettings.requireLocationCheckIn || attSettings.locationCheck;

        const executeClockIn = async (locationData = null) => {
            setLoadingLocation(true);
            try {
                const payload = locationData ? { location: locationData } : {};
                await api.post('/attendance/clock-in', payload);
                toast.success('Clocked In Successfully');
                await fetchTodayStatus();
                const now = new Date();
                fetchMonthHistory(now.getFullYear(), now.getMonth() + 1);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Error Clocking In');
            } finally {
                setLoadingLocation(false);
            }
        };

        if (!isLocationRequired) {
            // If location is not strictly required, try to get it best-effort but don't block
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        executeClockIn({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            accuracy: position.coords.accuracy
                        });
                    },
                    (error) => {
                        console.log('Location access denied or failed, proceeding with default clock-in');
                        executeClockIn();
                    },
                    { timeout: 5000 }
                );
            } else {
                executeClockIn();
            }
            return;
        }

        // Strictly required flow
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser. Please use a modern browser.');
            return;
        }

        setLoadingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const isCached = (Date.now() - position.timestamp) > 60000;
                if (!position.coords.accuracy || position.coords.accuracy > 300 || isCached) {
                    toast.error('Please Enable location for accurate verification');
                    setLoadingLocation(false);
                    return;
                }

                executeClockIn({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                }).catch(err => {
                    console.error("Unhandled error during clock in:", err);
                    toast.error("An unexpected error occurred during clock in.");
                    setLoadingLocation(false);
                });
            },
            (error) => {
                toast.error('Please Enable location to proceed with clock-in (Required by your company).');
                setLoadingLocation(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    const handleClockOut = async () => {
        const attSettings = user?.company?.settings?.attendance || {};
        const isLocationRequired = attSettings.requireLocationCheckOut || attSettings.locationCheck;

        const executeClockOut = async (locationData = null) => {
            setLoadingLocation(true);
            try {
                const payload = locationData ? { location: locationData } : {};
                await api.post('/attendance/clock-out', payload);
                toast.success('Clocked Out Successfully');
                fetchTodayStatus();
                const now = new Date();
                fetchMonthHistory(now.getFullYear(), now.getMonth() + 1);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Error Clocking Out');
            } finally {
                setLoadingLocation(false);
            }
        };

        toast((t) => (
            <div className={`
                ${t.visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
                transition-all duration-300 pointer-events-auto
                bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-5 min-w-[320px]
            `}>
                <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                        <LogOut size={24} />
                    </div>
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Confirm Checkout?</h3>
                        <p className="text-xs text-slate-500 font-medium">Are you sure you want to end your session?</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-1 py-2.5 px-4 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all active:scale-95 border border-slate-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            
                            if (!isLocationRequired) {
                                if (navigator.geolocation) {
                                    navigator.geolocation.getCurrentPosition(
                                        (position) => executeClockOut({
                                            lat: position.coords.latitude,
                                            lng: position.coords.longitude,
                                            accuracy: position.coords.accuracy
                                        }),
                                        () => executeClockOut(),
                                        { timeout: 5000 }
                                    );
                                } else {
                                    executeClockOut();
                                }
                                return;
                            }

                            if (!navigator.geolocation) {
                                toast.error('Geolocation is not supported by your browser.');
                                return;
                            }

                            setLoadingLocation(true);
                            navigator.geolocation.getCurrentPosition(
                                (position) => {
                                    const isCached = (Date.now() - position.timestamp) > 60000;
                                    if (!position.coords.accuracy || position.coords.accuracy > 300 || isCached) {
                                        toast.error('Please Enable location for accurate verification');
                                        setLoadingLocation(false);
                                        return;
                                    }

                                    executeClockOut({
                                        lat: position.coords.latitude,
                                        lng: position.coords.longitude,
                                        accuracy: position.coords.accuracy
                                    }).catch(err => {
                                        console.error("Unhandled error during clock out:", err);
                                        toast.error("An unexpected error occurred during clock out.");
                                        setLoadingLocation(false);
                                    });
                                },
                                (error) => {
                                    toast.error('Please Enable location to proceed with checkout (Required by your company).');
                                    setLoadingLocation(false);
                                },
                                {
                                    enableHighAccuracy: true,
                                    timeout: 10000,
                                    maximumAge: 0
                                }
                            );
                        }}
                        className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 rounded-xl transition-all active:scale-95"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        ), { duration: 10000, position: 'top-center', style: { padding: 0, background: 'transparent', boxShadow: 'none', border: 'none' } });
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
                // SPLIT
                const total = parseFloat(existingLog.hours) || 0;
                const h = Math.floor(total);
                const m = Math.round((total - h) * 60);

                setLogForm({
                    date: new Date(existingLog.date).toISOString().split('T')[0],
                    hours: h,
                    minutes: m,
                    description: existingLog.description || ''
                });
            } else {
                setEditingLogId(null);
                setLogForm({ date: new Date().toISOString().split('T')[0], hours: '', minutes: '', description: '' });
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
            const h = parseFloat(logForm.hours) || 0;
            const m = parseFloat(logForm.minutes) || 0;
            const totalHours = h + (m / 60);

            if (totalHours <= 0) {
                toast.error("Please enter valid time");
                return;
            }

            const payload = { ...logForm, hours: totalHours.toFixed(2) };

            if (editingLogId) {
                await api.put(`/projects/worklogs/${editingLogId}`, payload);
                toast.success('Work Log Updated');
            } else {
                await api.post(`/projects/tasks/${loggingTaskId}/log`, payload);
                toast.success('Work Logged Successfully');
            }

            setExpandedLogTaskId(null);
            setLoggingTaskId(null);
            setEditingLogId(null);
            setLogForm({ date: new Date().toISOString().split('T')[0], hours: '', minutes: '', description: '' });
            fetchRecentLogs(); // Refresh logs
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to log work');
        }
    };

    const formatTime = (dateString, istString) => {
        if (istString && istString.includes(',')) {
            const timePart = istString.split(',')[1]?.trim() || '';
            return timePart.toLowerCase();
        }
        if (!dateString) return '--:--';
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).toLowerCase();
    };

    const calculateDuration = (start, end, recordDate) => {
        if (!start) return '--';
        const startTime = new Date(start);
        let endTime;

        if (end) {
            endTime = new Date(end);
        } else {
            const today = new Date();
            const rDate = recordDate ? new Date(recordDate) : today;
            const isToday = rDate.toDateString() === today.toDateString();

            if (isToday) {
                endTime = currentTime; // Use living timer for today
            } else {
                endTime = new Date(rDate);
                endTime.setHours(23, 59, 59, 999);
            }
        }

        // Prevent negative duration
        if (endTime < startTime) return '0h 0m 0s';

        const diffString = Math.abs(endTime - startTime);
        const hours = Math.floor(diffString / (1000 * 60 * 60));
        const minutes = Math.floor((diffString % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffString % (1000 * 60)) / 1000);

        return `${hours}h ${minutes}m ${seconds}s`;
    };


    const handleExportMonthlyTimesheet = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Monthly Timesheet');

        // Determine user to export
        const exportUser = viewUser || user;

        const referenceDate = history.length > 0 ? new Date(history[0].date) : new Date();
        const start = startOfMonth(referenceDate);
        const end = endOfMonth(referenceDate);
        const days = eachDayOfInterval({ start, end });
        const standardHours = user?.company?.settings?.attendance?.workingHours || 8;

        // --- STYLING ---
        const blueHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; 
        const tableHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
        const weekendFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
        const borderStyle = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        // 1. TOP HEADER
        sheet.mergeCells('A1:E1');
        const topHeader = sheet.getCell('A1');
        topHeader.value = 'Monthly timesheet';
        topHeader.fill = blueHeaderFill;
        topHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF366092' } };

        // 2. EMPLOYEE & SUPERVISOR INFO
        sheet.getRow(2).height = 20;
        sheet.getCell('A2').value = 'EMPLOYEE:';
        sheet.getCell('A2').font = { bold: true, size: 10 };
        sheet.mergeCells('B2:C2');
        const empCell = sheet.getCell('B2');
        empCell.value = `${exportUser.firstName} ${exportUser.lastName || ''}`;
        empCell.font = { name: 'Calibri', size: 10 };
        empCell.border = { bottom: { style: 'dotted' } };

        sheet.getCell('D2').value = 'START OF MONTH';
        sheet.getCell('D2').font = { bold: true, size: 10 };
        const startMonthCell = sheet.getCell('E2');
        startMonthCell.value = format(start, 'd/MM/yyyy');
        startMonthCell.font = { name: 'Calibri', size: 10, bold: true };
        startMonthCell.alignment = { horizontal: 'right' };
        startMonthCell.border = { bottom: { style: 'dotted' } };

        sheet.getRow(3).height = 20;
        sheet.getCell('A3').value = 'SUPERVISOR:';
        sheet.getCell('A3').font = { bold: true, size: 10 };
        sheet.mergeCells('B3:C3');
        const mgrs = exportUser.reportingManagers || [];
        const supCell = sheet.getCell('B3');
        supCell.value = mgrs.length > 0 ? mgrs.map(m => `${m.firstName} ${m.lastName}`).join(', ') : 'N/A';
        supCell.font = { name: 'Calibri', size: 10 };
        supCell.border = { bottom: { style: 'dotted' } };

        sheet.getCell('D3').value = 'REGULAR HRS';
        sheet.getCell('D3').font = { bold: true, size: 10 };
        const hrsCell = sheet.getCell('E3');
        hrsCell.value = parseFloat(standardHours).toFixed(2);
        hrsCell.font = { name: 'Calibri', size: 10, bold: true };
        hrsCell.alignment = { horizontal: 'right' };
        hrsCell.border = { bottom: { style: 'dotted' } };

        // 3. TABLE HEADER (Now starts at row 5 after a blank row 4)
        sheet.getRow(4).height = 15; // Blank Row

        sheet.getRow(5).height = 20;
        sheet.mergeCells('B5:C5'); // Merge B and C for Attendance header
        const hDate = sheet.getCell('A5');
        const hAtt = sheet.getCell('B5');
        hDate.value = 'DATE';
        hAtt.value = 'Attendance';
        [hDate, hAtt].forEach(c => {
            c.fill = tableHeaderFill;
            c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            c.alignment = { horizontal: 'center' };
            c.border = borderStyle;
        });

        // 4. DATA ROWS (Now starts at row 6)
        let currentRow = 6;
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const record = history.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);
            const weeklyOffDays = user?.company?.settings?.attendance?.weeklyOff || ['Sunday'];
            const dayName = format(day, 'EEEE');
            const isWeekendDay = weeklyOffDays.includes(dayName);
            const holiday = holidays.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);

            const row = sheet.getRow(currentRow);
            const cDate = row.getCell(1);
            sheet.mergeCells(`B${currentRow}:C${currentRow}`); // Merge B and C for Status
            const cStatus = row.getCell(2);

            cDate.value = format(day, 'EEE, d MMM');
            
            const leave = approvedLeaves.find(l => {
                const lStart = new Date(l.startDate);
                const lEnd = new Date(l.endDate);
                lStart.setHours(0,0,0,0);
                lEnd.setHours(23,59,59,999);
                return day >= lStart && day <= lEnd;
            });

            let status = '';
            if (leave) {
                status = 'Leave';
            } else if (holiday) {
                status = holiday.name;
            } else if (isWeekendDay) {
                status = 'Weekend';
            } else if (record) {
                status = 'P';
            } else if (day <= new Date()) {
                status = 'Absent';
            }

            cStatus.value = status;

            // Styling
            [cDate, cStatus].forEach(c => {
                c.border = borderStyle;
                c.font = { name: 'Calibri', size: 10 };
                c.alignment = { horizontal: 'center' };
                if (isWeekendDay) c.fill = weekendFill;
            });

            currentRow++;
        });

        // 5. FOOTER (Aligned with columns D and E)
        sheet.getRow(currentRow).height = 25;
        const footerLabel = sheet.getCell(`D${currentRow}`);
        footerLabel.value = 'Total Days';
        footerLabel.font = { bold: true };
        footerLabel.alignment = { horizontal: 'right', vertical: 'middle' };

        const footerValue = sheet.getCell(`E${currentRow}`);
        footerValue.value = days.length;
        footerValue.font = { bold: true };
        footerValue.alignment = { horizontal: 'right', vertical: 'middle' };
        footerValue.border = { bottom: { style: 'double', color: { argb: 'FF4F81BD' } } };

        // Column Widths
        sheet.getColumn(1).width = 25; // A
        sheet.getColumn(2).width = 15; // B (part of merged B/C for name, but C is narrower)
        sheet.getColumn(3).width = 15; // C
        sheet.getColumn(4).width = 20; // D (Labels like START OF MONTH)
        sheet.getColumn(5).width = 15; // E (Values)

        // Save
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Monthly_Timesheet_${format(start, 'MMMM_yyyy')}_${exportUser.firstName}.xlsx`);
    };

    const handleExportAttendance = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Attendance Report');

        // Determine user to export
        const exportUser = viewUser || user;

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
            const weeklyOffDays = user?.company?.settings?.attendance?.weeklyOff || ['Sunday'];
            const dayName = format(day, 'EEEE');
            const isWeeklyOff = weeklyOffDays.includes(dayName);
            const isFuture = day > new Date();

            let status = 'Absent';
            let rowColor = 'FFF2DCDB'; // Red by default

            const joiningDate = exportUser.joiningDate ? new Date(exportUser.joiningDate) : null;
            // Normalize joining date to start of day for comparison
            if (joiningDate) joiningDate.setHours(0, 0, 0, 0);

            const holiday = holidays.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);

            const leave = approvedLeaves.find(l => {
                const lStart = new Date(l.startDate);
                const lEnd = new Date(l.endDate);
                lStart.setHours(0,0,0,0);
                lEnd.setHours(23,59,59,999);
                return day >= lStart && day <= lEnd;
            });

            if (joiningDate && day < joiningDate) {
                status = 'Not Applicable';
                rowColor = 'FFFFFFFF'; // White
            } else if (isFuture) {
                status = '-';
                rowColor = 'FFFFFFFF'; // White
            } else if (leave) {
                status = `Leave (${leave.leaveType})`;
                rowColor = 'FFE1BEE7'; // Light Purple/Indigo
            } else if (holiday) {
                status = holiday.name;
                rowColor = holiday.isOptional ? 'FFFFE0B2' : 'FFD1F2EB'; // Light Orange for Optional, Light Teal for Regular
            } else if (record) {
                status = 'Present';
                rowColor = 'FFEBF1DE'; // Green
            } else if (isWeeklyOff) {
                status = 'Weekoff';
                rowColor = 'FFF2F2F2'; // Gray
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
                        durationRow[colKey] = calculateDuration(record.clockIn, record.clockOut, colDate);
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
        <div className="h-[calc(100vh-64px)] w-full bg-slate-100 font-sans flex flex-col overflow-hidden">
            <div className="flex-none px-4 pt-4 md:px-6 md:pt-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="hidden sm:block">
                        <Skeleton className="h-10 w-32 mb-1" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-hidden px-4 pb-4 md:px-6 md:pb-6">
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full">
                    <div className="xl:col-span-1 space-y-6 overflow-y-auto pr-2 h-full custom-scrollbar pb-2">
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
                    <div className="xl:col-span-3 flex flex-col h-full overflow-hidden">
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 flex-1 overflow-y-auto">
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
        <div className="h-[calc(100vh-64px)] w-full bg-slate-100 font-sans flex flex-col overflow-hidden">
            {/* Header - Fixed */}
            <div className="flex-none px-4 pt-4 md:px-6 md:pt-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
                        <p className="text-sm text-slate-500">
                            {selectedUserId === user?._id ? 'Track and manage your work hours' : `Viewing ${viewUser?.firstName || ''} ${viewUser?.lastName || ''}'s attendance`}
                        </p>
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
                                <div className="flex items-center space-x-2">
                                    {(user?.company?.settings?.attendance?.exportFormat === 'Monthly Timesheet') ? (
                                        <Button
                                            onClick={handleExportMonthlyTimesheet}
                                            variants="outline"
                                            className="p-2 border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-300"
                                            title="Download Monthly Timesheet"
                                        >
                                            <Calendar size={20} />
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={handleExportAttendance}
                                            variants="outline"
                                            className="p-2 border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300"
                                            title="Download Personal Report"
                                        >
                                            <Download size={20} />
                                        </Button>
                                    )}
                                </div>
                            )}
                    </div>
                </div>
            </div>


            {/* Main Content - Flex/Grid taking remaining height */}
            <div className="flex-1 overflow-hidden px-4 pb-4 md:px-6 md:pb-6">
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full">

                    {/* Widget Column - Scrollable */}
                    <div className="xl:col-span-1 space-y-6 overflow-y-auto pr-2 h-full custom-scrollbar pb-2">
                        {/* Clock Widget */}
                        <div className="zoho-card p-6 flex flex-col items-center justify-center text-center border-t-4 border-t-blue-500">
                            <div className="mb-6 relative group">
                                <div className={`h-36 w-36 rounded-full flex items-center justify-center border-[6px] transition-all duration-500 ${isClockedIn ? 'border-[#08B87B] bg-[#EAF7F2] shadow-sm' : 'border-slate-200 bg-white shadow-sm'}`}>
                                    <Clock size={48} className={isClockedIn ? 'text-[#08B87B]' : 'text-slate-400'} />
                                </div>
                                {isClockedIn && (
                                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-[#08B87B] text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                                        ACTIVE
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1 mb-6">
                                <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Status</div>
                                <div className={`text-xl font-bold ${isClockedIn ? 'text-[#08B87B]' : isClockedOut ? 'text-slate-500' : 'text-slate-700'}`}>
                                    {isClockedIn ? 'Clocked In' : isClockedOut ? 'Shift Ended' : 'Not Started'}
                                </div>
                            </div>

                            <div className="w-full space-y-3">
                                {!isClockedIn && !isClockedOut && (
                                    <button
                                        onClick={handleClockIn}
                                        disabled={loadingLocation}
                                        className={`w-full flex items-center justify-center gap-2 py-3 bg-[#1B5FF3] text-white font-bold rounded-[10px] shadow-[0_4px_16px_rgba(27,95,243,0.35)] hover:bg-blue-700 active:scale-95 transition-all text-[15px] tracking-wide ${loadingLocation ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {loadingLocation ? (
                                            <>
                                                <Loader2 className="animate-spin" size={18} />
                                                <span>Loading...</span>
                                            </>
                                        ) : (
                                            <span>Check In</span>
                                        )}
                                    </button>
                                )}

                                {isClockedIn && (
                                    <button
                                        onClick={handleClockOut}
                                        disabled={loadingLocation}
                                        className={`w-full flex items-center justify-center gap-2 py-3 bg-[#e60000] text-white font-bold rounded-[10px] shadow-[0_4px_16px_rgba(230,0,0,0.35)] hover:bg-[#cc0000] active:scale-95 transition-all text-[15px] tracking-wide ${loadingLocation ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {loadingLocation ? (
                                            <>
                                                <Loader2 className="animate-spin" size={18} />
                                                <span>Fetching Location...</span>
                                            </>
                                        ) : (
                                            <span>Check Out</span>
                                        )}
                                    </button>
                                )}

                                {isClockedOut && (
                                    <div className="w-full py-2.5 bg-slate-100 text-slate-500 rounded font-medium border border-slate-200 text-sm text-center">
                                        Output Logged
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 w-full bg-slate-50 rounded border border-slate-100 divide-y divide-slate-100">
                                <div className="flex justify-between p-3 text-sm flex-col sm:flex-row gap-1 sm:gap-0">
                                    <span className="text-slate-500">In Time</span>
                                    <span className="font-mono font-medium text-slate-700 sm:text-right">
                                        {formatTime(status?.clockIn, status?.clockInIST)}
                                    </span>
                                </div>
                                <div className="flex justify-between p-3 text-sm flex-col sm:flex-row gap-1 sm:gap-0">
                                    <span className="text-slate-500">Out Time</span>
                                    <span className="font-mono font-medium text-slate-700 sm:text-right">
                                        {formatTime(status?.clockOut, status?.clockOutIST)}
                                    </span>
                                </div>
                                <div className="flex justify-between p-3 text-sm bg-slate-100/30 flex-col sm:flex-row gap-1 sm:gap-0 rounded-b">
                                    <span className="font-bold text-slate-700">Total Hours</span>
                                    <span className="font-mono font-bold text-[#1B5FF3] sm:text-right">
                                        {status?.clockIn ? calculateDuration(status.clockIn, status.clockOut) : '--'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {hasModule('projectManagement') && (
                            <div className="zoho-card p-5 mt-6">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Recent Activity</h4>
                                {recentLogs.length > 0 ? (
                                    <div className="space-y-4">
                                        {recentLogs.map(log => (
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
                        )}

                        {!isClockedIn && hasModule('projectManagement') && (
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

                    {/* Main Content Column with Tabs - Flex Column */}
                    <div className="xl:col-span-3 flex flex-col h-full overflow-hidden">
                        {/* Tab Navigation - Fixed */}
                        <div className="flex-none flex border-b border-slate-200 bg-white rounded-t-lg px-4 pt-2 mb-0">
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                <Calendar size={16} /> Attendance History
                            </button>
                            <button
                                onClick={() => setActiveTab('regularize')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'regularize' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                <Clock size={16} /> Regularization Requests
                            </button>
                            {hasModule('projectManagement') && (
                                <button
                                    onClick={() => setActiveTab('tasks')}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tasks' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Briefcase size={16} /> Assigned to Me {assignedTasks.length > 0 && <span className="bg-slate-100 text-slate-600 text-xs py-0.5 px-2 rounded-full ml-1">{assignedTasks.length}</span>}
                                </button>
                            )}
                        </div>

                        {/* Scrollable Content Area */}
                        <div className="flex-1 bg-white rounded-b-lg shadow-sm border border-t-0 border-slate-200 p-6 overflow-y-auto custom-scrollbar relative">
                            {activeTab === 'history' ? (
                                <AttendanceCalendar 
                                    history={history} 
                                    onMonthChange={fetchMonthHistory} 
                                    user={user} 
                                    holidays={holidays} 
                                    approvedLeaves={approvedLeaves} 
                                    onRegularize={handleRegularize}
                                />
                            ) : activeTab === 'regularize' ? (
                                <RegularizationRequestsView 
                                    requests={regularizationRequests} 
                                    onProcess={processRegularization}
                                    processingId={processingRegId}
                                    currentUser={user}
                                />
                            ) : (
                                <AssignedTasksView
                                    assignedTasks={assignedTasks}
                                    isClockedIn={isClockedIn}
                                    onLogWork={handleLogWork}
                                    logForm={logForm}
                                    setLogForm={setLogForm}
                                    expandedLogTaskId={expandedLogTaskId}
                                    setExpandedLogTaskId={setExpandedLogTaskId} // Using this to track "selected task" for logging
                                    recentLogs={recentLogs}
                                    onDeleteLog={handleDeleteLog}
                                    toggleLogForm={toggleLogForm}
                                    editingLogId={editingLogId}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Regularization Modal */}
            {showRegModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Request Regularization</h3>
                                <p className="text-xs text-slate-500 font-medium">{regDate ? format(new Date(regDate), 'MMMM dd, yyyy') : ''}</p>
                            </div>
                            <button onClick={() => setShowRegModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        
                        <form onSubmit={submitRegularization} className="p-6 space-y-5">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Regularize For</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['IN', 'OUT', 'BOTH'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setRegForm({ ...regForm, type })}
                                            className={`py-2 text-xs font-semibold rounded-lg border transition-all ${regForm.type === type ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {(regForm.type === 'IN' || regForm.type === 'BOTH') && (
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Check In Time</label>
                                        <input
                                            type="time"
                                            required
                                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                            value={regForm.checkIn}
                                            onChange={(e) => setRegForm({ ...regForm, checkIn: e.target.value })}
                                        />
                                    </div>
                                )}
                                {(regForm.type === 'OUT' || regForm.type === 'BOTH') && (
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Check Out Time</label>
                                        <input
                                            type="time"
                                            required
                                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                            value={regForm.checkOut}
                                            onChange={(e) => setRegForm({ ...regForm, checkOut: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Reason for Regularization</label>
                                <textarea
                                    required
                                    rows="3"
                                    placeholder="Please provide a valid reason..."
                                    className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none resize-none"
                                    value={regForm.reason}
                                    onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all"
                                >
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const AssignedTasksView = ({
    assignedTasks,
    isClockedIn,
    onLogWork,
    logForm,
    setLogForm,
    expandedLogTaskId,
    setExpandedLogTaskId,
    recentLogs,
    onDeleteLog,
    toggleLogForm,
    editingLogId
}) => {
    // 1. Group Tasks by Project -> Module
    const groupedData = useMemo(() => {
        const projects = {};
        assignedTasks.forEach(task => {
            const projectId = task.module?.project?._id || 'unknown';
            const projectName = task.module?.project?.name || 'Unknown Project';
            const moduleId = task.module?._id || 'unknown';
            const moduleName = task.module?.name || 'Unknown Module';

            if (!projects[projectId]) {
                projects[projectId] = { id: projectId, name: projectName, modules: {} };
            }
            if (!projects[projectId].modules[moduleId]) {
                projects[projectId].modules[moduleId] = { id: moduleId, name: moduleName, tasks: [] };
            }
            projects[projectId].modules[moduleId].tasks.push(task);
        });

        return Object.values(projects).map(p => ({
            ...p,
            modules: Object.values(p.modules)
        }));
    }, [assignedTasks]);

    // 2. Selection State
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [selectedModuleId, setSelectedModuleId] = useState(null);

    // Derived Data for Views
    const selectedProject = selectedProjectId ? groupedData.find(p => p.id === selectedProjectId) : null;
    const selectedModule = (selectedProject && selectedModuleId) ? selectedProject.modules.find(m => m.id === selectedModuleId) : null;

    // Helper
    const getTodayLogForTask = (taskId) => {
        const today = new Date().toISOString().split('T')[0];
        return recentLogs.find(log =>
            log.task &&
            log.task._id === taskId &&
            new Date(log.date).toISOString().split('T')[0] === today
        );
    };

    // --- VIEW 1: PROJECTS GRID ---
    if (!selectedProjectId) {
        return (
            <div className="h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10 py-2 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">My Projects</h3>
                    <span className="text-xs text-slate-500">{groupedData.length} Projects</span>
                </div>

                {groupedData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groupedData.map(project => (
                            <button
                                key={project.id}
                                onClick={() => setSelectedProjectId(project.id)}
                                className="flex items-center p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
                            >
                                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mr-4 group-hover:scale-110 transition-transform">
                                    <Briefcase size={20} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{project.name}</h4>
                                    <p className="text-xs text-slate-500">{project.modules.length} Modules • {project.modules.reduce((acc, m) => acc + m.tasks.length, 0)} Tasks</p>
                                </div>
                                <ChevronRight className="ml-auto text-slate-300 group-hover:text-blue-400" size={20} />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400">
                        <CheckSquare size={48} className="mx-auto text-slate-200 mb-3" />
                        <p>No tasks assigned.</p>
                    </div>
                )}
            </div>
        );
    }

    // --- VIEW 2: MODULES GRID ---
    if (!selectedModuleId) {
        return (
            <div className="h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                <div className="sticky top-0 bg-white z-10 pb-4 border-b border-slate-100 mb-4">
                    <button
                        onClick={() => setSelectedProjectId(null)}
                        className="flex items-center text-sm text-slate-500 hover:text-blue-600 transition-colors mb-2"
                    >
                        <ChevronLeft size={16} className="mr-1" /> Back to Projects
                    </button>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        <span className="text-slate-400 font-normal mr-2">Project:</span>
                        {selectedProject?.name}
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedProject?.modules.map(module => (
                        <button
                            key={module.id}
                            onClick={() => setSelectedModuleId(module.id)}
                            className="flex items-center p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left group"
                        >
                            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mr-4 group-hover:scale-110 transition-transform">
                                <Layers size={20} />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">{module.name}</h4>
                                <p className="text-xs text-slate-500">{module.tasks.length} Assigned Tasks</p>
                            </div>
                            <ChevronRight className="ml-auto text-slate-300 group-hover:text-emerald-400" size={20} />
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // --- VIEW 3: TASKS LIST ---
    return (
        <div className="h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="sticky top-0 bg-white z-10 pb-4 border-b border-slate-100 mb-4">
                <button
                    onClick={() => setSelectedModuleId(null)}
                    className="flex items-center text-sm text-slate-500 hover:text-blue-600 transition-colors mb-2"
                >
                    <ChevronLeft size={16} className="mr-1" /> Back to Modules
                </button>
                <div className="flex flex-col">
                    <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
                        <span>{selectedProject?.name}</span>
                        <span>/</span>
                        <span>{selectedModule?.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-800">Tasks</h3>
                        {!isClockedIn && <span className="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full border border-amber-200">⚠️ Clock in to log work</span>}
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {selectedModule?.tasks.map(task => {
                    const existingLog = getTodayLogForTask(task._id);
                    const isExpanded = expandedLogTaskId === task._id;

                    return (
                        <div key={task._id} className={`border rounded-lg transition-all ${isExpanded ? 'border-blue-300 ring-1 ring-blue-100 bg-white' : 'border-slate-200 hover:border-blue-200 bg-white hover:bg-slate-50'}`}>
                            {/* Task Items */}
                            <div className="p-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <h4 className={`font-semibold text-sm ${isExpanded ? 'text-blue-700' : 'text-slate-800'}`}>{task.name}</h4>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description || 'No description'}</p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {existingLog ? (
                                            <div className="flex items-center gap-2">
                                                <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full flex items-center">
                                                    <CheckSquare size={12} className="mr-1.5" />
                                                    {existingLog.hours}h Logged
                                                </div>
                                                <button
                                                    onClick={() => toggleLogForm(task._id, existingLog)}
                                                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => onDeleteLog(existingLog._id)}
                                                    className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => toggleLogForm(task._id)}
                                                disabled={!isClockedIn}
                                                className={`flex items-center px-3 py-1.5 rounded text-xs font-medium transition-all ${isClockedIn ? (isExpanded ? 'bg-slate-100 text-slate-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm') : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                            >
                                                {isExpanded ? 'Cancel' : 'Log Work'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Log Form Area */}
                            {isExpanded && (
                                <div className="bg-slate-50 p-4 border-t border-slate-100 rounded-b-lg animate-fadeIn">
                                    <form onSubmit={onLogWork} className="flex flex-col sm:flex-row gap-4 items-end">
                                        <div className="w-full sm:w-32 flex space-x-2">
                                            <div className="flex-1">
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hrs</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    required
                                                    autoFocus
                                                    className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                    placeholder="0"
                                                    value={logForm.hours}
                                                    onChange={(e) => setLogForm({ ...logForm, hours: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Min</label>
                                                <input
                                                    type="number"
                                                    min="0" max="59"
                                                    className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                    placeholder="0"
                                                    value={logForm.minutes}
                                                    onChange={(e) => setLogForm({ ...logForm, minutes: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 w-full">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                placeholder="What did you work on?"
                                                value={logForm.description}
                                                onChange={(e) => setLogForm({ ...logForm, description: e.target.value })}
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full sm:w-auto px-6 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm h-[38px] flex items-center justify-center"
                                        >
                                            <CheckSquare size={16} className="mr-2" />
                                            {editingLogId ? 'Update' : 'Save'}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const RegularizationRequestsView = ({ requests, onProcess, processingId, currentUser }) => {
    const isAdmin = currentUser?.roles?.some(r => r.name === 'Admin' || r === 'Admin');

    if (requests.length === 0) {
        return (
            <div className="text-center py-20 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <div className="h-16 w-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4">
                    <Info size={32} className="text-slate-300" />
                </div>
                <h3 className="text-slate-800 font-bold">No Requests Found</h3>
                <p className="text-slate-500 text-xs mt-1">Regularization requests will appear here once submitted.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-slate-800">Regularization Requests</h3>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-full uppercase tracking-wider">
                    {requests.length} Total
                </span>
            </div>

            <div className="grid gap-4">
                {requests.map(req => {
                    const isMyRequest = req.user?._id === currentUser?._id;
                    // Manager check: identify if the current user is a reporting manager for the requester
                    const isManagerOfUser = currentUser?.directReports?.some(r => 
                        (typeof r === 'string' ? r === req.user?._id : (r._id === req.user?._id || r === req.user?._id))
                    );
                    const canProcess = !isMyRequest && (isAdmin || req.manager === currentUser?._id || req.manager?._id === currentUser?._id || isManagerOfUser) && req.status === 'PENDING';

                    return (
                        <div key={req._id} className={`bg-white border rounded-xl p-4 transition-all shadow-sm hover:shadow-md ${req.status === 'PENDING' ? 'border-amber-200 bg-amber-50/5' : 'border-slate-100'}`}>
                            <div className="flex flex-col sm:flex-row justify-between gap-4">
                                <div className="flex gap-4">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : req.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {req.status === 'APPROVED' ? <CheckCircle size={20} /> : req.status === 'REJECTED' ? <XCircle size={20} /> : <Clock size={20} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{req.user?.firstName} {req.user?.lastName}</span>
                                            <span className="text-[10px] text-slate-400 font-mono">#{req.user?.employeeCode}</span>
                                        </div>
                                        <div className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                                            <span>{format(new Date(req.date), 'EEE, MMM dd')}</span>
                                            <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                                            <span className="text-blue-600 font-bold uppercase tracking-tighter">{req.type}</span>
                                        </div>
                                        <div className="mt-3 bg-white/50 border border-slate-100 rounded-lg p-2 flex gap-4 text-[10px] font-mono">
                                            {(req.type === 'IN' || req.type === 'BOTH') && (
                                                <div>
                                                    <span className="text-slate-400 block mb-0.5">REQ IN</span>
                                                    <span className="text-slate-700 font-bold">{new Date(req.requestedClockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            )}
                                            {(req.type === 'OUT' || req.type === 'BOTH') && (
                                                <div>
                                                    <span className="text-slate-400 block mb-0.5">REQ OUT</span>
                                                    <span className="text-slate-700 font-bold">{new Date(req.requestedClockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-start sm:items-end justify-between gap-3">
                                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : req.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {req.status}
                                    </div>
                                    
                                    {canProcess ? (
                                        <div className="flex gap-2">
                                            <button
                                                disabled={processingId === req._id}
                                                onClick={() => onProcess(req._id, 'REJECTED')}
                                                className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors flex items-center gap-1.5"
                                            >
                                                <X size={14} /> Reject
                                            </button>
                                            <button
                                                disabled={processingId === req._id}
                                                onClick={() => onProcess(req._id, 'APPROVED')}
                                                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-lg transition-colors flex items-center gap-1.5"
                                            >
                                                {processingId === req._id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve
                                            </button>
                                        </div>
                                    ) : (
                                        req.status !== 'PENDING' && (
                                            <div className="text-[10px] text-slate-400 italic flex items-center gap-1">
                                                {req.status === 'APPROVED' ? 'Approved by' : 'Rejected by'} {req.manager?.firstName}
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-slate-50 flex items-start gap-2">
                                <Info size={14} className="text-slate-300 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-slate-600 italic leading-relaxed">
                                    "{req.reason}"
                                </div>
                            </div>
                            {req.rejectionReason && (
                                <div className="mt-2 p-2 bg-red-50 text-red-600 text-[10px] rounded border border-red-100 italic">
                                    Rejection: {req.rejectionReason}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Attendance;
