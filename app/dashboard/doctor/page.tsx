"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import {
    Users,
    Clock,
    FileText,
    CheckCircle2,
    AlertCircle,
    Calendar,
    Stethoscope,
    Activity,
    Search,
    Loader2,
    RefreshCw,
    X,
    UserCheck,
    Phone,
    Eye,
    Save,
    Send,
    History,
    ChevronRight,
    AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { subscribeToQueueUpdates } from "@/lib/queue-sync";
import { formatAgeGender } from "@/lib/patient-utils";

const MONTH_NAMES_TITLE = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatDateTable(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.split(" ")[0];
    const parts = cleanDate.split("-");
    if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parts[2].padStart(2, "0");
        const monthName = MONTH_NAMES_TITLE[monthIndex] || parts[1];
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
    return `${hour12}:${m} ${period}`;
}

function formatDateTime12h(dateTimeStr: string | null | undefined): string {
    if (!dateTimeStr) return "—";
    const datePart = formatDateTable(dateTimeStr);
    const timePart = formatTime12h(dateTimeStr);
    return `${datePart} ${timePart}`;
}

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

export default function DoctorDashboard() {
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date();
        return today.toISOString().split("T")[0];
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const [summary, setSummary] = useState({
        today_total: 0,
        waiting: 0,
        in_consultation: 0,
        completed: 0,
    });
    const [waitingPatients, setWaitingPatients] = useState<AppointmentItem[]>([]);
    const [inConsultation, setInConsultation] = useState<AppointmentItem[]>([]);
    const [completedConsultations, setCompletedConsultations] = useState<AppointmentItem[]>([]);
    const [doctorInfo, setDoctorInfo] = useState<{ id: number; name: string; specialization: string } | null>(null);

    // Active Consultation Screen State
    const [consultationModalOpen, setConsultationModalOpen] = useState(false);
    const [activeAppointment, setActiveAppointment] = useState<AppointmentItem | null>(null);
    const [consultationRemarks, setConsultationRemarks] = useState("");
    const [pastHistory, setPastHistory] = useState<PastConsultation[]>([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);

    // Physiotherapy Referral Form in Consultation Screen
    const [isReferralOpen, setIsReferralOpen] = useState(false);
    const [physiotherapists, setPhysiotherapists] = useState<Array<{ id: number; name: string }>>([]);
    const [assignedPhysioId, setAssignedPhysioId] = useState<number | "">("");
    const [treatmentCost, setTreatmentCost] = useState("");
    const [referralInstructions, setReferralInstructions] = useState("");

    // View-Only Completed Consultation Modal
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewAppointment, setViewAppointment] = useState<AppointmentItem | null>(null);

    // Confirmation dialog before completing
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        type: "complete" | "refer";
    }>({ open: false, type: "complete" });

    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [newCheckInToast, setNewCheckInToast] = useState<{
        name: string;
        time: string;
        appointment: AppointmentItem;
    } | null>(null);

    const waitingPatientsRef = useRef<AppointmentItem[]>([]);

    const fetchQueue = async (silent: boolean = false) => {
        if (!silent) {
            setIsLoading(true);
        }
        setErrorMessage(null);
        try {
            const res = await api.getDoctorQueue({
                date: selectedDate,
                search: searchQuery.trim() || undefined,
            });

            setDoctorInfo(res.doctor || null);
            setSummary(res.summary || {
                today_total: 0,
                waiting: 0,
                in_consultation: 0,
                completed: 0,
            });

            const rawWaiting: AppointmentItem[] = res.waiting_patients || [];
            const rawInConsult: AppointmentItem[] = res.in_consultation || [];
            const existingIds = new Set(rawWaiting.map((p: AppointmentItem) => p.id));
            const incomingWaiting: AppointmentItem[] = [
                ...rawWaiting,
                ...rawInConsult.filter((p: AppointmentItem) => !existingIds.has(p.id)),
            ];

            // Order by appointment slot ascending (first appointment of the day on top)
            incomingWaiting.sort((a, b) => {
                const timeA = a.start_time || "";
                const timeB = b.start_time || "";
                return timeA.localeCompare(timeB) || a.id - b.id;
            });

            // Detect newly checked-in patients if this was a silent background sync
            if (silent && waitingPatientsRef.current.length > 0) {
                const prevIds = new Set(waitingPatientsRef.current.map((p) => p.id));
                const newlyCheckedIn = incomingWaiting.filter((p: AppointmentItem) => !prevIds.has(p.id));
                if (newlyCheckedIn.length > 0) {
                    const first = newlyCheckedIn[0];
                    setNewCheckInToast({
                        name: first.patient?.name || "A patient",
                        time: formatTime12h(first.start_time),
                        appointment: first,
                    });
                    setTimeout(() => setNewCheckInToast(null), 8000);
                }
            }

            waitingPatientsRef.current = incomingWaiting;
            setWaitingPatients(incomingWaiting);
            setInConsultation(res.in_consultation || []);
            setCompletedConsultations(res.completed_consultations || []);
        } catch (err: any) {
            if (!silent) {
                setErrorMessage(err.message || "Failed to load doctor consultation queue.");
            }
        } finally {
            if (!silent) {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        api.getDoctorPhysiotherapists()
            .then((res) => {
                const list = res.data || [];
                setPhysiotherapists(list);
                if (list.length > 0) {
                    setAssignedPhysioId(list[0].id);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        // Initial full fetch
        fetchQueue(false);

        // 1. Instant cross-tab sync when receptionist checks in
        const unsubscribe = subscribeToQueueUpdates(() => {
            fetchQueue(true);
        });

        // 2. Automated background live polling (every 5 seconds while browser tab is active)
        const intervalId = setInterval(() => {
            if (typeof document !== "undefined" && !document.hidden) {
                fetchQueue(true);
            }
        }, 5000);

        // 3. Immediate sync on window focus or tab visibility change
        const handleVisibilityChange = () => {
            if (typeof document !== "undefined" && !document.hidden) {
                fetchQueue(true);
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
    }, [selectedDate]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchQueue();
    };

    // Open consultation screen for starting or continuing
    const handleOpenConsultation = async (appointment: AppointmentItem, isStart: boolean = false) => {
        setErrorMessage(null);
        setIsLoadingDetails(true);
        try {
            if (isStart) {
                // Call start consultation endpoint
                const res = await api.startDoctorConsultation(appointment.id);
                appointment = res.appointment;
            }

            // Fetch details & past history
            const details = await api.getDoctorConsultationDetails(appointment.id);
            setActiveAppointment(details.appointment);
            setConsultationRemarks(details.consultation?.remarks || "");
            setPastHistory(details.patient_history || []);
            setIsReferralOpen(false);
            setReferralInstructions("");
            setConsultationModalOpen(true);
        } catch (err: any) {
            setErrorMessage(err.message || "Unable to start or resume consultation.");
        } finally {
            setIsLoadingDetails(false);
            fetchQueue();
        }
    };

    // Save draft remarks
    const handleSaveDraft = async () => {
        if (!activeAppointment) return;
        setIsSavingDraft(true);
        setErrorMessage(null);
        try {
            await api.saveDoctorConsultationDraft(activeAppointment.id, consultationRemarks);
            setAlertMessage("Draft remarks saved successfully.");
            setTimeout(() => setAlertMessage(null), 3000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to save draft remarks.");
        } finally {
            setIsSavingDraft(false);
        }
    };

    // Complete Consultation (Direct or Referral)
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

        if (confirmModal.type === "refer" && (treatmentCost === "" || isNaN(parseFloat(treatmentCost)) || parseFloat(treatmentCost) < 0)) {
            setErrorMessage("Please enter a valid agreed treatment cost.");
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
                treatment_cost: confirmModal.type === "refer" && treatmentCost !== "" ? parseFloat(treatmentCost) : undefined,
            });

            setAlertMessage(res.message);
            setConfirmModal({ open: false, type: "complete" });
            setConsultationModalOpen(false);
            setActiveAppointment(null);
            fetchQueue();
            setTimeout(() => setAlertMessage(null), 5000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to complete consultation.");
            setConfirmModal({ open: false, type: "complete" });
        } finally {
            setIsCompleting(false);
        }
    };

    // View-Only consultation details
    const handleViewCompleted = async (appointment: AppointmentItem) => {
        setViewAppointment(appointment);
        setIsLoadingDetails(true);
        try {
            const details = await api.getDoctorConsultationDetails(appointment.id);
            setViewAppointment(details.appointment);
            setPastHistory(details.patient_history || []);
            setViewModalOpen(true);
        } catch (err: any) {
            setErrorMessage(err.message || "Unable to view consultation.");
        } finally {
            setIsLoadingDetails(false);
        }
    };

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

            {newCheckInToast && (
                <div className="flex items-center justify-between rounded-xl border border-sky-300 bg-sky-50 p-4 text-sky-900 shadow-sm transition-all animate-in fade-in slide-in-from-top-2 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                        </div>
                        <span className="text-sm font-medium">
                            <strong>{newCheckInToast.name}</strong> just checked in at reception ({newCheckInToast.time}) and is waiting for consultation.
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            className="bg-sky-600 hover:bg-sky-700 text-white text-xs h-7 px-2.5"
                            onClick={() => {
                                handleOpenConsultation(newCheckInToast.appointment, true);
                                setNewCheckInToast(null);
                            }}
                        >
                            Start Consultation
                        </Button>
                        <button
                            onClick={() => setNewCheckInToast(null)}
                            className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-200 p-1"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Header with Title, Doctor Info & Controls */}
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center border-b border-black/10 dark:border-white/10 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Doctor Dashboard
                    </h1>
                    <div className="flex items-center gap-2 text-xs text-foreground/60 mt-1">
                        {doctorInfo ? (
                            <>
                                <span className="font-semibold text-foreground">{doctorInfo.name}</span>
                                <span>•</span>
                                <span>{doctorInfo.specialization}</span>
                            </>
                        ) : (
                            <span>Daily Clinical Appointments & Consultation Workflow</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    

                    {/* Quick navigation */}
                    <Link href="/dashboard/doctor/appointments">
                        <Button variant="outline" size="sm" icon={Calendar}>
                            My Appointments
                        </Button>
                    </Link>
                    <Link href="/dashboard/doctor/schedule">
                        <Button variant="outline" size="sm" icon={Clock}>
                            Clinic Schedule
                        </Button>
                    </Link>

                    {/* Date Filter */}
                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs">
                        <Calendar className="h-4 w-4 text-foreground/50" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-foreground outline-none font-medium cursor-pointer"
                        />
                    </div>

                    {/* Refresh */}
                    <Button
                        variant="outline"
                        size="sm"
                        icon={RefreshCw}
                        onClick={() => fetchQueue(false)}
                        disabled={isLoading}
                    >
                        {isLoading ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>
            </div>

            {/* Top Summary Cards (All counts based on logged-in doctor's appointments for selected date) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                    <div className="flex items-center justify-between text-foreground/60">
                        <span className="text-xs font-semibold uppercase tracking-wider">Today's Appointments</span>
                        <Calendar className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
                        {summary.today_total}
                    </div>
                    <div className="text-[11px] text-foreground/50 mt-1">Total scheduled for date</div>
                </div>

                <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                    <div className="flex items-center justify-between text-foreground/60">
                        <span className="text-xs font-semibold uppercase tracking-wider">Waiting Patients</span>
                        <UserCheck className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-2">
                        {waitingPatients.length}
                    </div>
                    <div className="text-[11px] text-foreground/50 mt-1">In clinical queue</div>
                </div>

                <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                    <div className="flex items-center justify-between text-foreground/60">
                        <span className="text-xs font-semibold uppercase tracking-wider">Completed Consultations</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2">
                        {summary.completed}
                    </div>
                    <div className="text-[11px] text-foreground/50 mt-1">Finished today</div>
                </div>
            </div>

            {/* Search Filter Bar */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search queue by patient name, mobile number, or file number..."
                        className="w-full rounded-xl border border-black/10 bg-white pl-9 pr-4 py-2.5 text-xs text-foreground placeholder:text-foreground/40 focus:border-purple-600 focus:outline-none dark:border-white/10 dark:bg-zinc-900"
                    />
                </div>
                <Button type="submit" variant="outline" size="sm">
                    Search
                </Button>
                {searchQuery && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSearchQuery("");
                            setTimeout(fetchQueue, 0);
                        }}
                    >
                        Clear
                    </Button>
                )}
            </form>

            {/* Three Primary Sections */}
            <div className="flex flex-col gap-6">

                {/* Section A: Waiting Patients (Prioritized Queue) */}
                <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                            <h2 className="text-base font-bold text-foreground">
                                Waiting Patients ({waitingPatients.length})
                            </h2>
                        </div>
                        <span className="text-xs text-foreground/50">
                            Patients checked in by reception and waiting for consultation
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="flex h-32 items-center justify-center text-xs text-foreground/50 gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                            Loading waiting queue...
                        </div>
                    ) : waitingPatients.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-black/10 dark:border-white/10 p-8 text-center text-xs text-foreground/50">
                            No patients currently waiting. Check-in arrives automatically when reception checks them in.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-black/10 dark:border-white/10 text-foreground/50 uppercase tracking-wider text-[10px]">
                                        <th className="py-2.5 px-3">Patient Name & File</th>
                                        <th className="py-2.5 px-3">Mobile</th>
                                        <th className="py-2.5 px-3">Appointment Slot</th>
                                        <th className="py-2.5 px-3">Status / Type</th>
                                        <th className="py-2.5 px-3">Check-in Time</th>
                                        <th className="py-2.5 px-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                    {waitingPatients.map((apt) => {
                                        const isInConsultation = apt.status === "in_consultation";
                                        return (
                                            <tr
                                                key={apt.id}
                                                className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.02] ${
                                                    isInConsultation ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""
                                                }`}
                                            >
                                                <td className="py-3 px-3">
                                                    <div className="flex items-center gap-2">
                                                        {isInConsultation && (
                                                            <span className="relative flex h-2 w-2" title="In Consultation">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                                            </span>
                                                        )}
                                                        <div className="font-bold text-foreground">{apt.patient?.name}</div>
                                                    </div>
                                                    <div className="font-mono text-[11px] text-purple-600">
                                                        File: {apt.patient?.file_number || "—"}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-foreground/70">
                                                    {apt.patient?.mobile_number}
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span className="font-mono font-bold text-foreground">
                                                        {formatTime12h(apt.start_time)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3">
                                                    <div className="flex flex-col items-start gap-1">
                                                        {isInConsultation ? (
                                                            <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-semibold dark:bg-indigo-900/40 dark:text-indigo-300">
                                                                In Consultation
                                                            </span>
                                                        ) : (
                                                            <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold dark:bg-amber-900/40 dark:text-amber-300">
                                                                Waiting
                                                            </span>
                                                        )}
                                                        <span className="capitalize text-foreground/60 text-[11px]">
                                                            {apt.appointment_type.replace(/_/g, " ")}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-foreground/70 font-mono text-[11px]">
                                                    {formatTime12h(apt.checked_in_at)}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    {isInConsultation ? (
                                                        <Button
                                                            variant="filled"
                                                            size="sm"
                                                            onClick={() => handleOpenConsultation(apt, false)}
                                                            disabled={isLoadingDetails}
                                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 ml-auto"
                                                        >
                                                            <FileText className="h-3.5 w-3.5" />
                                                            Continue Consultation
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="filled"
                                                            size="sm"
                                                            onClick={() => handleOpenConsultation(apt, true)}
                                                            disabled={isLoadingDetails}
                                                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1.5 ml-auto"
                                                        >
                                                            <Stethoscope className="h-3.5 w-3.5" />
                                                            Start Consultation
                                                        </Button>
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

                {/* Section C: Completed Consultations */}
                <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <h2 className="text-base font-bold text-foreground">
                                Completed Consultations ({completedConsultations.length})
                            </h2>
                        </div>
                        <span className="text-xs text-foreground/50">
                            Consultations completed for selected date
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="flex h-24 items-center justify-center text-xs text-foreground/50 gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                            Loading completed consultations...
                        </div>
                    ) : completedConsultations.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-black/10 dark:border-white/10 p-6 text-center text-xs text-foreground/50">
                            No completed consultations recorded for this date.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-black/10 dark:border-white/10 text-foreground/50 uppercase tracking-wider text-[10px]">
                                        <th className="py-2.5 px-3">Patient Name & File</th>
                                        <th className="py-2.5 px-3">Appointment Slot</th>
                                        <th className="py-2.5 px-3">Completed At</th>
                                        <th className="py-2.5 px-3">Outcome</th>
                                        <th className="py-2.5 px-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                    {completedConsultations.map((apt) => {
                                        const isReferred =
                                            apt.consultation?.outcome === "referred_to_physio" ||
                                            (apt.physiotherapy_referrals && apt.physiotherapy_referrals.length > 0);

                                        return (
                                            <tr key={apt.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
                                                <td className="py-3 px-3">
                                                    <div className="font-bold text-foreground">{apt.patient?.name}</div>
                                                    <div className="font-mono text-[11px] text-purple-600">
                                                        File: {apt.patient?.file_number || "—"}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 font-mono text-foreground">
                                                    {formatTime12h(apt.start_time)}
                                                </td>
                                                <td className="py-3 px-3 font-mono text-foreground/70">
                                                    {formatTime12h(apt.consultation_completed_at)}
                                                </td>
                                                <td className="py-3 px-3">
                                                    {isReferred ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 px-2.5 py-0.5 text-[10px] font-bold">
                                                            <Activity className="h-3 w-3" /> Referred to Physio
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-0.5 text-[10px] font-bold">
                                                            <CheckCircle2 className="h-3 w-3" /> Completed
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleViewCompleted(apt)}
                                                        className="flex items-center gap-1.5 ml-auto text-xs"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                        View Consultation
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* DEDICATED CONSULTATION WORKSPACE MODAL (Start / Continue) */}
            {consultationModalOpen && activeAppointment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 overflow-hidden shadow-2xl">
                        {/* Header */}
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

                        {/* Modal Body: Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* 1. Patient Information Banner */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 p-4 border border-black/5 dark:border-white/5 text-xs">
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
                                    <span className="text-foreground mt-0.5 block font-medium">
                                        {formatAgeGender(activeAppointment.patient)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-foreground/50 text-[11px] block">Appointment Type</span>
                                    <span className="capitalize text-foreground mt-0.5 block">
                                        {activeAppointment.appointment_type.replace(/_/g, " ")}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-foreground/50 text-[11px] block">Scheduled Slot</span>
                                    <span className="font-mono text-foreground mt-0.5 block">
                                        {formatTime12h(activeAppointment.start_time)}
                                    </span>
                                </div>
                            </div>

                            {/* Presenting Symptoms / Reception Internal Notes */}
                            {activeAppointment.internal_notes && (
                                <div className="rounded-xl bg-amber-50/50 dark:bg-amber-950/20 p-3.5 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                                    <span className="font-bold text-amber-800 dark:text-amber-300">Presenting Symptoms / Notes:</span>
                                    <p className="mt-1 text-foreground/80">{activeAppointment.internal_notes}</p>
                                </div>
                            )}

                            {/* 2. Previous Consultation History */}
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

                            {/* 3. Consultation Remarks (Text Area) */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                                        <FileText className="h-4 w-4" /> Clinical Consultation Remarks <span className="text-red-500">*</span>
                                    </label>
                                    {/* Draft saving temporarily hidden */}
                                </div>
                                <textarea
                                    rows={4}
                                    value={consultationRemarks}
                                    onChange={(e) => setConsultationRemarks(e.target.value)}
                                    placeholder="Enter clinical examination notes, diagnosis, objective observations, prescribed treatment..."
                                    className="w-full rounded-xl border border-foreground/20 bg-slate-50/50 dark:bg-zinc-800/50 p-3 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                />
                            </div>

                            {/* 4. Physiotherapy Referral Section (Option 2 disclosure) */}
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
                                    <p className="text-[11px] text-foreground/60">
                                        Select a physiotherapist and enter treatment instructions. The referral will be sent to Physiotherapy Admin for billing configuration.
                                    </p>
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
                                    <div>
                                        <label className="block text-[11px] font-bold text-teal-800 dark:text-teal-300 mb-1">
                                            Total Treatment Cost (₹) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={treatmentCost}
                                            onChange={(e) => setTreatmentCost(e.target.value)}
                                            placeholder="e.g. 5000"
                                            className="h-9 w-full rounded-lg border border-teal-300 dark:border-teal-800 bg-white dark:bg-zinc-900 px-3 text-xs text-foreground focus:border-teal-600 focus:outline-none"
                                        />
                                    </div>
                                    <textarea
                                        rows={3}
                                        value={referralInstructions}
                                        onChange={(e) => setReferralInstructions(e.target.value)}
                                        placeholder="Specific modalities, targeted spinal areas (e.g. IDD therapy L4-L5 decompression), recommended sessions..."
                                        className="w-full rounded-lg border border-teal-300 dark:border-teal-800 bg-white dark:bg-zinc-900 p-2.5 text-xs text-foreground focus:border-teal-600 focus:outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Modal Footer: Action Outcomes */}
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
                                    {confirmModal.type === "refer"
                                        ? "Confirm Physiotherapy Referral"
                                        : "Confirm Consultation Completion"}
                                </h3>
                                <p className="text-xs text-foreground/50">This action finalizes the consultation session.</p>
                            </div>
                        </div>

                        <p className="text-xs text-foreground/80 leading-relaxed mb-6">
                            {confirmModal.type === "refer"
                                ? `Are you sure you want to complete this consultation and refer ${activeAppointment.patient?.name} to Physiotherapy? The referral will be dispatched directly to the physiotherapist queue.`
                                : `Are you sure you want to mark the consultation for ${activeAppointment.patient?.name} as Completed? Completed consultations cannot be edited afterwards.`}
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

            {/* VIEW-ONLY COMPLETED CONSULTATION MODAL */}
            {viewModalOpen && viewAppointment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="flex flex-col w-full max-w-3xl max-h-[85vh] rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4 bg-slate-50/50 dark:bg-zinc-800/50">
                            <div>
                                <h2 className="text-base font-bold text-foreground">
                                    Completed Consultation Record – {viewAppointment.patient?.name}
                                </h2>
                                <div className="text-xs text-foreground/50">
                                    File: <span className="font-mono text-purple-600">{viewAppointment.patient?.file_number || "—"}</span> • Ref: {viewAppointment.reference} • Age / Gender: <span className="font-semibold text-foreground">{formatAgeGender(viewAppointment.patient)}</span>
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

                        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                            <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 p-4 border border-black/5 dark:border-white/5">
                                <div>
                                    <span className="text-foreground/50 text-[11px] block">Consultation Date</span>
                                    <span className="font-bold text-foreground mt-0.5 block">
                                        {formatDateTable(viewAppointment.appointment_date)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-foreground/50 text-[11px] block">Slot Time</span>
                                    <span className="font-mono text-foreground mt-0.5 block">
                                        {formatTime12h(viewAppointment.start_time)} – {formatTime12h(viewAppointment.end_time)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-foreground/50 text-[11px] block">Completion Timestamp</span>
                                    <span className="font-mono text-emerald-600 font-semibold mt-0.5 block">
                                        {formatTime12h(viewAppointment.consultation_completed_at)}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 block mb-1.5">
                                    Clinical Consultation Remarks
                                </span>
                                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-800/50 p-4 text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                    {viewAppointment.consultation?.remarks || "No clinical remarks recorded."}
                                </div>
                            </div>

                            {viewAppointment.physiotherapy_referrals && viewAppointment.physiotherapy_referrals.length > 0 && (
                                <div className="rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20 p-4">
                                    <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-bold mb-1.5">
                                        <Activity className="h-4 w-4 text-teal-600" />
                                        Physiotherapy Referral Details
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
