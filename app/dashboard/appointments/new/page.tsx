"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ChevronLeft,
    Calendar,
    Clock,
    User,
    Phone,
    FileText,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Plus,
    UserPlus,
    ArrowRight,
    Search,
    Stethoscope,
    Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlatpickrDob } from "@/components/ui/flatpickr-dob";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { api, ApiError } from "@/lib/api";
import { getPatientAge } from "@/lib/patient-utils";

const MONTH_NAMES_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatConfirmationDateTime(dateStr: string | null | undefined, timeStr: string | null | undefined): string {
    if (!dateStr) return "";
    const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.split(" ")[0];
    const parts = cleanDate.split("-");
    let formattedDate = cleanDate;
    if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parts[2].padStart(2, "0");
        const monthName = MONTH_NAMES_SHORT[monthIndex] || parts[1];
        formattedDate = `${day}-${monthName}-${year}`;
    }

    if (!timeStr) return formattedDate;

    let formattedTime = timeStr.trim();
    const match12h = formattedTime.match(/^(\d{1,2}):(\d{2})(\s)?(AM|PM)$/i);
    if (match12h) {
        const h = match12h[1].padStart(2, "0");
        const m = match12h[2];
        const p = match12h[4].toUpperCase();
        formattedTime = `${h}:${m} ${p}`;
    } else {
        const cleanTime = formattedTime.includes("T") ? formattedTime.split("T")[1] : formattedTime;
        const timeParts = cleanTime.slice(0, 5).split(":");
        if (timeParts.length === 2) {
            const h = parseInt(timeParts[0], 10);
            const m = timeParts[1];
            const period = h >= 12 ? "PM" : "AM";
            const hour12 = h % 12 === 0 ? 12 : h % 12;
            const hour12Pad = String(hour12).padStart(2, "0");
            formattedTime = `${hour12Pad}:${m} ${period}`;
        }
    }

    return `${formattedDate} ${formattedTime}`;
}

interface PatientResult {
    id: number;
    name: string;
    mobile_number: string;
    alternate_contact_number?: string | null;
    file_number?: string | null;
    date_of_birth?: string | null;
    age?: number | null;
    gender?: string | null;
    registration_date?: string | null;
}

interface DoctorItem {
    id: number;
    name: string;
    specialization: string;
    slot_duration?: number;
}

interface SlotItem {
    start_time: string;
    start_time_24: string;
    end_time: string;
    end_time_24: string;
    is_available: boolean;
}

interface PhysioItem {
    id: number;
    name: string;
}

export default function NewAppointmentPage() {
    const router = useRouter();

    // Step 1: Appointment Type
    const [appointmentType, setAppointmentType] = useState<"new_registration" | "review_consultation" | "procedure">("review_consultation");

    // Step 2: Patient Search & Selection
    const [searchType, setSearchType] = useState<"mobile" | "file_number">("mobile");
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchingPatient, setIsSearchingPatient] = useState(false);
    const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    // Inline Register New Patient
    const [showInlineRegister, setShowInlineRegister] = useState(false);
    const [newName, setNewName] = useState("");
    const [newMobile, setNewMobile] = useState("");
    const [newAltMobile, setNewAltMobile] = useState("");
    const [newDob, setNewDob] = useState("");
    const [newGender, setNewGender] = useState<"M" | "F" | "O" | "">("");
    const [isRegisteringPatient, setIsRegisteringPatient] = useState(false);
    const [registerError, setRegisterError] = useState<string | null>(null);

    // Calculate age from date of birth
    const calculatedAge = React.useMemo(() => {
        if (!newDob) return null;
        const birthDate = new Date(newDob);
        if (isNaN(birthDate.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 0 ? age : null;
    }, [newDob]);

    // Step 3: Doctor, Date, Slots
    const [doctors, setDoctors] = useState<DoctorItem[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState<number | "">("");
    const [appointmentDate, setAppointmentDate] = useState(() => {
        const today = new Date();
        return today.toISOString().slice(0, 10);
    });
    const [slots, setSlots] = useState<SlotItem[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string>("");
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [slotsMessage, setSlotsMessage] = useState<string | null>(null);
    const [slotsRefreshKey, setSlotsRefreshKey] = useState(0);

    const refetchSlots = useCallback(() => {
        setSlotsRefreshKey((k) => k + 1);
    }, []);

    // Step 4: Procedure (Optional Physio)
    const [physiotherapists, setPhysiotherapists] = useState<PhysioItem[]>([]);
    const [selectedPhysioId, setSelectedPhysioId] = useState<number | "">("");

    // Step 5: Options & Notes
    const [internalNotes, setInternalNotes] = useState("");
    const [sendWhatsApp, setSendWhatsApp] = useState(true);

    // Step 6: Submission & Success
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const [createdAppointment, setCreatedAppointment] = useState<any | null>(null);

    // Load initial metadata (doctors, physiotherapists)
    useEffect(() => {
        api.getPublicDoctors()
            .then((res) => {
                if (res.data && res.data.length > 0) {
                    setDoctors(res.data);
                    setSelectedDoctorId(res.data[0].id);
                }
            })
            .catch(() => { });

        api.getAppointments({ tab: "all" })
            .then((res) => {
                if (res.physiotherapists) {
                    setPhysiotherapists(res.physiotherapists);
                }
            })
            .catch(() => { });
    }, []);

    // Debounced Patient Search
    useEffect(() => {
        if (selectedPatient) return;

        const trimmed = searchQuery.trim();
        if (trimmed.length < 2) {
            setPatientResults([]);
            setHasSearched(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingPatient(true);
            try {
                const res = await api.searchPatients(trimmed, searchType);
                const results = res.data || [];
                setPatientResults(results);
                setHasSearched(true);
                if (searchType === "mobile" && results.length === 0) {
                    setNewMobile(trimmed);
                }
            } catch {
                setPatientResults([]);
                setHasSearched(true);
                if (searchType === "mobile") {
                    setNewMobile(trimmed);
                }
            } finally {
                setIsSearchingPatient(false);
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [searchQuery, searchType, selectedPatient]);

    // Slots Loading when doctor, date or appointment type changes, or when refreshed
    useEffect(() => {
        if (!selectedDoctorId || !appointmentDate) {
            setSlots([]);
            return;
        }

        setIsLoadingSlots(true);
        setSelectedSlot("");
        setSlotsMessage(null);

        api.getDoctorSlots(Number(selectedDoctorId), appointmentDate, appointmentType)
            .then((res) => {
                setSlots(res.slots || []);
                if (res.message) {
                    setSlotsMessage(res.message);
                }
            })
            .catch((err) => {
                setSlots([]);
                setSlotsMessage(err.message || "Failed to load slots.");
            })
            .finally(() => {
                setIsLoadingSlots(false);
            });
    }, [selectedDoctorId, appointmentDate, appointmentType, slotsRefreshKey]);

    // Handle Inline New Patient Registration
    const handleRegisterPatientInline = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegisterError(null);

        if (!newName.trim() || !newMobile.trim()) {
            setRegisterError("Patient name and primary mobile number are mandatory.");
            return;
        }

        setIsRegisteringPatient(true);
        try {
            const res = await api.registerPatientInline({
                name: newName.trim(),
                mobile_number: newMobile.trim(),
                alternate_contact_number: newAltMobile.trim() || undefined,
                date_of_birth: newDob || undefined,
                gender: newGender ? (newGender as "M" | "F" | "O") : undefined,
                allow_duplicate: true,
            });

            setSelectedPatient(res.patient);
            setShowInlineRegister(false);
            setSearchQuery("");
            setPatientResults([]);
            setNewName("");
            setNewMobile("");
            setNewAltMobile("");
            setNewDob("");
            setNewGender("");
        } catch (err: any) {
            setRegisterError(err.message || "Failed to register patient.");
        } finally {
            setIsRegisteringPatient(false);
        }
    };

    // Handle Appointment Submission
    const handleSaveAppointment = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmissionError(null);

        if (!selectedPatient && (!newName.trim() || !newMobile.trim())) {
            setSubmissionError("Please select an existing patient or enter Full Name and Mobile Number to register a new patient.");
            return;
        }

        if (!selectedDoctorId) {
            setSubmissionError("Please select a doctor.");
            return;
        }

        if (!appointmentDate) {
            setSubmissionError("Please select an appointment date.");
            return;
        }

        if (!selectedSlot) {
            setSubmissionError("Please choose an available time slot.");
            return;
        }

        setIsSubmitting(true);
        try {
            let patientToBook = selectedPatient;

            if (!patientToBook) {
                const regRes = await api.registerPatientInline({
                    name: newName.trim(),
                    mobile_number: newMobile.trim(),
                    alternate_contact_number: newAltMobile.trim() || undefined,
                    date_of_birth: newDob || undefined,
                    gender: newGender || undefined,
                });
                patientToBook = regRes.patient;
                setSelectedPatient(patientToBook);
                setShowInlineRegister(false);
            }

            const bookedSlot = selectedSlot;
            const res = await api.createReceptionistAppointment({
                patient_id: patientToBook.id,
                doctor_id: Number(selectedDoctorId),
                appointment_type: appointmentType,
                appointment_date: appointmentDate,
                start_time: selectedSlot,
                assigned_physio_id: appointmentType === "procedure" && selectedPhysioId ? Number(selectedPhysioId) : undefined,
                internal_notes: internalNotes.trim() || undefined,
                send_whatsapp: sendWhatsApp,
            });

            // Optimistically mark the booked slot as unavailable in current slots state
            setSlots((prev) =>
                prev.map((s) =>
                    s.start_time_24 === bookedSlot || s.start_time === bookedSlot
                        ? { ...s, is_available: false }
                        : s
                )
            );

            setCreatedAppointment(res.appointment);
            refetchSlots();
        } catch (err: any) {
            setSubmissionError(err.message || "Failed to create appointment.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset everything for "New Appointment"
    const handleReset = () => {
        setCreatedAppointment(null);
        setSelectedPatient(null);
        setSearchQuery("");
        setPatientResults([]);
        setShowInlineRegister(false);
        setNewName("");
        setNewMobile("");
        setNewAltMobile("");
        setNewDob("");
        setNewGender("");
        setSelectedSlot("");
        setInternalNotes("");
        setSubmissionError(null);
        setRegisterError(null);
        refetchSlots();
    };

    return (
        <div className="flex w-full flex-col gap-6 p-6 sm:p-8 max-w-4xl mx-auto">
            {/* Top Navigation Back */}
            <div className="flex items-center justify-between">
                <Link
                    href="/dashboard/receptionist"
                    className="flex items-center gap-2 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Receptionist Dashboard
                </Link>
                <Link
                    href="/dashboard/appointments"
                    className="text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400"
                >
                    View All Appointments
                </Link>
            </div>

            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    New Patient Appointment
                </h1>
            </div>

            {/* Notifications / Errors */}
            {submissionError && (
                <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                    <span>{submissionError}</span>
                </div>
            )}

            {/* SUCCESS STATE */}
            {createdAppointment ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 p-8 sm:p-12 text-center space-y-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>

                    <div>
                        <span className="inline-block rounded-md bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 mb-2">
                            Appointment Confirmed
                        </span>
                        <h2 className="text-2xl font-bold">Booking Reference: {createdAppointment.reference}</h2>
                    </div>

                    {/* Summary Card */}
                    <div className="w-full max-w-md rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/40 p-5 text-left text-sm space-y-3">
                        <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-2">
                            <span className="text-foreground/60">Patient Name</span>
                            <span className="font-semibold">{createdAppointment.patient?.name}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-2">
                            <span className="text-foreground/60">File Number</span>
                            <span className="font-mono font-medium">{createdAppointment.patient?.file_number || "None (New Patient)"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-2">
                            <span className="text-foreground/60">Doctor</span>
                            <span className="font-semibold">{createdAppointment.doctor?.name}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-2">
                            <span className="text-foreground/60">Date & Time</span>
                            <span className="font-semibold text-purple-700 dark:text-purple-300">
                                {formatConfirmationDateTime(createdAppointment.appointment_date, createdAppointment.start_time)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-foreground/60">Appointment Type</span>
                            <span className="capitalize font-medium">{createdAppointment.appointment_type?.replace(/_/g, " ")}</span>
                        </div>
                        {createdAppointment.assigned_physiotherapist && (
                            <div className="flex justify-between items-center border-t border-black/5 dark:border-white/5 pt-2">
                                <span className="text-foreground/60">Assigned Physiotherapist</span>
                                <span className="font-semibold">{createdAppointment.assigned_physiotherapist.name}</span>
                            </div>
                        )}
                    </div>

                    {sendWhatsApp && (
                        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2 rounded-lg">
                            <WhatsAppIcon className="h-4 w-4 shrink-0" />
                            <span>WhatsApp confirmation message dispatched to {createdAppointment.patient?.mobile_number}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <Button
                            variant="filled"
                            onClick={handleReset}
                            icon={Plus}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            Book Another Appointment
                        </Button>
                        <Link href="/dashboard/appointments">
                            <Button variant="outline">
                                View Appointment in Ledger
                            </Button>
                        </Link>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSaveAppointment} className="space-y-6">
                    {/* CARD 2: PATIENT AUTO-LOOKUP & SELECTION */}
                    <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                    <User className="h-4 w-4" /> Patient Lookup
                                </h2>
                                <p className="text-xs text-foreground/60 mt-0.5">
                                    Search registered patients by mobile number or file number
                                </p>
                            </div>

                            {!selectedPatient && (
                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <div className="flex items-center rounded-lg border border-black/10 dark:border-white/10 p-0.5 bg-zinc-100 dark:bg-zinc-800 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchType("mobile");
                                            setPatientResults([]);
                                            setHasSearched(false);
                                        }}
                                        className={`px-3 py-1.5 rounded-md font-medium transition-all ${searchType === "mobile"
                                            ? "bg-white dark:bg-zinc-900 text-foreground"
                                            : "text-foreground/60 hover:text-foreground"
                                            }`}
                                    >
                                        Mobile Number
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchType("file_number");
                                            setPatientResults([]);
                                            setHasSearched(false);
                                        }}
                                        className={`px-3 py-1.5 rounded-md font-medium transition-all ${searchType === "file_number"
                                            ? "bg-white dark:bg-zinc-900 text-foreground"
                                            : "text-foreground/60 hover:text-foreground"
                                            }`}
                                    >
                                        File Number
                                    </button>
                                </div>
                            </div>
                        )}
                        </div>

                        {/* SELECTED PATIENT SUMMARY */}
                        {selectedPatient ? (
                            <div className="flex items-center justify-between rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20 p-5">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white font-bold text-lg shrink-0">
                                        {selectedPatient.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <h3 className="text-base font-bold text-foreground">{selectedPatient.name}</h3>
                                            {selectedPatient.file_number ? (
                                                <span className="rounded bg-purple-200 dark:bg-purple-900/60 px-2.5 py-0.5 text-xs font-mono font-bold text-purple-900 dark:text-purple-200">
                                                    {selectedPatient.file_number}
                                                </span>
                                            ) : (
                                                <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                                                    New Patient (No File #)
                                                </span>
                                            )}
                                            {selectedPatient.gender && (
                                                <span className="rounded bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-foreground/80">
                                                    {selectedPatient.gender === "M" ? "Male" : selectedPatient.gender === "F" ? "Female" : "Other"}
                                                </span>
                                            )}
                                            {getPatientAge(selectedPatient) !== null && (
                                                <span className="rounded bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-foreground/80">
                                                    Age: {getPatientAge(selectedPatient)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-foreground/60 flex flex-wrap items-center gap-2 mt-1">
                                            <span>{selectedPatient.mobile_number}</span>
                                            {selectedPatient.alternate_contact_number && (
                                                <span>• Alt: {selectedPatient.alternate_contact_number}</span>
                                            )}
                                            {selectedPatient.registration_date && (
                                                <span>• Registered: {selectedPatient.registration_date}</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedPatient(null);
                                        setShowInlineRegister(false);
                                    }}
                                >
                                    Change Patient
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setShowInlineRegister(false);
                                        }}
                                        placeholder={
                                            searchType === "mobile"
                                                ? "Type patient mobile number..."
                                                : "Type patient file number (e.g. 1001 or FILE-1001)..."
                                        }
                                        className="w-full rounded-xl border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 py-2.5 pl-10 pr-10 text-sm placeholder:text-foreground/40 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                                    />
                                    {isSearchingPatient && (
                                        <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-purple-600" />
                                    )}
                                </div>

                                {/* Results List */}
                                {patientResults.length > 0 && (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-xs font-semibold text-foreground/70">
                                                {patientResults.length} matching {patientResults.length === 1 ? "patient" : "patients"} found
                                            </span>
                                        </div>

                                        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 divide-y divide-black/5 dark:divide-white/5 overflow-hidden max-h-60 overflow-y-auto">
                                            {patientResults.map((p) => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => {
                                                        setSelectedPatient(p);
                                                        setPatientResults([]);
                                                        setSearchQuery("");
                                                        setShowInlineRegister(false);
                                                    }}
                                                    className="flex items-center justify-between p-3.5 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 cursor-pointer transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-700 font-semibold text-xs text-foreground/70">
                                                            {p.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-foreground">{p.name}</p>
                                                            <p className="text-xs text-foreground/60">{p.mobile_number}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {p.file_number && (
                                                            <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 font-semibold text-foreground/80">
                                                                {p.file_number}
                                                            </span>
                                                        )}
                                                        <ArrowRight className="h-4 w-4 text-foreground/40" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* No Patient Found */}
                                {hasSearched && patientResults.length === 0 && !isSearchingPatient && (
                                    <div className="rounded-xl border border-dashed border-red-300 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 p-5 text-center">
                                        <p className="text-sm text-red-600 dark:text-red-400 font-semibold flex items-center justify-center gap-1.5">
                                            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                                            No patient record found matching "{searchQuery}"
                                        </p>
                                    </div>
                                )}

                                {/* Inline Registration Form */}
                                {((hasSearched && !patientResults.some((p) => {
                                    if (searchType === "mobile") {
                                        const qDigits = searchQuery.trim().replace(/\D/g, "");
                                        const pDigits = (p.mobile_number || "").replace(/\D/g, "");
                                        return qDigits !== "" && pDigits === qDigits;
                                    }
                                    return searchQuery.trim() !== "" && (p.file_number || "").toLowerCase() === searchQuery.trim().toLowerCase();
                                })) || showInlineRegister) && (
                                    <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/20 p-5 space-y-3.5">
                                        <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-900/50 pb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                                                <UserPlus className="h-3.5 w-3.5" /> Quick Patient Registration
                                            </span>
                                           
                                        </div>

                                        {registerError && (
                                            <div className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                                {registerError}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                            <div>
                                                <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                                    Patient Full Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newName}
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    placeholder=""
                                                    className="w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-2.5 text-xs focus:border-purple-600 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                                    Mobile Number *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newMobile}
                                                    onChange={(e) => setNewMobile(e.target.value)}
                                                    placeholder=""
                                                    className="w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-2.5 text-xs focus:border-purple-600 focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                            <div>
                                                <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                                    Alternate Contact / WhatsApp (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newAltMobile}
                                                    onChange={(e) => setNewAltMobile(e.target.value)}
                                                    placeholder=""
                                                    className="w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-2.5 text-xs focus:border-purple-600 focus:outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                                    Gender (M, F, O)
                                                </label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {(["M", "F", "O"] as const).map((g) => (
                                                        <button
                                                            key={g}
                                                            type="button"
                                                            onClick={() => setNewGender(g)}
                                                            className={`py-2 text-xs font-bold rounded-lg border transition-all ${newGender === g
                                                                ? "border-purple-600 bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200"
                                                                : "border-black/15 dark:border-white/15 bg-white dark:bg-zinc-800 text-foreground/70 hover:text-foreground"
                                                                }`}
                                                        >
                                                            {g === "M" ? "Male (M)" : g === "F" ? "Female (F)" : "Other (O)"}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                            <div>
                                                <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                                    Date of Birth (DD-MM-YYYY)
                                                </label>
                                                <FlatpickrDob
                                                    value={newDob}
                                                    onChange={setNewDob}
                                                    placeholder="DD-MM-YYYY"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                                Age
                                                </label>
                                                <div className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800/60 p-2.5 text-xs font-medium text-foreground/80 flex items-center h-[38px] mt-0.5">
                                                    {calculatedAge !== null ? `${calculatedAge} years old` : "Select DOB"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* CARD 3: DOCTOR & DATE SELECTION */}
                    <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900 space-y-4">
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                <Stethoscope className="h-4 w-4" /> Doctor & Schedule Date
                            </h2>
                            <p className="text-xs text-foreground/60 mt-0.5">
                                Select active consultant and desired booking date
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-foreground/70 mb-1.5">
                                    Doctor / Consultant *
                                </label>
                                <select
                                    value={selectedDoctorId}
                                    onChange={(e) => setSelectedDoctorId(e.target.value ? Number(e.target.value) : "")}
                                    className="w-full rounded-xl border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 py-2.5 px-3 text-sm focus:border-purple-600 focus:outline-none"
                                >
                                    <option value="" disabled>Select Doctor...</option>
                                    {doctors.map((doc) => (
                                        <option key={doc.id} value={doc.id}>
                                            {doc.name} {doc.specialization ? `(${doc.specialization})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-foreground/70 mb-1.5">
                                    Appointment Date *
                                </label>
                                <input
                                    type="date"
                                    min={new Date().toISOString().slice(0, 10)}
                                    value={appointmentDate}
                                    onChange={(e) => setAppointmentDate(e.target.value)}
                                    className="w-full rounded-xl border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 py-2 px-3 text-sm focus:border-purple-600 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* CARD 4: AVAILABLE TIME SLOTS */}
                    <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> Available Time Slots
                                </h2>
                                
                            </div>
                            {isLoadingSlots && (
                                <span className="flex items-center gap-1.5 text-xs text-purple-600">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching slots...
                                </span>
                            )}
                        </div>

                        {slotsMessage && !isLoadingSlots && slots.length === 0 && (
                            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 text-xs text-amber-900 dark:text-amber-200">
                                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                                <div>
                                    <span className="font-bold">Date Unavailable: </span>
                                    <span>{slotsMessage}</span>
                                    <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80">
                                        Please select another appointment date or consult the Clinic Schedule & Active Exclusions calendar.
                                    </p>
                                </div>
                            </div>
                        )}

                        {!isLoadingSlots && slots.length > 0 && (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto p-1">
                                {slots.map((slot, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        disabled={!slot.is_available}
                                        onClick={() => setSelectedSlot(slot.start_time_24)}
                                        className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold transition-all ${!slot.is_available
                                            ? "border-black/5 bg-zinc-100 text-foreground/30 dark:border-white/5 dark:bg-zinc-800/40 cursor-not-allowed line-through"
                                            : selectedSlot === slot.start_time_24
                                                ? "border-purple-600 bg-purple-600 text-white shadow-none ring-1 ring-purple-600"
                                                : "border-black/10 dark:border-white/10 hover:border-purple-500 bg-white dark:bg-zinc-800 text-foreground hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
                                            }`}
                                    >
                                        {slot.start_time}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* CARD 5: PROCEDURE PHYSIOTHERAPIST (IF APPLICABLE) */}
                    {appointmentType === "procedure" && (
                        <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900 space-y-3">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                <Activity className="h-4 w-4" /> Physiotherapist Assignment (Optional)
                            </h2>
                            <p className="text-xs text-foreground/60">
                                Assign this therapy procedure directly to an active physiotherapist queue:
                            </p>
                            <select
                                value={selectedPhysioId}
                                onChange={(e) => setSelectedPhysioId(e.target.value ? Number(e.target.value) : "")}
                                className="w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-2.5 text-sm focus:border-purple-600 focus:outline-none"
                            >
                                <option value="">-- No specific physiotherapist assigned --</option>
                                {physiotherapists.map((physio) => (
                                    <option key={physio.id} value={physio.id}>
                                        {physio.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* CARD 6: NOTES & CONFIRMATION */}
                    <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900 space-y-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-2">
                            <FileText className="h-4 w-4" /> {appointmentType === "procedure" ? "6" : "5"}. Internal Notes & Notifications
                        </h2>

                        <div>
                            <label className="block text-xs font-semibold text-foreground/70 mb-1.5">
                                Internal Front Desk Notes (Optional)
                            </label>
                            <textarea
                                value={internalNotes}
                                onChange={(e) => setInternalNotes(e.target.value)}
                                placeholder="Add any special patient notes, clinical symptoms, or referral details..."
                                rows={3}
                                className="w-full rounded-xl border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-3 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                            />
                        </div>


                        
                        {/*<div className="flex items-center gap-2.5 pt-1">
                            <input
                                type="checkbox"
                                id="page_send_whatsapp_toggle"
                                checked={sendWhatsApp}
                                onChange={(e) => setSendWhatsApp(e.target.checked)}
                                className="h-4 w-4 rounded border-black/20 text-purple-600 focus:ring-purple-500"
                            />
                            <label htmlFor="page_send_whatsapp_toggle" className="text-xs font-medium text-foreground/80 flex items-center gap-1.5 cursor-pointer">
                                <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                Send immediate WhatsApp confirmation message to patient upon booking
                            </label>
                        </div> */}

                        <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-black/5 dark:border-white/5">
                            <Link href="/dashboard/receptionist">
                                <Button type="button" variant="outline" disabled={isSubmitting}>
                                    Cancel
                                </Button>
                            </Link>
                            <Button
                                type="submit"
                                variant="filled"
                                disabled={isSubmitting || (!selectedPatient && (!newName.trim() || !newMobile.trim())) || !selectedSlot}
                                className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                {isSubmitting ? "Confirming Appointment..." : "Save & Confirm Appointment"}
                            </Button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
}
