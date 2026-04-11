import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Calendar, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isPast, isToday } from 'date-fns';
import api from '../api/axios';
import socket from '../api/socket';
import { useAuth } from '../context/AuthContext';

const Topbar = ({ toggleSidebar }) => {
    const { user, hasModule } = useAuth();
    const navigate = useNavigate();
    const hasTalentAcquisition = hasModule('talentAcquisition');
    const [notifications, setNotifications] = useState([]);
    const [interviews, setInterviews] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const showDropdownRef = useRef(false);

    useEffect(() => {
        showDropdownRef.current = showDropdown;
    }, [showDropdown]);

    const fetchNotificationBootstrap = useCallback(async () => {
        try {
            const res = await api.get('/notifications/bootstrap', {
                params: { includeInterviews: hasTalentAcquisition }
            });
            setNotifications(res.data?.notifications || []);
            setInterviews(res.data?.interviews || []);
        } catch (error) {
            console.error('Failed to fetch notification bootstrap:', error);
        }
    }, [hasTalentAcquisition]);

    useEffect(() => {
        if (!user?._id) return;
        fetchNotificationBootstrap();
    }, [fetchNotificationBootstrap, user?._id]);

    useEffect(() => {
        if (!user) return;

        const handleSocketNotification = (newNotif) => {
            setNotifications(prev => [newNotif, ...prev]);
        };

        const handleInterviewUpdate = (data) => {
            fetchNotificationBootstrap();
        };

        const handleRefresh = () => {
            fetchNotificationBootstrap();
        };

        socket.on('notification', handleSocketNotification);
        socket.on('interview_update', handleInterviewUpdate);
        window.addEventListener('refreshNotifications', handleRefresh);

        return () => {
            socket.off('notification', handleSocketNotification);
            socket.off('interview_update', handleInterviewUpdate);
            window.removeEventListener('refreshNotifications', handleRefresh);
        };
    }, [fetchNotificationBootstrap, hasTalentAcquisition, user]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const todaysInterviews = interviews.filter(inv =>
        inv.scheduledDate && isToday(new Date(inv.scheduledDate))
    );

    const getStatusText = (inv) => {
        if (!inv.scheduledDate) return 'Not Scheduled';
        if (isPast(new Date(inv.scheduledDate))) return 'Overdue';
        return format(new Date(inv.scheduledDate), 'h:mm a');
    };

    const handleMarkAsRead = async (id, link) => {
        // Navigate immediately — don't block on the API call.
        // A failure to mark-as-read is non-critical and should never prevent navigation.
        if (link) {
            navigate(link);
        }
        setShowDropdown(false);

        // Fire-and-forget: mark as read in the background
        try {
            await api.patch(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.post('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const getIconForType = (type) => {
        switch (type) {
            case 'Interview': return <Calendar size={16} className="text-indigo-600" />;
            case 'Approval': return <Clock size={16} className="text-amber-600" />;
            case 'Action': return <ChevronRight size={16} className="text-blue-600" />;
            case 'Alert': return <Bell size={16} className="text-red-600" />;
            case 'Task': return <Calendar size={16} className="text-amber-600" />;
            default: return <Bell size={16} className="text-slate-600" />;
        }
    };

    const getBgForType = (type) => {
        switch (type) {
            case 'Interview': return 'bg-indigo-50';
            case 'Approval': return 'bg-amber-50';
            case 'Action': return 'bg-blue-50';
            case 'Alert': return 'bg-red-50';
            case 'Task': return 'bg-amber-50';
            default: return 'bg-slate-50';
        }
    };

    const allNotifications = [
        ...todaysInterviews.map(inv => ({
            _id: `task-${inv.roundId}`,
            title: `Today's Interview: ${inv.candidateName}`,
            message: `Level: ${inv.levelName} for ${inv.role} at ${getStatusText(inv)}.`,
            type: 'Task',
            isRead: false,
            createdAt: inv.scheduledDate || new Date().toISOString(),
            link: `/ta/hiring-request/${inv.hiringRequestId}/candidate/${inv.candidateId}/view`,
            isTask: true
        })),
        ...notifications
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalUnreadCount = allNotifications.filter(n => !n.isRead).length;

    return (
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm w-full">
            <div className="flex items-center gap-4">
                <button
                    onClick={toggleSidebar}
                    className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
                </button>
                <div className="md:hidden font-bold text-indigo-700 text-lg tracking-tight flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-black text-sm">T</span>
                    </div>
                    TalentCio
                </div>
            </div>

            <div className="flex items-center gap-4 ml-auto">
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors relative"
                    >
                        <Bell size={20} />
                        {totalUnreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
                        )}
                    </button>

                    {showDropdown && (
                        <div className="absolute right-0 mt-2 w-80 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <h3 className="font-bold text-slate-800">Notifications</h3>
                                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                    {totalUnreadCount}
                                </span>
                            </div>

                            <div className="max-h-[350px] overflow-y-auto">
                                {allNotifications.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 flex flex-col items-center">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                            <Bell size={20} className="text-slate-400" />
                                        </div>
                                        <p className="font-medium text-slate-700">All caught up!</p>
                                        <p className="text-xs mt-1">No pending notifications or tasks.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {allNotifications.map((notif) => (
                                            <div
                                                key={notif._id}
                                                onClick={() => {
                                                    if (notif.isTask) {
                                                        navigate(notif.link);
                                                        setShowDropdown(false);
                                                    } else {
                                                        handleMarkAsRead(notif._id, notif.link);
                                                    }
                                                }}
                                                className={`p-4 transition-colors cursor-pointer group ${!notif.isRead ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className={`mt-0.5 min-w-[32px] w-8 h-8 rounded-full flex items-center justify-center ${getBgForType(notif.type)}`}>
                                                        {getIconForType(notif.type)}
                                                    </div>
                                                    <div>
                                                        <h4 className={`text-sm ${!notif.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'} group-hover:text-indigo-600 transition-colors`}>
                                                            {notif.isTask ? <span className="text-amber-600 bg-amber-50 px-1 py-0.5 rounded-[4px] text-[10px] mr-1 uppercase">Task</span> : null}
                                                            {notif.title}
                                                        </h4>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            {notif.message}
                                                        </p>
                                                        <span className="text-[10px] text-slate-400 mt-2 block font-medium">
                                                            {format(new Date(notif.createdAt), 'MMM d, h:mm a')}
                                                        </span>
                                                    </div>
                                                    {!notif.isRead && (
                                                        <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 ml-auto mt-1.5" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {totalUnreadCount > 0 && notifications.some(n => !n.isRead) && (
                                <div className="p-2 bg-slate-50 border-t border-slate-100 flex justify-center">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkAllAsRead();
                                        }}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-4 py-2 hover:bg-indigo-50 rounded-lg transition-colors w-full text-center"
                                    >
                                        Mark all as read
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="w-px h-6 bg-slate-200"></div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:block text-right">
                        <p className="text-sm font-bold text-slate-800 leading-tight">{user?.firstName}</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{user?.roles?.[0]?.name || 'User'}</p>
                    </div>
                    <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm shadow-inner border border-indigo-200">
                        {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Topbar;
