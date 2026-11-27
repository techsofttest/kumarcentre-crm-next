"use client";

import { useState, useEffect } from "react";
import {
    Clock,
    Calendar as CalendarIcon,
    AlertCircle,
    Coffee,
    CalendarOff,
    Loader2,
    RefreshCw,
    ShieldAlert,
    CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime12h(timeStr: string | null | undefined): string {
    if (!timeStr) return "—";

    if (timeStr.includes("T") || timeStr.includes("Z")) {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata",
            });
        }
    }

    if (timeStr.includes(" ") && timeStr.includes("-")) {
        const timeOnly = timeStr.split(" ")[1];
        if (timeOnly) {
            timeStr = timeOnly;
        }
    }

    const clean = timeStr.includes("T") ? timeStr.split("T")[1] : timeStr;
    const parts = clean.slice(0, 5).split(":");
    if (parts.length !== 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${m} ${ampm}`;
}

const MONTH_NAMES_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatDateDisplay(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.split(" ")[0];
    const parts = cleanDate.split("-");
    if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parts[2].padStart(2, "0");
        const monthName = MONTH_NAMES_SHORT[monthIndex] || parts[1];
        return `${day}-${monthName}-${year}`;
    }
    return dateStr;
}

interface WorkingSession {
    id: number;
    start_time: string;
    end_time: string;
    breaks: Array<{ id: number; start_time: string; end_time: string }>;
}

interface WorkingDay {
    id: number;
    day_of_week: number;
    is_working: boolean;
    sessions: WorkingSession[];
}

interface ScheduleExclusion {
    id: number;
    doctor_id: number | null;
    exclusion_date: string;
    start_time: string | null;
    end_time: string | null;
    reason: string | null;
    doctor?: { id: number; name: string } | null;
}

export default function DoctorSchedulePage() {
    const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
    const [exclusions, setExclusions] = useState<ScheduleExclusion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fetchSchedule = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await api.getStaffClinicSchedule();
            setWorkingDays(res.working_days || []);
            setExclusions(res.exclusions || []);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load clinic schedule.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedule();
    }, []);

    // Sort working days Monday (1) to Sunday (0)
    const sortedWorkingDays = [...workingDays].sort((a, b) => {
        const orderA = a.day_of_week === 0 ? 7 : a.day_of_week;
        const orderB = b.day_of_week === 0 ? 7 : b.day_of_week;
        return orderA - orderB;
    });

    return (
        <div className="flex w-full flex-col gap-6 p-8">
            {/* Header & Breadcrumb */}
            <div className="flex flex-col gap-4 border-b border-black/10 dark:border-white/10 pb-5">
                <div className="flex items-center gap-2 text-xs text-foreground/50">
                    <span>Doctor Admin</span>
                    <span>/</span>
                    <span className="text-foreground font-semibold">Clinic Schedule</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Clinic Operating Schedule
                        </h1>
                        <p className="text-xs text-foreground/60 mt-1">
                            Common clinic working hours, consultation sessions, breaks, and holiday calendar
                        </p>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        icon={RefreshCw}
                        onClick={fetchSchedule}
                        disabled={isLoading}
                    >
                        {isLoading ? "Refreshing..." : "Refresh Schedule"}
                    </Button>
                </div>
            </div>

            {errorMessage && (
                <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-xs text-foreground/50">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                    <span>Loading schedule information...</span>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* SECTION 1: WEEKLY OPERATING SCHEDULE TABLE */}
                    <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 overflow-hidden shadow-xs">
                        <div className="border-b border-black/5 dark:border-white/5 p-4 bg-slate-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-purple-600" />
                                <h2 className="text-sm font-bold text-foreground">
                                    Weekly Clinic Consultation Hours
                                </h2>
                            </div>
                            <span className="text-[11px] text-foreground/50">
                                Regular Operating Days & Sessions
                            </span>
                        </div>

                        {sortedWorkingDays.length === 0 ? (
                            <div className="p-8 text-center text-xs text-foreground/50">
                                No schedule configured for this clinic.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-black/10 dark:border-white/10 text-foreground/50 uppercase tracking-wider text-[10px] bg-slate-50/30 dark:bg-zinc-800/20">
                                            <th className="py-3 px-4">Day</th>
                                            <th className="py-3 px-4">Operating Status</th>
                                            <th className="py-3 px-4">Morning Session</th>
                                            <th className="py-3 px-4">Evening Session</th>
                                            <th className="py-3 px-4">Scheduled Breaks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                        {sortedWorkingDays.map((day) => {
                                            const dayName = DAYS_OF_WEEK[day.day_of_week];
                                            const session1 = day.sessions && day.sessions[0];
                                            const session2 = day.sessions && day.sessions[1];

                                            // All breaks in this day
                                            const allBreaks = (day.sessions || []).flatMap((s) => s.breaks || []);

                                            return (
                                                <tr key={day.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
                                                    <td className="py-3 px-4 font-bold text-foreground">
                                                        {dayName}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {day.is_working ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold uppercase">
                                                                <CheckCircle2 className="h-3 w-3" /> Working
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-400 px-2 py-0.5 text-[10px] font-bold uppercase">
                                                                Off
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono text-foreground/80">
                                                        {day.is_working && session1 ? (
                                                            <span>
                                                                {formatTime12h(session1.start_time)} – {formatTime12h(session1.end_time)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-foreground/40">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono text-foreground/80">
                                                        {day.is_working && session2 ? (
                                                            <span>
                                                                {formatTime12h(session2.start_time)} – {formatTime12h(session2.end_time)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-foreground/40">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {allBreaks.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {allBreaks.map((b) => (
                                                                    <span
                                                                        key={b.id}
                                                                        className="inline-flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 font-mono text-[10px] border border-amber-200 dark:border-amber-900/40"
                                                                    >
                                                                        <Coffee className="h-2.5 w-2.5" />
                                                                        {formatTime12h(b.start_time)} – {formatTime12h(b.end_time)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-foreground/40">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: UPCOMING HOLIDAYS & BLOCKED DATES */}
                    <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 overflow-hidden shadow-xs">
                        <div className="border-b border-black/5 dark:border-white/5 p-4 bg-slate-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CalendarOff className="h-4 w-4 text-red-600" />
                                <h2 className="text-sm font-bold text-foreground">
                                    Upcoming Holidays & Blocked Dates ({exclusions.length})
                                </h2>
                            </div>
                            <span className="text-[11px] text-foreground/50">
                                Clinic-wide closures & scheduled leaves
                            </span>
                        </div>

                        {exclusions.length === 0 ? (
                            <div className="p-8 text-center text-xs text-foreground/50">
                                No upcoming holidays or blocked exclusions on schedule.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-black/10 dark:border-white/10 text-foreground/50 uppercase tracking-wider text-[10px] bg-slate-50/30 dark:bg-zinc-800/20">
                                            <th className="py-3 px-4">Date</th>
                                            <th className="py-3 px-4">Scope</th>
                                            <th className="py-3 px-4">Timing</th>
                                            <th className="py-3 px-4">Reason / Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                        {exclusions.map((ex) => (
                                            <tr key={ex.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
                                                <td className="py-3 px-4 font-mono font-bold text-foreground">
                                                    {formatDateDisplay(ex.exclusion_date)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {ex.doctor_id ? (
                                                        <span className="rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 text-[10px] font-semibold">
                                                            Dr. {ex.doctor?.name || "Doctor Specific"}
                                                        </span>
                                                    ) : (
                                                        <span className="rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 text-[10px] font-semibold">
                                                            Clinic-Wide Closure
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 font-mono text-foreground/80">
                                                    {ex.start_time && ex.end_time ? (
                                                        `${formatTime12h(ex.start_time)} – ${formatTime12h(ex.end_time)}`
                                                    ) : (
                                                        "All Day Block"
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-foreground/80">
                                                    {ex.reason || "Scheduled closure"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
