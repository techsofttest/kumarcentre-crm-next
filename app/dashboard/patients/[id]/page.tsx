"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Calendar as CalendarIcon,
    FileText,
    Clock,
    ChevronLeft,
    Check,
    AlertCircle,
    User,
    Activity,
    CheckCircle2,
    Loader2,
    Stethoscope
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { normalizeRole } from "@/lib/roles";
import { FlatpickrDob } from "@/components/ui/flatpickr-dob";
import { NewPhysioReferralModal } from "@/components/physio/NewPhysioReferralModal";

interface PatientData {
    id: number;
    name: string;
    mobile_number: string;
    alternate_contact_number?: string | null;
    email?: string | null;
    file_number?: string | null;
    date_of_birth?: string | null;
    age?: number | null;
    gender?: string | null;
    registration_date?: string | null;
    notes?: string | null;
    created_at?: string | null;
}

interface UpcomingAppointmentItem {
    id: number;
    reference: string;
    doctor_id: number;
    doctor_name: string;
    doctor_specialization?: string | null;
    appointment_type: string;
    appointment_type_label: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: string;
    status_label: string;
    internal_notes?: string | null;
}

interface CompletedAppointmentItem {
    id: number;
    reference: string;
    doctor_id: number;
    doctor_name: string;
    doctor_specialization?: string | null;
    appointment_type: string;
    appointment_type_label: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: string;
    status_label: string;
    appointment_notes?: string | null;
    internal_notes?: string | null;
    doctor_remarks?: string | null;
    notes?: string | null;
    physio_completion_notes?: string | null;
    completed_at?: string | null;
}

import { formatIstDate, formatIstDateNumeric, formatIstTime12h, toIstYmd } from "@/lib/date-utils";

function formatTime12h(timeStr: string | null | undefined): string {
    return formatIstTime12h(timeStr, "", true);
}

function formatDateDisplay(dateStr: string): string {
    return formatIstDate(dateStr, "");
}

function formatDobNumeric(dateStr: string | null | undefined): string {
    return formatIstDateNumeric(dateStr, "");
}

export default function PatientDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [userRole, setUserRole] = useState<string>("Receptionist");
    const [patient, setPatient] = useState<PatientData | null>(null);
    const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointmentItem[]>([]);
    const [completedAppointments, setCompletedAppointments] = useState<CompletedAppointmentItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<"profile" | "upcoming" | "completed" | "physio">("profile");
    const [filterDate, setFilterDate] = useState<string>("");
    const [physioReferralModalOpen, setPhysioReferralModalOpen] = useState(false);

    const normalizedRole = normalizeRole(userRole);
    const isDoctor = normalizedRole === "Doctor";
    const isPhysio = normalizedRole === "Physiotherapist";

    // Edit fields (matching registration fields)
    const [editName, setEditName] = useState("");
    const [editMobile, setEditMobile] = useState("");
    const [editAltMobile, setEditAltMobile] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editDob, setEditDob] = useState("");
    const [editGender, setEditGender] = useState<"M" | "F" | "O" | "">("");
    const [editNotes, setEditNotes] = useState("");
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Calculate age from date of birth
    const calculatedAge = useMemo(() => {
        if (!editDob) return null;
        const birthDate = new Date(editDob);
        if (isNaN(birthDate.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 0 ? age : null;
    }, [editDob]);

    const loadPatientDetail = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await api.getPatientDetail(id);
            const p = res.patient;
            setPatient(p);
            setUpcomingAppointments(res.upcoming_appointments || []);
            setCompletedAppointments(res.completed_appointments || []);

            setEditName(p.name || "");
            setEditMobile(p.mobile_number || "");
            setEditAltMobile(p.alternate_contact_number || "");
            setEditEmail(p.email || "");
            setEditDob(toIstYmd(p.date_of_birth));
            setEditGender((p.gender as "M" | "F" | "O") || "");
            setEditNotes(p.notes || "");
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load patient from database.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const storedRole = localStorage.getItem("userRole");
        if (storedRole) setUserRole(storedRole);
        loadPatientDetail();
    }, [id]);

    const handleUpdatePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patient) return;
        setIsSavingProfile(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const res = await api.updatePatientDetail(patient.id, {
                name: editName.trim(),
                mobile_number: editMobile.trim(),
                alternate_contact_number: editAltMobile.trim() || null,
                email: editEmail.trim() || null,
                date_of_birth: editDob || null,
                gender: editGender ? (editGender as "M" | "F" | "O") : null,
                notes: editNotes.trim() || null,
            });

            setPatient(res.patient);
            setSuccessMessage("Patient details updated successfully.");
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to update patient details.");
        } finally {
            setIsSavingProfile(false);
        }
    };

    const getStatusBadge = (status: string, statusLabel?: string) => {
        const label = statusLabel || status;
        const normalized = status.toLowerCase();

        let colors = "bg-zinc-100 dark:bg-zinc-800 text-foreground/80";
        if (normalized === "confirmed") {
            colors = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
        } else if (normalized.includes("pending")) {
            colors = "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300";
        } else if (normalized === "completed") {
            colors = "bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300";
        } else if (normalized === "cancelled" || normalized === "rejected") {
            colors = "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-300";
        }

        return (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full self-start sm:self-auto ${colors}`}>
                {label}
            </span>
        );
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .filter(Boolean)
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .substring(0, 2);
    };

    // Filter appointments by selected date
    const filteredUpcoming = useMemo(() => {
        if (!filterDate) return upcomingAppointments;
        return upcomingAppointments.filter(apt => apt.appointment_date.startsWith(filterDate));
    }, [upcomingAppointments, filterDate]);

    const filteredCompleted = useMemo(() => {
        if (!filterDate) return completedAppointments;
        return completedAppointments.filter(apt => apt.appointment_date.startsWith(filterDate));
    }, [completedAppointments, filterDate]);

    // Physiotherapy notes (preserves existing physio section as requested)
    const physioSchedules = useMemo(() => {
        if (!patient) return [];
        const results: any[] = [];
        try {
            const rawConsultations = localStorage.getItem("kumar_consultations");
            if (rawConsultations) {
                const consultations = JSON.parse(rawConsultations);
                if (Array.isArray(consultations)) {
                    consultations.forEach((item: any) => {
                        const isPhysioDoc = (item.doctor || "").toUpperCase() === "PHYSIOTHERAPIST";
                        const srv = (item.service || "").toLowerCase();
                        const isPhysioSrv = srv.includes("physio") || srv.includes("rehab") || srv.includes("decompression") || srv.includes("tens") || srv.includes("cryo");

                        if ((isPhysioDoc || isPhysioSrv) && (
                            String(item.patientId) === String(patient.id) ||
                            item.patientName?.toLowerCase() === patient.name?.toLowerCase()
                        )) {
                            results.push({
                                id: item.id || `PT-${Math.floor(100 + Math.random() * 900)}`,
                                date: item.date || "2026-10-31",
                                time: item.time || "10:00 AM",
                                therapist: "PHYSIOTHERAPIST",
                                service: item.service || "Physiotherapy & Rehab Session",
                                referringDoctor: item.referringDoctor || "Dr. SASIKUMAR",
                                notes: item.notes || "Therapy session completed. Patient tolerated active mobilizations with progressive improvement in range of motion.",
                                status: item.status || "Confirmed"
                            });
                        }
                    });
                }
            }
        } catch (_) { }
        return results;
    }, [patient]);

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center p-12">
                <div className="flex items-center gap-2.5 text-foreground/60 text-sm font-medium">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                    <span>Loading patient record from database...</span>
                </div>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center p-12 gap-3">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <p className="text-foreground/70 font-semibold">{errorMessage || "Patient record not found."}</p>
                <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/patients")}>
                    Back to Patient Database
                </Button>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col p-8">
            {/* Back Button */}
            <div className="mb-4">
                <button
                    onClick={() => router.push("/dashboard/patients")}
                    className="flex items-center gap-1 text-sm font-bold text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                >
                    <ChevronLeft className="h-4 w-4" /> Back to Patient Database
                </button>
            </div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[.15] dark:border-white/[.22] pb-6 mb-6">
                <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-xl shrink-0">
                        {getInitials(patient.name)}
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{patient.name}</h1>
                            {patient.file_number && (
                                <span className="rounded bg-purple-100 dark:bg-purple-950/60 px-2.5 py-0.5 text-xs font-mono font-bold text-purple-900 dark:text-purple-200">
                                    {patient.file_number}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-foreground/70 font-medium">
                            <span>Phone: {patient.mobile_number}</span>
                            {patient.gender && (
                                <>
                                    <span>•</span>
                                    <span>{patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : "Other"}</span>
                                </>
                            )}
                            {patient.age !== null && patient.age !== undefined && (
                                <>
                                    <span>•</span>
                                    <span>Age: {patient.age} yrs</span>
                                </>
                            )}
                            {patient.registration_date && (
                                <>
                                    <span>•</span>
                                    <span>Registered: {formatDateDisplay(patient.registration_date)}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {!isDoctor && !isPhysio && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            icon={Activity}
                            onClick={() => setPhysioReferralModalOpen(true)}
                            className="text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-900/60 dark:hover:bg-purple-950/20"
                        >
                            + Refer to Physio
                        </Button>
                    </div>
                )}
            </div>

            {/* Feedback Notifications */}
            {successMessage && (
                <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{successMessage}</span>
                </div>
            )}
            {errorMessage && (
                <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-semibold text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Content Container */}
            <div className="mx-auto w-full max-w-4xl bg-white dark:bg-zinc-900 border border-black/[.15] dark:border-white/[.22] rounded-2xl p-6 sm:p-8">
                {/* Tabs */}
                <div className="flex text-sm font-bold border-b border-black/[.15] dark:border-white/[.22] mb-6 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`mr-6 border-b-2 pb-3 transition-colors shrink-0 cursor-pointer ${activeTab === "profile"
                            ? "border-purple-600 text-purple-600 dark:text-purple-400 font-bold"
                            : "border-transparent text-foreground/70 hover:text-foreground"
                            }`}
                    >
                        Profile Details
                    </button>
                    <button
                        onClick={() => setActiveTab("upcoming")}
                        className={`mr-6 border-b-2 pb-3 transition-colors shrink-0 cursor-pointer flex items-center gap-2 ${activeTab === "upcoming"
                            ? "border-purple-600 text-purple-600 dark:text-purple-400 font-bold"
                            : "border-transparent text-foreground/70 hover:text-foreground"
                            }`}
                    >
                        <span>Upcoming Appointments</span>
                        {upcomingAppointments.length > 0 && (
                            <span className="rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] px-2 py-0.5">
                                {upcomingAppointments.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("completed")}
                        className={`mr-6 border-b-2 pb-3 transition-colors shrink-0 cursor-pointer flex items-center gap-2 ${activeTab === "completed"
                            ? "border-purple-600 text-purple-600 dark:text-purple-400 font-bold"
                            : "border-transparent text-foreground/70 hover:text-foreground"
                            }`}
                    >
                        <span>Completed Appointments</span>
                        {completedAppointments.length > 0 && (
                            <span className="rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 text-[10px] px-2 py-0.5">
                                {completedAppointments.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("physio")}
                        className={`border-b-2 pb-3 transition-colors shrink-0 cursor-pointer ${activeTab === "physio"
                            ? "border-teal-600 text-teal-600 dark:text-teal-400 font-bold"
                            : "border-transparent text-foreground/70 hover:text-foreground"
                            }`}
                    >
                        Physio Notes & Schedules
                    </button>
                </div>

                {/* TAB 1: PROFILE DETAILS (Uses same fields as registration) */}
                {activeTab === "profile" && (
                    <form onSubmit={handleUpdatePatient} className="flex flex-col gap-6 animate-in fade-in">
                        <div className="space-y-5 rounded-xl border border-black/10 dark:border-white/10 p-6 bg-zinc-50/50 dark:bg-zinc-800/20">
                            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                        Patient Registration & Profile Information
                                    </h3>
                                    <p className="text-xs text-foreground/60 mt-0.5">
                                        Synchronized with live patient database
                                    </p>
                                </div>
                                <div className="text-xs font-mono text-foreground/60">
                                    Patient #{patient.id}
                                </div>
                            </div>

                            {/* Full Name & Mobile */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-bold text-foreground">Full Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="h-10 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-900 px-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold text-foreground">Primary Mobile Number *</label>
                                    <input
                                        type="text"
                                        required
                                        value={editMobile}
                                        onChange={(e) => setEditMobile(e.target.value)}
                                        className="h-10 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-900 px-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                    />
                                </div>
                            </div>

                            {/* Alternate Mobile & Email */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-bold text-foreground">Alternate Contact / WhatsApp Number</label>
                                    <input
                                        type="text"
                                        value={editAltMobile}
                                        onChange={(e) => setEditAltMobile(e.target.value)}
                                        placeholder="Optional"
                                        className="h-10 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-900 px-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold text-foreground">Email Address</label>
                                    <input
                                        type="email"
                                        value={editEmail}
                                        onChange={(e) => setEditEmail(e.target.value)}
                                        placeholder="Optional"
                                        className="h-10 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-900 px-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                    />
                                </div>
                            </div>

                            {/* Date of Birth & Calculated Age */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-bold text-foreground">Date of Birth (DD-MM-YYYY)</label>
                                    <FlatpickrDob
                                        value={editDob}
                                        onChange={setEditDob}
                                        placeholder="DD-MM-YYYY"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold text-foreground">Age</label>
                                    <div className="h-10 w-full rounded-lg border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800/60 px-3 text-xs font-semibold text-foreground/80 flex items-center">
                                        {calculatedAge !== null ? `${calculatedAge} years old` : (patient.age ? `${patient.age} years old` : "Enter DOB to calculate age")}
                                    </div>
                                </div>
                            </div>

                            {/* Gender & Registration Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-bold text-foreground">Gender (M, F, O)</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(["M", "F", "O"] as const).map((g) => (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => setEditGender(g)}
                                                className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${editGender === g
                                                    ? "border-purple-600 bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200"
                                                    : "border-black/15 dark:border-white/15 bg-white dark:bg-zinc-800 text-foreground/70 hover:text-foreground"
                                                    }`}
                                            >
                                                {g === "M" ? "Male (M)" : g === "F" ? "Female (F)" : "Other (O)"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold text-foreground">Registration Date</label>
                                    <div className="h-10 w-full rounded-lg border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800/60 px-3 text-xs font-mono font-medium text-foreground/80 flex items-center">
                                        {formatDateDisplay(patient.registration_date || patient.created_at || "")}
                                    </div>
                                </div>
                            </div>

                            {/* Internal Notes */}
                            <div>
                                <label className="mb-1 block text-xs font-bold text-foreground">Patient Notes / Medical Remarks</label>
                                <textarea
                                    rows={3}
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Enter any medical history or receptionist notes..."
                                    className="w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-900 p-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                />
                            </div>

                            <div className="pt-2 flex justify-end">
                                <Button
                                    type="submit"
                                    variant="filled"
                                    disabled={isSavingProfile}
                                    className="bg-purple-600 hover:bg-purple-700 text-white min-w-[140px]"
                                >
                                    {isSavingProfile ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        "Save Changes"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                )}

                {/* TAB 2: UPCOMING APPOINTMENTS */}
                {/* Doctor as main text, then date, slot and status pill */}
                {activeTab === "upcoming" && (
                    <div className="flex flex-col gap-6 animate-in fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-base font-bold text-foreground">Upcoming Appointments</h2>
                                <p className="text-xs text-foreground/60 mt-0.5">
                                    Active bookings scheduled for future dates
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-xs font-semibold text-foreground/70">Filter Date:</label>
                                <input
                                    type="date"
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className="rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 px-2 py-1 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                />
                                {filterDate && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterDate("")}
                                        className="text-xs font-bold text-red-500 hover:text-red-600"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {filteredUpcoming.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-black/15 dark:border-white/15 p-8 text-center text-xs text-foreground/60">
                                    No upcoming appointments found{filterDate ? ` on ${formatDateDisplay(filterDate)}` : ""}.
                                </div>
                            ) : (
                                filteredUpcoming.map((apt) => (
                                    <div
                                        key={apt.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-black/10 dark:border-white/10 p-4 gap-4 bg-white dark:bg-zinc-800 hover:border-black/20 dark:hover:border-white/20 transition-all"
                                    >
                                        <div className="space-y-1">
                                            {/* Main Text: Doctor Name */}
                                            <div className="flex items-center gap-2">
                                                <Stethoscope className="h-4 w-4 text-purple-600 shrink-0" />
                                                <h3 className="text-sm font-bold text-foreground">
                                                    {apt.doctor_name}
                                                </h3>
                                                {apt.doctor_specialization && (
                                                    <span className="text-xs text-foreground/50 font-normal">
                                                        ({apt.doctor_specialization})
                                                    </span>
                                                )}
                                            </div>

                                            {/* Secondary: Date and Slot */}
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/70 font-medium pl-6">
                                                <span className="flex items-center gap-1 font-mono">
                                                    <CalendarIcon className="h-3.5 w-3.5 text-foreground/40" />
                                                    {formatDateDisplay(apt.appointment_date)}
                                                </span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1 font-mono">
                                                    <Clock className="h-3.5 w-3.5 text-foreground/40" />
                                                    Slot: {formatTime12h(apt.start_time)} – {formatTime12h(apt.end_time)}
                                                </span>
                                                <span>•</span>
                                                <span className="text-purple-700 dark:text-purple-300 font-semibold">
                                                    {apt.appointment_type_label}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status Pill (Pending, Confirmed, etc.) */}
                                        <div className="self-start sm:self-auto pl-6 sm:pl-0">
                                            {getStatusBadge(apt.status, apt.status_label)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 3: COMPLETED APPOINTMENTS */}
                {/* Shows Doctor name as main text, date, slot, and Notes (prescriptions removed) */}
                {activeTab === "completed" && (
                    <div className="flex flex-col gap-6 animate-in fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-base font-bold text-foreground">Completed Appointments</h2>
                                <p className="text-xs text-foreground/60 mt-0.5">
                                    Historical doctor visits, consultation timestamps and clinical notes
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-xs font-semibold text-foreground/70">Filter Date:</label>
                                <input
                                    type="date"
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className="rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 px-2 py-1 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                />
                                {filterDate && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterDate("")}
                                        className="text-xs font-bold text-red-500 hover:text-red-600"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {filteredCompleted.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-black/15 dark:border-white/15 p-8 text-center text-xs text-foreground/60">
                                    No completed appointments recorded{filterDate ? ` on ${formatDateDisplay(filterDate)}` : ""}.
                                </div>
                            ) : (
                                filteredCompleted.map((apt) => (
                                    <div
                                        key={apt.id}
                                        className="flex flex-col rounded-xl border border-black/10 dark:border-white/10 p-5 gap-3 bg-white dark:bg-zinc-800 hover:border-black/20 dark:hover:border-white/20 transition-all"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 dark:border-white/5 pb-3">
                                            <div className="space-y-1">
                                                {/* Main Text: Doctor Name */}
                                                <div className="flex items-center gap-2">
                                                    <Stethoscope className="h-4 w-4 text-purple-600 shrink-0" />
                                                    <h3 className="text-sm font-bold text-foreground">
                                                        {apt.doctor_name}
                                                    </h3>
                                                    {apt.doctor_specialization && (
                                                        <span className="text-xs text-foreground/50 font-normal">
                                                            ({apt.doctor_specialization})
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Secondary: Date and Slot */}
                                                <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/70 font-medium pl-6">
                                                    <span className="flex items-center gap-1 font-mono">
                                                        <CalendarIcon className="h-3.5 w-3.5 text-foreground/40" />
                                                        {formatDateDisplay(apt.appointment_date)}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1 font-mono">
                                                        <Clock className="h-3.5 w-3.5 text-foreground/40" />
                                                        Slot: {formatTime12h(apt.start_time)} – {formatTime12h(apt.end_time)}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="text-purple-700 dark:text-purple-300 font-semibold">
                                                        {apt.appointment_type_label}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <div className="self-start sm:self-auto pl-6 sm:pl-0">
                                                {getStatusBadge(apt.status, apt.status_label)}
                                            </div>
                                        </div>

                                        {/* Notes Section: Appointment Notes on Left & Doctor's Remarks on Right */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                            {/* Appointment Notes (Left) */}
                                            <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-800/40 flex flex-col">
                                                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                                    <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                                                    Appointment Notes
                                                </span>
                                                <p className="text-foreground/85 font-medium leading-relaxed whitespace-pre-wrap flex-1">
                                                    {apt.appointment_notes || apt.internal_notes || "No appointment notes recorded."}
                                                </p>
                                            </div>

                                            {/* Doctor's Remarks (Right) */}
                                            <div className="rounded-lg border border-purple-200/70 bg-purple-50/40 p-3.5 text-xs dark:border-purple-900/40 dark:bg-purple-950/20 flex flex-col">
                                                <span className="font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                                    <Stethoscope className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                                    Doctor's Remarks
                                                </span>
                                                <p className="text-foreground/85 font-medium leading-relaxed whitespace-pre-wrap flex-1">
                                                    {apt.doctor_remarks || "No clinical remarks recorded."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 4: PHYSIO NOTES & SCHEDULES (Left untouched as requested) */}
                {activeTab === "physio" && (
                    <div className="flex flex-col gap-6 animate-in fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Physiotherapy Schedules & Clinical Notes</h2>
                                <p className="text-xs text-foreground/60 mt-0.5">
                                    Rehabilitation timeline and physiotherapist notes.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {physioSchedules.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-black/[.15] dark:border-white/[.22] p-8 text-center">
                                    <Activity className="h-8 w-8 text-foreground/30 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-foreground/60">No physiotherapy schedules or notes recorded for this patient.</p>
                                </div>
                            ) : (
                                physioSchedules.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-2xl border border-teal-200/80 bg-teal-50/20 p-6 dark:border-teal-900/40 dark:bg-teal-950/10"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[.08] pb-4 dark:border-white/[.08]">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                                                    <CalendarIcon className="h-4 w-4 text-teal-600" />
                                                    <span>{item.date}</span>
                                                    <span className="text-foreground/40">•</span>
                                                    <span className="flex items-center gap-1 text-xs font-semibold text-foreground/70">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {item.time}
                                                    </span>
                                                </div>

                                                <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 flex items-center gap-1">
                                                    <Activity className="h-3 w-3" />
                                                    {item.therapist}
                                                </span>

                                                <span className="text-sm font-bold text-foreground">
                                                    {item.service}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {item.referringDoctor && (
                                                    <span className="rounded-full bg-slate-100 dark:bg-white/10 px-2.5 py-1 text-xs font-semibold text-foreground/70">
                                                        Ref: {item.referringDoctor}
                                                    </span>
                                                )}
                                                <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700 dark:bg-green-950/40 dark:text-green-300 flex items-center gap-1">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    {item.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-4 rounded-xl border border-teal-200/80 bg-white dark:border-teal-900/40 dark:bg-zinc-800/80 p-4">
                                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200">
                                                <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                                                Therapist Clinical Notes & Assessment
                                            </div>
                                            <p className="mt-2 text-sm leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap">
                                                {item.notes}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* New Physiotherapy Referral Modal */}
            <NewPhysioReferralModal
                isOpen={physioReferralModalOpen}
                onClose={() => setPhysioReferralModalOpen(false)}
                initialPatientId={patient.id}
                initialPatientName={patient.name}
                onSuccess={(ref) => {
                    setSuccessMessage(`Physiotherapy referral ${ref.referral_number} created successfully!`);
                    setTimeout(() => setSuccessMessage(null), 5000);
                }}
            />
        </div>
    );
}
