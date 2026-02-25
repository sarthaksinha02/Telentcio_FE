import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, MessageSquare, Calendar, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const Discussions = () => {
    const navigate = useNavigate();
    const [discussions, setDiscussions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10;

    const fetchDiscussions = async (page) => {
        try {
            setLoading(true);
            const res = await api.get(`/discussions?page=${page}&limit=${limit}`);
            setDiscussions(res.data.discussions);
            setCurrentPage(res.data.currentPage);
            setTotalPages(res.data.totalPages);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load discussions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDiscussions(currentPage);
    }, [currentPage]);

    const handleStatusChange = async (id, newStatus) => {
        try {
            await api.put(`/discussions/${id}`, { status: newStatus });
            toast.success('Status updated');
            setDiscussions(prev => prev.map(d => d._id === id ? { ...d, status: newStatus } : d));
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update status');
        }
    };

    const getStatusBadgeColor = (status) => {
        const styles = {
            'inprogress': 'bg-amber-100 text-amber-700 border-amber-200',
            'mark as complete': 'bg-green-100 text-green-700 border-green-200',
            'on-hold': 'bg-slate-100 text-slate-700 border-slate-200'
        };
        return styles[status] || 'bg-blue-100 text-blue-700 border-blue-200';
    };

    if (loading && discussions.length === 0) return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">
                <Skeleton className="h-8 w-48 mb-2" />
                <div className="bg-white rounded-xl shadow-sm overflow-hidden p-6 border border-slate-200">
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* View Toggle */}
                <div className="flex justify-center mb-8">
                    <div className="inline-flex bg-slate-200/70 p-1 rounded-lg">
                        <button
                            onClick={() => navigate('/meetings')}
                            className="px-6 py-2 text-sm font-medium rounded-md transition-all text-slate-600 hover:text-slate-800"
                        >
                            Meetings
                        </button>
                        <button
                            onClick={() => navigate('/discussions')}
                            className="px-6 py-2 text-sm font-medium rounded-md transition-all shadow-sm bg-white text-slate-800"
                        >
                            Discussions
                        </button>
                    </div>
                </div>

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <MessageSquare className="text-indigo-600" /> Discussions
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Create and manage team discussions, tasks, and topics.</p>
                    </div>
                    <button
                        onClick={() => navigate('/discussions/new')}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        <span>Create Discussion</span>
                    </button>
                </div>

                {/* List View */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Title</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Author</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Due Date</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Status</th>
                                    <th className="px-6 py-4 text-right font-semibold text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8">
                                            <div className="flex justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>
                                        </td>
                                    </tr>
                                ) : discussions.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <MessageSquare size={48} className="text-slate-200 mb-4" />
                                                <p className="text-lg font-medium text-slate-600">No discussions found</p>
                                                <p className="text-sm">Start a new discussion algorithmically or manually.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    discussions.map(discussion => (
                                        <tr key={discussion._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-800">{discussion.title}</div>
                                                <div className="text-xs text-slate-500 mt-1 truncate max-w-md">{discussion.discussion}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                                                        {discussion.createdBy?.firstName?.[0]}{discussion.createdBy?.lastName?.[0]}
                                                    </div>
                                                    <span className="text-slate-700 font-medium whitespace-nowrap">
                                                        {discussion.createdBy?.firstName} {discussion.createdBy?.lastName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {discussion.dueDate ? (
                                                    <div className="flex items-center text-slate-700 whitespace-nowrap">
                                                        <Calendar size={14} className="mr-1.5 text-slate-400" />
                                                        {format(new Date(discussion.dueDate), 'dd MMM yyyy')}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic">No due date</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={discussion.status}
                                                    onChange={(e) => handleStatusChange(discussion._id, e.target.value)}
                                                    className={`px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${getStatusBadgeColor(discussion.status)}`}
                                                >
                                                    <option value="inprogress">In Progress</option>
                                                    <option value="on-hold">On-hold</option>
                                                    <option value="mark as complete">Mark as complete</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => navigate(`/discussions/${discussion._id}/edit`)}
                                                    className="inline-flex items-center justify-center px-3 py-1.5 border border-slate-200 text-xs font-medium rounded-lg text-indigo-600 bg-white hover:bg-slate-50 transition-colors shadow-sm"
                                                >
                                                    View / Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                            <p className="text-sm text-slate-500">
                                Showing page <span className="font-medium text-slate-700">{currentPage}</span> of <span className="font-medium text-slate-700">{totalPages}</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1 || loading}
                                    className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="flex items-center gap-1">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            disabled={loading}
                                            className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${currentPage === i + 1 ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages || loading}
                                    className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Discussions;
