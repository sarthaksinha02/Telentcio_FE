import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, MessageSquare, Calendar, Search, ChevronLeft, ChevronRight, X, Eye, EyeOff, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const Discussions = () => {
    const navigate = useNavigate();
    const [discussions, setDiscussions] = useState([]);
    const [loading, setLoading] = useState(true);

    // New states for inline creation
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // New states for inline editing
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState(null);

    // State for toggling full descriptions inline
    const [expandedIds, setExpandedIds] = useState([]);

    const [newDiscussion, setNewDiscussion] = useState({
        discussion: '',
        status: 'inprogress',
        dueDate: ''
    });

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

    const handleCreateInline = async () => {
        if (!newDiscussion.discussion) {
            toast.error('Description is required');
            return;
        }
        try {
            setIsSaving(true);
            const payload = { ...newDiscussion, title: 'Discussion' }; // Setting default title since field is removed
            if (!payload.dueDate) delete payload.dueDate;

            await api.post('/discussions', payload);
            toast.success('Discussion created');

            fetchDiscussions(1); // Fetch the first page to show the new discussion

            setIsCreating(false);
            setNewDiscussion({
                discussion: '',
                status: 'inprogress',
                dueDate: ''
            });
        } catch (error) {
            console.error('Error creating discussion:', error);
            toast.error('Failed to create discussion');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditInline = (discussion) => {
        setEditingId(discussion._id);
        setEditData({
            discussion: discussion.discussion,
            status: discussion.status,
            dueDate: discussion.dueDate ? discussion.dueDate.split('T')[0] : ''
        });
    };

    const handleUpdateInline = async (id) => {
        if (!editData.discussion) {
            toast.error('Description is required');
            return;
        }
        try {
            setIsSaving(true);
            const payload = { ...editData };
            if (!payload.dueDate) delete payload.dueDate;

            await api.put(`/discussions/${id}`, payload);
            toast.success('Discussion updated');

            // Update local state
            setDiscussions(prev => prev.map(d => d._id === id ? { ...d, ...payload } : d));

            setEditingId(null);
            setEditData(null);
        } catch (error) {
            console.error('Error updating discussion:', error);
            toast.error('Failed to update discussion');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this discussion?')) {
            try {
                await api.delete(`/discussions/${id}`);
                toast.success('Discussion deleted');
                fetchDiscussions(currentPage);
            } catch (error) {
                console.error('Error deleting discussion:', error);
                toast.error('Failed to delete discussion');
            }
        }
    };

    const toggleDescription = (id) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
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
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        <span>Create Discussion</span>
                    </button>
                </div>

                {/* List View */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm table-fixed">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600 w-16">S.No</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Description</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600 w-32">Due Date</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600 w-40">Status</th>
                                    <th className="px-6 py-4 text-right font-semibold text-slate-600 w-64">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isCreating && (
                                    <tr className="bg-indigo-50/50">
                                        <td className="px-6 py-4 text-slate-500 text-sm font-medium">New</td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                value={newDiscussion.discussion}
                                                onChange={(e) => setNewDiscussion({ ...newDiscussion, discussion: e.target.value })}
                                                placeholder="Enter description"
                                                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="date"
                                                value={newDiscussion.dueDate}
                                                onChange={(e) => setNewDiscussion({ ...newDiscussion, dueDate: e.target.value })}
                                                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={newDiscussion.status}
                                                onChange={(e) => setNewDiscussion({ ...newDiscussion, status: e.target.value })}
                                                className={`px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full ${getStatusBadgeColor(newDiscussion.status)}`}
                                            >
                                                <option value="inprogress">In Progress</option>
                                                <option value="on-hold">On-hold</option>
                                                <option value="mark as complete">Mark as complete</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={handleCreateInline}
                                                    disabled={isSaving}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                                >
                                                    {isSaving ? '...' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={() => setIsCreating(false)}
                                                    className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8">
                                            <div className="flex justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>
                                        </td>
                                    </tr>
                                ) : discussions.length === 0 && !isCreating ? (
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
                                    discussions.map((discussion, index) => (
                                        editingId === discussion._id ? (
                                            <tr key={`edit-${discussion._id}`} className="bg-indigo-50/20">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-500">
                                                    {(currentPage - 1) * limit + index + 1}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="text"
                                                        value={editData.discussion}
                                                        onChange={(e) => setEditData({ ...editData, discussion: e.target.value })}
                                                        placeholder="Enter description"
                                                        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="date"
                                                        value={editData.dueDate}
                                                        onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                                                        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600"
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <select
                                                        value={editData.status}
                                                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                                                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-fit ${getStatusBadgeColor(editData.status)}`}
                                                    >
                                                        <option value="inprogress">In Progress</option>
                                                        <option value="on-hold">On-hold</option>
                                                        <option value="mark as complete">Mark as complete</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleUpdateInline(discussion._id)}
                                                            disabled={isSaving}
                                                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                                        >
                                                            {isSaving ? '...' : 'Save'}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditingId(null);
                                                                setEditData(null);
                                                            }}
                                                            className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr key={discussion._id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-500">
                                                    {(currentPage - 1) * limit + index + 1}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600 break-all whitespace-normal leading-relaxed">
                                                        {discussion.discussion && discussion.discussion.length > 55 && !expandedIds.includes(discussion._id) ?
                                                            `${discussion.discussion.substring(0, 55)}...` :
                                                            discussion.discussion
                                                        }
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {discussion.dueDate ? (
                                                        <div className="flex items-center text-slate-700 whitespace-nowrap text-sm">
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
                                                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-fit ${getStatusBadgeColor(discussion.status)}`}
                                                    >
                                                        <option value="inprogress">In Progress</option>
                                                        <option value="on-hold">On-hold</option>
                                                        <option value="mark as complete">Mark as complete</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {discussion.discussion && discussion.discussion.length > 55 && (
                                                            <button
                                                                onClick={() => toggleDescription(discussion._id)}
                                                                title={expandedIds.includes(discussion._id) ? "Show Less" : "View"}
                                                                className="inline-flex items-center justify-center p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors bg-slate-50 border-transparent shadow-sm"
                                                            >
                                                                {expandedIds.includes(discussion._id) ? <EyeOff size={16} /> : <Eye size={16} />}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleEditInline(discussion)}
                                                            title="Edit"
                                                            className="inline-flex items-center justify-center p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition-colors bg-slate-50 border-transparent shadow-sm"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(discussion._id)}
                                                            title="Delete"
                                                            className="inline-flex items-center justify-center p-2 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors bg-slate-50 border-transparent shadow-sm"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
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
