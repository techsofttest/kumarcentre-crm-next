"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    X,
    Search,
    User,
    Calendar,
    Clock,
    Phone,
    FileText,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Plus,
    UserPlus,
    ArrowRight,
    Sparkles,
    Stethoscope,
    Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { api, ApiError } from "@/lib/api";

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

export interface NewAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface PatientResult {
    id: number;
    name: string;
    mobile_number: string;
    alternate_contact_number?: string | null;
    file_number?: string | null;
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

export function NewAppointmentModal({ isOpen, onClose, onSuccess }: NewAppointmentModalProps) {
    // Step 1: Appointment Type
    const [appointmentType, setAppointmentType] = useState<"new_registration" | "review_consultation" | "procedure">("new_registration");

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
    const [isRegisteringPatient, setIsRegisteringPatient] = useState(false);
    const [registerError, setRegisterError] = useState<string | null>(null);

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
        if (!isOpen) return;

        api.getPublicDoctors()
            .then((res) => {
                if (res.data && res.data.length > 0) {
                    setDoctors(res.data);
                    if (!selectedDoctorId) {
                        setSelectedDoctorId(res.data[0].id);
                    }
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
    }, [isOpen]);

    // Debounced Patient Search
    useEffect(() => {
        if (!isOpen) return;
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
                setPatientResults(res.data || []);
                setHasSearched(true);
            } catch (err) {
                setPatientResults([]);
                setHasSearched(true);
            } finally {
                setIsSearchingPatient(false);
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [searchQuery, searchType, selectedPatient, isOpen]);

    // Slots Loading when doctor, date or appointment type changes
    useEffect(() => {
        if (!isOpen || !selectedDoctorId || !appointmentDate) {
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
    }, [selectedDoctorId, appointmentDate, appointmentType, isOpen]);

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
            });

            setSelectedPatient(res.patient);
            setShowInlineRegister(false);
            setSearchQuery("");
            setPatientResults([]);
        } catch (err: any) {
            if (err.status === 409 && err.data?.patient) {
                setRegisterError("A patient with this mobile number already exists. You can select them directly.");
                setPatientResults([err.data.patient]);
            } else {
                setRegisterError(err.message || "Failed to register patient.");
            }
        } finally {
            setIsRegisteringPatient(false);
        }
    };

    // Handle Appointment Submission
    const handleSaveAppointment = async () => {
        setSubmissionError(null);

        if (!selectedPatient) {
            setSubmissionError("Please select or register a patient.");
            return;
        }

        if (appointmentType !== "new_registration" && !selectedPatient.file_number) {
            setSubmissionError(`An existing patient file number is strictly required for ${appointmentType === "procedure" ? "Procedures" : "Review Consultations"}.`);
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
            const res = await api.createReceptionistAppointment({
                patient_id: selectedPatient.id,
                doctor_id: Number(selectedDoctorId),
                appointment_type: appointmentType,
                appointment_date: appointmentDate,
                start_time: selectedSlot,
                assigned_physio_id: appointmentType === "procedure" && selectedPhysioId ? Number(selectedPhysioId) : undefined,
                internal_notes: internalNotes.trim() || undefined,
                send_whatsapp: sendWhatsApp,
            });

            setCreatedAppointment(res.appointment);
            if (onSuccess) {
                onSuccess();
            }
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
        setSelectedSlot("");
        setInternalNotes("");
        setSubmissionError(null);
        setRegisterError(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
            <div className="relative w-full max-w-3xl rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 shadow-none my-8 max-h-[92vh] flex flex-col overflow-hidden text-foreground">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4 bg-zinc-50/80 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                            <Plus className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">New Receptionist Booking</h2>
                            <p className="text-xs text-foreground/60">Instant patient appointment creation & verified scheduling</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-foreground/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Error Banner */}
                    {submissionError && (
                        <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <span>{submissionError}</span>
                        </div>
                    )}

                    {/* SUCCESS STATE */}
                    {createdAppointment ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-5">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="h-8 w-8" />
                            </div>

                            <div>
                                <span className="inline-block rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 mb-2">
                                    Appointment Confirmed
                                </span>
                                <h3 className="text-2xl font-bold">Booking Reference: {createdAppointment.reference}</h3>
                            </div>

                            {/* Summary Card */}
                            <div className="w-full max-w-lg rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/40 p-5 text-left text-sm space-y-3">
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
                                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg">
                                    <WhatsAppIcon className="h-4 w-4" />
                                    <span>WhatsApp confirmation notification queued to {createdAppointment.patient?.mobile_number}</span>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={handleReset}
                                    icon={Plus}
                                >
                                    New Appointment
                                </Button>
                                <Button
                                    variant="filled"
                                    onClick={onClose}
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                >
                                    Close & View Ledger
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* STEP 1: APPOINTMENT TYPE */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-foreground/60 mb-2">
                                    1. Select Appointment Type
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        { id: "new_registration", label: "New Registration", desc: "First visit" },
                                        { id: "review_consultation", label: "Review Consultation", desc: "Existing patient file required" },
                                        { id: "procedure", label: "Procedure", desc: "Existing patient  & physio assignment" },
                                    ].map((type) => (
                                        <button
                                            key={type.id}
                                            type="button"
                                            onClick={() => {
                                                setAppointmentType(type.id as any);
                                                if (type.id !== "new_registration" && selectedPatient && !selectedPatient.file_number) {
                                                    setSelectedPatient(null);
                                                }
                                                setShowInlineRegister(false);
                                            }}
                                            className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${appointmentType === type.id
                                                ? "border-purple-600 bg-purple-50/60 dark:bg-purple-950/30 text-purple-950 dark:text-purple-100 ring-1 ring-purple-600"
                                                : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 bg-white dark:bg-zinc-800/40"
                                                }`}
                                        >
                                            <span className="text-sm font-bold">{type.label}</span>
                                            <span className="text-xs text-foreground/60 mt-0.5">{type.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* STEP 2: PATIENT SEARCH / SELECT */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                                        2. Patient Lookup
                                    </label>
                                    {!selectedPatient && (
                                        <div className="flex items-center rounded-lg border border-black/10 dark:border-white/10 p-0.5 bg-zinc-100 dark:bg-zinc-800 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearchType("mobile");
                                                    setPatientResults([]);
                                                    setHasSearched(false);
                                                }}
                                                className={`px-3 py-1 rounded-md font-medium transition-all ${searchType === "mobile"
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
                                                className={`px-3 py-1 rounded-md font-medium transition-all ${searchType === "file_number"
                                                    ? "bg-white dark:bg-zinc-900 text-foreground"
                                                    : "text-foreground/60 hover:text-foreground"
                                                    }`}
                                            >
                                                File Number
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* SELECTED PATIENT SUMMARY */}
                                {selectedPatient ? (
                                    <div className="flex items-center justify-between rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20 p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-600 text-white font-bold text-base shrink-0">
                                                {selectedPatient.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-base font-bold text-foreground">{selectedPatient.name}</h4>
                                                    {selectedPatient.file_number ? (
                                                        <span className="rounded bg-purple-200 dark:bg-purple-900/60 px-2 py-0.5 text-xs font-mono font-bold text-purple-900 dark:text-purple-200">
                                                            {selectedPatient.file_number}
                                                        </span>
                                                    ) : (
                                                        <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                                                            New Patient (No File #)
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-foreground/60 flex items-center gap-2 mt-0.5">
                                                    <span>{selectedPatient.mobile_number}</span>
                                                    {selectedPatient.alternate_contact_number && (
                                                        <span>• Alt: {selectedPatient.alternate_contact_number}</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
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
                                                        ? "Type mobile number (auto-searches on typing)..."
                                                        : "Type file number (e.g. 1001 or FILE-1001)..."
                                                }
                                                className="w-full rounded-xl border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800/80 py-2.5 pl-10 pr-10 text-sm placeholder:text-foreground/40 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                                            />
                                            {isSearchingPatient && (
                                                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-purple-600" />
                                            )}
                                        </div>

                                        {/* Search Results Dropdown / List */}
                                        {patientResults.length > 0 && (
                                            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 divide-y divide-black/5 dark:divide-white/5 overflow-hidden max-h-56 overflow-y-auto">
                                                {patientResults.map((p) => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => {
                                                            setSelectedPatient(p);
                                                            setPatientResults([]);
                                                            setSearchQuery("");
                                                        }}
                                                        className="flex items-center justify-between p-3 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 cursor-pointer transition-colors"
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
                                                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 font-semibold text-foreground/80">
                                                                    {p.file_number}
                                                                </span>
                                                            )}
                                                            <ArrowRight className="h-4 w-4 text-foreground/40" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* No Results Fallback */}
                                        {hasSearched && patientResults.length === 0 && !isSearchingPatient && (
                                            <div className="rounded-xl border border-dashed border-red-300 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 p-4 text-center">
                                                <p className="text-sm text-red-600 dark:text-red-400 font-semibold flex items-center justify-center gap-1.5">
                                                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                                                    No patient record found matching "{searchQuery}"
                                                </p>
                                                {appointmentType === "new_registration" ? (
                                                    <div className="mt-3">
                                                        <p className="text-xs text-foreground/50 mb-2">
                                                            You can register this new patient right away without leaving:
                                                        </p>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            icon={UserPlus}
                                                            onClick={() => {
                                                                setShowInlineRegister(true);
                                                                if (searchType === "mobile") {
                                                                    setNewMobile(searchQuery);
                                                                }
                                                            }}
                                                        >
                                                            Register New Patient Inline
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                                                        ⚠️ Existing patient file number is required for {appointmentType === "procedure" ? "Procedure" : "Review"}. Please check file number or register patient under New Registration.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* INLINE REGISTRATION FORM */}
                                        {showInlineRegister && appointmentType === "new_registration" && (
                                            <form onSubmit={handleRegisterPatientInline} className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/20 p-4 space-y-3">
                                                <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-900/50 pb-2">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                                                        <UserPlus className="h-3.5 w-3.5" /> Quick Patient Registration
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowInlineRegister(false)}
                                                        className="text-foreground/50 hover:text-foreground text-xs"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>

                                                {registerError && (
                                                    <div className="rounded bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                                        {registerError}
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                                            Patient Full Name *
                                                        </label>
                                                        <input
                                                            type="text"
                                                            required
                                                            value={newName}
                                                            onChange={(e) => setNewName(e.target.value)}
                                                            placeholder="e.g. Ramesh Menon"
                                                            className="w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-2 text-xs focus:border-purple-600 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                                            Mobile Number *
                                                        </label>
                                                        <input
                                                            type="text"
                                                            required
                                                            value={newMobile}
                                                            onChange={(e) => setNewMobile(e.target.value)}
                                                            placeholder="e.g. 9847123456"
                                                            className="w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-2 text-xs focus:border-purple-600 focus:outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                                        Alternate Mobile / WhatsApp (Optional)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={newAltMobile}
                                                        onChange={(e) => setNewAltMobile(e.target.value)}
                                                        placeholder="e.g. 9847999999"
                                                        className="w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-2 text-xs focus:border-purple-600 focus:outline-none"
                                                    />
                                                </div>

                                                <div className="flex justify-end pt-1">
                                                    <Button
                                                        type="submit"
                                                        variant="filled"
                                                        size="sm"
                                                        disabled={isRegisteringPatient}
                                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                                    >
                                                        {isRegisteringPatient ? (
                                                            <>
                                                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                Registering...
                                                            </>
                                                        ) : (
                                                            "Save & Select Patient"
                                                        )}
                                                    </Button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* STEP 3: DOCTOR & DATE SELECTION */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-foreground/60 mb-2">
                                        3. Doctor
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
                                    <label className="block text-xs font-bold uppercase tracking-wider text-foreground/60 mb-2">
                                        4. Appointment Date
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

                            {/* STEP 4: TIME SLOTS */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                                        5. Available Slots
                                    </label>
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
                                                Please select another date or check clinic schedule exclusions.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {!isLoadingSlots && slots.length > 0 && (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-44 overflow-y-auto p-1">
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

                            {/* STEP 5: PROCEDURE PHYSIOTHERAPIST ASSIGNMENT */}
                            {appointmentType === "procedure" && (
                                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/40 p-4">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1.5">
                                        Procedure Physiotherapist Assignment (Optional)
                                    </label>
                                    <p className="text-xs text-foreground/60 mb-2.5">
                                        Assign this procedure directly to an on-duty physiotherapist queue:
                                    </p>
                                    <select
                                        value={selectedPhysioId}
                                        onChange={(e) => setSelectedPhysioId(e.target.value ? Number(e.target.value) : "")}
                                        className="w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 p-2 text-sm focus:border-purple-600 focus:outline-none"
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

                            {/* STEP 6: NOTES & WHATSAPP TOGGLE */}
                            <div className="space-y-3 pt-1">
                                <div>
                                    <label className="block text-xs font-semibold text-foreground/70 mb-1">
                                        Internal Clinic Notes (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={internalNotes}
                                        onChange={(e) => setInternalNotes(e.target.value)}
                                        placeholder="e.g. Needs wheelchair assistance, refer from Dr. Thomas"
                                        className="w-full rounded-xl border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-800 py-2 px-3 text-xs focus:border-purple-600 focus:outline-none"
                                    />
                                </div>

                                <div className="flex items-center gap-2.5 pt-1">
                                    <input
                                        type="checkbox"
                                        id="send_whatsapp_toggle"
                                        checked={sendWhatsApp}
                                        onChange={(e) => setSendWhatsApp(e.target.checked)}
                                        className="h-4 w-4 rounded border-black/20 text-purple-600 focus:ring-purple-500"
                                    />
                                    <label htmlFor="send_whatsapp_toggle" className="text-xs font-medium text-foreground/80 flex items-center gap-1.5 cursor-pointer">
                                        <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                        Send immediate WhatsApp confirmation message to patient upon booking
                                    </label>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                {!createdAppointment && (
                    <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 px-6 py-4 bg-zinc-50/80 dark:bg-zinc-800/50">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="filled"
                            onClick={handleSaveAppointment}
                            disabled={isSubmitting || !selectedPatient || !selectedSlot}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Confirming Booking...
                                </>
                            ) : (
                                "Save & Confirm Appointment"
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

