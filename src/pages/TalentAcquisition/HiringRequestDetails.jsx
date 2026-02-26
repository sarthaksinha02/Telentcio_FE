import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { ArrowLeft, CheckCircle, XCircle, Clock, User, Building, MapPin, DollarSign, Send, ThumbsUp, ThumbsDown, Briefcase, Edit, Construction, Loader } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button'; // Assuming Button component exists
import CandidateList from './CandidateList';
import Skeleton from '../../components/Skeleton';

const DetailRow = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-slate-50 last:border-0">
        <span className="text-slate-500 font-medium text-sm">{label}</span>
        <span className="text-slate-800 font-semibold text-sm text-right">{value || '-'}</span>
    </div>
);

const HiringRequestDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [approvalComment, setApprovalComment] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview'); // overview, applications, reviews

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const fetchRequest = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/ta/hiring-request/${id}`);
            setRequest(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load request details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequest();
    }, [id]);

    const isDynamic = request?.approvalChain && request?.approvalChain?.length > 0;

    const currentStep = isDynamic
        ? request.approvalChain[request.currentApprovalLevel - 1]
        : null;

    const hasSuperApprove = user?.permissions?.includes('ta.super_approve') || user?.permissions?.includes('*');

    const canApprove = request && isDynamic
        ? (
            (request.status === 'Pending_Approval' || request.status === 'Submitted') &&
            currentStep &&
            currentStep.status === 'Pending' &&
            (
                hasSuperApprove ||
                (currentStep.approvers && currentStep.approvers.some(a => a._id === user?._id || a === user?._id))
            )
        )
        : request && (request.status === 'Pending_L1' || request.status === 'Pending_Final');

    const handleApproval = async (action) => {
        // Only require comment for rejection
        if (action === 'REJECT' && !approvalComment.trim()) {
            return toast.error('Please add a comment for rejection');
        }

        try {
            setActionLoading(true);
            const payload = { comments: approvalComment };

            if (!isDynamic) {
                if (request.status === 'Pending_L1') payload.level = 'L1';
                else if (request.status === 'Pending_Final') payload.level = 'Final';
            }

            if (action === 'APPROVE') {
                await api.patch(`/ta/hiring-request/${id}/approve`, payload);
                toast.success('Approved successfully');
            } else {
                await api.patch(`/ta/hiring-request/${id}/reject`, payload);
                toast.success('Rejected successfully');
            }

            setApprovalComment('');
            fetchRequest(); // Refresh
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Action failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleClose = async () => {
        if (!window.confirm('Are you sure you want to close this hiring request?')) return;
        try {
            setActionLoading(true);
            await api.patch(`/ta/hiring-request/${id}/close`);
            toast.success('Request closed successfully');
            fetchRequest();
        } catch (error) {
            console.error(error);
            toast.error('Failed to close request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleEdit = () => {
        navigate(`/ta/edit-request/${id}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 pb-12">
                <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div>
                                    <Skeleton className="h-5 w-48 mb-1" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                            </div>
                            <div className="hidden md:flex gap-2">
                                <Skeleton className="h-8 w-24 rounded-lg" />
                                <Skeleton className="h-8 w-24 rounded-lg" />
                            </div>
                            <div className="w-24" />
                        </div>
                    </div>
                </div>
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        <div className="xl:col-span-2 space-y-8">
                            <Skeleton className="h-64 w-full rounded-2xl" />
                            <Skeleton className="h-64 w-full rounded-2xl" />
                        </div>
                        <div className="space-y-4">
                            <Skeleton className="h-48 w-full rounded-2xl" />
                            <Skeleton className="h-32 w-full rounded-2xl" />
                            <Skeleton className="h-32 w-full rounded-2xl" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    if (!request) return <div className="p-10 text-center">Request not found</div>;

    const getStatusColor = (status) => {
        const colors = {
            'Draft': 'bg-slate-100 text-slate-700',
            'Submitted': 'bg-blue-100 text-blue-700',
            'Pending_L1': 'bg-amber-100 text-amber-700',
            'Pending_Approval': 'bg-amber-100 text-amber-700',
            'Pending_Final': 'bg-purple-100 text-purple-700',
            'Approved': 'bg-emerald-100 text-emerald-700',
            'Rejected': 'bg-red-100 text-red-700',
            'Closed': 'bg-gray-100 text-gray-700'
        };
        return colors[status] || colors['Draft'];
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Sticky Navbar - Glassmorphism effect */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 shadow-sm transition-all duration-300">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Left: Back button + Title */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/ta')}
                                className="p-2 hover:bg-slate-100/80 rounded-full text-slate-500 hover:text-slate-700 transition-all duration-200 group"
                                aria-label="Go back"
                            >
                                <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                            <div className="flex flex-col">
                                <h1 className="text-lg font-bold text-slate-900 leading-tight">{request.roleDetails.title}</h1>
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                    <span className="flex items-center gap-1"><Building size={10} /> {request.roleDetails.department}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span>#{request.requestId.slice(-6).toUpperCase()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Center: Tabs with Pill Design */}
                        <div className="hidden md:flex bg-slate-100/50 p-1 rounded-xl">
                            {['overview', ...(request.status === 'Approved' ? ['applications'] : [])].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 capitalize ${activeTab === tab
                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Right: placeholder to keep flex layout balanced */}
                        <div className="w-24" />
                    </div>
                </div>
            </div>

            {/* Tab Content Container */}
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Main Content Column */}
                        <div className="xl:col-span-2 space-y-8">

                            {/* Role Information Card */}
                            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-300">
                                <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                                            <Briefcase size={14} />
                                        </div>
                                        Role Information
                                    </h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${request.hiringDetails.priority === 'High' ? 'bg-red-50 text-red-600 border border-red-100' :
                                        request.hiringDetails.priority === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                            'bg-blue-50 text-blue-600 border border-blue-100'
                                        }`}>
                                        {request.hiringDetails.priority} Priority
                                    </span>
                                </div>
                                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                                    <div className="group">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 group-hover:text-blue-600 transition-colors">Client / Project</h4>
                                        <p className="text-slate-900 font-bold text-base">{request.client}</p>
                                    </div>
                                    <div className="group">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 group-hover:text-blue-600 transition-colors">Job Title</h4>
                                        <p className="text-slate-800 font-semibold text-sm">{request.roleDetails.title}</p>
                                    </div>
                                    <div className="group">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 group-hover:text-blue-600 transition-colors">Department</h4>
                                        <p className="text-slate-800 font-medium text-sm">{request.roleDetails.department}</p>
                                    </div>
                                    <div className="group">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 group-hover:text-blue-600 transition-colors">Employment Type</h4>
                                        <p className="text-slate-800 font-medium text-sm flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                            {request.roleDetails.employmentType}
                                        </p>
                                    </div>
                                    <div className="group">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 group-hover:text-blue-600 transition-colors">Interview Template</h4>
                                        <p className="text-slate-800 font-medium text-sm">{request.interviewWorkflowId?.name || 'Custom (None)'}</p>
                                    </div>
                                    <div className="group">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 group-hover:text-blue-600 transition-colors">Hiring Purpose</h4>
                                        <p className="text-slate-800 font-medium text-sm">{request.purpose}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Requirements Card */}
                            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-300">
                                <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                                            <CheckCircle size={14} />
                                        </div>
                                        Requirements
                                    </h3>
                                </div>
                                <div className="p-5 space-y-5">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Must-Have Skills</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {request.requirements.mustHaveSkills?.map(s => (
                                                <span key={s} className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-semibold shadow-sm hover:shadow transition-shadow cursor-default">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nice-To-Have Skills</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {request.requirements.niceToHaveSkills?.map(s => (
                                                <span key={s} className="px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-full text-xs font-medium hover:bg-slate-100 transition-colors cursor-default">
                                                    {s}
                                                </span>
                                            ))}
                                            {!request.requirements.niceToHaveSkills?.length && <span className="text-slate-400 italic text-xs">None specified</span>}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-5 pt-4 border-t border-slate-100">
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Experience Range</h4>
                                            <p className="text-slate-900 font-bold text-sm">{request.requirements.experienceMin} - {request.requirements.experienceMax} <span className="text-xs font-medium text-slate-500">Years</span></p>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Location</h4>
                                            <div className="flex items-center gap-1.5 text-slate-900 font-medium text-sm">
                                                <MapPin size={13} className="text-slate-400" />
                                                {request.requirements.location}
                                                {request.requirements.shift && <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">({request.requirements.shift})</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Approval History - Enhanced Timeline */}
                            {(isDynamic || request.approvals?.l1?.status !== 'Pending' || request.approvals?.final?.status !== 'Pending') && (
                                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-300">
                                    <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                                                <Clock size={14} />
                                            </div>
                                            Approval Timeline
                                        </h3>
                                    </div>
                                    <div className="p-5">
                                        <div className="relative pl-4 border-l-2 border-slate-100 space-y-5">
                                            {request.approvalChain.map((step, index) => (
                                                <div key={index} className="relative">
                                                    {/* Timeline Dot */}
                                                    <div className={`absolute -left-[21px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-sm ${step.status === 'Approved' ? 'bg-emerald-500 ring-4 ring-emerald-50' :
                                                        step.status === 'Rejected' ? 'bg-red-500 ring-4 ring-red-50' :
                                                            'bg-slate-300 ring-4 ring-slate-50'
                                                        }`}></div>

                                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800">
                                                                Level {step.level} <span className="font-normal text-slate-500 mx-1">/</span> {step.roleName || 'Approver'}
                                                            </p>
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                {step.status === 'Pending' ? 'Waiting for:' : 'Assigned to:'} <span className="font-medium text-slate-700">{step.approvers?.map(a => `${a.firstName} ${a.lastName}`).join(', ')}</span>
                                                            </p>
                                                            {step.status !== 'Pending' && (
                                                                <p className="text-xs text-slate-500 mt-0.5">
                                                                    {step.status} by <span className="font-medium text-slate-700">{step.approvedBy?.firstName} {step.approvedBy?.lastName}</span>
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${step.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                                                            step.status === 'Rejected' ? 'bg-red-50 text-red-600' :
                                                                'bg-slate-100 text-slate-500'
                                                            }`}>
                                                            {step.status}
                                                        </span>
                                                    </div>

                                                    {step.date && (
                                                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                                            <Clock size={12} /> {format(new Date(step.date), 'MMM dd, yyyy • hh:mm a')}
                                                        </p>
                                                    )}

                                                    {step.comments && (
                                                        <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-600 italic relative">
                                                            <span className="absolute top-2 left-2 text-slate-300 text-xl font-serif">"</span>
                                                            <span className="pl-4">{step.comments}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-4">
                            {/* Hiring Details Card */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow duration-300">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-50">
                                    <div className="p-1.5 bg-amber-100 text-amber-600 rounded-md">
                                        <DollarSign size={14} />
                                    </div>
                                    Hiring Specifics
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center group">
                                        <span className="text-slate-500 text-xs font-medium">Open Positions</span>
                                        <span className="text-slate-900 font-bold text-xs bg-slate-100 px-2 py-0.5 rounded group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">{request.hiringDetails.openPositions}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 text-xs font-medium">Expected Joining</span>
                                        <span className="text-slate-900 font-semibold text-xs text-right">{request.hiringDetails.expectedJoiningDate ? format(new Date(request.hiringDetails.expectedJoiningDate), 'MMM dd, yyyy') : '-'}</span>
                                    </div>
                                    <div className="pt-3 border-t border-slate-50">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1.5">Budget Range</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-bold text-slate-800">{request.hiringDetails.budgetRange?.min?.toLocaleString()}</span>
                                            <span className="text-slate-400 text-xs">to</span>
                                            <span className="text-sm font-bold text-slate-800">{request.hiringDetails.budgetRange?.max?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Position Created By Card */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow duration-300">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-50">
                                    <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md">
                                        <User size={14} />
                                    </div>
                                    Created By
                                </h3>
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-blue-50">
                                        {request.createdBy?.firstName?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">{request.createdBy?.firstName} {request.createdBy?.lastName}</p>
                                        <p className="text-xs text-slate-500">{request.createdBy?.email}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            on {format(new Date(request.createdAt), 'MMM dd, yyyy')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Status Card */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow duration-300">
                                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 pb-3 border-b border-slate-50">
                                    <div className="p-1.5 bg-slate-100 text-slate-600 rounded-md">
                                        <CheckCircle size={14} />
                                    </div>
                                    Status
                                </h3>
                                <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${request.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    request.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                        request.status === 'Closed' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                            request.status === 'Pending_L1' || request.status === 'Pending_Approval' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                request.status === 'Pending_Final' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}>
                                    {request.status.replace(/_/g, ' ')}
                                </div>
                            </div>

                            {/* Actions Card */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow duration-300">
                                <h3 className="text-sm font-bold text-slate-800 mb-3">Actions</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={handleEdit}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium text-sm transition-all shadow-sm hover:shadow"
                                    >
                                        <Edit size={16} /> Edit Request
                                    </button>

                                    {request.status !== 'Closed' && (
                                        <button
                                            onClick={handleClose}
                                            disabled={actionLoading}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {actionLoading ? <Loader className="animate-spin" size={16} /> : <XCircle size={16} />} Close Request
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Approval Action */}
                            {canApprove && (
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-200 p-6 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Send size={64} />
                                    </div>
                                    <h3 className="font-bold text-white mb-2 relative z-10 text-lg">Approval Required</h3>
                                    <p className="text-xs text-blue-100 mb-4 relative z-10">Please review the details and take action.</p>

                                    <textarea
                                        value={approvalComment}
                                        onChange={(e) => setApprovalComment(e.target.value)}
                                        placeholder="Add comments (required for rejection)..."
                                        className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-sm mb-4 outline-none focus:bg-white/20 placeholder-blue-200 text-white transition-all backdrop-blur-sm"
                                        rows={3}
                                    />

                                    <div className="grid grid-cols-2 gap-3 relative z-10">
                                        <button
                                            onClick={() => handleApproval('APPROVE')}
                                            disabled={actionLoading}
                                            className="flex items-center justify-center gap-2 py-2.5 bg-white text-blue-600 hover:bg-blue-50 rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {actionLoading ? <Loader className="animate-spin" size={16} /> : <ThumbsUp size={16} />} Approve
                                        </button>
                                        <button
                                            onClick={() => handleApproval('REJECT')}
                                            disabled={actionLoading}
                                            className="flex items-center justify-center gap-2 py-2.5 bg-white/10 border border-white/20 text-white hover:bg-white/20 rounded-xl font-bold text-sm transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {actionLoading ? <Loader className="animate-spin" size={16} /> : <ThumbsDown size={16} />} Reject
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'applications' && (
                    <CandidateList hiringRequestId={id} />
                )}


            </div>
        </div>
    );
};

export default HiringRequestDetails;
