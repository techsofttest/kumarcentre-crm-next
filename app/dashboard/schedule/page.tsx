"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { normalizeRole } from "@/lib/roles";
import {
    Clock,
    Calendar as CalendarIcon,
    Plus,
    X,
    Stethoscope,
    AlertCircle,
    CheckCircle2,
    CalendarDays,
    Loader2,
    Trash2,
    ShieldAlert,
    Building2,
    Coffee,
    CalendarOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertifyToast } from "@/components/ui/alertify-toast";
import { FlatpickrTime } from "@/components/ui/flatpickr-time";
import { api, ApiError } from "@/lib/api";
import { formatIstDate, formatIstTime12h, getTodayIstYmd } from "@/lib/date-utils";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime12h(timeStr: string | null | undefined): string {
    return formatIstTime12h(timeStr, "", true);
}

function formatDateDisplay(dateStr: string): string {
    return formatIstDate(dateStr, "");
}

interface ClinicBreak {
    id?: number;
    start_time: string;
    end_time: string;
}

interface ClinicSession {
    id?: number;
    start_time: string;
    end_time: string;
    breaks?: ClinicBreak[];
}

interface WorkingDay {
    id?: number;
    day_of_week: number;
    is_working: boolean;
    sessions: ClinicSession[];
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

interface DoctorSimple {
    id: number;
    name: string;
}

export default function ClinicScheduleManagement() {
    const router = useRouter();
    const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
    const [exclusions, setExclusions] = useState<ScheduleExclusion[]>([]);
    const [doctors, setDoctors] = useState<DoctorSimple[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    const [isUnauthorized, setIsUnauthorized] = useState(false);

    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);

    // Modal state for adding exclusion
    const [showExclusionModal, setShowExclusionModal] = useState(false);
    const [targetDoctorId, setTargetDoctorId] = useState<number | "">("");
    const [exclusionDate, setExclusionDate] = useState(() => getTodayIstYmd(1));
    const [isFullDay, setIsFullDay] = useState(true);
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("13:00");
    const [reason, setReason] = useState("");
    const [isSavingExclusion, setIsSavingExclusion] = useState(false);

    // Check role on mount
    useEffect(() => {
        const storedRole = localStorage.getItem("userRole") || "";
        const normalized = (normalizeRole(storedRole) ?? "").toLowerCase();
        if (normalized === "doctor") {
            router.replace("/dashboard/doctor/schedule");
            return;
        }
        if (normalized !== "admin") {
            setIsUnauthorized(true);
            setIsLoading(false);
        } else {
            loadData();
        }
    }, [router]);

    // Load data from backend API
    const loadData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await api.getClinicSchedule();
            setWorkingDays(res.working_days || []);
            setExclusions(res.exclusions || []);
            setDoctors(res.doctors || []);
        } catch (err: any) {
            if (err.status === 403) {
                setIsUnauthorized(true);
            } else {
                setErrorMessage(err.message || "Failed to load clinic schedule data.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Toggle working day
    const handleToggleDay = (dayIndex: number) => {
        setWorkingDays((prev) =>
            prev.map((d) => {
                if (d.day_of_week === dayIndex) {
                    const newIsWorking = !d.is_working;
                    return {
                        ...d,
                        is_working: newIsWorking,
                        sessions: newIsWorking && d.sessions.length === 0
                            ? [
                                { start_time: "09:00:00", end_time: "13:00:00", breaks: [] },
                                { start_time: "14:00:00", end_time: "17:00:00", breaks: [] },
                            ]
                            : d.sessions,
                    };
                }
                return d;
            })
        );
    };

    // Update session times
    const handleUpdateSession = (dayIndex: number, sessionIdx: number, field: "start_time" | "end_time", value: string) => {
        setWorkingDays((prev) =>
            prev.map((d) => {
                if (d.day_of_week === dayIndex) {
                    const updatedSessions = [...d.sessions];
                    const nextSession = {
                        ...updatedSessions[sessionIdx],
                        [field]: value.length === 5 ? `${value}:00` : value,
                    };
                    nextSession.breaks = (nextSession.breaks || []).filter(
                        (b) => b.start_time >= nextSession.start_time && b.end_time <= nextSession.end_time
                    );
                    updatedSessions[sessionIdx] = nextSession;
                    return { ...d, sessions: updatedSessions };
                }
                return d;
            })
        );
    };

    // Add session to a day
    const handleAddSession = (dayIndex: number) => {
        setWorkingDays((prev) =>
            prev.map((d) => {
                if (d.day_of_week === dayIndex) {
                    return {
                        ...d,
                        sessions: [
                            ...d.sessions,
                            { start_time: "14:00:00", end_time: "17:00:00", breaks: [] },
                        ],
                    };
                }
                return d;
            })
        );
    };

    // Remove session
    const handleRemoveSession = (dayIndex: number, sessionIdx: number) => {
        setWorkingDays((prev) =>
            prev.map((d) => {
                if (d.day_of_week === dayIndex) {
                    return {
                        ...d,
                        sessions: d.sessions.filter((_, idx) => idx !== sessionIdx),
                    };
                }
                return d;
            })
        );
    };

    // Add break to a session
    const handleAddBreak = (dayIndex: number, sessionIdx: number) => {
        setWorkingDays((prev) =>
            prev.map((d) => {
                if (d.day_of_week === dayIndex) {
                    const updatedSessions = [...d.sessions];
                    const targetSession = updatedSessions[sessionIdx];
                    const existingBreaks = targetSession.breaks || [];
                    const defaultStart = "13:00:00" >= targetSession.start_time && "14:00:00" <= targetSession.end_time
                        ? "13:00:00"
                        : targetSession.start_time;
                    const defaultEnd = "13:00:00" >= targetSession.start_time && "14:00:00" <= targetSession.end_time
                        ? "14:00:00"
                        : targetSession.end_time;
                    updatedSessions[sessionIdx] = {
                        ...targetSession,
                        breaks: [
                            ...existingBreaks,
                            { start_time: defaultStart, end_time: defaultEnd },
                        ],
                    };
                    return { ...d, sessions: updatedSessions };
                }
                return d;
            })
        );
    };

    // Remove break
    const handleRemoveBreak = (dayIndex: number, sessionIdx: number, breakIdx: number) => {
        setWorkingDays((prev) =>
            prev.map((d) => {
                if (d.day_of_week === dayIndex) {
                    const updatedSessions = [...d.sessions];
                    const existingBreaks = updatedSessions[sessionIdx].breaks || [];
                    updatedSessions[sessionIdx] = {
                        ...updatedSessions[sessionIdx],
                        breaks: existingBreaks.filter((_, idx) => idx !== breakIdx),
                    };
                    return { ...d, sessions: updatedSessions };
                }
                return d;
            })
        );
    };

    // Update break times
    const handleUpdateBreak = (dayIndex: number, sessionIdx: number, breakIdx: number, field: "start_time" | "end_time", value: string) => {
        setWorkingDays((prev) =>
            prev.map((d) => {
                if (d.day_of_week === dayIndex) {
                    const updatedSessions = [...d.sessions];
                    const existingBreaks = [...(updatedSessions[sessionIdx].breaks || [])];
                    existingBreaks[breakIdx] = {
                        ...existingBreaks[breakIdx],
                        [field]: value.length === 5 ? `${value}:00` : value,
                    };
                    updatedSessions[sessionIdx] = {
                        ...updatedSessions[sessionIdx],
                        breaks: existingBreaks,
                    };
                    return { ...d, sessions: updatedSessions };
                }
                return d;
            })
        );
    };

    // Save common weekly schedule
    const handleSaveSchedule = async () => {
        setErrorMessage(null);

        for (const day of workingDays) {
            if (!day.is_working) continue;
            const dayLabel = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day.day_of_week] || `Day ${day.day_of_week}`;
            const sortedSessions = [...day.sessions].sort((a, b) => a.start_time.localeCompare(b.start_time));
            for (let i = 0; i < sortedSessions.length; i++) {
                const s = sortedSessions[i];
                if (s.end_time <= s.start_time) {
                    setErrorMessage(`${dayLabel}: Session end time (${s.end_time}) must be after start time (${s.start_time}).`);
                    return;
                }
                if (i > 0 && s.start_time < sortedSessions[i - 1].end_time) {
                    setErrorMessage(`${dayLabel}: Sessions (${sortedSessions[i - 1].start_time} - ${sortedSessions[i - 1].end_time}) and (${s.start_time} - ${s.end_time}) cannot overlap.`);
                    return;
                }
            }
        }

        const sanitizedDays = workingDays.map((day) => ({
            ...day,
            sessions: day.sessions.map((s) => ({
                ...s,
                breaks: [],
            })),
        }));

        setIsSavingSchedule(true);
        try {
            await api.updateClinicSchedule(sanitizedDays);
            setAlertMessage("Clinic working hours saved successfully!");
            setTimeout(() => setAlertMessage(null), 4000);
            loadData();
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to update clinic schedule.");
        } finally {
            setIsSavingSchedule(false);
        }
    };

    // Save exclusion
    const handleAddExclusion = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingExclusion(true);
        setErrorMessage(null);
        setConflictWarning(null);

        try {
            const res = await api.addScheduleExclusion({
                doctor_id: targetDoctorId ? Number(targetDoctorId) : null,
                exclusion_date: exclusionDate,
                start_time: isFullDay ? null : startTime,
                end_time: isFullDay ? null : endTime,
                reason: reason.trim() || undefined,
            });

            setShowExclusionModal(false);
            setReason("");
            setAlertMessage("Schedule exclusion added successfully.");
            if (res.warning) {
                setConflictWarning(res.warning);
            }
            loadData();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to save exclusion.");
        } finally {
            setIsSavingExclusion(false);
        }
    };

    // Delete exclusion
    const handleRemoveExclusion = async (id: number) => {
        try {
            await api.removeScheduleExclusion(id);
            setAlertMessage("Schedule exclusion removed.");
            setTimeout(() => setAlertMessage(null), 3000);
            loadData();
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to remove exclusion.");
        }
    };

    if (isUnauthorized) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center p-12 text-center">
                <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 dark:border-red-900/40 dark:bg-red-950/20 max-w-md space-y-4">
                    <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
                    <h2 className="text-lg font-bold text-red-900 dark:text-red-200">
                        Access Restricted
                    </h2>
                    <p className="text-xs text-foreground/70 leading-relaxed">
                        Only clinic administrators have permission to configure clinic operating schedules, breaks, and exclusions. Doctors are not permitted to alter clinic-wide schedules.
                    </p>
                    <div className="pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push("/dashboard/doctor")}
                        >
                            Return to Doctor Workspace
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-8 p-8 max-w-6xl mx-auto text-foreground">
            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Clinic Working Hours & Exclusions
                    </h1>
                </div>

                <div className="flex flex-wrap gap-2.5">
                    <Button
                        variant="outline"
                        onClick={() => setShowExclusionModal(true)}
                        icon={CalendarOff}
                    >
                        Add Schedule Exclusion
                    </Button>
                </div>
            </div>

            <AlertifyToast type="success" message={alertMessage} onClose={() => setAlertMessage(null)} />
            <AlertifyToast type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />

            {conflictWarning && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <span className="font-bold">Booking Conflict Warning: </span>
                        <span>{conflictWarning}</span>
                    </div>
                </div>
            )}

            {/* SECTION 1: COMMON WEEKLY WORKING SCHEDULE */}
            <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900 space-y-6">
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-purple-600" />
                        Common Clinic Operating Schedule (Applies to All Doctors)
                    </h2>
                    <p className="text-xs text-foreground/60 mt-1">
                        Active doctors share these clinic-wide working sessions and break times. Individual overrides can be added later without loss of data.
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center p-12 text-sm text-foreground/60">
                        <Loader2 className="h-6 w-6 animate-spin text-purple-600 mr-2" />
                        Loading clinic schedule...
                    </div>
                ) : (
                    <div className="space-y-4">
                        {DAYS_OF_WEEK.map((dayName, dayIndex) => {
                            const dayConfig = workingDays.find((d) => d.day_of_week === dayIndex) || {
                                day_of_week: dayIndex,
                                is_working: false,
                                sessions: [],
                            };

                            if (isUnauthorized) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center p-12 text-center">
                <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 dark:border-red-900/40 dark:bg-red-950/20 max-w-md space-y-4">
                    <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
                    <h2 className="text-lg font-bold text-red-900 dark:text-red-200">
                        Access Restricted
                    </h2>
                    <p className="text-xs text-foreground/70 leading-relaxed">
                        Only clinic administrators have permission to configure clinic operating schedules, breaks, and exclusions. Doctors are not permitted to alter clinic-wide schedules.
                    </p>
                    <div className="pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push("/dashboard/doctor")}
                        >
                            Return to Doctor Workspace
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
                                <div
                                    key={dayIndex}
                                    className={`rounded-xl border p-4 transition-all ${
                                        dayConfig.is_working
                                            ? "border-black/10 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-800/20"
                                            : "border-dashed border-black/10 dark:border-white/10 bg-zinc-100/40 dark:bg-zinc-900/40 opacity-70"
                                    }`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 dark:border-white/5 pb-3">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id={`day_${dayIndex}`}
                                                checked={dayConfig.is_working}
                                                onChange={() => handleToggleDay(dayIndex)}
                                                className="h-4 w-4 rounded border-black/20 text-purple-600 focus:ring-purple-500"
                                            />
                                            <label
                                                htmlFor={`day_${dayIndex}`}
                                                className="text-sm font-bold cursor-pointer select-none"
                                            >
                                                {dayName}
                                            </label>
                                            <span
                                                className={`text-xs px-2 py-0.5 rounded font-medium ${
                                                    dayConfig.is_working
                                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                                }`}
                                            >
                                                {dayConfig.is_working ? "Open" : "Closed"}
                                            </span>
                                        </div>

                                        {dayConfig.is_working && (
                                            <button
                                                type="button"
                                                onClick={() => handleAddSession(dayIndex)}
                                                className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 self-start sm:self-auto"
                                            >
                                                <Plus className="h-3.5 w-3.5" /> Add Working Session
                                            </button>
                                        )}
                                    </div>

                                    {dayConfig.is_working && (
                                        <div className="pt-3 space-y-4">
                                            {dayConfig.sessions.map((session, sIdx) => (
                                                <div
                                                    key={sIdx}
                                                    className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 p-3.5 space-y-3"
                                                >
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                                                                Session {sIdx + 1}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <FlatpickrTime
                                                                    value={session.start_time}
                                                                    onChange={(val) => handleUpdateSession(dayIndex, sIdx, "start_time", val)}
                                                                />
                                                                <span className="text-xs text-foreground/50">to</span>
                                                                <FlatpickrTime
                                                                    value={session.end_time}
                                                                    onChange={(val) => handleUpdateSession(dayIndex, sIdx, "end_time", val)}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {dayConfig.sessions.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveSession(dayIndex, sIdx)}
                                                                    className="text-xs text-red-600 hover:text-red-700 p-1"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer Center-Aligned Save Button */}
                <div className="border-t border-black/10 dark:border-white/10 pt-5 mt-6 flex justify-center">
                    <Button
                        variant="filled"
                        size="md"
                        onClick={handleSaveSchedule}
                        disabled={isSavingSchedule || isLoading}
                        className="bg-purple-600 hover:bg-purple-700 text-white min-w-[200px]"
                    >
                        {isSavingSchedule ? "Saving Common Schedule..." : "Save Common Schedule"}
                    </Button>
                </div>
            </div>

            {/* SECTION 2: SCHEDULE EXCLUSIONS */}
            <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <CalendarOff className="h-5 w-5 text-amber-600" />
                            Active Schedule Exclusions (Clinic Holidays, Doctor Leaves & Blocks)
                        </h2>
                        <p className="text-xs text-foreground/60 mt-0.5">
                            Exclusions prevent appointments from being booked during the blocked period
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowExclusionModal(true)}
                        icon={Plus}
                    >
                        Add Exclusion
                    </Button>
                </div>

                {exclusions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center text-sm text-foreground/50">
                        No upcoming schedule exclusions found.
                    </div>
                ) : (
                    <div className="divide-y divide-black/5 dark:divide-white/5 rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
                        {exclusions.map((ex) => (
                            <div key={ex.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                                            {formatDateDisplay(ex.exclusion_date)}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                            ex.doctor_id ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200" : "bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200"
                                        }`}>
                                            {ex.doctor ? `Doctor: ${ex.doctor.name}` : "🏥 All Doctors (Clinic-Wide)"}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded font-medium bg-zinc-100 dark:bg-zinc-800 text-foreground/70">
                                            {!ex.start_time ? "Full Day" : `${formatTime12h(ex.start_time)} - ${formatTime12h(ex.end_time)}`}
                                        </span>
                                    </div>
                                    {ex.reason && (
                                        <p className="text-xs text-foreground/60">{ex.reason}</p>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleRemoveExclusion(ex.id)}
                                    className="text-foreground/40 hover:text-red-600 p-2 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ADD EXCLUSION MODAL */}
            {showExclusionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="relative w-full max-w-lg rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 p-6 space-y-4 shadow-none">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="text-base font-bold flex items-center gap-2">
                                <CalendarOff className="h-4 w-4 text-purple-600" />
                                Add Schedule Exclusion
                            </h3>
                            <button
                                onClick={() => setShowExclusionModal(false)}
                                className="text-foreground/50 hover:text-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddExclusion} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                    Target Scope *
                                </label>
                                <select
                                    value={targetDoctorId}
                                    onChange={(e) => setTargetDoctorId(e.target.value ? Number(e.target.value) : "")}
                                    className="w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-2.5 text-xs focus:border-purple-600 focus:outline-none"
                                >
                                    <option value="">🏥 All Doctors (Clinic-Wide Exclusion)</option>
                                    {doctors.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            Doctor: {d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                    Exclusion Date *
                                </label>
                                <input
                                    type="date"
                                    required
                                    min={getTodayIstYmd()}
                                    value={exclusionDate}
                                    onChange={(e) => setExclusionDate(e.target.value)}
                                    className="w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-2 text-xs focus:border-purple-600 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                    Duration Window
                                </label>
                                <div className="flex items-center gap-4 text-xs">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="duration_type"
                                            checked={isFullDay}
                                            onChange={() => setIsFullDay(true)}
                                            className="text-purple-600"
                                        />
                                        <span>Full Day Exclusion</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="duration_type"
                                            checked={!isFullDay}
                                            onChange={() => setIsFullDay(false)}
                                            className="text-purple-600"
                                        />
                                        <span>Specific Time Range</span>
                                    </label>
                                </div>
                            </div>

                            {!isFullDay && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                            Start Time *
                                        </label>
                                        <FlatpickrTime
                                            value={startTime}
                                            onChange={setStartTime}
                                            className="w-full text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                            End Time *
                                        </label>
                                        <FlatpickrTime
                                            value={endTime}
                                            onChange={setEndTime}
                                            className="w-full text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                    Reason / Description (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g. National Holiday, Facility Maintenance, Doctor Leave"
                                    className="w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-2 text-xs focus:border-purple-600 focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-black/5 dark:border-white/5">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowExclusionModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isSavingExclusion}
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                >
                                    {isSavingExclusion ? "Saving Exclusion..." : "Create Exclusion"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
