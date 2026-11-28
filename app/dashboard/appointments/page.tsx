"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertifyToast } from "@/components/ui/alertify-toast";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { NewAppointmentModal } from "@/components/appointments/NewAppointmentModal";
import { NewPhysioReferralModal } from "@/components/physio/NewPhysioReferralModal";
import {
    Search,
    Plus,
    Filter,
    Calendar as CalendarIcon,
    Clock,
    User,
    Stethoscope,
    FileText,
    AlertCircle,
    X,
    Check,
    Ban,
    UserCheck,
    XCircle,
    Loader2,
    RefreshCw,
    Activity,
    Phone
} from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { api, ApiError } from "@/lib/api";
import { notifyQueueUpdate } from "@/lib/queue-sync";

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

function formatDateIso(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    return dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.split(" ")[0];
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

    const parts = timeStr.slice(0, 5).split(":");
    if (parts.length !== 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${m} ${ampm}`;
}

interface PatientInfo {
    id: number;
    name: string;
    mobile_number: string;
    alternate_contact_number?: string | null;
    file_number?: string | null;
}

interface DoctorInfo {
    id: number;
    name: string;
}

interface PhysioInfo {
    id: number;
    name: string;
}

interface AppointmentRecord {
    id: number;
    reference: string;
    patient_id: number;
    doctor_id: number;
    assigned_physio_id: number | null;
    appointment_type: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: string;
    reminder_response: string | null;
    cancellation_reason: string | null;
    rejection_reason: string | null;
    internal_notes: string | null;
    physio_completion_notes: string | null;
    doctor_remarks?: string | null;
    is_referred_to_physio?: boolean;
    patient?: PatientInfo;
    doctor?: DoctorInfo;
    assigned_physiotherapist?: PhysioInfo | null;
}

interface PhysiotherapistUser {
    id: number;
    name: string;
    email: string;
}

export default function AppointmentsManager() {
    const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
    const [physiotherapists, setPhysiotherapists] = useState<PhysiotherapistUser[]>([]);
    const [counts, setCounts] = useState({
        pending: 0,
        confirmed: 0,
        today: 0,
        upcoming: 0,
        cancelled: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"today" | "pending" | "confirmed" | "upcoming" | "no_show" | "cancelled" | "all">("today");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterDate, setFilterDate] = useState("");

    // Detail Drawer & Modals
    const [selectedApt, setSelectedApt] = useState<AppointmentRecord | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Modal action state
    const [actionType, setActionType] = useState<"reject" | "cancel" | "assign_physio" | null>(null);
    const [reasonText, setReasonText] = useState("");
    const [selectedPhysioId, setSelectedPhysioId] = useState<number | "">("");
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    // New Appointment Modal
    const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false);

    // Physio Referral Modal
    const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fetchAppointments = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const params: Record<string, string> = {
                tab: activeTab,
            };
            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }
            if (filterDate) {
                params.date = filterDate;
            }

            const res = await api.getAppointments(params);
            setAppointments(res.data || []);
            if (res.physiotherapists) {
                setPhysiotherapists(res.physiotherapists);
            }
            if (res.counts) {
                setCounts(res.counts);
            }
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load appointments from server.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, [activeTab, filterDate]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchAppointments();
    };

    // Confirm Appointment
    const handleConfirm = async (id: number) => {
        setIsSubmittingAction(true);
        try {
            await api.confirmAppointment(id);
            setAlertMessage("Appointment confirmed successfully.");
            notifyQueueUpdate("STATUS_CHANGE", { appointmentId: id });
            fetchAppointments();
            if (selectedApt && selectedApt.id === id) {
                setSelectedApt((prev) => (prev ? { ...prev, status: "confirmed" } : null));
            }
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to confirm appointment.");
        } finally {
            setIsSubmittingAction(false);
        }
    };

    // Receptionist Check-In
    const handleCheckIn = async (id: number, confirmLate = false) => {
        setIsSubmittingAction(true);
        try {
            const res = await api.checkInAppointment(id, confirmLate ? { confirm_late: true } : undefined);
            if (res.requires_confirmation) {
                setIsSubmittingAction(false);
                if (window.confirm(res.warning_message || "The scheduled appointment time has passed. Are you sure you want to check in this patient?")) {
                    await handleCheckIn(id, true);
                }
                return;
            }
            setAlertMessage("Patient successfully checked in and moved to doctor queue.");
            notifyQueueUpdate("CHECK_IN", { appointmentId: id });
            fetchAppointments();
            if (selectedApt && selectedApt.id === id) {
                setSelectedApt((prev) => (prev ? { ...prev, status: "checked_in" } : null));
            }
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to check in patient.");
        } finally {
            setIsSubmittingAction(false);
        }
    };

    // Submit Action Modal (Reject, Cancel, Reschedule, Assign Physio)
    const handleSubmitAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedApt) return;

        setIsSubmittingAction(true);
        setErrorMessage(null);
        try {
            if (actionType === "reject") {
                if (!reasonText.trim()) throw new Error("A rejection reason is mandatory.");
                await api.rejectAppointment(selectedApt.id, reasonText.trim());
                setAlertMessage("Appointment rejected.");
            } else if (actionType === "cancel") {
                if (!reasonText.trim()) throw new Error("A cancellation reason is mandatory.");
                await api.cancelAppointment(selectedApt.id, reasonText.trim());
                setAlertMessage("Appointment cancelled.");
            } else if (actionType === "assign_physio") {
                if (!selectedPhysioId) throw new Error("Please select a physiotherapist.");
                await api.assignPhysiotherapist(selectedApt.id, Number(selectedPhysioId));
                setAlertMessage("Physiotherapist assigned successfully.");
            }

            setActionType(null);
            setReasonText("");
            setIsDrawerOpen(false);
            notifyQueueUpdate("STATUS_CHANGE", { appointmentId: selectedApt.id });
            fetchAppointments();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Action failed.");
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleSendWhatsApp = (apt: AppointmentRecord) => {
        const cleanPhone = String(apt.patient?.mobile_number || "").replace(/[^0-9]/g, "");
        const formattedPhone = cleanPhone.startsWith("91") && cleanPhone.length > 10 ? cleanPhone : `91${cleanPhone}`;
        const msg = encodeURIComponent(
            `Hello ${apt.patient?.name}, this is a message from Kumar Centres regarding your appointment with ${apt.doctor?.name} scheduled on ${apt.appointment_date?.slice(0, 10)} at ${apt.start_time?.slice(0, 5)}. Booking Ref: ${apt.reference}. Please let us know if you have any questions!`
        );
        window.open(`https://wa.me/${formattedPhone}?text=${msg}`, "_blank");
    };

    return (
        <div className="flex w-full flex-col gap-6 p-8">
            <AlertifyToast type="success" message={alertMessage} onClose={() => setAlertMessage(null)} />
            <AlertifyToast type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />

            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        All Appointments
                    </h1>
                </div>

                <div className="flex flex-wrap gap-2.5">
                    <Link href="/dashboard/appointments/new">
                        <Button
                            variant="filled"
                            icon={Plus}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            New Appointment
                        </Button>
                    </Link>
                    <Button
                        variant="outline"
                        icon={RefreshCw}
                        onClick={fetchAppointments}
                        disabled={isLoading}
                    >
                        {isLoading ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>
            </div>

            {/* Tabs & Filters */}
            <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-4">
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: "today", label: "Today", count: counts.today },
                            { id: "pending", label: "Pending", count: counts.pending },
                            { id: "confirmed", label: "Confirmed", count: counts.confirmed },
                            { id: "upcoming", label: "Upcoming", count: counts.upcoming },
                            { id: "no_show", label: "No Show", count: (counts as any).no_show ?? 0 },
                            { id: "cancelled", label: "Cancelled", count: counts.cancelled },
                            { id: "all", label: "All Bookings", count: appointments.length },
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all cursor-pointer ${
                                    activeTab === t.id
                                        ? "bg-purple-600 text-white"
                                        : "bg-slate-100 text-foreground/70 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300"
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-foreground/60">Date:</span>
                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className="rounded-md border border-foreground/20 bg-slate-50 dark:bg-zinc-800 px-2 py-1 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                            />
                            {filterDate && (
                                <button
                                    onClick={() => setFilterDate("")}
                                    className="text-xs text-foreground/50 hover:text-foreground"
                                    title="Clear date filter"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSearch} className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                            <input
                                type="text"
                                placeholder="Search ref, patient, doctor..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-md border border-foreground/20 bg-slate-50 dark:bg-zinc-800 pl-9 pr-3 py-1.5 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                            />
                        </form>
                    </div>
                </div>

                {/* Table */}
                {isLoading ? (
                    <div className="flex h-48 flex-col items-center justify-center gap-2 text-foreground/50">
                        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                        <span className="text-xs">Loading appointments from database...</span>
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="flex h-36 flex-col items-center justify-center text-foreground/50 text-xs">
                        No appointments found matching current criteria.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-black/10 bg-slate-50/50 dark:border-white/10 dark:bg-white/5 uppercase tracking-wider text-foreground/60">
                                <tr>
                                    <th className="px-4 py-3">Reference</th>
                                    <th className="px-4 py-3">Patient</th>
                                    <th className="px-4 py-3">Clinician / Doctor</th>
                                    <th className="px-4 py-3">Date & Time</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {appointments.map((apt) => (
                                    <tr
                                        key={apt.id}
                                        onClick={() => {
                                            setSelectedApt(apt);
                                            setIsDrawerOpen(true);
                                        }}
                                        className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3 font-bold">
                                            <span className="rounded bg-slate-100 dark:bg-white/10 px-2 py-1 font-mono text-purple-700 dark:text-purple-300">
                                                {apt.reference}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-foreground">{apt.patient?.name}</div>
                                            <div className="text-[11px] text-foreground/50">{apt.patient?.mobile_number}</div>
                                            {apt.patient?.file_number && (
                                                <div className="text-[10px] font-mono text-purple-600">File: {apt.patient.file_number}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-foreground">{apt.doctor?.name}</div>
                                            {apt.assigned_physiotherapist && (
                                                <div className="text-[11px] text-teal-600 dark:text-teal-400">
                                                    Physio: {apt.assigned_physiotherapist.name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-foreground">{formatDateTable(apt.appointment_date)}</div>
                                            <div className="text-[11px] text-foreground/60 font-mono mt-0.5">{formatTime12h(apt.start_time)} – {formatTime12h(apt.end_time)}</div>
                                        </td>
                                        <td className="px-4 py-3 capitalize">
                                            {apt.appointment_type.replace('_', ' ')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                                ((apt as any).display_status ?? apt.status) === "confirmed"
                                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                                    : ((apt as any).display_status ?? apt.status) === "checked_in"
                                                    ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                                                    : ((apt as any).display_status ?? apt.status) === "in_consultation"
                                                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                                                    : ((apt as any).display_status ?? apt.status) === "pending_confirmation"
                                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                                    : ((apt as any).display_status ?? apt.status) === "completed"
                                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                            }`}>
                                                {(apt as any).status_label || (((apt as any).display_status ?? apt.status) === "no_show" ? "No Show" : apt.status.replace(/_/g, ' '))}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1.5">
                                                {apt.status === "confirmed" && (apt as any).check_in_eligibility?.eligible && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCheckIn(apt.id)}
                                                        disabled={isSubmittingAction}
                                                        className="inline-flex items-center gap-1 rounded bg-sky-600 hover:bg-sky-700 text-white px-2 py-1 text-xs font-semibold transition-colors cursor-pointer"
                                                        title="Check-in arriving patient"
                                                    >
                                                        <UserCheck className="h-3.5 w-3.5 shrink-0" />
                                                        Check In
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleSendWhatsApp(apt)}
                                                    className="inline-flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-xs font-semibold transition-colors cursor-pointer"
                                                    title={`Send WhatsApp message`}
                                                >
                                                    <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
                                                    WA
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Appointment Detail Drawer */}
            {isDrawerOpen && selectedApt && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
                    <DetailDrawer
                        onClose={() => setIsDrawerOpen(false)}
                        title={`Appointment ${selectedApt.reference}`}
                    >
                        <div className="flex flex-col gap-6 text-xs text-foreground p-1">
                        {/* Status Banner */}
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
                            <div>
                                <span className="text-foreground/50 uppercase tracking-wider text-[10px]">Current Status</span>
                                <div className="mt-1">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                                        ((selectedApt as any).display_status ?? selectedApt.status) === "confirmed"
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                            : ((selectedApt as any).display_status ?? selectedApt.status) === "checked_in"
                                            ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                                            : ((selectedApt as any).display_status ?? selectedApt.status) === "in_consultation"
                                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                                            : ((selectedApt as any).display_status ?? selectedApt.status) === "pending_confirmation"
                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                            : ((selectedApt as any).display_status ?? selectedApt.status) === "completed"
                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                    }`}>
                                        {(selectedApt as any).status_label || (((selectedApt as any).display_status ?? selectedApt.status) === "no_show" ? "No Show" : selectedApt.status.replace(/_/g, ' '))}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleSendWhatsApp(selectedApt)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
                            >
                                <WhatsAppIcon className="h-4 w-4" /> Message Patient
                            </button>
                        </div>

                        {/* Patient & Doctor details */}
                        <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 p-4 border border-black/5 dark:border-white/5">
                            <div>
                                <span className="text-foreground/50">Patient Name:</span>
                                <div className="font-bold text-sm text-foreground mt-0.5">{selectedApt.patient?.name}</div>
                                <div className="text-foreground/70">{selectedApt.patient?.mobile_number}</div>
                                {selectedApt.patient?.file_number && (
                                    <div className="text-purple-600 font-mono mt-1">File: {selectedApt.patient.file_number}</div>
                                )}
                            </div>
                            <div>
                                <span className="text-foreground/50">Doctor / Clinician:</span>
                                <div className="font-bold text-sm text-foreground mt-0.5">{selectedApt.doctor?.name}</div>
                                <div className="text-foreground/70 capitalize mt-1">Type: {selectedApt.appointment_type.replace('_', ' ')}</div>
                                {selectedApt.assigned_physiotherapist && (
                                    <div className="text-teal-600 font-medium mt-1">
                                        Assigned Physio: {selectedApt.assigned_physiotherapist.name}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Schedule timing */}
                        <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/50 p-4 border border-black/5 dark:border-white/5 flex justify-between items-center">
                            <div>
                                <span className="text-foreground/50">Scheduled Date:</span>
                                <div className="font-bold text-sm text-foreground font-mono">{formatDateTable(selectedApt.appointment_date)}</div>
                            </div>
                            <div>
                                <span className="text-foreground/50">Consultation Slot:</span>
                                <div className="font-bold text-sm text-foreground font-mono">
                                    {formatTime12h(selectedApt.start_time)} – {formatTime12h(selectedApt.end_time)}
                                </div>
                            </div>
                        </div>

                        {/* Clinical / Internal notes */}
                        {selectedApt.internal_notes && (
                            <div>
                                <span className="font-semibold text-foreground">Internal Notes / Symptoms:</span>
                                <div className="mt-1 rounded-lg border border-foreground/10 bg-white dark:bg-zinc-800 p-3 text-foreground/80">
                                    {selectedApt.internal_notes}
                                </div>
                            </div>
                        )}

                        {selectedApt.physio_completion_notes && (
                            <div>
                                <span className="font-semibold text-teal-600">Physiotherapy Procedure Notes:</span>
                                <div className="mt-1 rounded-lg border border-teal-200 bg-teal-50/30 dark:bg-teal-950/20 p-3 text-foreground/80">
                                    {selectedApt.physio_completion_notes}
                                </div>
                            </div>
                        )}

                        {selectedApt.status === "completed" && selectedApt.doctor_remarks && (
                            <div>
                                <span className="font-semibold text-purple-700 dark:text-purple-400">Doctor&apos;s Clinical Remarks:</span>
                                <div className="mt-1 rounded-lg border border-purple-200 bg-purple-50/40 dark:border-purple-900/40 dark:bg-purple-950/20 p-3 text-foreground/80 whitespace-pre-wrap">
                                    {selectedApt.doctor_remarks}
                                </div>
                            </div>
                        )}

                        {selectedApt.cancellation_reason && (
                            <div>
                                <span className="font-semibold text-red-600">Cancellation Reason:</span>
                                <div className="mt-1 rounded-lg border border-red-200 bg-red-50/40 dark:bg-red-950/20 p-3 text-red-800 dark:text-red-300">
                                    {selectedApt.cancellation_reason}
                                </div>
                            </div>
                        )}

                        {selectedApt.rejection_reason && (
                            <div>
                                <span className="font-semibold text-red-600">Rejection Reason:</span>
                                <div className="mt-1 rounded-lg border border-red-200 bg-red-50/40 dark:bg-red-950/20 p-3 text-red-800 dark:text-red-300">
                                    {selectedApt.rejection_reason}
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2.5 pt-4 border-t border-black/10 dark:border-white/10">
                            {selectedApt.status === "pending_confirmation" && (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="filled"
                                        size="sm"
                                        onClick={() => handleConfirm(selectedApt.id)}
                                        disabled={isSubmittingAction}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        Confirm Booking
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setActionType("reject")}
                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                    >
                                        Reject Request
                                    </Button>
                                </div>
                            )}

                            {selectedApt.status === "confirmed" && !(selectedApt as any).is_no_show && (
                                <div className="flex flex-col gap-2">
                                    {(selectedApt as any).check_in_eligibility?.eligible && (
                                        <Button
                                            variant="filled"
                                            size="sm"
                                            onClick={() => handleCheckIn(selectedApt.id)}
                                            disabled={isSubmittingAction}
                                            className="bg-sky-600 hover:bg-sky-700 text-white w-full flex items-center justify-center gap-1.5"
                                        >
                                            <UserCheck className="h-4 w-4" />
                                            Check In Patient (Send to Doctor Queue)
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setActionType("cancel")}
                                        className="w-full text-red-600 border-red-200 hover:bg-red-50"
                                    >
                                        Cancel Booking
                                    </Button>
                                </div>
                            )}

                            {selectedApt.status === "checked_in" && (
                                <div className="rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 p-3 text-sky-800 dark:text-sky-300 text-xs">
                                    Patient has been checked in and is currently waiting in the doctor queue.
                                </div>
                            )}

                            {selectedApt.status === "in_consultation" && (
                                <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-3 text-indigo-800 dark:text-indigo-300 text-xs">
                                    Patient is currently in consultation with {selectedApt.doctor?.name}.
                                </div>
                            )}

                            {selectedApt.appointment_type === "procedure" && selectedApt.status !== "cancelled" && selectedApt.status !== "rejected" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedPhysioId(selectedApt.assigned_physio_id || (physiotherapists[0]?.id ?? ""));
                                        setActionType("assign_physio");
                                    }}
                                    className="border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300"
                                >
                                    Assign / Change Physiotherapist
                                </Button>
                            )}

                            {selectedApt.status === "completed" && !selectedApt.is_referred_to_physio && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsReferralModalOpen(true)}
                                    className="border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 w-full flex items-center justify-center gap-1.5"
                                >
                                    <Activity className="h-4 w-4" />
                                    Refer to Physiotherapy
                                </Button>
                            )}

                            {selectedApt.status === "completed" && selectedApt.is_referred_to_physio && (
                                <div className="rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 p-3 text-teal-800 dark:text-teal-300 text-xs font-medium flex items-center gap-2">
                                    <Activity className="h-4 w-4 shrink-0" />
                                    Patient has been referred to physiotherapy.
                                </div>
                            )}
                        </div>
                        </div>
                    </DetailDrawer>
                </div>
            )}

            {/* Modal: Action Handler (Reject / Cancel / Reschedule / Assign Physio) */}
            {actionType && selectedApt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-zinc-900 border border-black/10 dark:border-white/10">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="text-base font-bold text-foreground">
                                {actionType === "reject" && "Reject Appointment Request"}
                                {actionType === "cancel" && "Cancel Confirmed Appointment"}
                                {actionType === "assign_physio" && "Assign Procedure to Physiotherapist"}
                            </h3>
                            <button onClick={() => setActionType(null)} className="text-foreground/50 hover:text-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitAction} className="mt-4 flex flex-col gap-4">
                            {(actionType === "reject" || actionType === "cancel") && (
                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1">
                                        Mandatory Reason <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        required
                                        rows={3}
                                        value={reasonText}
                                        onChange={(e) => setReasonText(e.target.value)}
                                        placeholder="Enter specific clinical or operational reason..."
                                        className="w-full rounded-md border border-foreground/20 bg-white dark:bg-zinc-800 p-2.5 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                    />
                                </div>
                            )}

                            {actionType === "assign_physio" && (
                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1">
                                        Select Physiotherapist <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedPhysioId}
                                        onChange={(e) => setSelectedPhysioId(Number(e.target.value))}
                                        className="w-full rounded-md border border-foreground/20 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-foreground focus:border-purple-600 focus:outline-none cursor-pointer"
                                    >
                                        {physiotherapists.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="mt-4 flex justify-end gap-2.5">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setActionType(null)}
                                    disabled={isSubmittingAction}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isSubmittingAction}
                                    className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5"
                                >
                                    {isSubmittingAction && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    {isSubmittingAction ? "Saving..." : "Confirm Action"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Receptionist New Appointment Modal */}
            <NewAppointmentModal
                isOpen={isNewAppointmentModalOpen}
                onClose={() => setIsNewAppointmentModalOpen(false)}
                onSuccess={() => {
                    fetchAppointments();
                    setAlertMessage("Appointment successfully created and confirmed.");
                    setTimeout(() => setAlertMessage(null), 5000);
                }}
            />

            {/* Physio Referral Modal */}
            {isReferralModalOpen && selectedApt && (
                <NewPhysioReferralModal
                    isOpen={isReferralModalOpen}
                    onClose={() => setIsReferralModalOpen(false)}
                    onSuccess={() => {
                        setIsReferralModalOpen(false);
                        fetchAppointments();
                        setAlertMessage("Patient referred to physiotherapy successfully.");
                        setTimeout(() => setAlertMessage(null), 5000);
                    }}
                    initialPatientId={selectedApt.patient_id}
                    initialPatientName={selectedApt.patient?.name}
                    appointmentId={selectedApt.id}
                />
            )}
        </div>
    );
}
