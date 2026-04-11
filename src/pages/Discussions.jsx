import React, { useCallback, useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { Plus, MessageSquare, Calendar, Search, ChevronLeft, ChevronRight, X, Eye, EyeOff, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Download, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createCachePayload, isCacheFresh, readSessionCache } from '../utils/cache';

const Discussions = () => {
    const navigate = useNavigate();
    const [discussions, setDiscussions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Export Dates State
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef(null);

    // New states for inline creation
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // New states for inline editing
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState(null);

    // State for toggling full descriptions inline
    const [expandedIds, setExpandedIds] = useState([]);

    const { user } = useAuth();
    const [supervisors, setSupervisors] = useState([]);

    const [newDiscussion, setNewDiscussion] = useState({
        discussion: '',
        status: 'inprogress',
        dueDate: '',
        supervisor: ''
    });

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10;
    const initialFetchDoneRef = useRef(false);
    const DISCUSSION_CACHE_TTL_MS = 30 * 1000;
    const SUPERVISOR_CACHE_TTL_MS = 60 * 1000;

    const fetchDiscussions = useCallback(async (page, options = {}) => {
        const force = options === true || !!options.force;
        const silent = typeof options === 'object' ? !!options.silent : false;
        
        const CACHE_KEY = `discussion_data_${user?._id}_p${page}`;

        // 1. Initial Load from Cache
        if (!silent && !force) {
            const cached = readSessionCache(CACHE_KEY);
            if (cached) {
                const data = cached.data || cached;
                setDiscussions(data.discussions || []);
                setTotalPages(data.totalPages || 1);
                setCurrentPage(data.currentPage || page);
                setLoading(false);
                // Background refresh will continue even if cache is hit
            }
        }

        try {
            if (!silent && !readSessionCache(CACHE_KEY)) setLoading(true);
            const res = await api.get('/discussions/bootstrap', { params: { page, limit } });
            const freshData = {
                discussions: res.data.discussions || [],
                supervisors: res.data.supervisors || [],
                totalPages: res.data.totalPages || 1,
                currentPage: res.data.currentPage || page
            };
            const newFingerprint = (freshData.discussions || []).map(d => `${d._id}-${d.status}-${d.discussion?.substring(0, 20)}-${d.dueDate}`).join('|');
            const cachedValue = readSessionCache(CACHE_KEY);
            const oldFingerprint = cachedValue?.fingerprint || '';

            if (newFingerprint !== oldFingerprint || force) {
                setDiscussions(freshData.discussions);
                setCurrentPage(freshData.currentPage);
                setTotalPages(freshData.totalPages);
                if (freshData.supervisors?.length > 0) setSupervisors(freshData.supervisors);

                // Minimal data for caching
                const minimalDiscussions = freshData.discussions.map(d => ({
                    _id: d._id,
                    discussion: d.discussion,
                    status: d.status,
                    dueDate: d.dueDate,
                    createdAt: d.createdAt,
                    supervisor: d.supervisor ? { _id: d.supervisor._id, firstName: d.supervisor.firstName, lastName: d.supervisor.lastName, profilePicture: d.supervisor.profilePicture } : null
                }));

                const payload = createCachePayload({
                    discussions: minimalDiscussions,
                    totalPages: freshData.totalPages,
                    currentPage: freshData.currentPage
                }, newFingerprint);
                
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));

                if (freshData.supervisors?.length > 0) {
                    const minimalSupervisors = freshData.supervisors.map(s => ({
                        _id: s._id,
                        firstName: s.firstName,
                        lastName: s.lastName
                    }));
                    const supervisorFingerprint = minimalSupervisors.map(s => s._id).join('|');
                    sessionStorage.setItem(
                        `supervisors_data_${user?._id}`,
                        JSON.stringify(createCachePayload(minimalSupervisors, supervisorFingerprint))
                    );
                }
            }
        } catch (error) {
            console.error(error);
            if (!silent) toast.error('Failed to load discussions');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [DISCUSSION_CACHE_TTL_MS, limit, user?._id]);

    const fetchSupervisors = useCallback(async () => {
        const SUPERVISOR_CACHE_KEY = `supervisors_data_${user?._id}`;
        
        // Load from cache first
        const cached = readSessionCache(SUPERVISOR_CACHE_KEY);
        if (cached) {
            setSupervisors(cached.data || cached);
            if (isCacheFresh(cached, SUPERVISOR_CACHE_TTL_MS)) return;
        }

        try {
            const res = await api.get('/discussions/supervisors');
            const freshData = res.data;

            const oldFingerprint = cached?.fingerprint || '';
            const newFingerprint = freshData.map(s => `${s._id}`).join('|');

            if (newFingerprint !== oldFingerprint) {
                setSupervisors(freshData);

                // Minimal data
                const minimalSupervisors = freshData.map(s => ({
                    _id: s._id,
                    firstName: s.firstName,
                    lastName: s.lastName
                }));

                sessionStorage.setItem(SUPERVISOR_CACHE_KEY, JSON.stringify(createCachePayload(minimalSupervisors, newFingerprint)));
            }
        } catch (error) {
            console.error('Error fetching supervisors:', error);
        }
    }, [SUPERVISOR_CACHE_TTL_MS, user?._id]);

    useEffect(() => {
        fetchDiscussions(currentPage);
        if (currentPage === 1) fetchSupervisors();
    }, [currentPage, fetchDiscussions, fetchSupervisors]);

    // Close export menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
                setShowExportMenu(false);
            }
        };
        if (showExportMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showExportMenu]);

    const handleExportExcel = async () => {
        try {
            setIsExporting(true);

            // If no dates selected, use current month
            let start = exportStartDate;
            let end = exportEndDate;

            if (!start || !end) {
                const now = new Date();
                start = format(startOfMonth(now), 'yyyy-MM-dd');
                end = format(endOfMonth(now), 'yyyy-MM-dd');
                // Optionally update state to show user what was used
                setExportStartDate(start);
                setExportEndDate(end);
            }

            // Fetch all discussions for the date range (using a large limit to get all)
            // Realistically, backend might need a specific export endpoint, but we'll use existing with large limit
            const res = await api.get(`/discussions?page=1&limit=1000`);
            let exportData = res.data.discussions || [];

            // Filter data by date range locally if backend doesn't support date filters on this endpoint yet
            exportData = exportData.filter(d => {
                if (!d.createdAt) return false;
                const createdDate = new Date(d.createdAt);
                const startDate = new Date(start);
                startDate.setHours(0, 0, 0, 0);
                const endDate = new Date(end);
                endDate.setHours(23, 59, 59, 999);
                return createdDate >= startDate && createdDate <= endDate;
            });

            if (exportData.length === 0) {
                toast.error('No discussions found in this date range');
                setIsExporting(false);
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Discussions');

            sheet.columns = [
                { header: 'S.No', key: 'slNo', width: 10 },
                { header: 'Description', key: 'description', width: 50 },
                { header: 'Created Date', key: 'createdDate', width: 20 },
                { header: 'Due Date', key: 'dueDate', width: 20 },
                { header: 'Status', key: 'status', width: 20 },
            ];

            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

            exportData.forEach((item, index) => {
                const row = sheet.addRow({
                    slNo: index + 1,
                    description: item.discussion || '-',
                    createdDate: item.createdAt ? format(new Date(item.createdAt), 'dd MMM yyyy') : '-',
                    dueDate: item.dueDate ? format(new Date(item.dueDate), 'dd MMM yyyy') : 'No due date',
                    status: item.status || '-',
                });

                const statusCell = row.getCell('status');
                const statusStr = (item.status || '').toLowerCase();

                // Set styles matching the UI badge colors
                if (statusStr === 'inprogress') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Amber-100
                    statusCell.font = { color: { argb: 'FFB45309' } }; // Amber-700
                } else if (statusStr === 'mark as complete') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Green-100
                    statusCell.font = { color: { argb: 'FF15803D' } }; // Green-700
                } else if (statusStr === 'on-hold') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Slate-100
                    statusCell.font = { color: { argb: 'FF334155' } }; // Slate-700
                } else {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // Blue-100
                    statusCell.font = { color: { argb: 'FF1D4ED8' } }; // Blue-700
                }
            });

            sheet.getColumn('description').alignment = { wrapText: true, vertical: 'top' };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Discussions_Export_${start}_to_${end}.xlsx`);
            toast.success('Excel downloaded successfully');
            setShowExportMenu(false);

        } catch (error) {
            console.error('Error exporting excel:', error);
            toast.error('Failed to export excel');
        } finally {
            setIsExporting(false);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        // Local state update for immediate feedback
        const updateState = (items) => {
            const updated = items.map(d => d._id === id ? { ...d, status: newStatus } : d);
            return updated.sort((a, b) => {
                const aCompleted = a.status === 'mark as complete';
                const bCompleted = b.status === 'mark as complete';
                if (aCompleted && !bCompleted) return 1;
                if (!aCompleted && bCompleted) return -1;
                return 0;
            });
        };

        setDiscussions(prev => updateState(prev));

        try {
            await api.put(`/discussions/${id}`, { status: newStatus });
            toast.success('Status updated');
            fetchDiscussions(currentPage, { silent: true }); // Sync cache and server state
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update status');
            fetchDiscussions(currentPage, { force: true }); // Revert on failure
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

            const res = await api.post('/discussions', payload);
            toast.success('Discussion created');

            // Use the created discussion from response for instant update
            const createdDiscussion = res.data.discussion;
            if (createdDiscussion && currentPage === 1) {
                setDiscussions(prev => [createdDiscussion, ...prev].slice(0, limit));
            }

            fetchDiscussions(1, { silent: true }); // Sync list and cache

            setIsCreating(false);
            setNewDiscussion({
                discussion: '',
                status: 'inprogress',
                dueDate: '',
                supervisor: ''
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
            dueDate: discussion.dueDate ? discussion.dueDate.split('T')[0] : '',
            supervisor: discussion.supervisor?._id || discussion.supervisor
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

            const res = await api.put(`/discussions/${id}`, payload);
            toast.success('Discussion updated');

            // Update local state using API response and sort
            const updatedFromApi = res.data.discussion;
            setDiscussions(prev => {
                const updated = prev.map(d => d._id === id ? { ...d, ...(updatedFromApi || payload) } : d);
                return updated.sort((a, b) => {
                    const aCompleted = a.status === 'mark as complete';
                    const bCompleted = b.status === 'mark as complete';
                    if (aCompleted && !bCompleted) return 1;
                    if (!aCompleted && bCompleted) return -1;
                    return 0;
                });
            });

            fetchDiscussions(currentPage, { silent: true }); // Background fetch to update cache

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
            // Optimistic update
            setDiscussions(prev => prev.filter(d => d._id !== id));

            try {
                await api.delete(`/discussions/${id}`);
                toast.success('Discussion deleted');
                fetchDiscussions(currentPage, { silent: true }); // Re-sync and pull in next page item if needed
            } catch (error) {
                console.error('Error deleting discussion:', error);
                toast.error('Failed to delete discussion');
                fetchDiscussions(currentPage, { force: true }); // Revert on failure
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
        <div className="min-h-screen bg-slate-50 font-sans p-4 sm:p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <MessageSquare className="text-indigo-600" /> Discussions
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Create and manage team discussions, tasks, and topics.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-3 sm:mt-0 items-center">
                        <div className="relative" ref={exportMenuRef}>
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm w-full sm:w-auto"
                            >
                                <Download size={18} />
                                <span>Export Data</span>
                            </button>

                            {/* Export Dropdown Menu */}
                            {showExportMenu && (
                                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                            <Download size={16} className="text-emerald-600" />
                                            Export to Excel
                                        </h3>
                                        <button
                                            onClick={() => setShowExportMenu(false)}
                                            className="text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={exportStartDate}
                                                    onChange={(e) => setExportStartDate(e.target.value)}
                                                    className="w-full text-xs py-1.5 px-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-700"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">End Date</label>
                                                <input
                                                    type="date"
                                                    value={exportEndDate}
                                                    onChange={(e) => setExportEndDate(e.target.value)}
                                                    className="w-full text-xs py-1.5 px-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-700"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-tight">
                                            Leave dates empty to export all discussions from the current month.
                                        </p>
                                        <button
                                            onClick={handleExportExcel}
                                            disabled={isExporting}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors mt-2"
                                        >
                                            {isExporting ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                                            Download Excel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setIsCreating(true)}
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm w-full sm:w-auto"
                        >
                            <Plus size={18} />
                            <span>Create Discussion</span>
                        </button>
                    </div>
                </div>

                {/* List View */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">

                    {/* ── Mobile card list (hidden on md+) ── */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {loading ? (
                            <div className="flex justify-center py-10"><Skeleton className="h-8 w-8 rounded-full" /></div>
                        ) : discussions.length === 0 && !isCreating ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <MessageSquare size={48} className="text-slate-200 mb-4" />
                                <p className="text-base font-medium text-slate-600">No discussions found</p>
                                <p className="text-sm">Start a new discussion.</p>
                            </div>
                        ) : (
                            discussions.map((discussion, index) => (
                                <div key={discussion._id} className="p-4 space-y-2 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-semibold text-slate-400 mr-1">#{(currentPage - 1) * limit + index + 1}</span>
                                            <span className="text-sm text-slate-700 break-words leading-relaxed">
                                                {discussion.discussion && discussion.discussion.length > 80 && !expandedIds.includes(discussion._id)
                                                    ? `${discussion.discussion.substring(0, 80)}...`
                                                    : discussion.discussion}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={discussion.status}
                                            onChange={(e) => handleStatusChange(discussion._id, e.target.value)}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${getStatusBadgeColor(discussion.status)}`}
                                        >
                                            <option value="inprogress">In Progress</option>
                                            <option value="on-hold" disabled={discussion.supervisor?._id !== user?._id}>On-hold {discussion.supervisor?._id !== user?._id && '(Supervisor Only)'}</option>
                                            <option value="mark as complete" disabled={discussion.supervisor?._id !== user?._id}>Mark as complete {discussion.supervisor?._id !== user?._id && '(Supervisor Only)'}</option>
                                        </select>
                                        {discussion.dueDate ? (
                                            <div className="flex items-center text-slate-500 text-xs">
                                                <Calendar size={12} className="mr-1 text-slate-400" />
                                                Due: {format(new Date(discussion.dueDate), 'dd MMM yyyy')}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-xs italic">No due date</span>
                                        )}
                                        <div className="flex items-center text-slate-500 text-xs">
                                            <span className="mr-1 text-slate-400">Created:</span>
                                            {discussion.createdAt ? format(new Date(discussion.createdAt), 'dd MMM yyyy') : '-'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                        {discussion.discussion && discussion.discussion.length > 80 && (
                                            <button onClick={() => toggleDescription(discussion._id)}
                                                className="inline-flex items-center justify-center p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors bg-slate-50 shadow-sm">
                                                {expandedIds.includes(discussion._id) ? <EyeOff size={15} /> : <Eye size={15} />}
                                            </button>
                                        )}
                                        <button onClick={() => handleEditInline(discussion)}
                                            className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition-colors bg-slate-50 shadow-sm">
                                            <Edit size={15} />
                                        </button>
                                        <button onClick={() => handleDelete(discussion._id)}
                                            className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors bg-slate-50 shadow-sm">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* ── Desktop table (hidden below md) ── */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm table-fixed">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600 w-16">S.No</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Description</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600 w-32">Created Date</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600 w-32">Due Date</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600 w-36">Status</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-600 w-44">Supervisor</th>
                                    <th className="px-6 py-4 text-right font-semibold text-slate-600 w-64">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isCreating && (
                                    <tr className="bg-indigo-50/50">
                                        <td className="px-6 py-4 text-slate-500 text-sm font-medium">New</td>
                                        <td className="px-6 py-4">
                                            <input type="text" value={newDiscussion.discussion}
                                                onChange={(e) => setNewDiscussion({ ...newDiscussion, discussion: e.target.value })}
                                                placeholder="Enter description"
                                                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-sm whitespace-nowrap">
                                            {format(new Date(), 'dd MMM yyyy')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <input type="date" value={newDiscussion.dueDate}
                                                onChange={(e) => setNewDiscussion({ ...newDiscussion, dueDate: e.target.value })}
                                                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600" />
                                        </td>
                                        <td className="px-6 py-4">
                                            <select value={newDiscussion.status}
                                                onChange={(e) => setNewDiscussion({ ...newDiscussion, status: e.target.value })}
                                                className={`px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-32 ${getStatusBadgeColor(newDiscussion.status)}`}>
                                                <option value="inprogress">In Progress</option>
                                                <option value="on-hold">On-hold</option>
                                                <option value="mark as complete">Mark as complete</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <select value={newDiscussion.supervisor}
                                                onChange={(e) => setNewDiscussion({ ...newDiscussion, supervisor: e.target.value })}
                                                className="w-40 px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                                <option value="">Select Supervisor</option>
                                                {supervisors.map(s => (
                                                    <option key={s._id} value={s._id}>{s.firstName} {s.lastName}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={handleCreateInline} disabled={isSaving}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                                    {isSaving ? '...' : 'Save'}
                                                </button>
                                                <button onClick={() => setIsCreating(false)}
                                                    className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300 transition-colors">
                                                    Cancel
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {loading ? (
                                    <tr><td colSpan="7" className="px-6 py-8">
                                        <div className="flex justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>
                                    </td></tr>
                                ) : discussions.length === 0 && !isCreating ? (
                                    <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <MessageSquare size={48} className="text-slate-200 mb-4" />
                                            <p className="text-lg font-medium text-slate-600">No discussions found</p>
                                            <p className="text-sm">Start a new discussion algorithmically or manually.</p>
                                        </div>
                                    </td></tr>
                                ) : (
                                    discussions.map((discussion, index) => (
                                        editingId === discussion._id ? (
                                            <tr key={`edit-${discussion._id}`} className="bg-indigo-50/20">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-500">{(currentPage - 1) * limit + index + 1}</td>
                                                <td className="px-6 py-4">
                                                    <input type="text" value={editData.discussion}
                                                        onChange={(e) => setEditData({ ...editData, discussion: e.target.value })}
                                                        placeholder="Enter description"
                                                        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 text-sm whitespace-nowrap">
                                                    {discussion.createdAt ? format(new Date(discussion.createdAt), 'dd MMM yyyy') : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <input type="date" value={editData.dueDate}
                                                        onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                                                        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600" />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <select value={editData.status}
                                                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                                                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-32 truncate ${getStatusBadgeColor(editData.status)}`}>
                                                        <option value="inprogress">In Progress</option>
                                                        <option value="on-hold" disabled={discussion.supervisor?._id !== user?._id}>On-hold {discussion.supervisor?._id !== user?._id && '(Supervisor Only)'}</option>
                                                        <option value="mark as complete" disabled={discussion.supervisor?._id !== user?._id}>Mark as complete {discussion.supervisor?._id !== user?._id && '(Supervisor Only)'}</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <select value={editData.supervisor}
                                                        onChange={(e) => setEditData({ ...editData, supervisor: e.target.value })}
                                                        className="w-40 px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700">
                                                        <option value="">Select Supervisor</option>
                                                        {supervisors.map(s => (
                                                            <option key={s._id} value={s._id}>{s.firstName} {s.lastName}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleUpdateInline(discussion._id)} disabled={isSaving}
                                                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                                            {isSaving ? '...' : 'Save'}
                                                        </button>
                                                        <button onClick={() => { setEditingId(null); setEditData(null); }}
                                                            className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300 transition-colors">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr key={discussion._id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-500">{(currentPage - 1) * limit + index + 1}</td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600 break-words whitespace-normal leading-relaxed">
                                                        {discussion.discussion && discussion.discussion.length > 55 && !expandedIds.includes(discussion._id)
                                                            ? `${discussion.discussion.substring(0, 55)}...`
                                                            : discussion.discussion}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-700 text-sm whitespace-nowrap">
                                                    {discussion.createdAt ? format(new Date(discussion.createdAt), 'dd MMM yyyy') : '-'}
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
                                                    <select value={discussion.status}
                                                        onChange={(e) => handleStatusChange(discussion._id, e.target.value)}
                                                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-32 truncate ${getStatusBadgeColor(discussion.status)}`}>
                                                        <option value="inprogress">In Progress</option>
                                                        <option value="on-hold" disabled={discussion.supervisor?._id !== user?._id}>On-hold {discussion.supervisor?._id !== user?._id && '(Supervisor Only)'}</option>
                                                        <option value="mark as complete" disabled={discussion.supervisor?._id !== user?._id}>Mark as complete {discussion.supervisor?._id !== user?._id && '(Supervisor Only)'}</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {discussion.supervisor?.profilePicture ? (
                                                            <img src={discussion.supervisor.profilePicture} alt="" className="w-6 h-6 rounded-full border border-slate-200" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200 uppercase">
                                                                {discussion.supervisor?.firstName?.[0]}{discussion.supervisor?.lastName?.[0]}
                                                            </div>
                                                        )}
                                                        <span className="text-xs text-slate-600 font-medium">
                                                            {discussion.supervisor?.firstName} {discussion.supervisor?.lastName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {discussion.discussion && discussion.discussion.length > 55 && (
                                                            <button onClick={() => toggleDescription(discussion._id)}
                                                                title={expandedIds.includes(discussion._id) ? 'Show Less' : 'View'}
                                                                className="inline-flex items-center justify-center p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors bg-slate-50 border-transparent shadow-sm">
                                                                {expandedIds.includes(discussion._id) ? <EyeOff size={16} /> : <Eye size={16} />}
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleEditInline(discussion)} title="Edit"
                                                            className="inline-flex items-center justify-center p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition-colors bg-slate-50 border-transparent shadow-sm">
                                                            <Edit size={16} />
                                                        </button>
                                                        <button onClick={() => handleDelete(discussion._id)} title="Delete"
                                                            className="inline-flex items-center justify-center p-2 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors bg-slate-50 border-transparent shadow-sm">
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
                        <div className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-slate-500">
                                Page <span className="font-medium text-slate-700">{currentPage}</span> of <span className="font-medium text-slate-700">{totalPages}</span>
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
                                        <button key={i} onClick={() => setCurrentPage(i + 1)} disabled={loading}
                                            className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${currentPage === i + 1 ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
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
