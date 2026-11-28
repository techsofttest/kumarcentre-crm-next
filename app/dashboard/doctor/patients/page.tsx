"use client";

import { useState, useEffect } from "react";
import {
    Users,
    Search,
    Phone,
    Calendar,
    FileText,
    History,
    Activity,
    Stethoscope,
    CheckCircle2,
    Clock,
    X,
    Loader2,
    RefreshCw,
    AlertCircle,
    ChevronRight,
    User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { formatAgeGender } from "@/lib/patient-utils";
import { formatIstDate, formatIstTime12h } from "@/lib/date-utils";

function formatDateTable(dateStr: string | null | undefined): string {
    return formatIstDate(dateStr, "—");
}

function formatTime12h(timeStr: string | null | undefined): string {
    return formatIstTime12h(timeStr, "", false);
}

interface PatientListItem {
    id: number;
    name: string;
    file_number: string | null;
    mobile_number: string;
    age: number | null;
    gender: string | null;
    date_of_birth: string | null;
    registration_date: string | null;
    last_consultation_date: string | null;
    upcoming_appointment: {
        id: number;
        reference: string;
        appointment_date: string;
        start_time: string;
        status: string;
    } | null;
}

interface PatientProfileData {
    patient: {
        id: number;
        name: string;
        file_number: string | null;
        mobile_number: string;
        alternate_contact_number: string | null;
        email: string | null;
        date_of_birth: string | null;
        age: number | null;
        gender: string | null;
        registration_date: string | null;
        notes: string | null;
    };
    appointments: Array<any>;
    consultations: Array<{
        id: number;
        appointment_id: number;
        appointment_notes?: string | null;
        consultation_date: string;
        doctor_name: string;
        remarks: string | null;
        doctor_remarks?: string | null;
        outcome: string;
        referred_to_physio: boolean;
        physiotherapy_instructions?: string | null;
        physiotherapy_status?: string | null;
        physiotherapy_completion_notes?: string | null;
        completed_at: string | null;
    }>;
    physiotherapy_referrals: Array<{
        id: number;
        referral_date: string;
        referring_doctor: string;
        assigned_physiotherapist?: string | null;
        treatment_instructions: string;
        status: string;
        completion_notes?: string | null;
        completed_at?: string | null;
    }>;
}

export default function DoctorPatientsPage() {
    const [patients, setPatients] = useState<PatientListItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [isLoading, setIsLoading] = useState(true);

    // Consolidated Profile Modal State
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
    const [profileData, setProfileData] = useState<PatientProfileData | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [activeTab, setActiveTab] = useState<"history" | "appointments" | "physio">("history");

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fetchPatients = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await api.getDoctorPatients({
                search: searchQuery.trim() || undefined,
                page,
                per_page: 20,
            });
            setPatients(res.data || []);
            setMeta(res.meta || { current_page: 1, last_page: 1, total: 0 });
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load doctor patient list.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, [page]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchPatients();
    };

    // Open Consolidated Patient Profile
    const handleOpenProfile = async (id: number) => {
        setSelectedPatientId(id);
        setIsLoadingProfile(true);
        setErrorMessage(null);
        try {
            const res = await api.getDoctorPatientProfile(id);
            setProfileData(res);
            setActiveTab("history");
        } catch (err: any) {
            setErrorMessage(err.message || "Unable to load patient profile.");
        } finally {
            setIsLoadingProfile(false);
        }
    };

    return (
        <div className="flex w-full flex-col gap-6 p-8">
            {/* Header & Breadcrumb */}
            <div className="flex flex-col gap-4 border-b border-black/10 dark:border-white/10 pb-5">
                <div className="flex items-center gap-2 text-xs text-foreground/50">
                    <span>Doctor Admin</span>
                    <span>/</span>
                    <span className="text-foreground font-semibold">My Patients</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            My Patients
                        </h1>
                        <p className="text-xs text-foreground/60 mt-1">
                            Directory of patients previously consulted by you ({meta.total} total)
                        </p>
                    </div>

                    {/* Search Form */}
                    <form onSubmit={handleSearch} className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name, file #, phone..."
                                className="w-64 rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 pl-9 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-purple-600"
                            />
                        </div>
                        <Button type="submit" variant="filled" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
                            Search
                        </Button>
                        {searchQuery && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSearchQuery("");
                                    setPage(1);
                                    setTimeout(fetchPatients, 0);
                                }}
                            >
                                Clear
                            </Button>
                        )}
                    </form>
                </div>
            </div>

            {errorMessage && (
                <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Patients Table */}
            {isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-xs text-foreground/50">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                    <span>Loading patient records...</span>
                </div>
            ) : patients.length === 0 ? (
                <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-12 text-center text-xs text-foreground/50">
                    {searchQuery ? "No patient records found matching your search." : "No consulted patients on record yet."}
                </div>
            ) : (
                <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-black/10 dark:border-white/10 text-foreground/50 uppercase tracking-wider text-[10px] bg-slate-50/40 dark:bg-zinc-800/20">
                                    <th className="py-3 px-4">Patient Name</th>
                                    <th className="py-3 px-4">File Number</th>
                                    <th className="py-3 px-4">Mobile</th>
                                    <th className="py-3 px-4">Age / Gender</th>
                                    <th className="py-3 px-4">Last Consultation</th>
                                    <th className="py-3 px-4">Upcoming Appointment</th>
                                    <th className="py-3 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {patients.map((pat) => (
                                    <tr
                                        key={pat.id}
                                        onClick={() => handleOpenProfile(pat.id)}
                                        className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                                    >
                                        <td className="py-3.5 px-4 font-bold text-foreground">
                                            {pat.name}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono font-semibold text-purple-600">
                                            {pat.file_number || "—"}
                                        </td>
                                        <td className="py-3.5 px-4 text-foreground/70">
                                            {pat.mobile_number}
                                        </td>
                                        <td className="py-3.5 px-4 text-foreground/80">
                                            {formatAgeGender(pat)}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-foreground/70">
                                            {formatDateTable(pat.last_consultation_date)}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {pat.upcoming_appointment ? (
                                                <div className="flex flex-col">
                                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                        {formatDateTable(pat.upcoming_appointment.appointment_date)}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-foreground/50">
                                                        {formatTime12h(pat.upcoming_appointment.start_time)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-foreground/40">None scheduled</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenProfile(pat.id);
                                                }}
                                                className="text-xs"
                                            >
                                                View Profile
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {meta.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 px-4 py-3 bg-slate-50/50 dark:bg-zinc-800/40 text-xs text-foreground/60">
                            <span>Page {meta.current_page} of {meta.last_page}</span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                                    disabled={page >= meta.last_page}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CONSOLIDATED PATIENT PROFILE MODAL */}
            {selectedPatientId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4 bg-slate-50/50 dark:bg-zinc-800/50">
                            <div>
                                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <User className="h-4 w-4 text-purple-600" />
                                    {profileData?.patient.name || "Patient Profile"}
                                </h2>
                                <div className="text-xs text-foreground/50 mt-0.5">
                                    File: <span className="font-mono text-purple-600 font-bold">{profileData?.patient.file_number || "None"}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedPatientId(null)}
                                className="rounded-lg p-1.5 text-foreground/60 hover:bg-black/5 dark:hover:bg-white/5"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {isLoadingProfile ? (
                            <div className="flex h-64 items-center justify-center gap-2 text-xs text-foreground/50">
                                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                                Loading consolidated medical history...
                            </div>
                        ) : profileData ? (
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Basic Information Card */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 p-4 border border-black/5 dark:border-white/5 text-xs">
                                    <div>
                                        <span className="text-foreground/50 text-[11px] block">Contact Number</span>
                                        <span className="font-bold text-foreground mt-0.5 block">{profileData.patient.mobile_number || "—"}</span>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50 text-[11px] block">Patient Notes</span>
                                        <span className="text-foreground mt-0.5 block">{profileData.patient.notes || "—"}</span>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50 text-[11px] block">Age / Gender</span>
                                        <span className="text-foreground mt-0.5 block">
                                            {formatAgeGender(profileData.patient)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50 text-[11px] block">Registration Date</span>
                                        <span className="font-mono text-foreground mt-0.5 block">{formatDateTable(profileData.patient.registration_date)}</span>
                                    </div>
                                </div>

                                {/* Tab Navigation */}
                                <div className="flex border-b border-black/10 dark:border-white/10 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("history")}
                                        className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === "history"
                                                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                                                : "border-transparent text-foreground/60 hover:text-foreground"
                                            }`}
                                    >
                                        <History className="h-3.5 w-3.5" />
                                        Consultation History ({profileData.consultations.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("appointments")}
                                        className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === "appointments"
                                                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                                                : "border-transparent text-foreground/60 hover:text-foreground"
                                            }`}
                                    >
                                        <Calendar className="h-3.5 w-3.5" />
                                        Appointment History ({profileData.appointments.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("physio")}
                                        className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === "physio"
                                                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                                                : "border-transparent text-foreground/60 hover:text-foreground"
                                            }`}
                                    >
                                        <Activity className="h-3.5 w-3.5" />
                                        Physiotherapy ({profileData.physiotherapy_referrals.length})
                                    </button>
                                </div>

                                {/* TAB 1: CONSULTATION HISTORY */}
                                {activeTab === "history" && (
                                    <div className="space-y-3">
                                        {profileData.consultations.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center text-xs text-foreground/50">
                                                No completed clinical consultations on record.
                                            </div>
                                        ) : (
                                            profileData.consultations.map((c) => (
                                                <div
                                                    key={c.id}
                                                    className="rounded-xl border border-black/10 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-800/30 p-4 text-xs space-y-2"
                                                >
                                                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                                                        <div>
                                                            <span className="font-bold text-foreground">
                                                                {formatDateTable(c.consultation_date)} • Dr. {c.doctor_name}
                                                            </span>
                                                        </div>
                                                        {c.referred_to_physio ? (
                                                            <span className="rounded bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 px-2 py-0.5 text-[10px] font-bold">
                                                                Referred to Physio
                                                            </span>
                                                        ) : (
                                                            <span className="rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                                                                Completed
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                                        <div className="rounded-lg border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/60 p-3">
                                                            <span className="text-[11px] font-bold text-foreground/70 block mb-1">
                                                                Appointment Notes:
                                                            </span>
                                                            <p className="text-foreground/85 whitespace-pre-wrap leading-relaxed">
                                                                {c.appointment_notes || "No appointment notes recorded."}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-lg border border-purple-200/80 bg-purple-50/30 dark:border-purple-900/40 dark:bg-purple-950/20 p-3">
                                                            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 block mb-1">
                                                                Doctor's Remarks:
                                                            </span>
                                                            <p className="text-foreground/85 whitespace-pre-wrap leading-relaxed">
                                                                {c.remarks || c.doctor_remarks || "No clinical remarks recorded."}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {c.physiotherapy_instructions && (
                                                        <div className="rounded-lg bg-teal-50 dark:bg-teal-950/20 p-2.5 border border-teal-200 dark:border-teal-900 text-[11px] text-teal-900 dark:text-teal-300">
                                                            <strong className="block">Physio Instructions:</strong>
                                                            {c.physiotherapy_instructions}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* TAB 2: APPOINTMENT HISTORY */}
                                {activeTab === "appointments" && (
                                    <div className="space-y-2">
                                        {profileData.appointments.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center text-xs text-foreground/50">
                                                No appointment records found.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs">
                                                    <thead>
                                                        <tr className="border-b border-black/10 dark:border-white/10 text-foreground/50 uppercase tracking-wider text-[10px]">
                                                            <th className="py-2.5 px-3">Date</th>
                                                            <th className="py-2.5 px-3">Ref</th>
                                                            <th className="py-2.5 px-3">Slot</th>
                                                            <th className="py-2.5 px-3">Type</th>
                                                            <th className="py-2.5 px-3">Doctor</th>
                                                            <th className="py-2.5 px-3">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                                        {profileData.appointments.map((apt) => (
                                                            <tr key={apt.id}>
                                                                <td className="py-2.5 px-3 font-mono font-medium">{formatDateTable(apt.appointment_date)}</td>
                                                                <td className="py-2.5 px-3 font-mono text-purple-600">{apt.reference}</td>
                                                                <td className="py-2.5 px-3 font-mono">{formatTime12h(apt.start_time)}</td>
                                                                <td className="py-2.5 px-3 capitalize">{apt.appointment_type.replace(/_/g, " ")}</td>
                                                                <td className="py-2.5 px-3">{apt.doctor?.name || "Doctor"}</td>
                                                                <td className="py-2.5 px-3">
                                                                    <span className="rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase">
                                                                        {apt.status.replace(/_/g, " ")}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 3: PHYSIOTHERAPY REFERRALS */}
                                {activeTab === "physio" && (
                                    <div className="space-y-3">
                                        {profileData.physiotherapy_referrals.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center text-xs text-foreground/50">
                                                No physiotherapy referrals on record.
                                            </div>
                                        ) : (
                                            profileData.physiotherapy_referrals.map((r) => (
                                                <div
                                                    key={r.id}
                                                    className="rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/20 dark:bg-teal-950/10 p-4 text-xs space-y-2"
                                                >
                                                    <div className="flex items-center justify-between border-b border-teal-200/50 dark:border-teal-900/50 pb-2">
                                                        <div>
                                                            <span className="font-bold text-teal-800 dark:text-teal-300">
                                                                Referral Date: {formatDateTable(r.referral_date)}
                                                            </span>
                                                            <span className="text-[11px] text-foreground/60 ml-2">
                                                                by {r.referring_doctor}
                                                            </span>
                                                        </div>
                                                        <span className="rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-300 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                                                            {r.status}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-foreground block mb-0.5">
                                                            Treatment Instructions:
                                                        </span>
                                                        <p className="text-foreground/90 whitespace-pre-wrap">{r.treatment_instructions}</p>
                                                    </div>
                                                    {r.completion_notes && (
                                                        <div className="rounded-lg bg-white dark:bg-zinc-800 p-2.5 border border-teal-200 dark:border-teal-900 text-[11px]">
                                                            <strong className="block text-teal-800 dark:text-teal-300">Physiotherapist Completion Notes:</strong>
                                                            <p className="mt-0.5 text-foreground/80">{r.completion_notes}</p>
                                                            {r.completed_at && (
                                                                <span className="text-[10px] text-foreground/40 mt-1 block">Completed at: {r.completed_at}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : null}

                        <div className="flex justify-end border-t border-black/10 dark:border-white/10 px-6 py-3 bg-slate-50/80 dark:bg-zinc-800/80">
                            <Button variant="outline" size="sm" onClick={() => setSelectedPatientId(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
