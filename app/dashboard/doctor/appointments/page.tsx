"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
    Calendar as CalendarIcon,
    Clock,
    Search,
    ChevronLeft,
    ChevronRight,
    Filter,
    Stethoscope,
    FileText,
    CheckCircle2,
    Activity,
    AlertCircle,
    UserCheck,
    Eye,
    Save,
    Send,
    History,
    X,
    Loader2,
    RefreshCw,
    User,
    Phone,
    AlertTriangle,
    SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { subscribeToQueueUpdates } from "@/lib/queue-sync";
import { formatAgeGender } from "@/lib/patient-utils";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const MONTH_NAMES_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateTable(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
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

function formatTime12h(timeStr: string | null | undefined): string {
    if (!timeStr) return "";

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

    const cleanTime = timeStr.includes("T") ? timeStr.split("T")[1] : timeStr;
    const parts = cleanTime.slice(0, 5).split(":");
    if (parts.length !== 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    if (isNaN(h)) return timeStr;
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const hourPad = String(hour12).padStart(2, "0");
    return `${hourPad}:${m} ${period}`;
}

const formatDateYMD = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

interface Patient {
    id: number;
    name: string;
    mobile_number: string;
    file_number?: string | null;
    date_of_birth?: string | null;
    age?: number | null;
    gender?: string | null;
}

interface AppointmentItem {
    id: number;
    reference: string;
    appointment_type: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: string;
    internal_notes?: string | null;
    checked_in_at?: string | null;
    consultation_started_at?: string | null;
    consultation_completed_at?: string | null;
    patient?: Patient;
    consultation?: {
        id: number;
        remarks: string;
        outcome: string;
        started_at: string;
        completed_at?: string | null;
    } | null;
    physiotherapy_referrals?: Array<{
        id: number;
        status: string;
        treatment_instructions: string;
    }>;
}

interface PastConsultation {
    id: number;
    consultation_date: string;
    doctor_name: string;
    remarks: string | null;
    outcome: string;
    referred_to_physio: boolean;
    physiotherapy_instructions?: string | null;
}

export default function MyAppointmentsPage() {
    // View Switcher: Day (Default), Week, Month
    const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");

    // Current Reference Date
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const selectedDateStr = useMemo(() => formatDateYMD(currentDate), [currentDate]);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");

    // Appointments Data
    const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
    const [summary, setSummary] = useState({
        total: 0,
        confirmed: 0,
        checked_in: 0,
        in_consultation: 0,
        completed: 0,
        cancelled: 0,
    });
    const [doctorInfo, setDoctorInfo] = useState<{ id: number; name: string; specialization: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Selected Appointment for Details Drawer
    const [detailsAppointment, setDetailsAppointment] = useState<AppointmentItem | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Consultation Workspace Modal (Reusing existing consultation flow)
    const [consultationModalOpen, setConsultationModalOpen] = useState(false);
    const [activeAppointment, setActiveAppointment] = useState<AppointmentItem | null>(null);
    const [consultationRemarks, setConsultationRemarks] = useState("");
    const [pastHistory, setPastHistory] = useState<PastConsultation[]>([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const [isReferralOpen, setIsReferralOpen] = useState(false);
    const [physiotherapists, setPhysiotherapists] = useState<Array<{ id: number; name: string }>>([]);
    const [assignedPhysioId, setAssignedPhysioId] = useState<number | "">("");
    const [referralInstructions, setReferralInstructions] = useState("");
    const [confirmModal, setConfirmModal] = useState<{ open: boolean; type: "complete" | "refer" }>({
        open: false,
        type: "complete",
    });

    // View-Only Consultation Modal
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewAppointment, setViewAppointment] = useState<AppointmentItem | null>(null);

    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Calculate Week Range for Week View (Monday to Sunday)
    const weekDays = useMemo(() => {
        const curr = new Date(currentDate);
        const day = curr.getDay();
        const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
        const monday = new Date(curr.setDate(diff));

        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const next = new Date(monday);
            next.setDate(monday.getDate() + i);
            days.push(next);
        }
        return days;
    }, [currentDate]);

    // Calculate Month Range for Month View
    const monthCalendarData = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const daysInMonth = lastDay.getDate();
        const startDayIndex = firstDay.getDay(); // 0 is Sunday

        const days: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = [];

        // Previous month days to pad the start
        for (let i = startDayIndex - 1; i >= 0; i--) {
            const d = new Date(year, month, -i);
            days.push({ date: d, dateStr: formatDateYMD(d), isCurrentMonth: false });
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            days.push({ date: d, dateStr: formatDateYMD(d), isCurrentMonth: true });
        }

        // Next month days to pad to 35 or 42 cells
        const remaining = 7 - (days.length % 7);
        if (remaining < 7) {
            for (let i = 1; i <= remaining; i++) {
                const d = new Date(year, month + 1, i);
                days.push({ date: d, dateStr: formatDateYMD(d), isCurrentMonth: false });
            }
        }

        return days;
    }, [currentDate]);

    // Fetch appointments based on viewMode and active range
    const fetchAppointments = async (silent: boolean = false) => {
        if (!silent) {
            setIsLoading(true);
            setErrorMessage(null);
        }
        try {
            let params: any = {
                status: statusFilter,
                type: typeFilter,
                search: searchQuery.trim() || undefined,
            };

            if (viewMode === "day") {
                params.date = selectedDateStr;
            } else if (viewMode === "week") {
                params.start_date = formatDateYMD(weekDays[0]);
                params.end_date = formatDateYMD(weekDays[6]);
            } else if (viewMode === "month") {
                params.start_date = monthCalendarData[0]?.dateStr;
                params.end_date = monthCalendarData[monthCalendarData.length - 1]?.dateStr;
            }

            const res = await api.getDoctorAppointments(params);
            setDoctorInfo(res.doctor);
            setAppointments(res.appointments || []);
            setSummary(res.summary || {
                total: 0,
                confirmed: 0,
                checked_in: 0,
                in_consultation: 0,
                completed: 0,
                cancelled: 0,
            });
        } catch (err: any) {
            if (!silent) {
                setErrorMessage(err.message || "Failed to load doctor appointments.");
            }
        } finally {
            if (!silent) {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        // Initial fetch with spinner
        fetchAppointments(false);

        // 1. Instant cross-tab sync when receptionist checks in or updates queue
        const unsubscribe = subscribeToQueueUpdates(() => {
            fetchAppointments(true);
        });

        // 2. Automated background live polling (every 8 seconds while tab is active)
        const intervalId = setInterval(() => {
            if (typeof document !== "undefined" && !document.hidden) {
                fetchAppointments(true);
            }
        }, 8000);

        // 3. Immediate sync on window focus or tab visibility change
        const handleVisibilityChange = () => {
            if (typeof document !== "undefined" && !document.hidden) {
                fetchAppointments(true);
            }
        };

        window.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleVisibilityChange);

        return () => {
            unsubscribe();
            clearInterval(intervalId);
            window.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleVisibilityChange);
        };
    }, [viewMode, currentDate, statusFilter, typeFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchAppointments();
    };

    // Navigation Controls
    const handlePrev = () => {
        const d = new Date(currentDate);
        if (viewMode === "day") {
            d.setDate(d.getDate() - 1);
        } else if (viewMode === "week") {
            d.setDate(d.getDate() - 7);
        } else if (viewMode === "month") {
            d.setMonth(d.getMonth() - 1);
        }
        setCurrentDate(d);
    };

    const handleNext = () => {
        const d = new Date(currentDate);
        if (viewMode === "day") {
            d.setDate(d.getDate() + 1);
        } else if (viewMode === "week") {
            d.setDate(d.getDate() + 7);
        } else if (viewMode === "month") {
            d.setMonth(d.getMonth() + 1);
        }
        setCurrentDate(d);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    // Open Consultation Workspace (Start or Continue)
    const handleOpenConsultation = async (appointment: AppointmentItem, isStart: boolean = false) => {
        setErrorMessage(null);
        setIsLoadingDetails(true);
        try {
            if (isStart) {
                const res = await api.startDoctorConsultation(appointment.id);
                appointment = res.appointment;
            }

            const details = await api.getDoctorConsultationDetails(appointment.id);
            setActiveAppointment(details.appointment);
            setConsultationRemarks(details.consultation?.remarks || "");
            setPastHistory(details.patient_history || []);
            setIsReferralOpen(false);
            setReferralInstructions("");
            setIsDetailsOpen(false);
            setConsultationModalOpen(true);
        } catch (err: any) {
            setErrorMessage(err.message || "Unable to open consultation.");
        } finally {
            setIsLoadingDetails(false);
            fetchAppointments();
        }
    };

    // Save Draft Remarks
    const handleSaveDraft = async () => {
        if (!activeAppointment) return;
        setIsSavingDraft(true);
        try {
            await api.saveDoctorConsultationDraft(activeAppointment.id, consultationRemarks);
            setAlertMessage("Draft remarks saved.");
            setTimeout(() => setAlertMessage(null), 3000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to save draft remarks.");
        } finally {
            setIsSavingDraft(false);
        }
    };

    // Execute Consultation Completion
    const handleExecuteCompletion = async () => {
        if (!activeAppointment) return;

        if (!consultationRemarks.trim()) {
            setErrorMessage("Consultation remarks are required before completing.");
            setConfirmModal({ open: false, type: "complete" });
            return;
        }

        if (confirmModal.type === "refer" && !referralInstructions.trim()) {
            setErrorMessage("Physiotherapy treatment instructions are mandatory when referring.");
            setConfirmModal({ open: false, type: "refer" });
            return;
        }

        if (confirmModal.type === "refer" && !assignedPhysioId) {
            setErrorMessage("Please select an assigned physiotherapist.");
            setConfirmModal({ open: false, type: "refer" });
            return;
        }

        setIsCompleting(true);
        setErrorMessage(null);
        try {
            const outcome = confirmModal.type === "refer" ? "referred_to_physio" : "completed";
            const res = await api.completeDoctorConsultation(activeAppointment.id, {
                remarks: consultationRemarks.trim(),
                outcome,
                treatment_instructions: confirmModal.type === "refer" ? referralInstructions.trim() : undefined,
                assigned_physio_id: confirmModal.type === "refer" ? Number(assignedPhysioId) : undefined,
            });

            setAlertMessage(res.message);
            setConfirmModal({ open: false, type: "complete" });
            setConsultationModalOpen(false);
            setActiveAppointment(null);
            fetchAppointments();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to complete consultation.");
            setConfirmModal({ open: false, type: "complete" });
        } finally {
            setIsCompleting(false);
        }
    };

    // View Completed Consultation
    const handleViewCompleted = async (appointment: AppointmentItem) => {
        setViewAppointment(appointment);
        setIsLoadingDetails(true);
        try {
            const details = await api.getDoctorConsultationDetails(appointment.id);
            setViewAppointment(details.appointment);
            setIsDetailsOpen(false);
            setViewModalOpen(true);
        } catch (err: any) {
            setErrorMessage(err.message || "Unable to view consultation.");
        } finally {
            setIsLoadingDetails(false);
        }
    };

    // Header Date Display String
    const formattedRangeHeader = useMemo(() => {
        if (viewMode === "day") {
            const dayName = currentDate.toLocaleDateString("en-US", { weekday: "long" });
            return `${dayName}, ${formatDateTable(selectedDateStr)}`;
        } else if (viewMode === "week") {
            return `${formatDateTable(formatDateYMD(weekDays[0]))} – ${formatDateTable(formatDateYMD(weekDays[6]))}`;
        } else {
            return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        }
    }, [viewMode, currentDate, selectedDateStr, weekDays]);

    return (
        <div className="flex w-full flex-col gap-6 p-8">
            {/* Notifications */}
            {alertMessage && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-sm font-medium">{alertMessage}</span>
                </div>
            )}

            {errorMessage && (
                <div className="flex items-center justify-between rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                        <span className="text-sm font-medium">{errorMessage}</span>
                    </div>
                    <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Breadcrumb & Header */}
            <div className="flex flex-col gap-4 border-b border-black/10 dark:border-white/10 pb-5">
                <div className="flex items-center gap-2 text-xs text-foreground/50">
                    <span>Doctor Admin</span>
                    <span>/</span>
                    <span className="text-foreground font-semibold">My Appointments</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            My Appointments
                        </h1>
                        <p className="text-xs text-foreground/60 mt-1">
                            {doctorInfo?.name} • Medical consultation schedule and appointment workflow
                        </p>
                    </div>

                    {/* View Selector (Day, Week, Month) */}
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-black/5 dark:border-white/5">
                        <button
                            type="button"
                            onClick={() => setViewMode("day")}
                            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                                viewMode === "day"
                                    ? "bg-white text-purple-700 shadow-xs dark:bg-zinc-900 dark:text-purple-300"
                                    : "text-foreground/60 hover:text-foreground"
                            }`}
                        >
                            Day
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("week")}
                            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                                viewMode === "week"
                                    ? "bg-white text-purple-700 shadow-xs dark:bg-zinc-900 dark:text-purple-300"
                                    : "text-foreground/60 hover:text-foreground"
                            }`}
                        >
                            Week
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("month")}
                            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                                viewMode === "month"
                                    ? "bg-white text-purple-700 shadow-xs dark:bg-zinc-900 dark:text-purple-300"
                                    : "text-foreground/60 hover:text-foreground"
                            }`}
                        >
                            Month
                        </button>
                    </div>
                </div>

                {/* Date Navigation Bar & Filter Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    {/* Navigation Buttons & Header */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 overflow-hidden">
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 text-foreground/70"
                                title="Previous"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleToday}
                                className="px-3 py-1.5 text-xs font-bold border-x border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={handleNext}
                                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 text-foreground/70"
                                title="Next"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>

                        <span className="text-sm font-bold text-foreground font-mono ml-2">
                            {formattedRangeHeader}
                        </span>
                    </div>

                    {/* Filter Bar: Status, Type, and Search */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                        >
                            <option value="all">All Statuses ({summary.total})</option>
                            <option value="confirmed">Confirmed ({summary.confirmed})</option>
                            <option value="checked_in">Checked In ({summary.checked_in})</option>
                            <option value="in_consultation">In Consultation ({summary.in_consultation})</option>
                            <option value="completed">Completed ({summary.completed})</option>
                            <option value="cancelled">Cancelled ({summary.cancelled})</option>
                        </select>

                        {/* Type Filter */}
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                        >
                            <option value="all">All Types</option>
                            <option value="new_registration">New Registration</option>
                            <option value="review_consultation">Review Consultation</option>
                            <option value="procedure">Procedure</option>
                        </select>

                        {/* Search Input */}
                        <form onSubmit={handleSearchSubmit} className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search patient, file #..."
                                className="w-48 sm:w-56 rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-purple-600"
                            />
                        </form>

                        
                        <Button
                            variant="outline"
                            size="sm"
                            icon={RefreshCw}
                            onClick={() => fetchAppointments(false)}
                            disabled={isLoading}
                        >
                            {isLoading ? "Loading..." : "Refresh"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT VIEWPORT */}
            {isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-xs text-foreground/50">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                    <span>Loading appointments...</span>
                </div>
            ) : (
                <>
                    {/* VIEW 1: DAY VIEW (Default: Today's Appointments Timeline) */}
                    {viewMode === "day" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-xs text-foreground/60 border-b border-black/5 dark:border-white/5 pb-2">
                                <span className="font-semibold uppercase tracking-wider text-[11px]">
                                    Chronological Appointments List ({appointments.length})
                                </span>
                                <span>Default view for daily clinic operations</span>
                            </div>

                            {appointments.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-12 text-center text-xs text-foreground/50">
                                    No appointments scheduled for this date matching the current filters.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {appointments.map((apt) => {
                                        const isCheckedIn = apt.status === "checked_in";
                                        const isInConsultation = apt.status === "in_consultation";
                                        const isCompleted = apt.status === "completed";
                                        const isConfirmed = apt.status === "confirmed";
                                        const isCancelled = apt.status === "cancelled" || apt.status === "rejected";

                                        return (
                                            <div
                                                key={apt.id}
                                                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border p-4 transition-all ${
                                                    isInConsultation
                                                        ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-xs"
                                                        : isCheckedIn
                                                        ? "border-amber-400 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs"
                                                        : "border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900"
                                                }`}
                                            >
                                                {/* Left: Time & Patient Identity */}
                                                <div className="flex items-start gap-4">
                                                    {/* Time Slot Badge */}
                                                    <div className="flex flex-col items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800 p-2.5 min-w-[90px] border border-black/5 dark:border-white/5">
                                                        <Clock className="h-4 w-4 text-purple-600 mb-1" />
                                                        <span className="font-mono text-xs font-bold text-foreground">
                                                            {formatTime12h(apt.start_time)}
                                                        </span>
                                                        <span className="font-mono text-[10px] text-foreground/50">
                                                            {formatTime12h(apt.end_time)}
                                                        </span>
                                                    </div>

                                                    {/* Patient Info */}
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-sm font-bold text-foreground">
                                                                {apt.patient?.name}
                                                            </h3>
                                                            <span className="rounded bg-slate-100 dark:bg-white/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                                                                {apt.reference}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/60 mt-1">
                                                            <span>File: <strong className="font-mono text-purple-600">{apt.patient?.file_number || "—"}</strong></span>
                                                            <span>•</span>
                                                            <span>Phone: {apt.patient?.mobile_number}</span>
                                                            <span>•</span>
                                                            <span className="capitalize">{apt.appointment_type.replace(/_/g, " ")}</span>
                                                        </div>

                                                        {/* Arrival Status / Booking Notes */}
                                                        {isCheckedIn && (
                                                            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-0.5 text-[11px] font-medium">
                                                                <UserCheck className="h-3 w-3 text-amber-600" />
                                                                Arrived & Checked In at {formatTime12h(apt.checked_in_at)}
                                                            </div>
                                                        )}

                                                        {isInConsultation && (
                                                            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200 px-2 py-0.5 text-[11px] font-medium">
                                                                <Activity className="h-3 w-3 text-indigo-600 animate-pulse" />
                                                                In consultation since {formatTime12h(apt.consultation_started_at)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: Status Pill & Contextual Action Button */}
                                                <div className="flex flex-wrap items-center gap-2.5 sm:self-center ml-auto">
                                                    {/* Status Badge */}
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                                                        isConfirmed
                                                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                                            : isCheckedIn
                                                            ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                                                            : isInConsultation
                                                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                                                            : isCompleted
                                                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                                                    }`}>
                                                        {apt.status.replace(/_/g, " ")}
                                                    </span>

                                                    {/* Contextual Action Button according to specification */}
                                                    {isCheckedIn && (
                                                        <Button
                                                            variant="filled"
                                                            size="sm"
                                                            onClick={() => handleOpenConsultation(apt, true)}
                                                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1.5"
                                                        >
                                                            <Stethoscope className="h-3.5 w-3.5" />
                                                            Start Consultation
                                                        </Button>
                                                    )}

                                                    {isInConsultation && (
                                                        <Button
                                                            variant="filled"
                                                            size="sm"
                                                            onClick={() => handleOpenConsultation(apt, false)}
                                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
                                                        >
                                                            <FileText className="h-3.5 w-3.5" />
                                                            Continue Consultation
                                                        </Button>
                                                    )}

                                                    {isCompleted && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleViewCompleted(apt)}
                                                            className="flex items-center gap-1.5 text-xs"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                            View Consultation
                                                        </Button>
                                                    )}

                                                    {(isConfirmed || isCancelled) && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setDetailsAppointment(apt);
                                                                setIsDetailsOpen(true);
                                                            }}
                                                            className="flex items-center gap-1.5 text-xs"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                            View Details
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW 2: WEEK VIEW (Modern 7-Day Calendar Grid) */}
                    {viewMode === "week" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-start">
                            {weekDays.map((wDate) => {
                                const wDateStr = formatDateYMD(wDate);
                                const isToday = wDateStr === formatDateYMD(new Date());
                                const dayAppointments = appointments.filter(
                                    (a) => a.appointment_date?.slice(0, 10) === wDateStr
                                );

                                return (
                                    <div
                                        key={wDateStr}
                                        className={`flex flex-col rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden min-h-[350px] ${
                                            isToday
                                                ? "border-purple-600 ring-1 ring-purple-600"
                                                : "border-black/10 dark:border-white/10"
                                        }`}
                                    >
                                        {/* Column Header */}
                                        <div
                                            onClick={() => {
                                                setCurrentDate(wDate);
                                                setViewMode("day");
                                            }}
                                            className={`p-3 border-b border-black/5 dark:border-white/5 cursor-pointer text-center transition-colors ${
                                                isToday
                                                    ? "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300"
                                                    : "bg-slate-50/60 dark:bg-zinc-800/40 hover:bg-slate-100"
                                            }`}
                                        >
                                            <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                                                {wDate.toLocaleDateString("en-US", { weekday: "short" })}
                                            </div>
                                            <div className="text-base font-bold font-mono">
                                                {wDate.getDate()}
                                            </div>
                                            <span className="text-[10px] text-foreground/60">
                                                {dayAppointments.length} apts
                                            </span>
                                        </div>

                                        {/* Day Appointments List */}
                                        <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[500px]">
                                            {dayAppointments.length === 0 ? (
                                                <div className="text-center py-8 text-[11px] text-foreground/40">
                                                    No appointments
                                                </div>
                                            ) : (
                                                dayAppointments.map((apt) => (
                                                    <div
                                                        key={apt.id}
                                                        onClick={() => {
                                                            setDetailsAppointment(apt);
                                                            setIsDetailsOpen(true);
                                                        }}
                                                        className={`rounded-lg border p-2 text-xs cursor-pointer transition-all hover:scale-[1.02] ${
                                                            apt.status === "in_consultation"
                                                                ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30"
                                                                : apt.status === "checked_in"
                                                                ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
                                                                : apt.status === "completed"
                                                                ? "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20"
                                                                : "border-black/10 bg-slate-50/50 dark:border-white/10 dark:bg-zinc-800/50"
                                                        }`}
                                                    >
                                                        <div className="font-mono text-[10px] font-bold text-purple-700 dark:text-purple-400">
                                                            {formatTime12h(apt.start_time)}
                                                        </div>
                                                        <div className="font-bold text-foreground truncate mt-0.5">
                                                            {apt.patient?.name}
                                                        </div>
                                                        <div className="text-[10px] text-foreground/60 truncate">
                                                            {apt.appointment_type.replace(/_/g, " ")}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* VIEW 3: MONTH VIEW (Monthly Calendar Matrix) */}
                    {viewMode === "month" && (
                        <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 overflow-hidden">
                            {/* Day Header */}
                            <div className="grid grid-cols-7 border-b border-black/10 dark:border-white/10 text-center text-xs font-semibold py-2 bg-slate-50/60 dark:bg-zinc-800/40 text-foreground/60 uppercase tracking-wider text-[11px]">
                                {DAY_NAMES.map((d) => (
                                    <div key={d}>{d}</div>
                                ))}
                            </div>

                            {/* Calendar Days Grid */}
                            <div className="grid grid-cols-7 divide-x divide-y divide-black/5 dark:divide-white/5">
                                {monthCalendarData.map(({ date, dateStr, isCurrentMonth }) => {
                                    const isToday = dateStr === formatDateYMD(new Date());
                                    const cellAppointments = appointments.filter(
                                        (a) => a.appointment_date?.slice(0, 10) === dateStr
                                    );

                                    return (
                                        <div
                                            key={dateStr}
                                            onClick={() => {
                                                setCurrentDate(date);
                                                setViewMode("day");
                                            }}
                                            className={`min-h-[100px] p-2 flex flex-col justify-between cursor-pointer transition-colors hover:bg-purple-50/30 dark:hover:bg-purple-950/10 ${
                                                !isCurrentMonth ? "bg-slate-50/40 dark:bg-zinc-950/40 text-foreground/30" : "text-foreground"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                                                        isToday
                                                            ? "bg-purple-600 text-white"
                                                            : isCurrentMonth
                                                            ? "text-foreground"
                                                            : "text-foreground/30"
                                                    }`}
                                                >
                                                    {date.getDate()}
                                                </span>
                                                {cellAppointments.length > 0 && (
                                                    <span className="rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.2 text-[10px] font-bold">
                                                        {cellAppointments.length}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Micro-cards for top 2 appointments */}
                                            <div className="space-y-1 mt-1">
                                                {cellAppointments.slice(0, 2).map((apt) => (
                                                    <div
                                                        key={apt.id}
                                                        className="truncate text-[10px] px-1 rounded bg-slate-100 dark:bg-zinc-800 text-foreground/80 font-medium"
                                                    >
                                                        {formatTime12h(apt.start_time)} {apt.patient?.name}
                                                    </div>
                                                ))}
                                                {cellAppointments.length > 2 && (
                                                    <div className="text-[9px] text-foreground/50 text-right">
                                                        +{cellAppointments.length - 2} more
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* APPOINTMENT DETAILS DRAWER / MODAL */}
            {isDetailsOpen && detailsAppointment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="flex flex-col w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4 bg-slate-50/50 dark:bg-zinc-800/50">
                            <div>
                                <h3 className="text-base font-bold text-foreground">
                                    Appointment Details
                                </h3>
                                <span className="font-mono text-xs text-purple-600 font-bold">
                                    {detailsAppointment.reference}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDetailsOpen(false)}
                                className="rounded-lg p-1.5 text-foreground/60 hover:bg-black/5 dark:hover:bg-white/5"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs">
                            {/* Patient Info */}
                            <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/50 p-4 border border-black/5 dark:border-white/5 space-y-2">
                                <div className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider">Patient Information</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-foreground/50">Name:</span>
                                        <div className="font-bold text-foreground">{detailsAppointment.patient?.name}</div>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50">File Number:</span>
                                        <div className="font-mono text-purple-600 font-semibold">{detailsAppointment.patient?.file_number || "—"}</div>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50">Mobile:</span>
                                        <div className="text-foreground">{detailsAppointment.patient?.mobile_number}</div>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50">Age / Gender:</span>
                                        <div className="text-foreground">{formatAgeGender(detailsAppointment.patient)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Schedule Info */}
                            <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/50 p-4 border border-black/5 dark:border-white/5 space-y-2">
                                <div className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider">Schedule Information</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-foreground/50">Scheduled Date:</span>
                                        <div className="font-bold text-foreground">{formatDateTable(detailsAppointment.appointment_date)}</div>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50">Time Slot:</span>
                                        <div className="font-mono font-bold text-foreground">
                                            {formatTime12h(detailsAppointment.start_time)} – {formatTime12h(detailsAppointment.end_time)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50">Type:</span>
                                        <div className="capitalize text-foreground">{detailsAppointment.appointment_type.replace(/_/g, " ")}</div>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50">Current Status:</span>
                                        <div className="font-bold uppercase text-purple-600">{detailsAppointment.status.replace(/_/g, " ")}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Check-In Information */}
                            {detailsAppointment.checked_in_at && (
                                <div className="rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 p-3 text-sky-800 dark:text-sky-300">
                                    Patient arrived and checked in at {formatTime12h(detailsAppointment.checked_in_at)}.
                                </div>
                            )}

                            {/* Internal Booking Notes */}
                            {detailsAppointment.internal_notes && (
                                <div>
                                    <span className="font-bold text-foreground">Booking Notes / Symptoms:</span>
                                    <p className="mt-1 rounded-lg border border-black/10 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-800/50 p-2.5 text-foreground/80">
                                        {detailsAppointment.internal_notes}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Drawer Actions */}
                        <div className="flex items-center justify-end gap-2 border-t border-black/10 dark:border-white/10 px-6 py-3 bg-slate-50/80 dark:bg-zinc-800/80">
                            <Button variant="outline" size="sm" onClick={() => setIsDetailsOpen(false)}>
                                Close
                            </Button>

                            {detailsAppointment.status === "checked_in" && (
                                <Button
                                    variant="filled"
                                    size="sm"
                                    onClick={() => handleOpenConsultation(detailsAppointment, true)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1.5"
                                >
                                    <Stethoscope className="h-4 w-4" />
                                    Start Consultation
                                </Button>
                            )}

                            {detailsAppointment.status === "in_consultation" && (
                                <Button
                                    variant="filled"
                                    size="sm"
                                    onClick={() => handleOpenConsultation(detailsAppointment, false)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
                                >
                                    <FileText className="h-4 w-4" />
                                    Continue Consultation
                                </Button>
                            )}

                            {detailsAppointment.status === "completed" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewCompleted(detailsAppointment)}
                                    className="flex items-center gap-1.5"
                                >
                                    <Eye className="h-4 w-4" />
                                    View Consultation
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CONSULTATION SCREEN WORKSPACE MODAL */}
            {consultationModalOpen && activeAppointment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4 bg-slate-50/50 dark:bg-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-700 dark:text-purple-300">
                                    <Stethoscope className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-foreground">
                                        Clinical Consultation – {activeAppointment.patient?.name}
                                    </h2>
                                    <div className="text-xs text-foreground/50">
                                        Appointment Ref: <span className="font-mono text-purple-600">{activeAppointment.reference}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setConsultationModalOpen(false)}
                                className="rounded-lg p-1.5 text-foreground/60 hover:bg-black/5 dark:hover:bg-white/5"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Patient Info Banner */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 p-4 border border-black/5 dark:border-white/5 text-xs">
                                <div>
                                    <span className="text-foreground/50 text-[11px] block">Patient Name</span>
                                    <span className="font-bold text-foreground mt-0.5 block">{activeAppointment.patient?.name}</span>
                                </div>
                                <div>
                                    <span className="text-foreground/50 text-[11px] block">File Number</span>
                                    <span className="font-mono text-purple-600 font-semibold mt-0.5 block">
                                        {activeAppointment.patient?.file_number || "—"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-foreground/50 text-[11px] block">Mobile Number</span>
                                    <span className="text-foreground mt-0.5 block">{activeAppointment.patient?.mobile_number}</span>
                                </div>
                                <div>
                                    <span className="text-foreground/50 text-[11px] block">Age / Gender</span>
                                    <span className="text-foreground mt-0.5 block font-medium">{formatAgeGender(activeAppointment.patient)}</span>
                                </div>
                                <div>
                                    <span className="text-foreground/50 text-[11px] block">Scheduled Slot</span>
                                    <span className="font-mono text-foreground mt-0.5 block">
                                        {formatTime12h(activeAppointment.start_time)}
                                    </span>
                                </div>
                            </div>

                            {/* Previous Consultation History */}
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-foreground">
                                    <History className="h-4 w-4 text-purple-600" />
                                    Previous Consultation History ({pastHistory.length})
                                </div>

                                {pastHistory.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-4 text-center text-xs text-foreground/50">
                                        No previous consultation history on record for this patient.
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                                        {pastHistory.map((history) => (
                                            <div
                                                key={history.id}
                                                className="rounded-xl border border-black/5 dark:border-white/5 bg-slate-50/60 dark:bg-zinc-800/30 p-3 text-xs"
                                            >
                                                <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-1.5 mb-1.5">
                                                    <div className="font-semibold text-foreground">
                                                        {formatDateTable(history.consultation_date)} • Dr. {history.doctor_name}
                                                    </div>
                                                    {history.referred_to_physio ? (
                                                        <span className="rounded bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 px-2 py-0.5 text-[10px] font-bold">
                                                            Referred to Physio
                                                        </span>
                                                    ) : (
                                                        <span className="rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                                                            Completed
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-foreground/80 whitespace-pre-wrap">{history.remarks || "No remarks logged."}</p>
                                                {history.physiotherapy_instructions && (
                                                    <div className="mt-2 text-[11px] text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/20 p-2 rounded-lg border border-teal-200 dark:border-teal-900">
                                                        <span className="font-semibold">Physio Instructions:</span> {history.physiotherapy_instructions}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Remarks Text Area */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                                        <FileText className="h-4 w-4" /> Clinical Remarks <span className="text-red-500">*</span>
                                    </label>
                                    {/* Draft saving temporarily hidden */}
                                </div>
                                <textarea
                                    rows={4}
                                    value={consultationRemarks}
                                    onChange={(e) => setConsultationRemarks(e.target.value)}
                                    placeholder="Enter clinical examination notes, diagnosis, observations, prescription..."
                                    className="w-full rounded-xl border border-foreground/20 bg-slate-50/50 dark:bg-zinc-800/50 p-3 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                />
                            </div>

                            {/* Option 2: Physio Referral Section */}
                            {isReferralOpen && (
                                <div className="rounded-xl border border-teal-300 bg-teal-50/30 dark:border-teal-800 dark:bg-teal-950/20 p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs font-bold text-teal-800 dark:text-teal-300">
                                            <Activity className="h-4 w-4 text-teal-600" />
                                            Physiotherapy Referral Instructions <span className="text-red-500">*</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsReferralOpen(false)}
                                            className="text-teal-700 text-xs hover:underline"
                                        >
                                            Cancel Referral
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-teal-800 dark:text-teal-300 mb-1">
                                            Assign Physiotherapist <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={assignedPhysioId}
                                            onChange={(e) => setAssignedPhysioId(e.target.value ? Number(e.target.value) : "")}
                                            className="h-9 w-full rounded-lg border border-teal-300 dark:border-teal-800 bg-white dark:bg-zinc-900 px-3 text-xs text-foreground focus:border-teal-600 focus:outline-none"
                                        >
                                            <option value="">-- Select Physiotherapist --</option>
                                            {physiotherapists.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <textarea
                                        rows={3}
                                        value={referralInstructions}
                                        onChange={(e) => setReferralInstructions(e.target.value)}
                                        placeholder="Targeted spinal decompression, traction modalities, recommended sessions..."
                                        className="w-full rounded-lg border border-teal-300 dark:border-teal-800 bg-white dark:bg-zinc-900 p-2.5 text-xs text-foreground focus:border-teal-600 focus:outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-black/10 dark:border-white/10 px-6 py-4 bg-slate-50/80 dark:bg-zinc-800/80">
                            {/* Draft saving temporarily hidden */}
                            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                                {!isReferralOpen ? (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsReferralOpen(true)}
                                            disabled={isCompleting}
                                            className="border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 flex items-center gap-1.5"
                                        >
                                            <Activity className="h-4 w-4 text-teal-600" />
                                            Refer to Physiotherapy
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="filled"
                                            size="sm"
                                            onClick={() => setConfirmModal({ open: true, type: "complete" })}
                                            disabled={isCompleting || !consultationRemarks.trim()}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                            Complete Consultation
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="filled"
                                        size="sm"
                                        onClick={() => setConfirmModal({ open: true, type: "refer" })}
                                        disabled={isCompleting || !consultationRemarks.trim() || !referralInstructions.trim()}
                                        className="bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5"
                                    >
                                        <Send className="h-4 w-4" />
                                        Submit Physio Referral & Complete
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION DIALOG MODAL */}
            {confirmModal.open && activeAppointment && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-3 text-foreground">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                                confirmModal.type === "refer"
                                    ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            }`}>
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold">
                                    {confirmModal.type === "refer" ? "Confirm Physiotherapy Referral" : "Confirm Consultation Completion"}
                                </h3>
                                <p className="text-xs text-foreground/50">This action finalizes the consultation session.</p>
                            </div>
                        </div>

                        <p className="text-xs text-foreground/80 leading-relaxed mb-6">
                            {confirmModal.type === "refer"
                                ? `Are you sure you want to complete this consultation and refer ${activeAppointment.patient?.name} to Physiotherapy?`
                                : `Are you sure you want to mark the consultation for ${activeAppointment.patient?.name} as Completed?`}
                        </p>

                        <div className="flex justify-end gap-2.5">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmModal({ open: false, type: "complete" })}
                                disabled={isCompleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="filled"
                                size="sm"
                                onClick={handleExecuteCompletion}
                                disabled={isCompleting}
                                className={`text-white font-semibold flex items-center gap-1.5 ${
                                    confirmModal.type === "refer"
                                        ? "bg-teal-600 hover:bg-teal-700"
                                        : "bg-emerald-600 hover:bg-emerald-700"
                                }`}
                            >
                                {isCompleting && <Loader2 className="h-4 w-4 animate-spin" />}
                                {confirmModal.type === "refer" ? "Confirm & Refer" : "Confirm Completion"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW-ONLY CONSULTATION MODAL */}
            {viewModalOpen && viewAppointment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="flex flex-col w-full max-w-2xl rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4 bg-slate-50/50 dark:bg-zinc-800/50">
                            <div>
                                <h3 className="text-base font-bold text-foreground">
                                    Consultation Details – {viewAppointment.patient?.name}
                                </h3>
                                <div className="text-xs text-foreground/50">
                                    Ref: {viewAppointment.reference} • File: {viewAppointment.patient?.file_number || "—"}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewModalOpen(false)}
                                className="rounded-lg p-1.5 text-foreground/60 hover:bg-black/5 dark:hover:bg-white/5"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 p-4 border border-black/5 dark:border-white/5">
                                <div>
                                    <span className="text-foreground/50">Consultation Date:</span>
                                    <div className="font-bold text-foreground">{formatDateTable(viewAppointment.appointment_date)}</div>
                                </div>
                                <div>
                                    <span className="text-foreground/50">Completion Timestamp:</span>
                                    <div className="font-mono text-emerald-600 font-semibold">{formatTime12h(viewAppointment.consultation_completed_at)}</div>
                                </div>
                            </div>

                            <div>
                                <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 block mb-1">
                                    Clinical Remarks:
                                </span>
                                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-800/50 p-3 text-foreground/90 whitespace-pre-wrap">
                                    {viewAppointment.consultation?.remarks || "No clinical remarks recorded."}
                                </div>
                            </div>

                            {viewAppointment.physiotherapy_referrals && viewAppointment.physiotherapy_referrals.length > 0 && (
                                <div className="rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20 p-4">
                                    <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-bold mb-1">
                                        <Activity className="h-4 w-4 text-teal-600" />
                                        Physiotherapy Referral
                                        <span className="ml-auto rounded-full bg-teal-200 dark:bg-teal-900 px-2 py-0.5 text-[10px] font-bold uppercase">
                                            {viewAppointment.physiotherapy_referrals[0].status}
                                        </span>
                                    </div>
                                    <p className="text-foreground/80 whitespace-pre-wrap">
                                        {viewAppointment.physiotherapy_referrals[0].treatment_instructions}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end border-t border-black/10 dark:border-white/10 px-6 py-3 bg-slate-50/80 dark:bg-zinc-800/80">
                            <Button variant="outline" size="sm" onClick={() => setViewModalOpen(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
