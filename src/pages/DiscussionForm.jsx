import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { ArrowLeft, CheckCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';

const DiscussionForm = () => {
    const { id } = useParams();
    const isEditMode = !!id;
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        title: '',
        discussion: '',
        status: 'inprogress',
        dueDate: ''
    });

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEditMode);

    useEffect(() => {
        if (isEditMode) {
            const fetchDiscussion = async () => {
                try {
                    const res = await api.get(`/discussions/${id}`);
                    const data = res.data;
                    setFormData({
                        title: data.title,
                        discussion: data.discussion,
                        status: data.status,
                        dueDate: data.dueDate ? data.dueDate.split('T')[0] : ''
                    });
                } catch (error) {
                    console.error('Error fetching discussion:', error);
                    toast.error('Failed to load discussion details');
                    navigate('/discussions');
                } finally {
                    setFetching(false);
                }
            };
            fetchDiscussion();
        }
    }, [id, navigate, isEditMode]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title || !formData.discussion) {
            toast.error('Title and Discussion fields are required');
            return;
        }

        try {
            setLoading(true);
            const payload = { ...formData };
            if (!payload.dueDate) delete payload.dueDate;

            if (isEditMode) {
                await api.put(`/discussions/${id}`, payload);
                toast.success('Discussion updated successfully');
            } else {
                await api.post('/discussions', payload);
                toast.success('Discussion created successfully');
            }

            navigate('/discussions');
        } catch (error) {
            console.error('Error saving discussion:', error);
            toast.error('Failed to save discussion');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-10">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/discussions')}
                        className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            {isEditMode ? 'Edit Discussion' : 'Create New Discussion'}
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {isEditMode ? 'Update details and status of this discussion topic.' : 'Start a new topic for team discussion.'}
                        </p>
                    </div>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">

                        {/* Title Row */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="Enter discussion title..."
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 placeholder-slate-400"
                                required
                            />
                        </div>

                        {/* Status & Due Date Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    Status
                                </label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700"
                                >
                                    <option value="inprogress">In Progress</option>
                                    <option value="on-hold">On-hold</option>
                                    <option value="mark as complete">Mark as complete</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    Due Date
                                </label>
                                <input
                                    type="date"
                                    name="dueDate"
                                    value={formData.dueDate}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700"
                                />
                            </div>
                        </div>

                        {/* Discussion Body Row */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Discussion <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                name="discussion"
                                value={formData.discussion}
                                onChange={handleChange}
                                placeholder="Write the details of your discussion here..."
                                rows="8"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 placeholder-slate-400 resize-y"
                                required
                            ></textarea>
                        </div>

                        {/* Actions */}
                        <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/discussions')}
                                className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                            >
                                {loading && <Loader size={16} className="animate-spin" />}
                                {!loading && <CheckCircle size={16} />}
                                {isEditMode ? 'Update Discussion' : 'Create Discussion'}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
};

export default DiscussionForm;
