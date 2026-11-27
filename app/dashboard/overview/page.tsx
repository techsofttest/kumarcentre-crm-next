"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Calendar,
    Users,
    AlertCircle,
    Plus,
    Clock,
    UserCheck,
    XCircle,
    Loader2,
    RefreshCw,
    CheckCircle2,
    Check,
    X,
    Eye,
    Activity,
    Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { NewPhysioReferralModal } from "@/components/physio/NewPhysioReferralModal";
import { api, ApiError } from "@/lib/api";
import { notifyQueueUpdate } from "@/lib/queue-sync";

const MONTH_NAMES_SHORT_OV = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
];

function formatDateIso(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.split(" ")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parts[2].padStart(2, "0");
        const monthName = MONTH_NAMES_SHORT_OV[monthIndex] || parts[1];
        return `${day}-${monthName}-${year}`;
    }
    return clean;
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

interface DashboardStats {
    total_bookings: number;
    today_appointments: number;
    pending_requests: number;
    confirmed_appointments: number;
    cancelled_appointments: number;
    patient_yes_responses: number;
    patient_no_responses: number;
    awaiting_responses: number;
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

export default function OverviewDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [todaySchedule, setTodaySchedule] = useState<AppointmentRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [physiotherapists, setPhysiotherapists] = useState<PhysiotherapistUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Detail Drawer & Modals
    const [selectedApt, setSelectedApt] = useState<AppointmentRecord | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Modal action state
    const [actionType, setActionType] = useState<"reject" | "cancel" | "reschedule" | "assign_physio" | null>(null);
    const [reasonText, setReasonText] = useState("");
    const [rescheduleDate, setRescheduleDate] = useState("");
    const [rescheduleTime, setRescheduleTime] = useState("");
    const [selectedPhysioId, setSelectedPhysioId] = useState<number | "">("");
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    // Physio Referral Modal
    const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadDashboardData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [statsRes, appointmentsRes] = await Promise.all([
                api.getAdminStats(),
                api.getAppointments({ tab: "today" }),
            ]);
            setStats(statsRes);
            setTodaySchedule(appointmentsRes.data || []);
            if (appointmentsRes.physiotherapists) {
                setPhysiotherapists(appointmentsRes.physiotherapists);
            }
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load dashboard metrics from backend.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    // Confirm Appointment
    const handleConfirm = async (id: number) => {
        setIsSubmittingAction(true);
        try {
            await api.confirmAppointment(id);
            setAlertMessage("Appointment confirmed successfully.");
            notifyQueueUpdate("STATUS_CHANGE", { appointmentId: id });
            loadDashboardData();
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
    const handleCheckIn = async (id: number) => {
        setIsSubmittingAction(true);
        try {
            await api.checkInAppointment(id);
            setAlertMessage("Patient successfully checked in and moved to doctor queue.");
            notifyQueueUpdate("CHECK_IN", { appointmentId: id });
            loadDashboardData();
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

    // Send WhatsApp Message
    const handleSendWhatsApp = (apt: AppointmentRecord) => {
        const cleanPhone = String(apt.patient?.mobile_number || "").replace(/[^0-9]/g, "");
        const formattedPhone = cleanPhone.startsWith("91") && cleanPhone.length > 10 ? cleanPhone : `91${cleanPhone}`;
        const msg = encodeURIComponent(
            `Hello ${apt.patient?.name}, this is a message from Kumar Centres regarding your appointment with ${apt.doctor?.name} today at ${formatTime12h(apt.start_time)}. Booking Ref: ${apt.reference}. Please let us know if you have any questions!`
        );
        window.open(`https://wa.me/${formattedPhone}?text=${msg}`, "_blank");
        setAlertMessage(`WhatsApp message opened for ${apt.patient?.name}.`);
        setTimeout(() => setAlertMessage(null), 4000);
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
            } else if (actionType === "reschedule") {
                if (!rescheduleDate || !rescheduleTime) throw new Error("Both new date and time are required.");
                await api.rescheduleAppointment(selectedApt.id, {
                    appointment_date: rescheduleDate,
                    start_time: rescheduleTime,
                });
                setAlertMessage("Appointment rescheduled successfully.");
            } else if (actionType === "assign_physio") {
                if (!selectedPhysioId) throw new Error("Please select a physiotherapist.");
                await api.assignPhysiotherapist(selectedApt.id, Number(selectedPhysioId));
                setAlertMessage("Physiotherapist assigned successfully.");
            }

            setActionType(null);
            setReasonText("");
            setIsDrawerOpen(false);
            notifyQueueUpdate("STATUS_CHANGE", { appointmentId: selectedApt.id });
            loadDashboardData();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Action failed.");
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const filteredSchedule = todaySchedule.filter((apt) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase().trim();
        const patientName = apt.patient?.name?.toLowerCase() || "";
        const mobile = apt.patient?.mobile_number?.toLowerCase() || "";
        const fileNumber = apt.patient?.file_number?.toLowerCase() || "";
        const reference = apt.reference?.toLowerCase() || "";
        return patientName.includes(query) || mobile.includes(query) || fileNumber.includes(query) || reference.includes(query);
    });

    return (
        <div className="flex w-full flex-col gap-8 p-8">
            {/* Page Header & Quick Actions */}
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
                </div>

                <div className="flex flex-wrap gap-2.5">
                    <Button
                        variant="outline"
                        icon={RefreshCw}
                        onClick={loadDashboardData}
                        disabled={isLoading}
                    >
                        {isLoading ? "Refreshing..." : "Refresh Live"}
                    </Button>
                    <Link href="/dashboard/appointments/new">
                        <Button variant="filled" icon={Plus} className="bg-purple-600 hover:bg-purple-700 text-white">
                            New Appointment
                        </Button>
                    </Link>
                    <Link href="/dashboard/reports">
                        <Button variant="outline" icon={Calendar}>
                            Daily Reports
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Notifications */}
            {alertMessage && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Check className="h-5 w-5 text-emerald-600 shrink-0" />
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

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Today's Appointments */}
                <div className="flex flex-col justify-between rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/70">Today's Appointments</span>
                        <Calendar className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        {isLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                        ) : (
                            <span className="text-3xl font-bold tracking-tight text-foreground">
                                {stats?.today_appointments ?? 0}
                            </span>
                        )}
                        <span className="text-xs font-medium text-purple-600">Active today</span>
                    </div>
                </div>

                {/* Pending Requests */}
                <div className="flex flex-col justify-between rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/70">Pending Requests</span>
                        <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        {isLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                        ) : (
                            <span className="text-3xl font-bold tracking-tight text-foreground">
                                {stats?.pending_requests ?? 0}
                            </span>
                        )}
                        <span className="text-xs font-medium text-amber-600">Awaiting confirmation</span>
                    </div>
                </div>

                {/* Confirmed Appointments */}
                <div className="flex flex-col justify-between rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/70">Confirmed Bookings</span>
                        <UserCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        {isLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                        ) : (
                            <span className="text-3xl font-bold tracking-tight text-foreground">
                                {stats?.confirmed_appointments ?? 0}
                            </span>
                        )}
                        <span className="text-xs font-medium text-emerald-600">Confirmed & active</span>
                    </div>
                </div>

                {/* Total Lifetime Bookings */}
                <div className="flex flex-col justify-between rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/70">Total System Bookings</span>
                        <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        {isLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        ) : (
                            <span className="text-3xl font-bold tracking-tight text-foreground">
                                {stats?.total_bookings ?? 0}
                            </span>
                        )}
                        <span className="text-xs font-medium text-blue-600">In database</span>
                    </div>
                </div>
            </div>

            {/* Today's Live Schedule from Backend */}
            <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 dark:border-white/5 pb-4">
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-foreground">
                            Today's Appointments
                        </h2>
                        <p className="text-xs text-foreground/60">
                            Patient bookings scheduled for today
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Quick search patient name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 w-full rounded-lg border border-black/10 bg-slate-50 dark:bg-zinc-800/60 dark:border-white/10 pl-8 pr-7 text-xs text-foreground placeholder:text-foreground/40 focus:border-purple-600 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none transition-colors"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground text-xs"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <Link href="/dashboard/appointments">
                            <Button variant="outline" size="sm" className="whitespace-nowrap">
                                All Appointments
                            </Button>
                        </Link>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex h-32 items-center justify-center text-xs text-foreground/50">
                        <Loader2 className="h-5 w-5 animate-spin mr-2 text-purple-600" />
                        Loading today's schedule from database...
                    </div>
                ) : todaySchedule.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-foreground/20 p-8 text-center text-xs text-foreground/50">
                        No appointments booked for today.
                    </div>
                ) : filteredSchedule.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-foreground/20 p-8 text-center text-xs text-foreground/50">
                        No appointments found matching &ldquo;{searchQuery}&rdquo;.
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="block mx-auto mt-2 text-purple-600 hover:underline font-semibold"
                        >
                            Clear Search
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-black/10 bg-slate-50/50 dark:border-white/10 dark:bg-white/5 uppercase tracking-wider text-foreground/60">
                                <tr>
                                    <th className="px-4 py-3">Reference</th>
                                    <th className="px-4 py-3">Patient Name</th>
                                    <th className="px-4 py-3">Clinician / Doctor</th>
                                    <th className="px-4 py-3">Time</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {filteredSchedule.map((apt) => (
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
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            <div>{apt.doctor?.name}</div>
                                            {apt.assigned_physiotherapist && (
                                                <div className="text-[11px] text-teal-600 dark:text-teal-400">
                                                    Physio: {apt.assigned_physiotherapist.name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-foreground">
                                                {formatTime12h(apt.start_time)} – {formatTime12h(apt.end_time)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 capitalize text-foreground/70">
                                            {apt.appointment_type.replace(/_/g, ' ')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${apt.status === "confirmed"
                                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                                : apt.status === "checked_in"
                                                    ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                                                    : apt.status === "in_consultation"
                                                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                                                        : apt.status === "pending_confirmation"
                                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                                            : apt.status === "completed"
                                                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                                }`}>
                                                {apt.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                {apt.status === "pending_confirmation" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleConfirm(apt.id)}
                                                        disabled={isSubmittingAction}
                                                        className="inline-flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-xs font-semibold transition-colors cursor-pointer"
                                                        title="Confirm appointment"
                                                    >
                                                        <Check className="h-3.5 w-3.5 shrink-0" />
                                                        Confirm
                                                    </button>
                                                )}
                                                {apt.status === "confirmed" && (
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
                                                    title="Send WhatsApp message"
                                                >
                                                    <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
                                                    WA
                                                </button>
                                                {(apt.status === "confirmed" || apt.status === "pending_confirmation") && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedApt(apt);
                                                            setActionType("cancel");
                                                        }}
                                                        disabled={isSubmittingAction}
                                                        className="inline-flex items-center gap-1 rounded border border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 px-2 py-1 text-xs font-semibold transition-colors cursor-pointer"
                                                        title="Cancel appointment"
                                                    >
                                                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                                                        Cancel
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedApt(apt);
                                                        setIsDrawerOpen(true);
                                                    }}
                                                    className="inline-flex items-center gap-1 rounded border border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-zinc-800 text-foreground px-2 py-1 text-xs font-medium transition-colors cursor-pointer"
                                                    title="View appointment details"
                                                >
                                                    <Eye className="h-3.5 w-3.5 shrink-0 text-foreground/60" />
                                                    Details
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
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${selectedApt.status === "confirmed"
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                            : selectedApt.status === "checked_in"
                                                ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                                                : selectedApt.status === "in_consultation"
                                                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                                                    : selectedApt.status === "pending_confirmation"
                                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                                        : selectedApt.status === "completed"
                                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                            }`}>
                                            {selectedApt.status.replace(/_/g, ' ')}
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
                                    <div className="text-foreground/70 capitalize mt-1">Type: {selectedApt.appointment_type.replace(/_/g, ' ')}</div>
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
                                    <div className="font-bold text-sm text-foreground font-mono">{formatDateIso(selectedApt.appointment_date)}</div>
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

                                {selectedApt.status === "confirmed" && (
                                    <div className="flex flex-col gap-2">
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
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setRescheduleDate(selectedApt.appointment_date?.slice(0, 10));
                                                    setRescheduleTime(selectedApt.start_time?.slice(0, 5));
                                                    setActionType("reschedule");
                                                }}
                                            >
                                                Reschedule
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setActionType("cancel")}
                                                className="text-red-600 border-red-200 hover:bg-red-50"
                                            >
                                                Cancel Booking
                                            </Button>
                                        </div>
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
                                {actionType === "reschedule" && "Reschedule Appointment"}
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

                            {actionType === "reschedule" && (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1">
                                            New Appointment Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            min={new Date().toISOString().split("T")[0]}
                                            value={rescheduleDate}
                                            onChange={(e) => setRescheduleDate(e.target.value)}
                                            className="w-full rounded-md border border-foreground/20 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1">
                                            New Start Time <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            required
                                            value={rescheduleTime}
                                            onChange={(e) => setRescheduleTime(e.target.value)}
                                            className="w-full rounded-md border border-foreground/20 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                        />
                                    </div>
                                </>
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

            {/* Physio Referral Modal */}
            {isReferralModalOpen && selectedApt && (
                <NewPhysioReferralModal
                    isOpen={isReferralModalOpen}
                    onClose={() => setIsReferralModalOpen(false)}
                    onSuccess={() => {
                        setIsReferralModalOpen(false);
                        loadDashboardData();
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
