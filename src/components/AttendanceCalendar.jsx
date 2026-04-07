import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';

const AttendanceCalendar = ({ history = [], onMonthChange, user, holidays = [], date, approvedLeaves = [], onRegularize, isPrivileged = false, weeklyOffs = ['Sunday'] }) => {
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

    const getApprovalMeta = (record) => {
        const finalStatus = record?.status || (record?.clockIn ? 'PRESENT' : 'ABSENT');

        if (record?.clockIn && !record?.clockOut) {
            return {
                primaryLabel: 'Incomplete',
                secondaryLabel: '',
                textClass: 'text-slate-800',
                dotClass: 'bg-red-500',
                showTimes: true
            };
        }

        if (record?.approvalStatus === 'REJECTED') {
            return {
                primaryLabel: finalStatus === 'PRESENT' ? 'Present' : finalStatus.replace('_', ' '),
                secondaryLabel: '',
                textClass: 'text-slate-800',
                dotClass: 'bg-red-500',
                showTimes: true
            };
        }

        if (record?.approvalStatus === 'APPROVED') {
            return {
                primaryLabel: finalStatus === 'PRESENT' ? 'Present' : finalStatus.replace('_', ' '),
                secondaryLabel: '',
                textClass: 'text-slate-800',
                dotClass: 'bg-emerald-500',
                showTimes: true
            };
        }

        return {
            primaryLabel: finalStatus === 'PRESENT' ? 'Present' : finalStatus.replace('_', ' '),
            secondaryLabel: '',
            textClass: 'text-slate-800',
            dotClass: finalStatus === 'PRESENT' ? 'bg-emerald-500' : 'bg-slate-400',
            showTimes: true
        };
    };

    return (
        <div className="zoho-card overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white">
                <h3 className="font-semibold text-slate-800 text-[14px]">
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="flex space-x-2">
                    <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Grid Header */}
            <div className="grid grid-cols-7 text-center border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-3">
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
                    <div key={`blank-${b}`} className="min-h-[100px] border-b border-r border-slate-100 bg-white"></div>
                ))}

                {days.map((day) => {
                    const record = (history || []).find(h => normalizeDate(h.date) === normalizeDate(day));
                    const holiday = (holidays || []).find(h => normalizeDate(h.date) === normalizeDate(day));
                    const leave = (approvedLeaves || []).find(l => {
                        const lStart = new Date(l.startDate);
                        const lEnd = new Date(l.endDate);

                        // Normalize to date-only midnight for reliable comparison
                        const s = new Date(lStart.getFullYear(), lStart.getMonth(), lStart.getDate()).getTime();
                        const e = new Date(lEnd.getFullYear(), lEnd.getMonth(), lEnd.getDate()).getTime();
                        const d = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();

                        return d >= s && d <= e;
                    });

                    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.getDay()];
                    const isWeeklyOff = weeklyOffs.includes(dayName);

                    const isToday = normalizeDate(day) === normalizeDate(new Date());
                    const joiningDate = user?.joiningDate ? new Date(user.joiningDate) : null;
                    if (joiningDate) joiningDate.setHours(0, 0, 0, 0);
                    const isBeforeJoining = joiningDate && day < joiningDate;

                    return (
                        <div
                            key={day.toISOString()}
                            className={`min-h-[100px] border-b border-r border-slate-100 px-2 py-2 relative group transition-colors ${isToday ? 'bg-blue-50/20' : 'bg-white'} ${isWeeklyOff ? 'bg-slate-50/40' : ''}`}
                        >
                            <div className={`text-right mb-2 font-medium text-[11px] ${isToday ? 'text-blue-600' : (isWeeklyOff ? 'text-slate-300' : 'text-slate-400')}`}>
                                {day.getDate()}
                            </div>

                            {/* Regularize Action */}
                            {(() => {
                                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.getDay()];
                                const isWeeklyOff = weeklyOffs.includes(dayName);
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

                                    const isCWeeklyOff = weeklyOffs.includes(cDayName);
                                    const isCHoliday = (holidays || []).some(h => new Date(h.date).toDateString() === cDateStr);

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
                                <div className={`mb-1 text-[9px] font-semibold px-1 py-0.5 rounded ${holiday.isOptional ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'} truncate`} title={holiday.name}>
                                    {holiday.name}
                                </div>
                            )}

                            {leave && (
                                (() => {
                                    const isHoliday = !!holiday;
                                    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.getDay()];
                                    const isWeeklyOff = weeklyOffs.includes(dayName);

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
                                    const approvalMeta = getApprovalMeta(record);
                                    return (
                                        <div className="space-y-1.5">
                                            <div className="flex items-start space-x-1">
                                                <div className={`h-2 w-2 rounded-full mt-1 ${approvalMeta.dotClass}`}></div>
                                                <div className="leading-tight">
                                                    <div className={`text-[10px] font-medium ${approvalMeta.textClass}`}>
                                                        {approvalMeta.primaryLabel}
                                                    </div>
                                                    {approvalMeta.secondaryLabel && (
                                                        <div className={`text-[9px] font-medium ${approvalMeta.textClass}`}>
                                                            ({approvalMeta.secondaryLabel})
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {approvalMeta.showTimes && record.clockIn && (
                                                <div className="text-[9px] text-slate-500 font-mono pl-3 line-clamp-1">
                                                    In: {new Date(record.clockIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </div>
                                            )}
                                            {approvalMeta.showTimes && record.clockOut && (
                                                <div className="text-[9px] text-slate-500 font-mono pl-3 line-clamp-1">
                                                    Out: {new Date(record.clockOut).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            ) : (
                                !leave && (
                                    isBeforeJoining ? (
                                        <div className="flex justify-center mt-6 opacity-70">
                                            <span className="text-[11px] text-slate-300 font-semibold" title="Not Applicable">N/A</span>
                                        </div>
                                    ) : (
                                        isWeeklyOff ? (
                                            <div className="flex justify-center mt-6 opacity-80">
                                                <span className="text-[11px] text-slate-300 font-semibold uppercase tracking-wide">OFF</span>
                                            </div>
                                        ) : (
                                            !holiday && day < new Date() && (
                                                <div className="flex justify-center mt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-[11px] text-red-400 font-medium">Absent</span>
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
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                    <span className="text-[10px] text-slate-600 font-medium">Pending</span>
                </div>
                <div className="flex items-center space-x-1.5">
                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                    <span className="text-[10px] text-slate-600 font-medium">Rejected / Absent</span>
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
