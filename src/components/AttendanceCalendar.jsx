import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const AttendanceCalendar = ({ history, onMonthChange, user, holidays = [] }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        onMonthChange(currentDate.getFullYear(), currentDate.getMonth() + 1);
    }, [currentDate]);

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
    };

    const normalizeDate = (d) => new Date(d).toDateString();

    const days = getDaysInMonth(currentDate);
    const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 = Sun

    // Create empty cells for start padding
    const blanks = Array.from({ length: startDay }, (_, i) => i);

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PRESENT': return 'bg-emerald-500';
            case 'ABSENT': return 'bg-red-500';
            case 'HALF_DAY': return 'bg-orange-500';
            case 'LEAVE': return 'bg-purple-500';
            default: return 'bg-slate-300';
        }
    };

    return (
        <div className="zoho-card">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-semibold text-slate-800">
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="flex space-x-2">
                    <button onClick={prevMonth} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={nextMonth} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Grid Header */}
            <div className="grid grid-cols-7 text-center border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide py-2">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
            </div>

            {/* Calendar Rows */}
            <div className="grid grid-cols-7 text-sm">
                {blanks.map((b) => (
                    <div key={`blank-${b}`} className="min-h-[100px] border-b border-r border-slate-100 bg-slate-50/30"></div>
                ))}

                {days.map((day) => {
                    const record = history.find(h => normalizeDate(h.date) === normalizeDate(day));
                    const holiday = holidays.find(h => normalizeDate(h.date) === normalizeDate(day));

                    const isToday = normalizeDate(day) === normalizeDate(new Date());
                    const isSunday = day.getDay() === 0;
                    const joiningDate = user?.joiningDate ? new Date(user.joiningDate) : null;
                    if (joiningDate) joiningDate.setHours(0, 0, 0, 0);
                    const isBeforeJoining = joiningDate && day < joiningDate;

                    return (
                        <div
                            key={day.toISOString()}
                            className={`min-h-[100px] border-b border-r border-slate-100 p-2 relative group hover:bg-slate-50 transition-colors ${isToday ? 'bg-blue-50/30' : ''}`}
                        >
                            <div className={`text-right mb-2 font-medium ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                                {day.getDate()}
                            </div>

                            {holiday && (
                                <div className={`mb-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${holiday.isOptional ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'} truncate`} title={holiday.name}>
                                    {holiday.name}
                                </div>
                            )}

                            {record ? (
                                <div className="space-y-1">
                                    <div className="flex items-center space-x-1.5">
                                        <div className={`h-2 w-2 rounded-full ${getStatusColor(record.status)}`}></div>
                                        <span className="text-xs font-semibold text-slate-700 capitalize">{record.status.toLowerCase()}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono pl-3.5">
                                        In: {record.clockInIST && record.clockInIST.includes(',') ? record.clockInIST.split(',')[1].trim().slice(0, 5) : '--:--'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono pl-3.5">
                                        Out: {record.clockOutIST && record.clockOutIST.includes(',') ? record.clockOutIST.split(',')[1].trim().slice(0, 5) : '--:--'}
                                    </div>
                                </div>
                            ) : (

                                isBeforeJoining ? (
                                    <div className="flex justify-center mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title="Not Applicable (Before Joining)">N/A</span>
                                    </div>
                                ) : (
                                    !isSunday && !holiday && day < new Date() && (
                                        <div className="flex justify-center mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] text-red-400 bg-red-50 px-1.5 py-0.5 rounded">Absent</span>
                                        </div>
                                    )
                                )
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AttendanceCalendar;
