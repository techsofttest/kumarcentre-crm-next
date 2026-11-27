"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Users,
    Clock,
    Calendar,
    CheckCircle2,
    Search,
    AlertCircle,
    UserCheck,
    XCircle,
    RefreshCw,
    Loader2,
    Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { api, ApiError } from "@/lib/api";
import { NewAppointmentModal } from "@/components/appointments/NewAppointmentModal";
import { NewPhysioReferralModal } from "@/components/physio/NewPhysioReferralModal";
import { notifyQueueUpdate } from "@/lib/queue-sync";

interface AppointmentItem {
    id: number;
    reference: string;
    appointment_type: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: string;
    reminder_response: string | null;
    internal_notes: string | null;
    patient: {
        id: number;
        name: string;
        mobile_number: string;
        file_number?: string;
    };
    doctor: {
        id: number;
        name: string;
    };
    assigned_physiotherapist?: {
        id: number;
        name: string;
    } | null;
}

export default function ReceptionistDashboard() {
    const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
    const [counts, setCounts] = useState({
        pending: 0,
        confirmed: 0,
        today: 0,
        upcoming: 0,
        cancelled: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"today" | "pending" | "confirmed" | "upcoming" | "cancelled">("today");
    const [searchTerm, setSearchTerm] = useState("");
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Modal state for Rejection / Cancellation reason
    const [modalAction, setModalAction] = useState<"reject" | "cancel" | null>(null);
    const [targetAptId, setTargetAptId] = useState<number | null>(null);
    const [reasonInput, setReasonInput] = useState("");
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    // New Appointment Modal
    const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false);
    const [isPhysioReferralModalOpen, setIsPhysioReferralModalOpen] = useState(false);

    const fetchAppointments = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const params: Record<string, string> = {
                tab: activeTab,
            };
            if (searchTerm.trim()) {
                params.search = searchTerm.trim();
            }
            const res = await api.getAppointments(params);
            setAppointments(res.data || []);
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
    }, [activeTab]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchAppointments();
    };

    const handleConfirm = async (id: number) => {
        try {
            await api.confirmAppointment(id);
            setAlertMessage("Appointment confirmed successfully! Outbound confirmation recorded.");
            notifyQueueUpdate("STATUS_CHANGE", { appointmentId: id });
            fetchAppointments();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to confirm appointment.");
        }
    };

    const handleCheckIn = async (id: number) => {
        setIsSubmittingAction(true);
        try {
            await api.checkInAppointment(id);
            setAlertMessage("Patient successfully checked in and moved to doctor queue.");
            notifyQueueUpdate("CHECK_IN", { appointmentId: id });
            fetchAppointments();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to check in patient.");
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const openReasonModal = (action: "reject" | "cancel", id: number) => {
        setModalAction(action);
        setTargetAptId(id);
        setReasonInput("");
    };

    const submitReasonModal = async () => {
        if (!targetAptId || !reasonInput.trim()) {
            setErrorMessage("Please enter a mandatory reason.");
            return;
        }

        setIsSubmittingAction(true);
        try {
            if (modalAction === "reject") {
                await api.rejectAppointment(targetAptId, reasonInput.trim());
                setAlertMessage("Appointment has been rejected.");
                notifyQueueUpdate("STATUS_CHANGE", { appointmentId: targetAptId });
            } else if (modalAction === "cancel") {
                await api.cancelAppointment(targetAptId, reasonInput.trim());
                setAlertMessage("Appointment has been cancelled.");
                notifyQueueUpdate("STATUS_CHANGE", { appointmentId: targetAptId });
            }
            setModalAction(null);
            setTargetAptId(null);
            setReasonInput("");
            fetchAppointments();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Action failed.");
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleSendWhatsAppDirect = (apt: AppointmentItem) => {
        const cleanPhone = String(apt.patient?.mobile_number || "").replace(/[^0-9]/g, "");
        const formattedPhone = cleanPhone.startsWith("91") && cleanPhone.length > 10 ? cleanPhone : `91${cleanPhone}`;
        const msg = encodeURIComponent(
            `Hello ${apt.patient?.name}, this is a reminder for your appointment at Kumar Centres with ${apt.doctor?.name} scheduled on ${apt.appointment_date} at ${apt.start_time}. Reference: ${apt.reference}. Please reply YES to confirm or NO if you need to reschedule.`
        );
        window.open(`https://wa.me/${formattedPhone}?text=${msg}`, "_blank");
        setAlertMessage(`WhatsApp message opened for ${apt.patient?.name}!`);
        setTimeout(() => setAlertMessage(null), 4000);
    };

    return (
        <div className="flex w-full flex-col gap-8 p-8">
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
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                        <span className="text-sm font-medium">{errorMessage}</span>
                    </div>
                    <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">
                        <XCircle className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Receptionist Dashboard
                    </h1>
                </div>

                <div className="flex flex-wrap gap-2.5">
                    <Link href="/dashboard/appointments/new">
                        <Button
                            variant="filled"
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            + New Appointment
                        </Button>
                    </Link>
                    <Button
                        variant="outline"
                        icon={Activity}
                        onClick={() => setIsPhysioReferralModalOpen(true)}
                        className="text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-900/60 dark:hover:bg-purple-950/20"
                    >
                        + Physio Referral
                    </Button>
                    <Button
                        variant="outline"
                        icon={RefreshCw}
                        onClick={fetchAppointments}
                        disabled={isLoading}
                    >
                        {isLoading ? "Refreshing..." : "Refresh Live"}
                    </Button>
                    <Link href="/dashboard/appointments">
                        <Button variant="outline" icon={Calendar}>
                            All Appointments List
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Live Metrics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div
                    onClick={() => setActiveTab("today")}
                    className={`cursor-pointer flex flex-col justify-between rounded-xl border p-6  transition-all ${activeTab === "today" ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/20" : "border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/70">Today's Appointments</span>
                        <Calendar className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-bold tracking-tight text-foreground">{counts.today}</span>
                        <span className="text-xs font-medium text-purple-600">Scheduled for today</span>
                    </div>
                </div>

                <div
                    onClick={() => setActiveTab("pending")}
                    className={`cursor-pointer flex flex-col justify-between rounded-xl border p-6  transition-all ${activeTab === "pending" ? "border-amber-600 bg-amber-50/50 dark:bg-amber-950/20" : "border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/70">Pending Requests</span>
                        <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-bold tracking-tight text-foreground">{counts.pending}</span>
                        <span className="text-xs font-medium text-amber-600">Awaiting confirmation</span>
                    </div>
                </div>

                <div
                    onClick={() => setActiveTab("confirmed")}
                    className={`cursor-pointer flex flex-col justify-between rounded-xl border p-6  transition-all ${activeTab === "confirmed" ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/70">Confirmed</span>
                        <UserCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-bold tracking-tight text-foreground">{counts.confirmed}</span>
                        <span className="text-xs font-medium text-emerald-600">Active bookings</span>
                    </div>
                </div>

                <div
                    onClick={() => setActiveTab("cancelled")}
                    className={`cursor-pointer flex flex-col justify-between rounded-xl border p-6  transition-all ${activeTab === "cancelled" ? "border-red-600 bg-red-50/50 dark:bg-red-950/20" : "border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/70">Cancelled / Rejected</span>
                        <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-bold tracking-tight text-foreground">{counts.cancelled}</span>
                        <span className="text-xs font-medium text-red-600">Terminated records</span>
                    </div>
                </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6  dark:border-white/10 dark:bg-zinc-900">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-4">
                    <div className="flex flex-wrap gap-2">
                        {(["today", "pending", "confirmed", "upcoming", "cancelled"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold capitalize transition-all cursor-pointer ${activeTab === tab
                                        ? "bg-purple-600 text-white "
                                        : "bg-slate-100 text-foreground/70 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300"
                                    }`}
                            >
                                {tab} ({counts[tab as keyof typeof counts] ?? 0})
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                        <input
                            type="text"
                            placeholder="Search name, phone, ref..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-md border border-foreground/20 bg-slate-50 dark:bg-zinc-800 pl-9 pr-3 py-1.5 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                        />
                    </form>
                </div>

                {/* Table */}
                {isLoading ? (
                    <div className="flex h-48 flex-col items-center justify-center gap-2 text-foreground/50">
                        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                        <span className="text-xs">Loading appointments...</span>
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="flex h-36 flex-col items-center justify-center text-foreground/50 text-xs">
                        No appointments found for "{activeTab}" view.
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
                                    <tr key={apt.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3.5 font-bold">
                                            <span className="rounded bg-slate-100 dark:bg-white/10 px-2 py-1 font-mono text-purple-700 dark:text-purple-300">
                                                {apt.reference}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="font-semibold text-foreground">{apt.patient?.name}</div>
                                            <div className="text-[11px] text-foreground/50">{apt.patient?.mobile_number}</div>
                                            {apt.patient?.file_number && (
                                                <div className="text-[10px] font-mono text-purple-600">File: {apt.patient.file_number}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="font-medium text-foreground">{apt.doctor?.name}</div>
                                            {apt.assigned_physiotherapist && (
                                                <div className="text-[11px] text-teal-600 dark:text-teal-400">
                                                    Physio: {apt.assigned_physiotherapist.name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="font-medium text-foreground">{apt.appointment_date}</div>
                                            <div className="text-[11px] text-foreground/50">{apt.start_time?.slice(0, 5)} - {apt.end_time?.slice(0, 5)}</div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="capitalize">{apt.appointment_type.replace('_', ' ')}</span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${apt.status === "confirmed"
                                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                                    : apt.status === "pending_confirmation"
                                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                                }`}>
                                                {apt.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => handleSendWhatsAppDirect(apt)}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-semibold  transition-colors cursor-pointer"
                                                title={`Send WhatsApp message to ${apt.patient?.name}`}
                                            >
                                                <WhatsAppIcon className="h-4 w-4 shrink-0" />
                                                WA
                                            </button>

                                            {apt.status === "pending_confirmation" && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="filled"
                                                        onClick={() => handleConfirm(apt.id)}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    >
                                                        Confirm
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openReasonModal("reject", apt.id)}
                                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                                    >
                                                        Reject
                                                    </Button>
                                                </>
                                            )}

                                            {apt.status === "confirmed" && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="filled"
                                                        onClick={() => handleCheckIn(apt.id)}
                                                        disabled={isSubmittingAction}
                                                        className="bg-sky-600 hover:bg-sky-700 text-white"
                                                    >
                                                        <UserCheck className="h-3.5 w-3.5 mr-1" />
                                                        Check In
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openReasonModal("cancel", apt.id)}
                                                        disabled={isSubmittingAction}
                                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Mandatory Reason Modal for Rejection / Cancellation */}
            {modalAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6  dark:bg-zinc-900 border border-black/10 dark:border-white/10">
                        <h3 className="text-lg font-bold text-foreground">
                            {modalAction === "reject" ? "Reject Appointment" : "Cancel Appointment"}
                        </h3>
                        <p className="mt-1 text-xs text-foreground/60">
                            Please provide a mandatory reason for this action as required by clinic compliance.
                        </p>

                        <div className="mt-4">
                            <textarea
                                value={reasonInput}
                                onChange={(e) => setReasonInput(e.target.value)}
                                placeholder="Enter specific reason (e.g., Doctor unavailable, Patient requested cancellation)..."
                                rows={3}
                                className="w-full rounded-md border border-foreground/20 bg-slate-50 dark:bg-zinc-800 p-2.5 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                            />
                        </div>

                        <div className="mt-6 flex justify-end gap-2.5">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setModalAction(null)}
                                disabled={isSubmittingAction}
                            >
                                Back
                            </Button>
                            <Button
                                variant="filled"
                                size="sm"
                                onClick={submitReasonModal}
                                disabled={isSubmittingAction || !reasonInput.trim()}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                {isSubmittingAction ? "Submitting..." : `Confirm ${modalAction === "reject" ? "Rejection" : "Cancellation"}`}
                            </Button>
                        </div>
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

            {/* Receptionist New Physio Referral Modal */}
            <NewPhysioReferralModal
                isOpen={isPhysioReferralModalOpen}
                onClose={() => setIsPhysioReferralModalOpen(false)}
                onSuccess={(ref) => {
                    setAlertMessage(`Physiotherapy referral ${ref.referral_number} created successfully!`);
                    setTimeout(() => setAlertMessage(null), 5000);
                }}
            />
        </div>
    );
}

