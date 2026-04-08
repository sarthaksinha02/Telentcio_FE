import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
    ArrowLeft, User as UserIcon, Calendar, Clock, AlertCircle,
    CheckCircle, MessageSquare, Send, Check, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { format } from 'date-fns';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const QueryDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [query, setQuery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);

    // Redirect user if they are stuck on the old /helpdesk/new URL
    useEffect(() => {
        if (id === 'new') {
            navigate('/helpdesk', { replace: true });
        }
    }, [id, navigate]);

    const commentsEndRef = useRef(null);

    const fetchQueryDetails = useCallback(async () => {
        if (id === 'new') return; // Don't attempt to fetch if it's the old 'new' URL
        try {
            const res = await api.get(`/helpdesk/${id}`);
            setQuery(res.data.data || res.data);
        } catch (error) {
            console.error('Failed to fetch query', error);
            toast.error('Failed to load query details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchQueryDetails();
    }, [fetchQueryDetails]);

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            query: { userId: user ? user.id : 'anonymous' },
            transports: ['websocket', 'polling']
        });

        socket.emit('join_query', id);

        socket.on('new_comment', (updatedComments) => {
            setQuery(prev => {
                if (!prev) return prev;
                return { ...prev, comments: updatedComments };
            });
        });

        return () => {
            socket.emit('leave_query', id);
            socket.disconnect();
        };
    }, [id, user]);

    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [query?.comments]);

    const handleStatusUpdate = async (newStatus, feedback = null) => {
        let confirmMsg = `Are you sure you want to change status to ${newStatus}?`;
        if (newStatus === 'Closed' && query.status !== 'Resolved') confirmMsg = "Are you sure you want to close this query?";
        if (newStatus === 'Resolved') confirmMsg = "Are you sure you want to mark this query as resolved?";
        if (newStatus === 'Escalated') confirmMsg = "Are you sure you want to escalate this query?";

        if (!feedback && !window.confirm(confirmMsg)) return;

        try {
            await api.put(`/helpdesk/${id}/close`, { status: newStatus, feedback });
            toast.success(newStatus === 'In Progress' && query.status === 'Resolved' ? 'Query reopened with feedback' : `Query marked as ${newStatus}`);
            // Clear list cache to reflect status change in main list
            sessionStorage.removeItem(`helpdesk_data_${user?._id}`);
            fetchQueryDetails();
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to update status to ${newStatus}`);
        }
    };

    const handleReopen = () => {
        const feedback = window.prompt("Please provide feedback on why this was not resolved:");
        if (feedback) {
            handleStatusUpdate('In Progress', feedback);
        }
    };

    const submitComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        setSubmittingComment(true);
        try {
            await api.post(`/helpdesk/${id}/comments`, { text: commentText });
            setCommentText('');
            // Clear list cache so comment count updates in main list
            sessionStorage.removeItem(`helpdesk_data_${user?._id}`);
            // Optional: Re-fetch if socket doesn't update fast enough, but socket should handle it
            const res = await api.get(`/helpdesk/${id}`);
            setQuery(res.data.data || res.data);
        } catch {
            toast.error('Failed to add comment');
        } finally {
            setSubmittingComment(false);
        }
    };

    if (loading) return (
        <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
            <Skeleton className="h-10 w-48 mb-6" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Skeleton className="h-96 lg:col-span-2 rounded-xl" />
                <Skeleton className="h-96 rounded-xl" />
            </div>
        </div>
    );

    if (!query) return (
        <div className="p-10 text-center flex flex-col items-center">
            <AlertCircle size={48} className="text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-700">Query Not Found</h2>
            <button onClick={() => navigate('/helpdesk')} className="mt-4 text-indigo-600 hover:underline">
                Return to Help Desk
            </button>
        </div>
    );

    const getStatusStyle = (s) => {
        const status = s?.toLowerCase() || '';
        if (status === 'new') return 'bg-amber-100 text-amber-700 border-amber-200';
        if (status === 'in progress') return 'bg-blue-100 text-blue-700 border-blue-200';
        if (status === 'escalated') return 'bg-red-100 text-red-700 border-red-200 animate-pulse';
        if (status === 'resolved') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        if (status === 'closed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    const getPriorityIcon = (p) => {
        if (p === 'Urgent') return <AlertCircle size={16} className="text-red-500" />;
        if (p === 'High') return <AlertCircle size={16} className="text-orange-500" />;
        if (p === 'Low') return <Clock size={16} className="text-slate-400" />;
        return <CheckCircle size={16} className="text-blue-500" />;
    };

    const isAdmin = user?.roles?.some(r => ['Admin', 'System'].includes(r.name || r) || r?.isSystem === true);
    const isAssignee = query.assignedTo?._id === user?._id || query.assignedTo === user?._id;
    const isRaiser = query.raisedBy?._id === user?._id || query.raisedBy === user?._id;

    const isClosed = query.status === 'Closed';

    return (
        <div className="min-h-screen bg-slate-50 font-sans p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => navigate('/helpdesk')}
                    className="flex items-center text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-6 group"
                >
                    <ArrowLeft size={16} className="mr-1.5 group-hover:-translate-x-1 transition-transform" />
                    Back to Help Desk
                </button>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                                {query.queryId}
                            </span>
                            <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getStatusStyle(query.status)}`}>
                                {query.status.replace('_', ' ')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                            {query.status === 'Escalated' && <AlertTriangle className="text-red-500 fill-red-50" size={24} />}
                            {query.subject}
                        </h1>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        {!isClosed && query.status === 'New' && (isAdmin || isAssignee) && (
                            <button
                                onClick={() => handleStatusUpdate('In Progress')}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 flex-1 md:flex-none hover:-translate-y-0.5 text-sm"
                            >
                                Start Progress
                            </button>
                        )}
                        {!isClosed && (query.status === 'In Progress' || query.status === 'Escalated' || query.status === 'New') && (isAdmin || isAssignee) && (
                            <button
                                onClick={() => handleStatusUpdate('Resolved')}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 flex-1 md:flex-none hover:-translate-y-0.5 text-sm"
                            >
                                Mark Resolved
                            </button>
                        )}
                        {!isClosed && (isAdmin || isAssignee) && (query.status === 'In Progress' || query.status === 'Escalated') && (
                            <button
                                onClick={() => handleStatusUpdate('Pending')}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-semibold shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 flex-1 md:flex-none hover:-translate-y-0.5 text-sm"
                            >
                                Mark Pending
                            </button>
                        )}

                        {!isClosed && query.status !== 'Escalated' && query.status !== 'Resolved' && (
                            (() => {
                                const canEscalate = query.canEscalate;
                                if (!canEscalate && !isRaiser) return null; // Someone else

                                return (
                                    <button
                                        onClick={() => {
                                            if (isRaiser && !isAdmin && !isAssignee && !canEscalate) {
                                                toast.error(`You can only escalate your query after 48 work hours. Currently ${query.workHoursElapsed?.toFixed(1) || 0} work hours have passed (excluding weekends).`);
                                                return;
                                            }
                                            handleStatusUpdate('Escalated');
                                        }}
                                        className={`${(isRaiser && !canEscalate && !isAdmin && !isAssignee) ? 'opacity-50 cursor-not-allowed bg-slate-400' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 hover:-translate-y-0.5'} text-white px-4 py-2 rounded-xl font-semibold shadow-md transition-all flex items-center justify-center gap-2 flex-1 md:flex-none text-sm`}
                                    >
                                        Escalate
                                    </button>
                                );
                            })()
                        )}

                        {!isClosed && query.status === 'Resolved' && isRaiser && (
                            <div className="flex gap-2 w-full md:w-auto">
                                <button
                                    onClick={() => handleStatusUpdate('Closed')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 flex-1 md:flex-none hover:-translate-y-0.5 text-sm"
                                >
                                    Yes, Resolved
                                </button>
                                <button
                                    onClick={handleReopen}
                                    className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-semibold shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 flex-1 md:flex-none hover:-translate-y-0.5 text-sm"
                                >
                                    No, Reopen
                                </button>
                            </div>
                        )}

                        {!isClosed && query.status === 'Resolved' && (isAdmin || isAssignee) && (
                            <button
                                onClick={() => {
                                    if (!query.canDirectlyClose && !isAdmin) {
                                        toast.error(`You can only close this query after 48 work hours of resolution. Currently ${query.resolvedWorkHoursElapsed?.toFixed(1) || 0} work hours have passed.`);
                                        return;
                                    }
                                    handleStatusUpdate('Closed');
                                }}
                                className={`${(!query.canDirectlyClose && !isAdmin) ? 'opacity-50 cursor-not-allowed bg-slate-400' : 'bg-slate-700 hover:bg-slate-800 shadow-slate-700/20 hover:-translate-y-0.5'} text-white px-4 py-2 rounded-xl font-semibold shadow-md transition-all flex items-center justify-center gap-2 flex-1 md:flex-none text-sm`}
                            >
                                <Check size={18} />
                                Close Directly
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Main Content (Left Col) */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Original Query Details */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
                                <MessageSquare size={18} className="text-indigo-500" />
                                Query Description
                            </h3>
                            <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
                                {query.description}
                            </div>
                        </div>

                        {/* Comments / Activity Feed */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-xl flex justify-between items-center">
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <Clock size={18} className="text-indigo-500" />
                                    Activity & Conversation
                                </h3>
                                <div className="text-xs font-medium text-slate-500">
                                    {query.comments?.length || 0} messages
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/30">
                                {query.comments && query.comments.length > 0 ? (
                                    query.comments.map((comment, index) => {
                                        const isSystem = comment.text.startsWith('[SYSTEM]');
                                        const isMe = comment.user?._id === user?._id;
                                        const userName = comment.user ? `${comment.user.firstName} ${comment.user.lastName}` : 'System';

                                        if (isSystem) {
                                            return (
                                                <div key={index} className="flex justify-center my-4">
                                                    <div className="bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-semibold px-4 py-1.5 rounded-full flex items-center shadow-sm">
                                                        <AlertCircle size={12} className="mr-1.5" />
                                                        {comment.text.replace('[SYSTEM] ', '')}
                                                        <span className="ml-2 pl-2 border-l border-slate-300 font-medium">
                                                            {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`flex max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>

                                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border
                                                        ${isMe ? 'ml-3 bg-indigo-600 text-white border-indigo-700' : 'mr-3 bg-white text-slate-600 border-slate-200'}
                                                    `}>
                                                        {comment.user?.firstName?.charAt(0)}{comment.user?.lastName?.charAt(0)}
                                                    </div>

                                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                        <div className="flex items-center gap-2 mb-1 px-1">
                                                            <span className="text-xs font-bold text-slate-700">{isMe ? 'You' : userName}</span>
                                                            <span className="text-[10px] font-medium text-slate-400">{format(new Date(comment.createdAt), 'MMM d, h:mm a')}</span>
                                                        </div>
                                                        <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap shadow-sm border
                                                            ${isMe ? 'bg-indigo-50 border-indigo-100 text-indigo-900 rounded-tr-sm' : 'bg-white border-slate-200 text-slate-700 rounded-tl-sm'}
                                                        `}>
                                                            {comment.text}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <MessageSquare size={32} className="mb-3 opacity-20" />
                                        <p className="text-sm font-medium">No conversation yet</p>
                                    </div>
                                )}
                                <div ref={commentsEndRef} />
                            </div>

                            {!isClosed ? (
                                <div className="p-4 bg-white border-t border-slate-200 rounded-b-xl">
                                    <form onSubmit={submitComment} className="flex flex-col gap-3">
                                        <textarea
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            placeholder="Type a message or response..."
                                            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none bg-slate-50 focus:bg-white transition-colors"
                                            rows="3"
                                        />
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] text-slate-400 font-medium px-1">Press submit to send</p>
                                            <button
                                                type="submit"
                                                disabled={!commentText.trim() || submittingComment}
                                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                                            >
                                                {submittingComment ? 'Sending...' : 'Send Message'}
                                                {!submittingComment && <Send size={14} className="ml-1" />}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 border-t border-slate-200 rounded-b-xl text-center text-sm font-semibold text-slate-500 flex items-center justify-center gap-2">
                                    <CheckCircle size={16} className="text-emerald-500" />
                                    This query is closed and cannot receive new messages.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar Information (Right Col) */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Config Details</h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <div className="p-4">
                                    <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Query Type</p>
                                    <p className="text-sm font-bold text-slate-800 bg-slate-100 inline-block px-2.5 py-1 rounded-md">{query.queryType?.name || 'Unknown'}</p>
                                </div>
                                <div className="p-4">
                                    <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Priority</p>
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                        {getPriorityIcon(query.priority)}
                                        {query.priority}
                                    </div>
                                </div>
                                <div className="p-4">
                                    <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Raised On</p>
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <Calendar size={14} className="text-slate-400" />
                                        {format(new Date(query.createdAt), 'MMMM d, yyyy h:mm a')}
                                    </div>
                                </div>
                                {query.closedAt && (
                                    <div className="p-4 bg-emerald-50/30">
                                        <p className="text-xs font-semibold text-emerald-600 mb-1 uppercase tracking-wider">Closed On</p>
                                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                                            <CheckCircle size={14} className="text-emerald-500" />
                                            {format(new Date(query.closedAt), 'MMMM d, yyyy h:mm a')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">People</h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <div className="p-4">
                                    <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Raised By</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs border border-slate-200">
                                            {query.raisedBy?.firstName?.charAt(0)}{query.raisedBy?.lastName?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{query.raisedBy?.firstName} {query.raisedBy?.lastName}</p>
                                            <p className="text-[10px] font-semibold text-slate-500">{query.raisedBy?.email}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <p className="text-[10px] font-bold text-indigo-400 mb-2 uppercase tracking-wider">
                                        {query.originalAssignee ? 'Originally Assigned To' : 'Assigned To'}
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-100">
                                            {(query.originalAssignee || query.assignedTo)?.firstName?.charAt(0)}{(query.originalAssignee || query.assignedTo)?.lastName?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">
                                                {(query.originalAssignee || query.assignedTo)?.firstName} {(query.originalAssignee || query.assignedTo)?.lastName}
                                            </p>
                                            <p className="text-[10px] font-semibold text-slate-500">
                                                {(query.originalAssignee || query.assignedTo)?.email}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {query.originalAssignee && (
                                    <div className="p-4 bg-amber-50/20 border-t border-amber-100">
                                        <p className="text-[10px] font-bold text-amber-600 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                                            <AlertTriangle size={10} />
                                            Escalated To
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs border border-amber-100 shadow-sm">
                                                {query.assignedTo?.firstName?.charAt(0)}{query.assignedTo?.lastName?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{query.assignedTo?.firstName} {query.assignedTo?.lastName}</p>
                                                <p className="text-[10px] font-semibold text-slate-500">{query.assignedTo?.email}</p>
                                                <div className="mt-1 flex items-center gap-1">
                                                    <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1 py-0.5 rounded uppercase tracking-tighter shadow-sm blur-[0.1px]">Escalation Level</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default QueryDetails;
