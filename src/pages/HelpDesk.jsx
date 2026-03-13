import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { LifeBuoy, Plus, Clock, CheckCircle, AlertCircle, MessageSquare, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import HelpdeskWorkflows from './HelpdeskWorkflows';

const QueryFormModal = ({ isOpen, onClose, onSuccess }) => {
    const [queryTypes, setQueryTypes] = useState([]);
    const [formData, setFormData] = useState({ subject: '', description: '', queryTypeId: '', priority: 'Medium' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchTypes();
            setFormData({ subject: '', description: '', queryTypeId: '', priority: 'Medium' });
        }
    }, [isOpen]);

    const fetchTypes = async () => {
        try {
            const res = await api.get('/helpdesk/types');
            setQueryTypes(res.data.data.filter(qt => qt.isActive));
        } catch (error) {
            toast.error('Failed to load query types');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/helpdesk', formData);
            toast.success('Query submitted successfully');
            onSuccess();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit query');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <h2 className="text-xl font-bold flex items-center text-slate-800">
                        <LifeBuoy className="mr-2 text-indigo-600" size={20} />
                        Raise a Query
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Query Type</label>
                        <select
                            required
                            value={formData.queryTypeId}
                            onChange={e => setFormData({ ...formData, queryTypeId: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                        >
                            <option value="">Select Type...</option>
                            {queryTypes.map(qt => (
                                <option key={qt._id} value={qt._id}>{qt.name}</option>
                            ))}
                        </select>
                        {formData.queryTypeId && (
                            <div className="mt-2 p-2 bg-indigo-50 border border-indigo-100 rounded-lg animate-in fade-in duration-300">
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Assigned Responsible Person</p>
                                <p className="text-sm font-semibold text-indigo-700">
                                    {queryTypes.find(qt => qt._id === formData.queryTypeId)?.assignedPerson?.firstName} {queryTypes.find(qt => qt._id === formData.queryTypeId)?.assignedPerson?.lastName}
                                </p>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Priority</label>
                        <select
                            value={formData.priority}
                            onChange={e => setFormData({ ...formData, priority: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                        >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subject</label>
                        <input
                            required
                            type="text"
                            value={formData.subject}
                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Brief summary of the issue"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                        <textarea
                            required
                            rows={4}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                            placeholder="Detailed explanation of your query..."
                        />
                    </div>

                    <div className="flex justify-end pt-4 gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center">
                            {submitting ? 'Submitting...' : 'Submit Query'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const HelpDesk = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [queries, setQueries] = useState([]);
    const [assignedQueries, setAssignedQueries] = useState([]);
    const [allQueries, setAllQueries] = useState([]);
    const [escalatedQueries, setEscalatedQueries] = useState([]);
    const [tabLoading, setTabLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('my-queries');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showAllQueries, setShowAllQueries] = useState(false);
    
    const [filters, setFilters] = useState({ status: '', priority: '' });

    const isAdmin = user?.roles?.some(r => (r.name || r) === 'Admin' || r?.isSystem === true);
    const isResolverRole = user?.roles?.some(r => ['HR', 'Supervisor', 'Admin'].includes(r.name || r));

    // Track which tabs have already been fetched to avoid redundant API calls
    const loadedTabs = React.useRef(new Set());

    const fetchTabData = async (tab, force = false) => {
        if (!force && loadedTabs.current.has(tab)) return; // already loaded, skip
        try {
            setTabLoading(true);
            if (tab === 'my-queries') {
                const res = await api.get('/helpdesk/my-queries');
                setQueries(res.data.data || res.data);
            } else if (tab === 'assigned') {
                const [assignedRes, allRes] = await Promise.all([
                    api.get('/helpdesk/assigned'),
                    isAdmin ? api.get('/helpdesk/all') : Promise.resolve(null),
                ]);
                setAssignedQueries(assignedRes.data.data || assignedRes.data);
                if (allRes) setAllQueries(allRes.data.data || allRes.data);
            } else if (tab === 'escalated' && isAdmin) {
                const res = await api.get('/helpdesk/escalated');
                setEscalatedQueries(res.data.data || res.data);
            }
            loadedTabs.current.add(tab);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load helpdesk queries');
        } finally {
            setTabLoading(false);
        }
    };

    // Refresh only the currently active tab (called after raising a new query)
    const refreshTab = () => {
        loadedTabs.current.delete(activeTab);
        fetchTabData(activeTab, true);
    };

    // Initial fetch on mount
    useEffect(() => {
        fetchTabData('my-queries');
        // Only attempt to fetch assigned queries if user has a resolver role
        if (isResolverRole) {
            fetchTabData('assigned');
        }
    }, [isResolverRole]);

    // Fetch data whenever the active tab changes (for tabs not fetched on mount)
    useEffect(() => {
        const alreadyFetched = activeTab === 'my-queries' || (activeTab === 'assigned' && isResolverRole);
        if (!alreadyFetched) {
            fetchTabData(activeTab);
        }
    }, [activeTab, isResolverRole]);

    const getStatusBadge = (status) => {
        const lowerS = status?.toLowerCase() || '';
        let style = 'bg-slate-100 text-slate-600 border border-slate-200';

        if (lowerS === 'new') style = 'bg-amber-100 text-amber-700 border border-amber-200';
        else if (lowerS === 'in progress') style = 'bg-blue-100 text-blue-700 border border-blue-200';
        else if (lowerS === 'pending') style = 'bg-purple-100 text-purple-700 border border-purple-200';
        else if (lowerS === 'escalated') style = 'bg-red-100 text-red-700 border border-red-200 animate-pulse';
        else if (lowerS === 'closed') style = 'bg-emerald-100 text-emerald-700 border border-emerald-200';

        return <span className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded-full tracking-wider ${style}`}>{status}</span>;
    };

    const getPriorityIcon = (priority) => {
        switch (priority) {
            case 'Urgent': return <AlertCircle size={14} className="text-red-500" />;
            case 'High': return <AlertCircle size={14} className="text-orange-500" />;
            case 'Low': return <Clock size={14} className="text-slate-400" />;
            default: return <CheckCircle size={14} className="text-blue-500" />;
        }
    };

    const renderTable = (data, isAssignedView = false) => {
        const loadingSpinner = (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm text-slate-400 font-medium">Loading queries...</p>
            </div>
        );
        const emptyState = (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <LifeBuoy size={48} className="text-slate-200 mb-4" />
                <p className="text-base font-medium text-slate-600">No queries found</p>
                <p className="text-sm mt-1">You're all caught up!</p>
            </div>
        );
        return (
            <div className="mt-4">
                {/* ── Mobile card list (hidden on md+) ── */}
                <div className="md:hidden space-y-3">
                    {tabLoading ? loadingSpinner : data.length === 0 ? emptyState : data.map(query => (
                        <div key={query._id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-800 text-sm truncate flex items-center gap-1">
                                        {query.status === 'Escalated' && <AlertTriangle size={14} className="text-red-500 fill-red-50" />}
                                        {query.subject}
                                    </div>
                                    <div className="text-xs text-indigo-500 font-medium mt-0.5">{query.queryId}</div>
                                </div>
                                {getStatusBadge(query.status)}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 font-medium">{query.queryType?.name || 'Unknown'}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-600 font-medium">{getPriorityIcon(query.priority)}{query.priority}</span>
                                {isAssignedView && query.raisedBy && (
                                    <span className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-600 font-medium">{query.raisedBy.firstName} {query.raisedBy.lastName}</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between pt-1">
                                <div className="text-xs text-slate-400">
                                    <span className="font-semibold text-slate-500">Opened: </span>{format(new Date(query.createdAt), 'MMM dd, yy')}
                                    {query.closedAt && <span className="ml-2 text-emerald-600"><span className="font-semibold">Closed: </span>{format(new Date(query.closedAt), 'MMM dd, yy')}</span>}
                                </div>
                                <button
                                    onClick={() => navigate(`/helpdesk/${query._id}`)}
                                    className="inline-flex items-center px-3 py-1.5 border border-slate-300 text-xs font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-300 transition-all"
                                >
                                    View
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Desktop table (hidden below md) ── */}
                <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Query ID</th>
                                    <th className="px-6 py-4">Subject</th>
                                    <th className="px-6 py-4">Type</th>
                                    {isAssignedView && <th className="px-6 py-4">Raised By</th>}
                                    <th className="px-6 py-4">Priority</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-center">Dates</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tabLoading ? (
                                    <tr><td colSpan={isAssignedView ? '8' : '7'} className="py-16">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                            <p className="text-sm text-slate-400 font-medium">Loading queries...</p>
                                        </div>
                                    </td></tr>
                                ) : data.length === 0 ? (
                                    <tr><td colSpan={isAssignedView ? '8' : '7'} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <LifeBuoy size={48} className="text-slate-200 mb-4" />
                                            <p className="text-base font-medium text-slate-600">No queries found</p>
                                            <p className="text-sm mt-1">You're all caught up!</p>
                                        </div>
                                    </td></tr>
                                ) : data.map(query => (
                                    <tr key={query._id} className="hover:bg-slate-50 transition border-b border-slate-50">
                                        <td className="px-6 py-4 font-medium text-indigo-600">{query.queryId}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => navigate(`/helpdesk/${query._id}`)}>
                                                {query.status === 'Escalated' && <AlertTriangle size={14} className="text-red-500 fill-red-50" />}
                                                {query.subject}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1 flex items-center">
                                                <MessageSquare size={12} className="mr-1" /> {query.comments?.length || 0} comments
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">{query.queryType?.name || 'Unknown'}</span>
                                        </td>
                                        {isAssignedView && (
                                            <td className="px-6 py-4 text-slate-600 font-medium text-xs">{query.raisedBy?.firstName} {query.raisedBy?.lastName}</td>
                                        )}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-1.5 font-medium text-slate-700">
                                                {getPriorityIcon(query.priority)}<span>{query.priority}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">{getStatusBadge(query.status)}</td>
                                        <td className="px-6 py-4 text-slate-600 text-xs text-center border-l bg-slate-50/30">
                                            <div className="flex flex-col gap-1 items-center justify-center">
                                                <div className="font-semibold text-slate-700 whitespace-nowrap">
                                                    <span className="text-[10px] uppercase text-slate-400 font-bold block mb-0.5">Opened</span>
                                                    {format(new Date(query.createdAt), 'MMM dd, yy')}
                                                </div>
                                                {query.closedAt && (
                                                    <div className="font-semibold text-emerald-600 whitespace-nowrap mt-1 pt-1 border-t border-slate-200">
                                                        <span className="text-[10px] uppercase text-emerald-600/70 font-bold block mb-0.5">Closed</span>
                                                        {format(new Date(query.closedAt), 'MMM dd, yy')}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => navigate(`/helpdesk/${query._id}`)}
                                                className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-xs font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm"
                                            >
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    if (false) return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans p-4 sm:p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
                            <LifeBuoy className="mr-2 sm:mr-3 text-indigo-600" size={28} /> Help Desk
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">Raise support tickets, track resolutions, and get help quickly.</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 sm:px-5 rounded-xl font-semibold shadow-md shadow-indigo-600/20 transition-all hover:-translate-y-0.5 w-full sm:w-auto"
                    >
                        <Plus size={18} />
                        <span>Raise Query</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="overflow-x-auto pb-1 mb-4 sm:mb-6">
                    <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-max">
                        <button
                            onClick={() => setActiveTab('my-queries')}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'my-queries' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            My Queries
                        </button>
                        {(isResolverRole || assignedQueries.length > 0) && (
                            <button
                                onClick={() => setActiveTab('assigned')}
                                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'assigned' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                <span className="flex items-center">
                                    {isAdmin ? 'Queries' : 'Assigned to Me'}
                                    {assignedQueries.filter(q => q.status === 'New' || q.status === 'In Progress').length > 0 && (
                                        <span className="ml-2 bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                            {assignedQueries.filter(q => q.status === 'New' || q.status === 'In Progress').length}
                                        </span>
                                    )}
                                </span>
                            </button>
                        )}
                        {isAdmin && (
                            <>
                                <button
                                    onClick={() => setActiveTab('escalated')}
                                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'escalated' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    <span className="flex items-center">
                                        <AlertTriangle size={14} className="mr-1.5 text-red-500" />
                                        Escalated
                                        {escalatedQueries.length > 0 && (
                                            <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                                                {escalatedQueries.length}
                                            </span>
                                        )}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('workflows')}
                                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'workflows' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Manage Workflows
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Content */}
                {activeTab === 'my-queries' && renderTable(queries, false)}
                {activeTab === 'assigned' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <select 
                                    value={filters.status}
                                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="New">New</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Escalated">Escalated</option>
                                    <option value="Closed">Closed</option>
                                </select>
                                <select 
                                    value={filters.priority}
                                    onChange={(e) => setFilters({...filters, priority: e.target.value})}
                                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                >
                                    <option value="">All Priorities</option>
                                    <option value="Urgent">Urgent</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>

                            {isAdmin && (
                                <div className="bg-slate-200/50 p-1 rounded-lg inline-flex items-center">
                                    <button
                                        onClick={() => setShowAllQueries(false)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${!showAllQueries ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Assigned to Me
                                    </button>
                                    <button
                                        onClick={() => setShowAllQueries(true)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${showAllQueries ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        All Queries
                                    </button>
                                </div>
                            )}
                        </div>
                        {renderTable((showAllQueries ? allQueries : assignedQueries).filter(q => {
                            if (filters.status && q.status !== filters.status) return false;
                            if (filters.priority && q.priority !== filters.priority) return false;
                            return true;
                        }), true)}
                    </div>
                )}
                {activeTab === 'escalated' && renderTable(escalatedQueries, true)}
                {activeTab === 'workflows' && isAdmin && <HelpdeskWorkflows />}

            </div>

            <QueryFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={refreshTab} />
        </div>
    );
};

export default HelpDesk;
