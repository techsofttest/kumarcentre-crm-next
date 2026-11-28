"use client";

import { useState, useEffect } from "react";
import {
    Activity,
    Search,
    User,
    Calendar,
    IndianRupee,
    Loader2,
    X,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { getTodayIstYmd } from "@/lib/date-utils";

interface NewPhysioReferralModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (referral: any) => void;
    initialPatientId?: number;
    initialPatientName?: string;
    appointmentId?: number | null;
}

export function NewPhysioReferralModal({
    isOpen,
    onClose,
    onSuccess,
    initialPatientId,
    initialPatientName,
    appointmentId
}: NewPhysioReferralModalProps) {
    // Patient Search
    const [patientQuery, setPatientQuery] = useState("");
    const [patientResults, setPatientResults] = useState<Array<any>>([]);
    const [selectedPatient, setSelectedPatient] = useState<{ id: number; name: string; file_number?: string | null; mobile_number?: string } | null>(null);
    const [isSearchingPatient, setIsSearchingPatient] = useState(false);

    // Doctors & Physiotherapists
    const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
    const [physiotherapists, setPhysiotherapists] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState<number | "">("");
    const [referredByText, setReferredByText] = useState("");
    const [selectedPhysioId, setSelectedPhysioId] = useState<number | "">("");

    // Referral Details
    const [referralDate, setReferralDate] = useState(() => getTodayIstYmd());
    const [treatmentInstructions, setTreatmentInstructions] = useState("");
    const [treatmentCost, setTreatmentCost] = useState("5000");
    const [clinicalRemarks, setClinicalRemarks] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        // Preselect patient if provided
        if (initialPatientId && initialPatientName) {
            setSelectedPatient({ id: initialPatientId, name: initialPatientName });
        }

        // Fetch doctors and physios
        api.getPublicDoctors()
            .then((res: any) => setDoctors(res.data || []))
            .catch(() => {});

        api.getPhysiotherapists()
            .then((res) => setPhysiotherapists(res.data || []))
            .catch(() => {});
    }, [isOpen, initialPatientId, initialPatientName]);

    // Search patients with debounce
    useEffect(() => {
        if (!patientQuery.trim() || selectedPatient) {
            setPatientResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingPatient(true);
            try {
                const res = await api.getPatients(patientQuery.trim());
                setPatientResults(res.data || []);
            } catch {
                setPatientResults([]);
            } finally {
                setIsSearchingPatient(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [patientQuery, selectedPatient]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient) {
            setErrorMessage("Please select an existing patient.");
            return;
        }

        if (!treatmentInstructions.trim()) {
            setErrorMessage("Treatment instructions are required.");
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            const payload: any = {
                patient_id: selectedPatient.id,
                appointment_id: appointmentId ?? undefined,
                referring_doctor_id: selectedDoctorId ? Number(selectedDoctorId) : null,
                referred_by: referredByText.trim() || undefined,
                assigned_physio_id: selectedPhysioId ? Number(selectedPhysioId) : null,
                referral_date: referralDate,
                treatment_instructions: treatmentInstructions.trim(),
                treatment_cost: parseFloat(treatmentCost) || 0,
                clinical_remarks: clinicalRemarks.trim() || undefined,
            };

            const res = await api.createPhysioReferral(payload);
            onSuccess(res.referral);
            onClose();
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to create physiotherapy referral.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
            <div className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white dark:bg-zinc-900 dark:border-white/10 p-6 shadow-2xl space-y-5 my-8">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
                    <div>
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Activity className="h-5 w-5 text-purple-600" />
                            Create Physiotherapy Referral
                        </h2>
                        <p className="text-xs text-foreground/60 mt-0.5">
                            Referred by Doctor or Reception Desk with specialized billing arrangement
                        </p>
                    </div>
                    <button onClick={onClose} className="text-foreground/50 hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {errorMessage && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    {/* Patient Selection */}
                    <div>
                        <label className="block font-bold text-foreground mb-1">
                            Patient Record *
                        </label>
                        {selectedPatient ? (
                            <div className="flex items-center justify-between p-3 rounded-xl border border-purple-200 bg-purple-50/50 dark:border-purple-900/40 dark:bg-purple-950/20">
                                <div>
                                    <span className="font-bold text-foreground text-sm block">{selectedPatient.name}</span>
                                    <span className="text-[11px] text-foreground/60">
                                        {selectedPatient.file_number ? `File: ${selectedPatient.file_number}` : `ID: #${selectedPatient.id}`}
                                        {selectedPatient.mobile_number && ` • ${selectedPatient.mobile_number}`}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPatient(null)}
                                    className="text-xs text-purple-600 hover:text-purple-700 font-bold"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/40" />
                                <input
                                    type="text"
                                    placeholder="Search existing patient by Name, Phone, or File #..."
                                    value={patientQuery}
                                    onChange={(e) => setPatientQuery(e.target.value)}
                                    className="h-10 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 pl-9 pr-4 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                />

                                {isSearchingPatient && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                                    </div>
                                )}

                                {patientResults.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-black/15 bg-white dark:bg-zinc-800 dark:border-white/15 shadow-xl divide-y divide-black/5 dark:divide-white/5">
                                        {patientResults.map((p) => (
                                            <div
                                                key={p.id}
                                                onClick={() => {
                                                    setSelectedPatient(p);
                                                    setPatientResults([]);
                                                    setPatientQuery("");
                                                }}
                                                className="p-2.5 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer flex justify-between items-center"
                                            >
                                                <div>
                                                    <span className="font-bold text-foreground block">{p.name}</span>
                                                    <span className="text-[11px] text-foreground/50">
                                                        {p.file_number || `#${p.id}`} • {p.mobile_number}
                                                    </span>
                                                </div>
                                                <span className="text-purple-600 text-xs font-semibold">Select</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Doctor & Assigned Physiotherapist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-bold text-foreground mb-1">
                                Referring Doctor
                            </label>
                            <select
                                value={selectedDoctorId}
                                onChange={(e) => {
                                    setSelectedDoctorId(e.target.value ? Number(e.target.value) : "");
                                    if (e.target.value) setReferredByText("");
                                }}
                                className="h-9 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 px-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                            >
                                <option value="">-- Select Clinic Doctor --</option>
                                {doctors.map((doc) => (
                                    <option key={doc.id} value={doc.id}>
                                        {doc.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block font-bold text-foreground mb-1">
                                Assign Physiotherapist
                            </label>
                            <select
                                value={selectedPhysioId}
                                onChange={(e) => setSelectedPhysioId(e.target.value ? Number(e.target.value) : "")}
                                className="h-9 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 px-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                            >
                                <option value="">-- Any Available On-Duty Physio --</option>
                                {physiotherapists.map((physio) => (
                                    <option key={physio.id} value={physio.id}>
                                        {physio.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Referral Date */}
                    <div>
                        <label className="block font-bold text-foreground mb-1">
                            Referral Date
                        </label>
                        <input
                            type="date"
                            value={referralDate}
                            onChange={(e) => setReferralDate(e.target.value)}
                            className="h-9 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 px-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                        />
                    </div>

                    {/* Treatment Instructions */}
                    <div>
                        <label className="block font-bold text-foreground mb-1">
                            Clinical Treatment Instructions *
                        </label>
                        <textarea
                            rows={3}
                            required
                            value={treatmentInstructions}
                            onChange={(e) => setTreatmentInstructions(e.target.value)}
                            placeholder="e.g. Lumbar traction 15 mins, core stabilization exercises, cold packs..."
                            className="w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 p-2.5 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                        />
                    </div>

                    {/* Total Treatment Cost */}
                    <div>
                        <label className="block font-bold text-foreground mb-1">
                            Agreed Total Treatment Cost (₹) *
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={treatmentCost}
                            onChange={(e) => setTreatmentCost(e.target.value)}
                            placeholder="e.g. 5000"
                            className="h-9 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 px-3 text-xs font-mono font-bold text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                        />
                    </div>

                    {/* Clinical Remarks */}
                    <div>
                        <label className="block font-bold text-foreground mb-1">
                            Diagnostic Remarks / Medical Notes (Optional)
                        </label>
                        <input
                            type="text"
                            value={clinicalRemarks}
                            onChange={(e) => setClinicalRemarks(e.target.value)}
                            placeholder="e.g. L4-L5 disc protrusion; MRI report verified"
                            className="h-9 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 px-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                        />
                    </div>

                    {/* Actions */}
                    <div className="pt-3 flex items-center justify-end gap-2 border-t border-black/10 dark:border-white/10">
                        <Button type="button" variant="outline" size="sm" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="filled"
                            size="sm"
                            disabled={isSubmitting}
                            className="bg-purple-600 hover:bg-purple-700 text-white min-w-[140px]"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Referral"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
