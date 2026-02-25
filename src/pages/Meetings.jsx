import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, Plus, Clock, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const Meetings = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Authorization
    const canCreate = user?.roles?.includes('Admin') || user?.permissions?.includes('meeting.create') || true; // Assuming any user can create a meeting they host

    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/meetings');
            setMeetings(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load meetings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMeetings();
    }, []);

    const getStatusBadge = (status) => {
        const styles = {
            'Draft': 'bg-slate-100 text-slate-700',
            'Published': 'bg-blue-100 text-blue-700',
            'Approved': 'bg-green-100 text-green-700',
            'Archived': 'bg-gray-100 text-gray-700'
        };
        return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${styles[status] || styles['Draft']}`}>{status}</span>;
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-100 p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">
                <Skeleton className="h-8 w-48 mb-2" />
                <div className="bg-white rounded-xl shadow-sm overflow-hidden p-6">
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* View Toggle */}
                {(user?.roles?.includes('Admin') || user?.permissions?.includes('discussion.read')) && (
                    <div className="flex justify-center mb-8">
                        <div className="inline-flex bg-slate-200/70 p-1 rounded-lg">
                            <button
                                onClick={() => navigate('/meetings')}
                                className="px-6 py-2 text-sm font-medium rounded-md transition-all shadow-sm bg-white text-slate-800"
                            >
                                Meetings
                            </button>
                            <button
                                onClick={() => navigate('/discussions')}
                                className="px-6 py-2 text-sm font-medium rounded-md transition-all text-slate-600 hover:text-slate-800"
                            >
                                Discussions
                            </button>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Minutes of Meeting</h1>
                        <p className="text-sm text-slate-500">Track and manage your team meetings, decisions, and action items.</p>
                    </div>
                    {canCreate && (
                        <button
                            onClick={() => navigate('/meetings/new')}
                            className="flex items-center space-x-2 zoho-btn-primary bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
                        >
                            <Plus size={18} />
                            <span>Create MoM</span>
                        </button>
                    )}
                </div>

                {/* List View */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Meeting Title</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Date & Time</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Host</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Type</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Status</th>
                                    <th className="px-6 py-4 text-right font-semibold text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {meetings.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center">
                                                <Calendar size={48} className="text-slate-200 mb-4" />
                                                <p className="text-lg font-medium text-slate-600">No meetings found</p>
                                                <p className="text-sm">You haven't participated in any meetings yet.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    meetings.map(meeting => (
                                        <tr key={meeting._id} className="hover:bg-slate-50 transition border-b border-slate-50">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-800">{meeting.title}</div>
                                                <div className="text-xs text-slate-500 mt-1 truncate max-w-xs">{meeting.objective}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center text-slate-700">
                                                    <Calendar size={14} className="mr-1.5 text-slate-400" />
                                                    {format(new Date(meeting.date), 'dd MMM yyyy')}
                                                </div>
                                                {(meeting.startTime || meeting.endTime) && (
                                                    <div className="flex items-center text-xs text-slate-500 mt-1">
                                                        <Clock size={12} className="mr-1.5 text-slate-400" />
                                                        {meeting.startTime} {meeting.endTime ? `- ${meeting.endTime}` : ''}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-2">
                                                    <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                                                        {meeting.host?.firstName?.[0]}{meeting.host?.lastName?.[0]}
                                                    </div>
                                                    <span className="text-slate-700 font-medium">
                                                        {meeting.host?.firstName} {meeting.host?.lastName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                                                    {meeting.meetingType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(meeting.status)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => navigate(`/meetings/${meeting._id}`)}
                                                    className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Meetings;
