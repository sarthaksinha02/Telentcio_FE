import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Calendar as CalendarIcon, Info } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfDay } from 'date-fns';

const AttendanceCalendar = ({ history, onMonthChange, user, holidays = [], date, approvedLeaves = [], onRegularize, isPrivileged = false, weeklyOffs = ['Sunday'] }) => {
    const [currentDate, setCurrentDate] = useState(date || new Date());

    useEffect(() => {
        if (date) setCurrentDate(date);
    }, [date]);

    const normalizeDate = (d) => new Date(d).toDateString();

    const days = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
    });

    const startDay = startOfMonth(currentDate).getDay(); // 0 = Sun
    const blanks = Array.from({ length: startDay }, (_, i) => i);

    const prevMonth = () => {
        const next = subMonths(currentDate, 1);
        setCurrentDate(next);
        onMonthChange(next.getFullYear(), next.getMonth() + 1);
    };

    const nextMonth = () => {
        const next = addMonths(currentDate, 1);
        setCurrentDate(next);
        onMonthChange(next.getFullYear(), next.getMonth() + 1);
    };

    const getStatusToken = (status) => {
        switch (status) {
            case 'PRESENT': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-500' };
            case 'ABSENT': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100', dot: 'bg-red-500' };
            case 'HALF_DAY': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', dot: 'bg-amber-500' };
            case 'LEAVE': return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', dot: 'bg-indigo-500' };
            default: return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100', dot: 'bg-slate-400' };
        }
    };

    return (
        <div className="bg-white flex flex-col h-full rounded-xl overflow-hidden">
            {/* High-Authority Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                        <CalendarIcon size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-800 tracking-tight leading-none mb-1">
                            {format(currentDate, 'MMMM yyyy')}
                        </h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visual Audit Journal</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200/50">
                    <button 
                        onClick={prevMonth} 
                        className="p-2 hover:bg-white hover:text-blue-600 rounded-lg text-slate-400 transition-all border border-transparent hover:border-slate-200 active:scale-95 shadow-none hover:shadow-sm"
                    >
                        <ChevronLeft size={16} strokeWidth={3} />
                    </button>
                    <button 
                        onClick={() => {
                            const now = new Date();
                            setCurrentDate(now);
                            onMonthChange(now.getFullYear(), now.getMonth() + 1);
                        }}
                        className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                    >
                        Today
                    </button>
                    <button 
                        onClick={nextMonth} 
                        className="p-2 hover:bg-white hover:text-blue-600 rounded-lg text-slate-400 transition-all border border-transparent hover:border-slate-200 active:scale-95 shadow-none hover:shadow-sm"
                    >
                        <ChevronRight size={16} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Grid Architecture */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="grid grid-cols-7 text-center border-b border-slate-100 bg-[#f9fafb]/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] py-3">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                </div>

                <div className="grid grid-cols-7 border-l border-slate-50">
                    {blanks.map((b) => (
                        <div key={`blank-${b}`} className="aspect-[4/3] border-r border-b border-slate-50 bg-[#fafbfc]/30"></div>
                    ))}

                    {days.map((day) => {
                        const dateStr = normalizeDate(day);
                        const record = history.find(h => normalizeDate(h.date) === dateStr);
                        const holiday = holidays.find(h => normalizeDate(h.date) === dateStr);
                        const leave = approvedLeaves.find(l => {
                            const s = startOfDay(new Date(l.startDate)).getTime();
                            const e = startOfDay(new Date(l.endDate)).getTime();
                            const d = startOfDay(day).getTime();
                            return d >= s && d <= e;
                        });

                        const dayOfWeek = format(day, 'EEEE');
                        const isWeeklyOff = weeklyOffs.includes(dayOfWeek);
                        const isToday = isSameDay(day, new Date());
                        const joiningDate = user?.joiningDate ? startOfDay(new Date(user.joiningDate)) : null;
                        const isBeforeJoining = joiningDate && day < joiningDate;

                        const attendanceStatus = record?.status || (record?.clockIn ? 'PRESENT' : (day < startOfDay(new Date()) && !isWeeklyOff && !holiday && !isBeforeJoining ? 'ABSENT' : null));
                        const token = attendanceStatus ? getStatusToken(attendanceStatus) : null;

                        return (
                            <div
                                key={day.toISOString()}
                                className={`aspect-[4/3] border-r border-b border-slate-50 p-2 relative group transition-all duration-200 ${isToday ? 'bg-blue-50/10' : 'bg-white hover:bg-slate-50/50'} ${isWeeklyOff ? 'bg-[#fcfdfe]/20' : ''}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className={`text-[12px] font-black tabular-nums transition-colors ${isToday ? 'text-blue-600 bg-blue-100/50 px-1.5 py-0.5 rounded-lg' : (isWeeklyOff ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-800')}`}>
                                        {format(day, 'd')}
                                    </div>
                                    
                                    {/* Action Hub */}
                                    {(() => {
                                        const todayStart = startOfDay(new Date());
                                        if (isBeforeJoining || day > todayStart || isWeeklyOff || holiday) return null;

                                        return (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRegularize(day, record);
                                                }}
                                                className="p-1 text-slate-300 opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded-md border border-slate-100 bg-white shadow-sm"
                                                title="Request Correction"
                                            >
                                                <Edit2 size={10} strokeWidth={4} />
                                            </button>
                                        );
                                    })()}
                                </div>

                                <div className="mt-2 space-y-1">
                                    {holiday && (
                                        <div className={`text-[8px] font-black px-1.5 py-1 rounded-md uppercase tracking-tighter truncate border ${holiday.isOptional ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`} title={holiday.name}>
                                            {holiday.name}
                                        </div>
                                    )}

                                    {leave && (
                                        <div className="text-[8px] font-black px-1.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-tighter truncate" title={leave.leaveType}>
                                            {leave.leaveType}
                                        </div>
                                    )}

                                    {token && (
                                        <div className={`mt-1 pt-1.5 border-t border-slate-50`}>
                                            <div className={`flex items-center gap-1.5 mb-1 px-1.5 py-0.5 rounded-md border ${token.bg} ${token.text} ${token.border}`}>
                                                <div className={`h-1.5 w-1.5 rounded-full ${token.dot} shadow-sm`}></div>
                                                <span className="text-[8px] font-black uppercase tracking-widest">{attendanceStatus}</span>
                                            </div>
                                            {record?.clockIn && (
                                                <div className="flex flex-col gap-0.5 px-0.5">
                                                    <div className="text-[8px] font-bold text-slate-400 flex justify-between">
                                                        <span>IN</span>
                                                        <span className="text-slate-600">{format(new Date(record.clockIn), 'HH:mm')}</span>
                                                    </div>
                                                    {record.clockOut && (
                                                        <div className="text-[8px] font-bold text-slate-400 flex justify-between">
                                                            <span>OUT</span>
                                                            <span className="text-slate-600">{format(new Date(record.clockOut), 'HH:mm')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Premium Legend Footer */}
            <div className="flex flex-wrap gap-x-6 gap-y-3 px-6 py-4 bg-slate-50/50 border-t border-slate-100 items-center justify-center">
                {[
                    { label: 'Present', color: 'bg-emerald-500' },
                    { label: 'Absent', color: 'bg-red-500' },
                    { label: 'Half Day', color: 'bg-amber-500' },
                    { label: 'Leave', color: 'bg-indigo-500' },
                    { label: 'Holiday' , color: 'bg-emerald-100 border border-emerald-200'}
                ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${item.color} shadow-sm`}></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AttendanceCalendar;
