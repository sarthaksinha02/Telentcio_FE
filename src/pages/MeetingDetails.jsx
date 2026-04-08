import React, { useCallback, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Calendar, Clock, MapPin, Users, CheckSquare, Edit, List, Info, Briefcase, FileText, AlignLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const MeetingDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [meeting, setMeeting] = useState(null);
    const [loading, setLoading] = useState(true);

    const canEdit = user?.roles?.includes('Admin') || user?.permissions?.includes('meeting.edit') || meeting?.host?._id === user?._id;

    const fetchMeeting = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/meetings/${id}`);
            setMeeting(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load meeting details');
            navigate('/meetings');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => {
        fetchMeeting();
    }, [fetchMeeting]);

    const updateActionStatus = async (itemIndex, newStatus) => {
        try {
            // Optimistic update locally
            const updatedItems = [...meeting.actionItems];
            updatedItems[itemIndex].status = newStatus;

            // Only sending the actionItems update to the server could be handled by a specific endpoint in a real app,
            // but for now we'll just send the full meeting back with updated items.
            await api.put(`/meetings/${id}`, { actionItems: updatedItems });
            toast.success('Action status updated');
            setMeeting(prev => ({ ...prev, actionItems: updatedItems }));
        } catch (error) {
            console.error(error);
            toast.error('Failed to update status');
            fetchMeeting(); // Revert
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-100 p-6 md:p-10">
            <div className="max-w-4xl mx-auto space-y-6">
                <Skeleton className="h-8 w-64 mb-4" />
                <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        </div>
    );

    if (!meeting) return <div className="p-10 text-center text-slate-500">Meeting not found</div>;

    const getPriorityColor = (p) => {
        switch (p) {
            case 'Urgent': return 'bg-red-100 text-red-700';
            case 'High': return 'bg-orange-100 text-orange-700';
            case 'Low': return 'bg-slate-100 text-slate-700';
            default: return 'bg-blue-100 text-blue-700'; // Medium
        }
    };

    const getStatusColor = (s) => {
        switch (s) {
            case 'Completed': return 'bg-emerald-100 text-emerald-700';
            case 'In Progress': return 'bg-amber-100 text-amber-700';
            case 'Cancelled': return 'bg-gray-100 text-gray-700';
            default: return 'bg-slate-100 text-slate-600'; // Pending
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
                    <div>
                        <div className="flex items-center space-x-3 mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                {meeting.meetingType}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${meeting.status === 'Published' || meeting.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
                                }`}>
                                {meeting.status}
                            </span>
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-900">{meeting.title}</h1>
                        {meeting.objective && <p className="text-slate-600 mt-2 max-w-2xl">{meeting.objective}</p>}
                    </div>

                    <div className="flex space-x-3">
                        {canEdit && (
                            <button
                                onClick={() => navigate(`/meetings/${meeting._id}/edit`)}
                                className="flex items-center space-x-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition shadow-sm"
                            >
                                <Edit size={16} />
                                <span>Edit MoM</span>
                            </button>
                        )}
                        <button
                            onClick={() => window.print()}
                            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm"
                        >
                            <FileText size={16} />
                            <span>Export PDF</span>
                        </button>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column (Main Info) */}
                    <div className="md:col-span-2 space-y-6">

                        {/* Discussion Notes */}
                        {meeting.discussionPoints && (
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                    <AlignLeft size={18} className="mr-2 text-indigo-500" /> Discussion Points
                                </h3>
                                <div className="prose prose-sm text-slate-700 max-w-none whitespace-pre-wrap">
                                    {meeting.discussionPoints}
                                </div>
                            </div>
                        )}

                        {/* Decisions */}
                        {meeting.decisionsMade && (
                            <div className="bg-emerald-50 rounded-xl shadow-sm p-6 border border-emerald-100">
                                <h3 className="text-lg font-bold text-emerald-800 mb-4 flex items-center">
                                    <CheckSquare size={18} className="mr-2 text-emerald-600" /> Key Decisions
                                </h3>
                                <div className="prose prose-sm text-emerald-900 max-w-none whitespace-pre-wrap font-medium">
                                    {meeting.decisionsMade}
                                </div>
                            </div>
                        )}

                        {/* Agenda Items */}
                        {meeting.agendaItems?.length > 0 && (
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                    <List size={18} className="mr-2 text-blue-500" /> Agenda
                                </h3>
                                <div className="space-y-4">
                                    {meeting.agendaItems.map((item, idx) => (
                                        <div key={idx} className="flex gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800">{item.title}</h4>
                                                {item.description && <p className="text-sm text-slate-600 mt-1">{item.description}</p>}
                                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
                                                    {item.owner && <span>Owner: {item.owner.firstName} {item.owner.lastName}</span>}
                                                    {item.estimatedTime && <span>Time: {item.estimatedTime} mins</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Items */}
                        {meeting.actionItems?.length > 0 && (
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                    <Briefcase size={18} className="mr-2 text-amber-500" /> Action Items
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                            <tr>
                                                <th className="px-4 py-3">Task</th>
                                                <th className="px-4 py-3">Assignee</th>
                                                <th className="px-4 py-3">Due Date</th>
                                                <th className="px-4 py-3">Priority</th>
                                                <th className="px-4 py-3 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {meeting.actionItems.map((action, idx) => {
                                                const isAssignee = action.assignee?._id === user?._id;
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium text-slate-800">{action.taskDescription}</td>
                                                        <td className="px-4 py-3 text-slate-600">{action.assignee?.firstName} {action.assignee?.lastName}</td>
                                                        <td className="px-4 py-3 text-slate-600">{action.dueDate ? format(new Date(action.dueDate), 'MMM dd, yyyy') : '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(action.priority)}`}>
                                                                {action.priority}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {isAssignee || canEdit ? (
                                                                <select
                                                                    value={action.status}
                                                                    onChange={(e) => updateActionStatus(idx, e.target.value)}
                                                                    className={`text-xs font-semibold rounded-md px-2 py-1 outline-none cursor-pointer border-transparent ${getStatusColor(action.status)}`}
                                                                >
                                                                    <option value="Pending">Pending</option>
                                                                    <option value="In Progress">In Progress</option>
                                                                    <option value="Completed">Completed</option>
                                                                    <option value="Cancelled">Cancelled</option>
                                                                </select>
                                                            ) : (
                                                                <span className={`px-2 py-1 rounded-md text-xs font-semibold inline-block ${getStatusColor(action.status)}`}>
                                                                    {action.status}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column (Meta Info) */}
                    <div className="space-y-6">
                        {/* Details Card */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 mb-4">Meeting Details</h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Calendar className="text-slate-400 mt-0.5" size={18} />
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{format(new Date(meeting.date), 'EEEE, MMMM dd, yyyy')}</p>
                                        {(meeting.startTime || meeting.endTime) && (
                                            <p className="text-xs text-slate-500 mt-0.5">{meeting.startTime} {meeting.endTime ? `- ${meeting.endTime}` : ''}</p>
                                        )}
                                    </div>
                                </div>
                                {meeting.location && (
                                    <div className="flex items-start gap-3">
                                        <MapPin className="text-slate-400 mt-0.5" size={18} />
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">{meeting.location}</p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-start gap-3">
                                    <Users className="text-slate-400 mt-0.5" size={18} />
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">Host: {meeting.host?.firstName} {meeting.host?.lastName}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Participants Card */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Attendees ({meeting.attendees?.length || 0})</h3>
                            <div className="space-y-2">
                                {meeting.attendees?.map(user => (
                                    <div key={user._id} className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                        {user.firstName} {user.lastName}
                                    </div>
                                ))}
                                {meeting.attendees?.length === 0 && <p className="text-sm text-slate-500 italic">None logged</p>}
                            </div>

                            {meeting.absentees?.length > 0 && (
                                <>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6">Absentees ({meeting.absentees.length})</h3>
                                    <div className="space-y-2">
                                        {meeting.absentees.map(user => (
                                            <div key={user._id} className="text-sm font-medium text-slate-500 flex items-center gap-2 line-through">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                                {user.firstName} {user.lastName}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MeetingDetails;
