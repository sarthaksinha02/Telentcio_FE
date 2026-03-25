import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';

const AttendanceCalendar = ({ history, onMonthChange, user, holidays = [], date, approvedLeaves = [], onRegularize, isPrivileged = false }) => {
    const [currentDate, setCurrentDate] = useState(date || new Date());

    useEffect(() => {
        if (date) {
            setCurrentDate(date);
        }
    }, [date]);

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
        const next = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        setCurrentDate(next);
        onMonthChange(next.getFullYear(), next.getMonth() + 1);
    };

    const nextMonth = () => {
        const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        setCurrentDate(next);
        onMonthChange(next.getFullYear(), next.getMonth() + 1);
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
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-semibold text-slate-800 text-sm">
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
            <div className="grid grid-cols-7 text-center border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wide py-1.5">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
            </div>

            {/* Calendar Rows */}
            <div className="grid grid-cols-7 text-xs">
                {blanks.map((b) => (
                    <div key={`blank-${b}`} className="min-h-[80px] border-b border-r border-slate-100 bg-slate-50/30"></div>
                ))}

                {days.map((day) => {
                    const record = history.find(h => normalizeDate(h.date) === normalizeDate(day));
                    const holiday = holidays.find(h => normalizeDate(h.date) === normalizeDate(day));
                    const leave = approvedLeaves.find(l => {
                        const lStart = new Date(l.startDate);
                        const lEnd = new Date(l.endDate);
                        
                        // Normalize to date-only midnight for reliable comparison
                        const s = new Date(lStart.getFullYear(), lStart.getMonth(), lStart.getDate()).getTime();
                        const e = new Date(lEnd.getFullYear(), lEnd.getMonth(), lEnd.getDate()).getTime();
                        const d = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
                        
                        return d >= s && d <= e;
                    });

                    const weeklyOffDays = user?.company?.settings?.attendance?.weeklyOff || ['Sunday'];
                    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.getDay()];
                    const isWeeklyOff = weeklyOffDays.includes(dayName);

                    const isToday = normalizeDate(day) === normalizeDate(new Date());
                    const joiningDate = user?.joiningDate ? new Date(user.joiningDate) : null;
                    if (joiningDate) joiningDate.setHours(0, 0, 0, 0);
                    const isBeforeJoining = joiningDate && day < joiningDate;

                    return (
                        <div
                            key={day.toISOString()}
                            className={`min-h-[80px] border-b border-r border-slate-100 p-1.5 relative group hover:bg-slate-50 transition-colors ${isToday ? 'bg-blue-50/30' : ''} ${isWeeklyOff ? 'bg-slate-50/50' : ''}`}
                        >
                            <div className={`text-right mb-1 font-medium text-xs ${isToday ? 'text-blue-600' : (isWeeklyOff ? 'text-slate-300' : 'text-slate-400')}`}>
                                {day.getDate()}
                            </div>

                            {/* Regularize Action */}
                            {(() => {
                                const weeklyOffDays = user?.company?.settings?.attendance?.weeklyOff || ['Sunday'];
                                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.getDay()];
                                const isWeeklyOff = weeklyOffDays.includes(dayName);
                                const isHoliday = !!holiday;

                                // 1. Skip if before joining or in future
                                const todayStart = new Date();
                                todayStart.setHours(0, 0, 0, 0);
                                if (isBeforeJoining || day > todayStart) return null;

                                // 2. Skip if it's a weekly off or holiday (no attendance allowed)
                                if (isWeeklyOff || isHoliday) return null;

                                // 3. Calculate 4 working days ago
                                let workingDaysCount = 0;
                                let checkDate = new Date(todayStart);
                                let maxLookback = 30; // Safety break

                                while (workingDaysCount < 4 && maxLookback > 0) {
                                    checkDate.setDate(checkDate.getDate() - 1);
                                    const cDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][checkDate.getDay()];
                                    const cDateStr = checkDate.toDateString();
                                    
                                    const isCWeeklyOff = weeklyOffDays.includes(cDayName);
                                    const isCHoliday = holidays.some(h => new Date(h.date).toDateString() === cDateStr);

                                    if (!isCWeeklyOff && !isCHoliday) {
                                        workingDaysCount++;
                                    }
                                    maxLookback--;
                                }

                                const fourWorkingDaysAgo = new Date(checkDate);
                                fourWorkingDaysAgo.setHours(0, 0, 0, 0);

                                const canRegularize = day >= fourWorkingDaysAgo || isPrivileged;
                                
                                if (canRegularize) {
                                    return (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRegularize(day, record);
                                            }}
                                            className="absolute top-1 left-1 p-1 bg-white border border-slate-200 rounded shadow-sm text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50"
                                            title="Regularize Attendance"
                                        >
                                            <Edit2 size={10} />
                                        </button>
                                    );
                                }
                                return null;
                            })()}

                            {holiday && (
                                <div className={`mb-1 text-[9px] font-bold px-1 py-0.5 rounded ${holiday.isOptional ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'} truncate`} title={holiday.name}>
                                    {holiday.name}
                                </div>
                            )}

                            {leave && (
                                (() => {
                                    const isHoliday = !!holiday;
                                    const weeklyOffDays = user?.company?.settings?.attendance?.weeklyOff || ['Sunday'];
                                    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.getDay()];
                                    const isWeeklyOff = weeklyOffDays.includes(dayName);
                                    
                                    // If it's a holiday or weekly off, only show leave if sandwich rule is active
                                    if (isHoliday || isWeeklyOff) {
                                        if (!leave.sandwichRule) return null;
                                    }
                                    
                                    return (
                                        <div className="mb-1 text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700 truncate" title={`${leave.leaveType} (${leave.status})`}>
                                            {leave.leaveType}
                                        </div>
                                    );
                                })()
                            )}

                            {record ? (
                                (() => {
                                    const finalStatus = record.status || (record.clockIn ? 'PRESENT' : 'ABSENT');
                                    return (
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-1">
                                                <div className={`h-1.5 w-1.5 rounded-full ${getStatusColor(finalStatus)}`}></div>
                                                <span className="text-[10px] font-semibold text-slate-700 capitalize">{finalStatus.toLowerCase()}</span>
                                            </div>
                                            {record.clockIn && (
                                                <div className="text-[9px] text-slate-500 font-mono pl-2.5 line-clamp-1">
                                                    In: {new Date(record.clockIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </div>
                                            )}
                                            {record.clockOut && (
                                                <div className="text-[9px] text-slate-500 font-mono pl-2.5 line-clamp-1">
                                                    Out: {new Date(record.clockOut).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            ) : (
                                !leave && (
                                    isBeforeJoining ? (
                                        <div className="flex justify-center mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title="Not Applicable">N/A</span>
                                        </div>
                                    ) : (
                                        isWeeklyOff ? (
                                            <div className="flex justify-center mt-3 opacity-40">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Off</span>
                                            </div>
                                        ) : (
                                            !holiday && day < new Date() && (
                                                <div className="flex justify-center mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-[10px] text-red-400 bg-red-50 px-1.5 py-0.5 rounded">Absent</span>
                                                </div>
                                            )
                                        )
                                    )
                                )
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3 bg-slate-50 border-t border-slate-100 items-center justify-center rounded-b-lg">
                <div className="flex items-center space-x-1.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[10px] text-slate-600 font-medium">Present</span>
                </div>
                <div className="flex items-center space-x-1.5">
                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                    <span className="text-[10px] text-slate-600 font-medium">Absent</span>
                </div>
                <div className="flex items-center space-x-1.5">
                    <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                    <span className="text-[10px] text-slate-600 font-medium">Half Day</span>
                </div>
                <div className="flex items-center space-x-1.5">
                    <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    <span className="text-[10px] text-slate-600 font-medium">Leave</span>
                </div>
                <div className="flex items-center space-x-1.5 border-l border-slate-200 pl-4 ml-2">
                    <div className="h-2 w-2 rounded-full bg-green-200"></div>
                    <span className="text-[10px] text-slate-600 font-medium">Holiday</span>
                </div>
            </div>
        </div>
    );
};

export default AttendanceCalendar;
