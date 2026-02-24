import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { Save, X, Plus, Trash2, Calendar, Clock, AlignLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const MeetingForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEdit = Boolean(id);

    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);
    const [users, setUsers] = useState([]);

    const [formData, setFormData] = useState({
        title: '',
        date: '',
        startTime: '',
        endTime: '',
        meetingType: 'Internal',
        location: '',
        objective: '',
        host: user?._id || '',
        attendees: [],
        absentees: [],
        agendaItems: [],
        discussionPoints: '',
        decisionsMade: '',
        actionItems: [],
        nextMeetingDate: '',
        additionalActions: '',
        status: 'Draft'
    });

    useEffect(() => {
        fetchUsers();
        if (isEdit) {
            fetchMeeting();
        }
    }, [id]);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/projects/employees'); // Assuming this returns basic user details
            setUsers(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load users');
        }
    };

    const fetchMeeting = async () => {
        try {
            const res = await api.get(`/meetings/${id}`);
            const m = res.data;
            setFormData({
                ...m,
                date: m.date ? new Date(m.date).toISOString().split('T')[0] : '',
                nextMeetingDate: m.nextMeetingDate ? new Date(m.nextMeetingDate).toISOString().split('T')[0] : '',
                host: m.host?._id || m.host,
                attendees: m.attendees?.map(a => a._id || a) || [],
                absentees: m.absentees?.map(a => a._id || a) || [],
                agendaItems: m.agendaItems?.map(a => ({ ...a, owner: a.owner?._id || a.owner })) || [],
                actionItems: m.actionItems?.map(a => ({
                    ...a,
                    assignee: a.assignee?._id || a.assignee,
                    dueDate: a.dueDate ? new Date(a.dueDate).toISOString().split('T')[0] : ''
                })) || []
            });
        } catch (error) {
            console.error(error);
            toast.error('Failed to load meeting details');
            navigate('/meetings');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectMultiple = (e, field) => {
        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
        setFormData(prev => ({ ...prev, [field]: selectedOptions }));
    };

    // Agenda Handlers
    const addAgendaItem = () => {
        setFormData(prev => ({
            ...prev,
            agendaItems: [...prev.agendaItems, { title: '', description: '', owner: '', estimatedTime: '' }]
        }));
    };

    const updateAgendaItem = (index, field, value) => {
        const newItems = [...formData.agendaItems];
        newItems[index][field] = value;
        setFormData(prev => ({ ...prev, agendaItems: newItems }));
    };

    const removeAgendaItem = (index) => {
        setFormData(prev => ({
            ...prev,
            agendaItems: prev.agendaItems.filter((_, i) => i !== index)
        }));
    };

    // Action Item Handlers
    const addActionItem = () => {
        setFormData(prev => ({
            ...prev,
            actionItems: [...prev.actionItems, { taskDescription: '', assignee: '', dueDate: '', priority: 'Medium', status: 'Pending' }]
        }));
    };

    const updateActionItem = (index, field, value) => {
        const newItems = [...formData.actionItems];
        newItems[index][field] = value;
        setFormData(prev => ({ ...prev, actionItems: newItems }));
    };

    const removeActionItem = (index) => {
        setFormData(prev => ({
            ...prev,
            actionItems: prev.actionItems.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (isEdit) {
                await api.put(`/meetings/${id}`, formData);
                toast.success('Meeting updated successfully');
            } else {
                await api.post('/meetings', formData);
                toast.success('Meeting created successfully');
            }
            navigate('/meetings');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to save meeting');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-100 font-sans p-6 md:p-10 pb-24 border-t border-slate-200">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{isEdit ? 'Edit Meeting' : 'Create Minutes of Meeting'}</h1>
                        <p className="text-sm text-slate-500">Log meeting details, agenda, and action items.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center"><AlignLeft size={18} className="mr-2 text-indigo-500" />Basic Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Meeting Title *</label>
                                <input required type="text" name="title" value={formData.title} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-100 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                                <div className="relative">
                                    <input required type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-100 outline-none appearance-none" />
                                    <Calendar className="absolute right-3 top-2.5 text-slate-400" size={16} />
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                                    <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-100 outline-none" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                                    <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-100 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                <select name="meetingType" value={formData.meetingType} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-100 outline-none bg-white">
                                    <option value="Internal">Internal</option>
                                    <option value="Client">Client</option>
                                    <option value="Project">Project</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Location / Link</label>
                                <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Conference Room A or Zoom link" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-100 outline-none" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Objective</label>
                                <input type="text" name="objective" value={formData.objective} onChange={handleChange} placeholder="Brief objective of the meeting" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-100 outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Participants */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Participants</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Attendees</label>
                                <select multiple value={formData.attendees} onChange={(e) => handleSelectMultiple(e, 'attendees')} className="w-full p-2 border border-slate-300 rounded-md h-32 focus:ring-2 focus:ring-indigo-100 outline-none bg-white">
                                    {users.map(u => <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>)}
                                </select>
                                <p className="text-xs text-slate-400 mt-1">Hold Ctrl/Cmd to select multiple</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Absentees</label>
                                <select multiple value={formData.absentees} onChange={(e) => handleSelectMultiple(e, 'absentees')} className="w-full p-2 border border-slate-300 rounded-md h-32 focus:ring-2 focus:ring-indigo-100 outline-none bg-white">
                                    {users.map(u => <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Agenda Items */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                            <h2 className="text-lg font-bold text-slate-800 border-none pb-0 mb-0">Agenda Items</h2>
                            <button type="button" onClick={addAgendaItem} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center"><Plus size={16} className="mr-1" /> Add Item</button>
                        </div>

                        {formData.agendaItems.length === 0 && <p className="text-sm text-slate-400 italic">No agenda items added.</p>}

                        <div className="space-y-4">
                            {formData.agendaItems.map((item, index) => (
                                <div key={index} className="flex flex-col md:flex-row gap-3 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div className="flex-1 space-y-3 w-full">
                                        <div className="flex gap-3">
                                            <input required type="text" placeholder="Agenda Title" value={item.title} onChange={e => updateAgendaItem(index, 'title', e.target.value)} className="flex-1 p-2 border border-slate-300 rounded-md text-sm outline-none" />
                                            <select value={item.owner} onChange={e => updateAgendaItem(index, 'owner', e.target.value)} className="w-40 p-2 border border-slate-300 rounded-md text-sm outline-none bg-white">
                                                <option value="">Owner...</option>
                                                {users.map(u => <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>)}
                                            </select>
                                            <input type="number" placeholder="Mins" value={item.estimatedTime} onChange={e => updateAgendaItem(index, 'estimatedTime', e.target.value)} className="w-20 p-2 border border-slate-300 rounded-md text-sm outline-none" />
                                        </div>
                                        <input type="text" placeholder="Brief description..." value={item.description} onChange={e => updateAgendaItem(index, 'description', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm outline-none" />
                                    </div>
                                    <button type="button" onClick={() => removeAgendaItem(index)} className="text-red-500 hover:text-red-600 p-2"><Trash2 size={18} /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notes & Decisions */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Meeting Notes</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Key Discussion Points</label>
                                <textarea name="discussionPoints" value={formData.discussionPoints} onChange={handleChange} rows={4} className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-100 outline-none text-sm"></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Decisions Made</label>
                                <textarea name="decisionsMade" value={formData.decisionsMade} onChange={handleChange} rows={3} className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-100 outline-none text-sm"></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Action Items */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                            <h2 className="text-lg font-bold text-slate-800 border-none pb-0 mb-0">Action Items</h2>
                            <button type="button" onClick={addActionItem} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center"><Plus size={16} className="mr-1" /> Add Action</button>
                        </div>

                        {formData.actionItems.length === 0 && <p className="text-sm text-slate-400 italic">No action items assigned.</p>}

                        <div className="space-y-4">
                            {formData.actionItems.map((item, index) => (
                                <div key={index} className="flex flex-col md:flex-row gap-3 items-start bg-amber-50/30 p-3 rounded-lg border border-amber-100">
                                    <div className="flex-1 space-y-3 w-full">
                                        <input required type="text" placeholder="Action description..." value={item.taskDescription} onChange={e => updateActionItem(index, 'taskDescription', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm outline-none" />
                                        <div className="flex gap-3">
                                            <select value={item.assignee} onChange={e => updateActionItem(index, 'assignee', e.target.value)} className="flex-1 p-2 border border-slate-300 rounded-md text-sm outline-none bg-white">
                                                <option value="">Assignee...</option>
                                                {users.map(u => <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>)}
                                            </select>
                                            <input type="date" value={item.dueDate} onChange={e => updateActionItem(index, 'dueDate', e.target.value)} className="w-40 p-2 border border-slate-300 rounded-md text-sm outline-none" />
                                            <select value={item.priority} onChange={e => updateActionItem(index, 'priority', e.target.value)} className="w-32 p-2 border border-slate-300 rounded-md text-sm outline-none bg-white">
                                                <option value="Low">Low</option>
                                                <option value="Medium">Medium</option>
                                                <option value="High">High</option>
                                                <option value="Urgent">Urgent</option>
                                            </select>
                                            <select value={item.status} onChange={e => updateActionItem(index, 'status', e.target.value)} className="w-32 p-2 border border-slate-300 rounded-md text-sm outline-none bg-white font-medium">
                                                <option value="Pending">Pending</option>
                                                <option value="In Progress">In Progress</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => removeActionItem(index)} className="text-red-500 hover:text-red-600 p-2"><Trash2 size={18} /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Status Toggle & Submit */}
                    <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-slate-200 p-4 px-6 md:px-10 flex justify-between items-center z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center space-x-3">
                            <label className="text-sm font-medium text-slate-600">Document Status:</label>
                            <select name="status" value={formData.status} onChange={handleChange} className="p-1.5 border border-slate-300 rounded-md text-sm font-semibold text-slate-700 outline-none bg-slate-50">
                                <option value="Draft">Draft</option>
                                <option value="Published">Published</option>
                                <option value="Approved">Approved</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </div>
                        <div className="flex space-x-3">
                            <button type="button" onClick={() => navigate('/meetings')} className="px-5 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Cancel</button>
                            <button type="submit" disabled={submitting} className="flex items-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
                                <Save size={16} />
                                <span>{submitting ? 'Saving...' : 'Save Meeting'}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MeetingForm;
