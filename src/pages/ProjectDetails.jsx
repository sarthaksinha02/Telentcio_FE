import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import api from '../api/axios';
import { Briefcase, Plus, Folder, CheckSquare, User, Calendar, ArrowLeft, Clock, LayoutList, ListTree, GanttChart, ChevronDown, ChevronRight, ListChecks, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import { format, differenceInDays, addDays, isValid, parseISO } from 'date-fns';

const ProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const canCreateProject = user?.roles?.includes('Admin') || user?.permissions?.includes('project.create');
    const canUpdateProject = user?.roles?.includes('Admin') || user?.permissions?.includes('project.update');
    const canCreateTask = user?.roles?.includes('Admin') || user?.permissions?.includes('task.create');
    const canUpdateTask = user?.roles?.includes('Admin') || user?.permissions?.includes('task.update');
    const canDeleteModule = user?.roles?.includes('Admin') || user?.permissions?.includes('module.delete');
    const canDeleteTask = user?.roles?.includes('Admin') || user?.permissions?.includes('task.delete');

    const [project, setProject] = useState(null);
    const [modules, setModules] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('overview'); // 'overview', 'hierarchy', 'timeline'

    // Modals
    const [showModuleModal, setShowModuleModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showLogModal, setShowLogModal] = useState(false);

    // Forms
    const [moduleForm, setModuleForm] = useState({ name: '', description: '', status: 'PLANNED', startDate: '', dueDate: '' });
    const [taskForm, setTaskForm] = useState({ name: '', description: '', assignees: [], priority: 'MEDIUM', startDate: '', dueDate: '', estimatedHours: '' });
    const [logForm, setLogForm] = useState({ date: new Date().toISOString().split('T')[0], hours: '', description: '' });

    // Editing State
    const [editingModuleId, setEditingModuleId] = useState(null);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [activeModuleId, setActiveModuleId] = useState(null);
    const [loggingTaskId, setLoggingTaskId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [projRes, empRes] = await Promise.all([
                api.get(`/projects/${id}/hierarchy`),
                api.get('/projects/employees')
            ]);

            const projData = projRes.data;
            setProject(projData);
            setModules(projData.modules || []);
            setTasks(projData.modules?.flatMap(m => m.tasks) || []);
            setEmployees(empRes.data);

        } catch (error) {
            console.error(error);
            toast.error('Failed to load project details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    // --- Handlers (Keep existing logic mostly) ---
    const handleCreateModule = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingModuleId) {
                await api.put(`/projects/modules/${editingModuleId}`, moduleForm);
                toast.success('Module Updated');
            } else {
                await api.post('/projects/modules', { ...moduleForm, project: id });
                toast.success('Module Created');
            }
            setShowModuleModal(false);
            setEditingModuleId(null);
            setModuleForm({ name: '', description: '', status: 'PLANNED', startDate: '', dueDate: '' });
            fetchData();
        } catch (error) {
            toast.error('Failed to save module');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingTaskId) {
                await api.put(`/projects/tasks/${editingTaskId}`, taskForm);
                toast.success('Task Updated');
            } else {
                await api.post('/projects/tasks', { ...taskForm, module: activeModuleId });
                toast.success('Task Created');
            }
            setShowTaskModal(false);
            setEditingTaskId(null);
            setTaskForm({ name: '', description: '', assignees: [], priority: 'MEDIUM', startDate: '', dueDate: '', estimatedHours: '' });
            fetchData();
        } catch (error) {
            toast.error('Failed to save task');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogWork = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post(`/projects/tasks/${loggingTaskId}/log`, logForm);
            toast.success('Work Logged Successfully');
            setShowLogModal(false);
            setLoggingTaskId(null);
        } catch (error) {
            toast.error('Failed to log work');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openCreateModuleModal = () => {
        setModuleForm({ name: '', description: '', status: 'PLANNED', startDate: '', dueDate: '' });
        setEditingModuleId(null);
        setShowModuleModal(true);
    };

    const openCreateTaskModal = (moduleId) => {
        setTaskForm({ name: '', description: '', assignees: [], priority: 'MEDIUM', startDate: '', dueDate: '', estimatedHours: '' });
        setEditingTaskId(null);
        setActiveModuleId(moduleId);
        setShowTaskModal(true);
    };

    const handleEditModule = (module) => {
        setModuleForm({
            name: module.name,
            description: module.description || '',
            status: module.status,
            startDate: module.startDate ? new Date(module.startDate).toISOString().split('T')[0] : '',
            dueDate: module.dueDate ? new Date(module.dueDate).toISOString().split('T')[0] : ''
        });
        setEditingModuleId(module._id);
        setShowModuleModal(true);
    };

    const handleEditTask = (task, moduleId) => {
        setTaskForm({
            name: task.name,
            description: task.description || '',
            assignees: task.assignees ? task.assignees.map(a => a._id) : [],
            priority: task.priority || 'MEDIUM',
            startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
            estimatedHours: task.estimatedHours || ''
        });
        setEditingTaskId(task._id);
        setActiveModuleId(moduleId);
        setShowTaskModal(true);
    };

    const openLogModal = (taskId) => {
        setLoggingTaskId(taskId);
        setLogForm({ date: new Date().toISOString().split('T')[0], hours: '', description: '' });
        setShowLogModal(true);
    };

    // --- Views ---

    const OverviewView = () => (
        <div className="space-y-6">
            {modules.map(module => (
                <div key={module._id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleEditModule(module)}>
                            <Folder size={20} className="text-blue-500" />
                            <h3 className="font-bold text-slate-800 text-lg">{module.name}</h3>
                            <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded">{module.status}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {canDeleteModule && (
                                <Button
                                    variant="ghost"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm('Are you sure you want to delete this module? All tasks within it will be deleted.')) {
                                            try {
                                                await api.delete(`/projects/modules/${module._id}`);
                                                toast.success('Module Deleted');
                                                fetchData();
                                            } catch (error) {
                                                toast.error('Failed to delete module');
                                            }
                                        }
                                    }}
                                    className="text-slate-400 hover:text-red-600 p-1 h-auto w-auto"
                                    title="Delete Module"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            )}
                            {canCreateTask && (
                                <button onClick={() => openCreateTaskModal(module._id)} className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1 font-medium bg-transparent border-0 cursor-pointer">
                                    <Plus size={16} /> <span>Add Task</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="p-4">
                        {module.tasks && module.tasks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {module.tasks.map(task => (
                                    <div key={task._id} className="border border-slate-100 rounded p-4 hover:shadow-md transition-shadow bg-white flex flex-col justify-between group relative">
                                        <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {canUpdateTask && <button onClick={() => handleEditTask(task, module._id)} className="text-slate-400 hover:text-blue-500 p-1"><CheckSquare size={16} /></button>}
                                            {canDeleteTask && (
                                                <Button
                                                    variant="ghost"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm('Delete this task?')) {
                                                            try {
                                                                await api.delete(`/projects/tasks/${task._id}`);
                                                                toast.success('Task Deleted');
                                                                fetchData();
                                                            } catch (error) {
                                                                toast.error('Failed to delete task');
                                                            }
                                                        }
                                                    }}
                                                    className="text-slate-400 hover:text-red-500 p-1 h-auto w-auto"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-semibold text-slate-800">{task.name}</h4>
                                                <div className={`h-2 w-2 rounded-full mt-1.5 ${task.priority === 'HIGH' ? 'bg-red-500' : task.priority === 'MEDIUM' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                                            </div>
                                            <p className="text-sm text-slate-500 line-clamp-2 mb-3">{task.description}</p>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-50">
                                            <div className="flex items-center space-x-1">
                                                <User size={14} />
                                                <span>{task.assignees?.length || 0} Assignees</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <Calendar size={14} />
                                                <span>{task.dueDate ? format(new Date(task.dueDate), 'MMM d') : '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400 text-sm italic">No tasks yet.</div>
                        )}
                    </div>
                </div>
            ))}
            {modules.length === 0 && <div className="text-center py-12 text-slate-400">No modules found. Create one to get started.</div>}
        </div>
    );

    const HierarchyView = () => {
        const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());

        const toggleTask = (taskId) => {
            const newExpanded = new Set(expandedTaskIds);
            if (newExpanded.has(taskId)) {
                newExpanded.delete(taskId);
            } else {
                newExpanded.add(taskId);
            }
            setExpandedTaskIds(newExpanded);
        };

        return (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 pl-8">Name</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Assignees</th>
                            <th className="px-6 py-4">Timeline</th>
                            <th className="px-6 py-4">Progress</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {modules.map(module => (
                            <React.Fragment key={module._id}>
                                <tr className="bg-slate-50/50">
                                    <td className="px-6 py-3 font-semibold text-slate-800 flex items-center gap-2">
                                        <Folder size={18} className="text-blue-600" /> {module.name}
                                    </td>
                                    <td className="px-6 py-3"><span className={`text-xs px-2 py-0.5 rounded border ${module.status === 'COMPLETED' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>{module.status}</span></td>
                                    <td className="px-6 py-3 text-slate-400">-</td>
                                    <td className="px-6 py-3 text-xs text-slate-500 font-mono">
                                        {module.startDate ? format(new Date(module.startDate), 'MMM d') : '...'} - {module.dueDate ? format(new Date(module.dueDate), 'MMM d') : '...'}
                                    </td>
                                    <td className="px-6 py-3">-</td>
                                    <td className="px-6 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {canDeleteModule && (
                                                <Button
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        if (window.confirm('Are you sure you want to delete this module?')) {
                                                            try {
                                                                await api.delete(`/projects/modules/${module._id}`);
                                                                toast.success('Module Deleted');
                                                                fetchData();
                                                            } catch (error) {
                                                                toast.error('Failed');
                                                            }
                                                        }
                                                    }}
                                                    className="text-slate-400 hover:text-red-600 p-1 h-auto w-auto"
                                                    title="Delete Module"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            )}
                                            {canCreateTask && (
                                                <button onClick={() => openCreateTaskModal(module._id)} className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center justify-end gap-1">
                                                    <Plus size={14} /> Add Task
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                {module.tasks?.map(task => {
                                    const isExpanded = expandedTaskIds.has(task._id);
                                    const progress = task.estimatedHours ? Math.min((task.loggedHours / task.estimatedHours) * 100, 100) : 0;

                                    return (
                                        <React.Fragment key={task._id}>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-3 pl-12 text-slate-700">
                                                    <div className="flex items-center gap-3">
                                                        <div onClick={() => toggleTask(task._id)} className="cursor-pointer text-slate-400 hover:text-slate-600">
                                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                        </div>
                                                        <div className={`w-2 h-2 rounded-full ${task.priority === 'HIGH' ? 'bg-red-500' : task.priority === 'MEDIUM' ? 'bg-orange-500' : 'bg-blue-400'}`}></div>
                                                        <span className="font-medium">{task.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${task.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {task.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex -space-x-2">
                                                        {task.assignees?.map((a, i) => (
                                                            <div key={a._id} className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] text-blue-600 font-bold" title={`${a.firstName} ${a.lastName}`}>
                                                                {a.firstName[0]}{a.lastName[0]}
                                                            </div>
                                                        ))}
                                                        {(!task.assignees || task.assignees.length === 0) && <span className="text-xs text-slate-400 italic">Unassigned</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-xs text-slate-600 font-mono">
                                                    {task.startDate ? format(new Date(task.startDate), 'MMM d') : ''} - {task.dueDate ? format(new Date(task.dueDate), 'MMM d') : ''}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-24">
                                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }}></div>
                                                        </div>
                                                        <span className="text-[10px] text-slate-500 whitespace-nowrap">{task.loggedHours || 0} / {task.estimatedHours || '-'}h</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {canUpdateTask && (
                                                            <>
                                                                <button onClick={() => openLogModal(task._id)} title="Log Work" className="text-slate-400 hover:text-green-600"><Clock size={16} /></button>
                                                                <button onClick={() => handleEditTask(task, module._id)} title="Edit" className="text-slate-400 hover:text-blue-600"><CheckSquare size={16} /></button>
                                                            </>
                                                        )}
                                                        {canDeleteTask && (
                                                            <Button
                                                                variant="ghost"
                                                                onClick={async () => {
                                                                    if (window.confirm('Delete this task?')) {
                                                                        try {
                                                                            await api.delete(`/projects/tasks/${task._id}`);
                                                                            toast.success('Task Deleted');
                                                                            fetchData();
                                                                        } catch (error) {
                                                                            toast.error('Failed');
                                                                        }
                                                                    }
                                                                }}
                                                                title="Delete"
                                                                className="text-slate-400 hover:text-red-600 p-1 h-auto w-auto"
                                                            >
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan="6" className="px-6 py-4 pl-20">
                                                        <div className="text-sm">
                                                            <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><ListChecks size={16} className="text-slate-400" /> Work Logs</h5>
                                                            {task.workLogs && task.workLogs.length > 0 ? (
                                                                <div className="space-y-2 max-w-2xl">
                                                                    {task.workLogs.map(log => (
                                                                        <div key={log._id} className="flex items-start justify-between bg-white p-2 rounded border border-slate-200">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                                                                    {log.user?.firstName?.[0]}
                                                                                </div>
                                                                                <div>
                                                                                    <div className="flex items-baseline gap-2">
                                                                                        <span className="font-medium text-slate-700">{log.user?.firstName} {log.user?.lastName}</span>
                                                                                        <span className="text-xs text-slate-400">{format(new Date(log.date), 'MMM d, yyyy')}</span>
                                                                                    </div>
                                                                                    <p className="text-slate-600 text-xs mt-0.5">{log.description}</p>
                                                                                </div>
                                                                            </div>
                                                                            <span className="font-mono font-bold text-slate-700 text-xs">{log.hours}h</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-slate-400 italic text-xs">No work logged yet.</p>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const TimelineView = () => {
        const [timelineScale, setTimelineScale] = useState('MONTH'); // WEEK, MONTH, QUARTER
        const [expandedModules, setExpandedModules] = useState(new Set(modules.map(m => m._id)));
        const [expandedTasks, setExpandedTasks] = useState(new Set());

        const toggleModule = (modId) => {
            const newSet = new Set(expandedModules);
            if (newSet.has(modId)) newSet.delete(modId);
            else newSet.add(modId);
            setExpandedModules(newSet);
        };

        const toggleTask = (taskId) => {
            const newSet = new Set(expandedTasks);
            if (newSet.has(taskId)) newSet.delete(taskId);
            else newSet.add(taskId);
            setExpandedTasks(newSet);
        };

        // Calculate timeline range
        const allDates = [
            project.startDate, project.dueDate,
            ...modules.flatMap(m => [m.startDate, m.dueDate]),
            ...tasks.flatMap(t => [t.startDate, t.dueDate, ...(t.workLogs?.map(l => l.date) || [])])
        ].filter(d => d && isValid(new Date(d))).map(d => new Date(d));

        if (allDates.length === 0) return (
            <div className="bg-white rounded border border-slate-300 p-12 flex flex-col items-center justify-center text-slate-500">
                <Calendar size={48} className="text-slate-400 mb-4" />
                <p className="text-lg font-medium text-slate-700">No schedule data available</p>
                <p className="text-sm">Set dates to see the roadmap.</p>
            </div>
        );

        const projectStart = new Date(Math.min(...allDates));
        const projectEnd = new Date(Math.max(...allDates));

        // Adjust buffer based on scale
        let start, end;
        if (timelineScale === 'WEEK') {
            start = addDays(projectStart, -7);
            end = addDays(projectEnd, 7);
        } else if (timelineScale === 'QUARTER') {
            start = addDays(projectStart, -30);
            end = addDays(projectEnd, 30);
        } else {
            // MONTH default
            start = addDays(projectStart, -15);
            end = addDays(projectEnd, 15);
        }

        const totalDays = Math.max(differenceInDays(end, start) + 1, 1);

        const getPosition = (date) => {
            if (!date || !isValid(new Date(date))) return -100;
            return (differenceInDays(new Date(date), start) / totalDays) * 100;
        };

        const getWidth = (s, e) => {
            const sDate = s ? new Date(s) : start;
            const eDate = e ? new Date(e) : sDate;
            const validS = isValid(sDate) ? sDate : start;
            const validE = isValid(eDate) ? eDate : validS;
            return Math.max((differenceInDays(validE, validS) / totalDays) * 100, 0.5);
        };

        // Generate date ticks
        const ticks = [];
        const tickCount = timelineScale === 'WEEK' ? 7 : timelineScale === 'QUARTER' ? 6 : 10;

        for (let i = 0; i <= tickCount; i++) {
            const date = addDays(start, Math.round((totalDays / tickCount) * i));
            ticks.push({ left: (i / tickCount) * 100, label: format(date, 'MMM d') });
        }

        const todayPos = getPosition(new Date());

        return (
            <div className="bg-white rounded-md shadow-sm border border-slate-300 overflow-hidden flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
                {/* Controls & Legend */}
                <div className="p-3 border-b border-slate-300 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 z-40 sticky top-0">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-600 uppercase">View:</span>
                        <div className="flex bg-white rounded border border-slate-300 p-0.5">
                            {['WEEK', 'MONTH', 'QUARTER'].map(scale => (
                                <button
                                    key={scale}
                                    onClick={() => setTimelineScale(scale)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-sm transition-colors ${timelineScale === scale ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    {scale.charAt(0) + scale.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs font-medium text-slate-600">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-700 rounded-sm"></div> Project</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-cyan-600 rounded-sm"></div> Module</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-600 rounded-sm"></div> Done</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-sm"></div> Work Log</div>
                        <div className="flex items-center gap-2"><div className="w-0.5 h-3 bg-red-500"></div> Today</div>
                    </div>
                </div>

                {/* Timeline Header */}
                <div className="flex border-b border-slate-300 bg-white shadow-sm h-10">
                    {/* Grid Columns Header */}
                    <div className="flex w-[500px] flex-shrink-0 border-r border-slate-300 bg-slate-100">
                        <div className="flex-1 p-2 pl-4 font-bold text-slate-700 text-xs uppercase flex items-center">Item Name</div>
                        <div className="w-24 p-2 font-bold text-slate-700 text-xs uppercase flex items-center justify-center border-l border-slate-300">Status</div>
                        <div className="w-20 p-2 font-bold text-slate-700 text-xs uppercase flex items-center justify-center border-l border-slate-300">Owner</div>
                        <div className="w-28 p-2 font-bold text-slate-700 text-xs uppercase flex items-center border-l border-slate-300 pl-4">Progress</div>
                    </div>

                    <div className="flex-1 relative overflow-hidden h-full bg-slate-50">
                        {ticks.map((tick, i) => (
                            <div key={i} className="absolute bottom-0 flex flex-col items-center transform -translate-x-1/2" style={{ left: `${tick.left}%` }}>
                                <span className="text-[10px] text-slate-600 font-semibold mb-1 whitespace-nowrap">{tick.label}</span>
                                <div className="h-1.5 w-px bg-slate-400"></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Timeline Body */}
                <div className="overflow-y-auto flex-1 relative bg-white custom-scrollbar">
                    {/* Vertical Grid Lines Layer */}
                    <div className="absolute top-0 bottom-0 right-0 left-[500px] pointer-events-none z-0">
                        {ticks.map((tick, i) => (
                            <div key={i} className="absolute top-0 bottom-0 border-r border-slate-200" style={{ left: `${tick.left}%` }}></div>
                        ))}
                        {todayPos >= 0 && todayPos <= 100 && (
                            <div className="absolute top-0 bottom-0 border-l-2 border-red-500 z-0" style={{ left: `${todayPos}%` }}>
                                <div className="absolute top-0 -translate-x-1/2 bg-red-100 text-red-700 text-[9px] font-bold px-1 py-0.5 border border-red-300">Today</div>
                            </div>
                        )}
                    </div>

                    {/* Project Row */}
                    <div className="flex border-b border-slate-300 bg-slate-50 group z-10 relative">
                        {/* Grid Columns */}
                        <div className="w-[500px] flex-shrink-0 flex bg-slate-50 z-20 sticky left-0 border-r border-slate-300 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            <div className="flex-1 p-2 flex items-center gap-2 truncate pr-4">
                                <div className="flex items-center justify-center text-blue-700">
                                    <Briefcase size={14} />
                                </div>
                                <span className="font-bold text-slate-800 text-sm truncate" title={project.name}>{project.name}</span>
                            </div>
                            <div className="w-24 p-2 flex items-center justify-center border-l border-slate-300"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${project.isActive ? 'bg-green-100 border-green-300 text-green-800' : 'bg-slate-100 border-slate-300 text-slate-600'}`}>{project.isActive ? 'Active' : 'Inactive'}</span></div>
                            <div className="w-20 p-2 flex items-center justify-center border-l border-slate-300"><div className="w-6 h-6 rounded bg-slate-200 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-700">{project.manager?.firstName?.[0] || 'N'}</div></div>
                            <div className="w-28 p-2 flex items-center border-l border-slate-300">
                                <span className="text-xs text-slate-400">-</span>
                            </div>
                        </div>

                        {/* Gantt Bar */}
                        <div className="flex-1 relative h-10 my-auto">
                            <div
                                className="absolute top-1/2 -translate-y-1/2 h-6 bg-blue-700 rounded-sm shadow-sm flex items-center px-2 text-white text-xs font-bold z-10 cursor-default"
                                style={{
                                    left: `${getPosition(project.startDate)}%`,
                                    width: `${getWidth(project.startDate, project.dueDate)}%`
                                }}
                            >
                                <span className="sticky left-2 truncate">{project.name}</span>
                            </div>
                        </div>
                    </div>

                    {modules.map(module => (
                        <React.Fragment key={module._id}>
                            {/* Module Row */}
                            <div className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors z-10 relative">
                                {/* Grid Columns */}
                                <div className="w-[500px] flex-shrink-0 flex bg-white group-hover:bg-slate-50 z-20 sticky left-0 border-r border-slate-300">
                                    <div className="flex-1 p-2 pl-6 flex items-center gap-2 truncate pr-4">
                                        <button onClick={() => toggleModule(module._id)} className="w-4 h-4 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none">
                                            {expandedModules.has(module._id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                        <Folder size={14} className="text-cyan-600 flex-shrink-0" />
                                        <span className="font-semibold text-slate-700 text-xs truncate cursor-pointer hover:underline" onClick={() => toggleModule(module._id)} title={module.name}>{module.name}</span>
                                    </div>
                                    <div className="w-24 p-2 flex items-center justify-center border-l border-slate-300"><span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 uppercase">{module.status}</span></div>
                                    <div className="w-20 p-2 flex items-center justify-center border-l border-slate-300 text-slate-300">-</div>
                                    <div className="w-28 p-2 flex items-center justify-center border-l border-slate-300 text-slate-300">-</div>
                                </div>

                                <div className="flex-1 relative h-9 my-auto">
                                    {module.startDate && module.dueDate && (
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 h-4 bg-cyan-600 rounded-sm flex items-center px-2 text-white text-[10px] font-semibold z-10 cursor-default"
                                            style={{
                                                left: `${getPosition(module.startDate)}%`,
                                                width: `${getWidth(module.startDate, module.dueDate)}%`
                                            }}
                                            title={`Module: ${module.name}`}
                                        >
                                            <span className="truncate">{module.name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Task Rows */}
                            {expandedModules.has(module._id) && module.tasks?.map(task => {
                                const progress = task.estimatedHours ? Math.min((task.loggedHours / task.estimatedHours) * 100, 100) : 0;
                                const hasLogs = task.workLogs && task.workLogs.length > 0;

                                return (
                                    <React.Fragment key={task._id}>
                                        <div className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors group z-10 relative">
                                            {/* Grid Columns */}
                                            <div className="w-[500px] flex-shrink-0 flex bg-white group-hover:bg-slate-50 z-20 sticky left-0 border-r border-slate-300">
                                                <div className="flex-1 p-2 pl-12 flex items-center gap-2 truncate pr-4">
                                                    {hasLogs ? (
                                                        <button onClick={() => toggleTask(task._id)} className="w-4 h-4 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none -ml-5 mr-1">
                                                            {expandedTasks.has(task._id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                        </button>
                                                    ) : <div className="w-4 -ml-5 mr-1"></div>}
                                                    <div className={`w-2 h-2 rounded-sm flex-shrink-0 border border-black/10 ${task.priority === 'HIGH' ? 'bg-red-500' : task.priority === 'MEDIUM' ? 'bg-orange-400' : 'bg-blue-400'}`} title={`Priority: ${task.priority}`}></div>
                                                    <span className="text-slate-700 text-xs truncate" title={task.name}>{task.name}</span>
                                                </div>
                                                <div className="w-24 p-2 flex items-center justify-center border-l border-slate-300">
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm border ${task.status === 'DONE' ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{task.status}</span>
                                                </div>
                                                <div className="w-20 p-2 flex items-center justify-center border-l border-slate-300">
                                                    <div className="flex -space-x-1">
                                                        {task.assignees?.length > 0 ? task.assignees.slice(0, 3).map(a => (
                                                            <div key={a._id} className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center text-[9px] font-bold text-slate-700" title={`${a.firstName} ${a.lastName}`}>
                                                                {a.firstName[0]}
                                                            </div>
                                                        )) : <span className="text-[10px] text-slate-400">-</span>}
                                                    </div>
                                                </div>
                                                <div className="w-28 p-2 flex items-center gap-2 border-l border-slate-300 pl-3">
                                                    <div className="flex-1 h-2 bg-slate-200 rounded-sm overflow-hidden border border-slate-300">
                                                        <div className={`h-full rounded-sm ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${progress}%` }}></div>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-slate-600 w-8 text-right">{Math.round(progress)}%</span>
                                                </div>
                                            </div>

                                            <div className="flex-1 relative h-8 my-auto">
                                                {task.startDate && task.dueDate && (
                                                    <div
                                                        className={`absolute top-1/2 -translate-y-1/2 h-4 rounded-sm flex items-center px-1 truncate transition-all hover:bg-opacity-90 cursor-pointer border ${task.status === 'DONE' ? 'bg-emerald-600 border-emerald-700 text-white' :
                                                            task.priority === 'HIGH' ? 'bg-red-100 border-red-300 text-red-700' :
                                                                'bg-slate-200 border-slate-300 text-slate-700'
                                                            }`}
                                                        style={{
                                                            left: `${getPosition(task.startDate)}%`,
                                                            width: `${getWidth(task.startDate, task.dueDate)}%`
                                                        }}
                                                        title={`Task: ${task.name}`}
                                                    >
                                                        <div className={`absolute top-0 bottom-0 left-0 bg-black/10`} style={{ width: `${progress}%` }}></div>
                                                        <span className="relative z-10 text-[9px] font-semibold truncate px-1">{task.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Work Logs Expansion */}
                                        {expandedTasks.has(task._id) && task.workLogs?.map(log => (
                                            <div key={log._id} className="flex border-b border-slate-200 bg-amber-50/30 hover:bg-amber-50 relative">
                                                {/* Grid Columns */}
                                                <div className="w-[500px] flex-shrink-0 flex bg-amber-50/10 z-20 sticky left-0 border-r border-slate-300">
                                                    <div className="flex-1 p-2 pl-20 flex items-center gap-2 truncate pr-4">
                                                        <div className="w-px h-full bg-slate-300 absolute left-[3.25rem] top-0"></div>
                                                        <span className="text-slate-500 text-[10px] truncate flex items-center gap-1">
                                                            <Clock size={10} className="text-amber-600" />
                                                            <span className="font-medium text-slate-700">{log.hours}h</span> by {log.user?.firstName}
                                                        </span>
                                                    </div>
                                                    <div className="w-24 p-2 flex items-center justify-center border-l border-slate-300">
                                                        <span className="text-[9px] text-slate-400 italic">Logged</span>
                                                    </div>
                                                    <div className="w-20 p-2 flex items-center justify-center border-l border-slate-300">
                                                        <div className="w-4 h-4 rounded-sm bg-slate-100 border border-slate-300 flex items-center justify-center text-[8px] font-bold text-slate-500">
                                                            {log.user?.firstName?.[0]}
                                                        </div>
                                                    </div>
                                                    <div className="w-28 p-2 flex items-center gap-2 border-l border-slate-300">
                                                        <span className="text-[10px] font-mono text-slate-600">{format(new Date(log.date), 'MM/dd')}</span>
                                                    </div>
                                                </div>

                                                <div className="flex-1 relative h-7 my-auto">
                                                    <div
                                                        className="absolute top-1/2 -translate-y-1/2 h-3 bg-amber-500 rounded-sm flex items-center justify-center border border-amber-600 hover:bg-amber-600 cursor-help"
                                                        style={{
                                                            left: `${getPosition(log.date)}%`,
                                                            width: `max(1.5%, 20px)`
                                                        }}
                                                        title={`Work Logged: ${log.hours}h\n${log.description}\nBy: ${log.user?.firstName}`}
                                                    >
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </React.Fragment>
                                )
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-100 font-sans flex flex-col">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
                <div className="flex items-center space-x-4">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div>
                        <Skeleton className="h-6 w-48 mb-1" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
            </header>
            <div className="flex-1 p-6 md:p-8 overflow-hidden flex flex-col">
                <div className="max-w-7xl mx-auto w-full h-full flex flex-col space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                            <Skeleton className="h-40 w-full" />
                            <Skeleton className="h-40 w-full" />
                        </div>
                        <div className="space-y-4">
                            <Skeleton className="h-64 w-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
    if (!project) return <div className="p-8 text-center">Project not found</div>;

    const handleExport = async () => {
        if (!modules || modules.length === 0) {
            toast.error('No data to export');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Project Details');

        // Define Columns
        worksheet.columns = [
            { header: 'Item Name', key: 'name', width: 40 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Assignee / User', key: 'assignee', width: 25 },
            { header: 'Start Date / Log Date', key: 'startDate', width: 15 },
            { header: 'Due Date', key: 'dueDate', width: 15 },
            { header: 'Est. Hours', key: 'estHours', width: 12 },
            { header: 'Logged / Hours', key: 'loggedHours', width: 15 },
            { header: 'Description', key: 'description', width: 40 }
        ];

        // Header Style
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F81BD' } // Blue
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // Iterate and Populate
        // Level 0: Project Root
        const projectRow = worksheet.addRow({
            name: `PROJECT: ${project.name}`,
            status: project.isActive ? 'Active' : 'Inactive',
            assignee: project.manager ? `${project.manager.firstName} ${project.manager.lastName}` : '-',
            startDate: project.startDate ? format(new Date(project.startDate), 'yyyy-MM-dd') : '',
            dueDate: project.dueDate ? format(new Date(project.dueDate), 'yyyy-MM-dd') : '',
            estHours: '-',
            loggedHours: '-',
            description: project.description || ''
        });
        projectRow.outlineLevel = 0;
        projectRow.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
        projectRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC5D9F1' } }; // Lighter Blue

        modules.forEach(module => {
            // Level 1: Module
            const modRow = worksheet.addRow({
                name: `  ${module.name}`,
                status: module.status,
                assignee: '-',
                startDate: module.startDate ? format(new Date(module.startDate), 'yyyy-MM-dd') : '',
                dueDate: module.dueDate ? format(new Date(module.dueDate), 'yyyy-MM-dd') : '',
                estHours: '-',
                loggedHours: '-',
                description: module.description || ''
            });

            modRow.outlineLevel = 1;
            modRow.font = { bold: true, size: 11 };
            modRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1DE' } }; // Light Green
            modRow.getCell('name').alignment = { indent: 1 };

            if (module.tasks && module.tasks.length > 0) {
                module.tasks.forEach(task => {
                    // Level 2: Task
                    const taskRow = worksheet.addRow({
                        name: `    ${task.name}`, // Visual indent
                        status: task.status,
                        assignee: task.assignees?.map(a => `${a.firstName} ${a.lastName}`).join(', ') || 'Unassigned',
                        startDate: task.startDate ? format(new Date(task.startDate), 'yyyy-MM-dd') : '',
                        dueDate: task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
                        estHours: task.estimatedHours || 0,
                        loggedHours: task.loggedHours || 0,
                        description: task.description || ''
                    });

                    taskRow.outlineLevel = 2;
                    taskRow.font = { bold: false };
                    taskRow.getCell('name').alignment = { indent: 2 };

                    // Task Logged Hours formatting
                    const loggedCell = taskRow.getCell('loggedHours');
                    if (task.loggedHours > (task.estimatedHours || 0) && task.estimatedHours > 0) {
                        loggedCell.font = { color: { argb: 'FFFF0000' } }; // Red if over budget
                    }

                    if (task.workLogs && task.workLogs.length > 0) {
                        task.workLogs.forEach(log => {
                            // Level 3: Work Log
                            const logRow = worksheet.addRow({
                                name: `        Log: ${format(new Date(log.date), 'MM/dd')}`, // Visual indent
                                status: '-',
                                assignee: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Unknown',
                                startDate: log.date ? format(new Date(log.date), 'yyyy-MM-dd') : '',
                                dueDate: '-',
                                estHours: '-',
                                loggedHours: log.hours,
                                description: log.description
                            });

                            logRow.outlineLevel = 3;
                            logRow.font = { italic: true, color: { argb: 'FF666666' } }; // Gray
                            logRow.getCell('name').alignment = { indent: 3 };
                        });
                    }
                });
            }
        });

        // Auto filter for top row just in case, though grouping is main feature
        worksheet.autoFilter = {
            from: 'A1',
            to: {
                row: 1,
                column: 8
            }
        };

        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.xlsx`;
        saveAs(new Blob([buffer]), fileName);
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <button onClick={() => navigate('/projects')} className="text-slate-500 hover:text-slate-800 flex items-center space-x-1 mb-2">
                            <ArrowLeft size={16} /> <span>Back to Projects</span>
                        </button>
                        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                            {project.name}
                            <span className={`text-sm px-2 py-0.5 rounded-full border ${project.isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {project.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </h1>
                        <p className="text-slate-500 mt-1">{project.description || 'No description provided.'}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                            <div className="flex items-center gap-1"><User size={14} /> Manager: {project.manager ? `${project.manager.firstName} ${project.manager.lastName}` : 'N/A'}</div>
                            <div className="flex items-center gap-1"><Briefcase size={14} /> Client: {project.client?.name || 'Internal'}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {(user?.roles?.includes('Admin') || user?.permissions?.includes('project.export_report')) && (
                            <button onClick={handleExport} className="zoho-btn-secondary flex items-center space-x-2 bg-white text-green-700 border-green-200 hover:bg-green-50 hover:border-green-300">
                                <ListChecks size={18} /> <span>Export Excel</span>
                            </button>
                        )}
                        <div className="flex bg-white rounded-lg shadow-sm p-1 border border-slate-200">
                            <button onClick={() => setViewMode('overview')} className={`p-2 rounded ${viewMode === 'overview' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`} title="Overview"><LayoutList size={20} /></button>
                            <button onClick={() => setViewMode('hierarchy')} className={`p-2 rounded ${viewMode === 'hierarchy' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`} title="Hierarchy"><ListTree size={20} /></button>
                        </div>
                        {canUpdateProject && (
                            <button onClick={openCreateModuleModal} className="zoho-btn-primary flex items-center space-x-2">
                                <Plus size={18} /> <span>Add Module</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {viewMode === 'overview' && <OverviewView />}
                {viewMode === 'hierarchy' && <HierarchyView />}

            </div>

            {/* Modals Reuse (Simplified for brevity in diff, but must include full modal code) */}
            {showModuleModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">{editingModuleId ? 'Edit Module' : 'New Module'}</h3>
                            <button onClick={() => setShowModuleModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleCreateModule} className="p-6 space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Module Name</label><input required className="zoho-input" value={moduleForm.name} onChange={e => setModuleForm({ ...moduleForm, name: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label><select className="zoho-input" value={moduleForm.status} onChange={e => setModuleForm({ ...moduleForm, status: e.target.value })}><option value="PLANNED">Planned</option><option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option></select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label><input type="date" className="zoho-input" value={moduleForm.startDate} onChange={e => setModuleForm({ ...moduleForm, startDate: e.target.value })} /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label><input type="date" className="zoho-input" value={moduleForm.dueDate} onChange={e => setModuleForm({ ...moduleForm, dueDate: e.target.value })} /></div>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setShowModuleModal(false)} className="zoho-btn-secondary">Cancel</button><Button type="submit" isLoading={isSubmitting}>{editingModuleId ? 'Update' : 'Create'}</Button></div>
                        </form>
                    </div>
                </div>
            )}

            {showTaskModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">{editingTaskId ? 'Edit Task' : 'New Task'}</h3>
                            <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleCreateTask} className="p-6 space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Name</label><input required className="zoho-input" value={taskForm.name} onChange={e => setTaskForm({ ...taskForm, name: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label><textarea className="zoho-input" value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows="2" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Assignees</label>
                                    <div className="zoho-input max-h-32 overflow-y-auto p-2 space-y-2">
                                        {employees.map(emp => (
                                            <div key={emp._id} className="flex items-center space-x-2">
                                                <input type="checkbox" checked={taskForm.assignees.includes(emp._id)} onChange={(e) => {
                                                    const id = emp._id;
                                                    setTaskForm(prev => ({ ...prev, assignees: e.target.checked ? [...prev.assignees, id] : prev.assignees.filter(a => a !== id) }));
                                                }} className="rounded text-blue-600" />
                                                <span className="text-sm">{emp.firstName} {emp.lastName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label><select className="zoho-input" value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label><input type="date" className="zoho-input" value={taskForm.startDate} onChange={e => setTaskForm({ ...taskForm, startDate: e.target.value })} /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label><input type="date" className="zoho-input" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Est. Hours</label><input type="number" className="zoho-input" value={taskForm.estimatedHours} onChange={e => setTaskForm({ ...taskForm, estimatedHours: e.target.value })} /></div>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setShowTaskModal(false)} className="zoho-btn-secondary">Cancel</button><Button type="submit" isLoading={isSubmitting}>{editingTaskId ? 'Update' : 'Save'}</Button></div>
                        </form>
                    </div>
                </div>
            )}
            {/* Log Work Modal - Simplified for brevity but functionality preserved by not removing it hopefully? No i need to include it */}
            {showLogModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Clock size={18} className="text-green-600" /> Log Time</h3>
                            <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleLogWork} className="p-6 space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" required className="zoho-input" value={logForm.date} onChange={e => setLogForm({ ...logForm, date: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hours Spent</label><input type="number" step="0.1" required className="zoho-input" value={logForm.hours} onChange={e => setLogForm({ ...logForm, hours: e.target.value })} placeholder="e.g. 2.5" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label><textarea className="zoho-input" value={logForm.description} onChange={e => setLogForm({ ...logForm, description: e.target.value })} rows="3" /></div>
                            <div className="flex justify-end space-x-3 pt-2"><button type="button" onClick={() => setShowLogModal(false)} className="zoho-btn-secondary">Cancel</button><Button type="submit" isLoading={isSubmitting} className="zoho-btn-primary bg-green-600 hover:bg-green-700">Log Time</Button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDetails;
