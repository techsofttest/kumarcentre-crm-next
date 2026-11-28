"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    Activity,
    Users,
    Clock,
    CheckCircle2,
    Calendar,
    ChevronLeft,
    HeartPulse,
    FileText,
    Search,
    Loader2,
    RefreshCw,
    X,
    AlertCircle,
    Check,
    CreditCard,
    IndianRupee,
    Play,
    Plus,
    Lock,
    ArrowUpRight,
    ArrowDownRight,
    Receipt,
    UserCheck,
    Phone,
    User,
    Stethoscope,
    CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertifyToast } from "@/components/ui/alertify-toast";
import { api, ApiError } from "@/lib/api";
import { formatIstDate } from "@/lib/date-utils";

function formatDateDisplay(dateStr: string | null | undefined): string {
    return formatIstDate(dateStr, "—");
}

export default function PhysioReferralDetailPage() {
    const router = useRouter();
    const params = useParams();
    const referralId = parseInt(params.id as string, 10);

    const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "ledger" | "plan">("overview");

    const [data, setData] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Modals
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [payAmount, setPayAmount] = useState("");
    const [payMethod, setPayMethod] = useState("cash");
    const [payRef, setPayRef] = useState("");
    const [payNotes, setPayNotes] = useState("");
    const [isPostingPay, setIsPostingPay] = useState(false);

    const [completeSessionModalOpen, setCompleteSessionModalOpen] = useState(false);
    const [treatmentPerformed, setTreatmentPerformed] = useState("");
    const [patientResponse, setPatientResponse] = useState("");
    const [progressRemarks, setProgressRemarks] = useState("");
    const [chargeAmount, setChargeAmount] = useState("");
    const [isCompletingSession, setIsCompletingSession] = useState(false);

    const [treatmentCompleteModalOpen, setTreatmentCompleteModalOpen] = useState(false);
    const [finalRemarks, setFinalRemarks] = useState("");
    const [isClosingTreatment, setIsClosingTreatment] = useState(false);

    const [isStartingSession, setIsStartingSession] = useState(false);
    const [isClosingReferral, setIsClosingReferral] = useState(false);

    const fetchDetail = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await api.getPhysioReferralDetail(referralId);
            setData(res);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load referral details.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (referralId) {
            fetchDetail();
        }
    }, [referralId]);

    const handleStartSession = async () => {
        setIsStartingSession(true);
        setErrorMessage(null);
        try {
            const res = await api.startPhysioSession(referralId);
            setAlertMessage(res.message);
            fetchDetail();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to start treatment session.");
        } finally {
            setIsStartingSession(false);
        }
    };

    const handleCompleteSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data?.active_session) return;
        if (!treatmentPerformed.trim()) {
            setErrorMessage("Treatment performed details are required.");
            return;
        }

        setIsCompletingSession(true);
        setErrorMessage(null);
        try {
            const extraCharge = chargeAmount ? parseFloat(chargeAmount) : undefined;
            const res = await api.completePhysioTreatmentSession(data.active_session.id, {
                treatment_performed: treatmentPerformed.trim(),
                patient_response: patientResponse.trim() || undefined,
                progress_remarks: progressRemarks.trim() || undefined,
                charge_amount: extraCharge,
            });
            setAlertMessage(res.message);
            setCompleteSessionModalOpen(false);
            setTreatmentPerformed("");
            setPatientResponse("");
            setProgressRemarks("");
            setChargeAmount("");
            fetchDetail();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to complete treatment session.");
        } finally {
            setIsCompletingSession(false);
        }
    };

    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(payAmount);
        if (isNaN(amt) || amt <= 0) {
            setErrorMessage("Please enter a valid payment amount.");
            return;
        }

        setIsPostingPay(true);
        setErrorMessage(null);
        try {
            await api.recordPhysioPayment({
                referral_id: referralId,
                amount: amt,
                payment_method: payMethod,
                payment_reference: payRef.trim() || undefined,
                notes: payNotes.trim() || undefined,
                idempotency_key: crypto.randomUUID(),
            });
            setAlertMessage(`Payment of ₹${amt.toLocaleString()} recorded successfully!`);
            setPaymentModalOpen(false);
            setPayAmount("");
            setPayRef("");
            setPayNotes("");
            fetchDetail();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to record payment.");
        } finally {
            setIsPostingPay(false);
        }
    };

    const handleCompleteTreatment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!finalRemarks.trim()) {
            setErrorMessage("Final treatment remarks are required.");
            return;
        }

        setIsClosingTreatment(true);
        setErrorMessage(null);
        try {
            await api.completePhysioTreatment(referralId, finalRemarks.trim());
            setAlertMessage("Physiotherapy treatment plan marked as completed!");
            setTreatmentCompleteModalOpen(false);
            setFinalRemarks("");
            fetchDetail();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to complete treatment.");
        } finally {
            setIsClosingTreatment(false);
        }
    };

    const handleCloseReferral = async () => {
        if (!window.confirm("Are you sure you want to close this referral? Financial records and balances will remain intact.")) {
            return;
        }

        setIsClosingReferral(true);
        setErrorMessage(null);
        try {
            await api.closePhysioReferral(referralId);
            setAlertMessage("Referral closed successfully.");
            fetchDetail();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to close referral.");
        } finally {
            setIsClosingReferral(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center p-12">
                <div className="flex items-center gap-2.5 text-foreground/60 text-sm font-medium">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                    <span>Loading referral details and financial ledgers...</span>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center p-12 gap-3">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <p className="text-foreground/70 font-semibold">{errorMessage || "Referral not found."}</p>
                <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/physiotherapist")}>
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    const { referral, patient, billing_plan, financial_summary, treatment_plan, active_session, sessions, ledger } = data;
    const isClosed = referral.status === "closed" || referral.status === "cancelled";
    const isCompleted = referral.status === "treatment_completed";

    return (
        <div className="flex flex-col min-h-screen w-full bg-background p-6 md:p-8 space-y-6">
            {/* Back Button */}
            <div>
                <button
                    onClick={() => router.push("/dashboard/physiotherapist")}
                    className="flex items-center gap-1.5 text-xs font-bold text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                >
                    <ChevronLeft className="h-4 w-4" /> Back to Physiotherapist Dashboard
                </button>
            </div>

            <AlertifyToast type="success" message={alertMessage} onClose={() => setAlertMessage(null)} />
            <AlertifyToast type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />

            {/* Referral & Patient Header Card */}
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-6">
                <div className="flex flex-col gap-5 border-b border-black/5 dark:border-white/5 pb-6">
                    <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">{patient.name}</h1>
                            {patient.file_number && (
                                <span className="font-mono bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 px-2 py-0.5 rounded text-xs font-bold">
                                    {patient.file_number}
                                </span>
                            )}
                            <span className="font-mono text-xs font-bold text-foreground/50 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                Ref: {referral.referral_number}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            <div className="flex items-center gap-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-zinc-50/80 dark:bg-zinc-800/40 px-3 py-2">
                                <Phone className="h-4 w-4 text-purple-600 shrink-0" />
                                <div className="min-w-0">
                                    <span className="block text-[10px] font-medium uppercase tracking-wider text-foreground/50">Phone</span>
                                    <span className="block text-xs font-semibold text-foreground truncate">{patient.mobile_number || "—"}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-zinc-50/80 dark:bg-zinc-800/40 px-3 py-2">
                                <Calendar className="h-4 w-4 text-purple-600 shrink-0" />
                                <div className="min-w-0">
                                    <span className="block text-[10px] font-medium uppercase tracking-wider text-foreground/50">Age</span>
                                    <span className="block text-xs font-semibold text-foreground truncate">
                                        {patient.age !== null && patient.age !== undefined ? `${patient.age} yrs` : "—"}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-zinc-50/80 dark:bg-zinc-800/40 px-3 py-2">
                                <User className="h-4 w-4 text-purple-600 shrink-0" />
                                <div className="min-w-0">
                                    <span className="block text-[10px] font-medium uppercase tracking-wider text-foreground/50">Gender</span>
                                    <span className="block text-xs font-semibold text-foreground truncate">
                                        {patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : patient.gender || "—"}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-zinc-50/80 dark:bg-zinc-800/40 px-3 py-2">
                                <Stethoscope className="h-4 w-4 text-purple-600 shrink-0" />
                                <div className="min-w-0">
                                    <span className="block text-[10px] font-medium uppercase tracking-wider text-foreground/50">Referred By</span>
                                    <span className="block text-xs font-semibold text-foreground truncate">{referral.referring_doctor || "—"}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-zinc-50/80 dark:bg-zinc-800/40 px-3 py-2">
                                <CalendarDays className="h-4 w-4 text-purple-600 shrink-0" />
                                <div className="min-w-0">
                                    <span className="block text-[10px] font-medium uppercase tracking-wider text-foreground/50">Referral Date</span>
                                    <span className="block text-xs font-semibold text-foreground truncate">{formatDateDisplay(referral.referral_date)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Action Header Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {!active_session && !isClosed && (
                            <Button
                                variant="filled"
                                size="sm"
                                onClick={handleStartSession}
                                disabled={isStartingSession}
                                className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                            >
                                <Play className="h-4 w-4 fill-current" />
                                {isStartingSession ? "Starting..." : "Start Session"}
                            </Button>
                        )}

                        {(typeof window !== "undefined" && localStorage.getItem("userRole")?.toLowerCase() !== "physiotherapist") && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setPayAmount(financial_summary.outstanding_balance > 0 ? String(Math.round(Number(financial_summary.outstanding_balance))) : "");
                                    setPaymentModalOpen(true);
                                }}
                                className="gap-2"
                            >
                                <IndianRupee className="h-4 w-4 text-purple-600" />
                                Record Payment
                            </Button>
                        )}

                        {!isCompleted && !isClosed && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTreatmentCompleteModalOpen(true)}
                                className="gap-2 text-emerald-600 hover:text-emerald-700 border-emerald-300 dark:border-emerald-900"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Complete & Close Referral
                            </Button>
                        )}
                    </div>
                </div>

                {/* Active Session Warning Banner (if in progress) */}
                {active_session && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
                        <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full bg-blue-600 shrink-0"></span>
                            <div>
                                <span className="text-sm font-bold text-blue-950 dark:text-blue-200">
                                    Session #{active_session.session_number} is currently In Progress
                                </span>
                                <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5">
                                    Started at {active_session.started_at} by {active_session.physiotherapist_name}. Ready to record clinical notes and conclude.
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="filled"
                            size="sm"
                            onClick={() => setCompleteSessionModalOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-2"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Complete Session Now
                        </Button>
                    </div>
                )}

                {/* 4 Tabs Navigation */}
                <div className="flex items-center space-x-8 border-b border-black/10 dark:border-white/10 overflow-x-auto text-sm font-bold">
                    <button
                        onClick={() => setActiveTab("overview")}
                        className={`pb-3 transition-colors border-b-2 cursor-pointer ${
                            activeTab === "overview"
                                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                                : "border-transparent text-foreground/60 hover:text-foreground"
                        }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab("sessions")}
                        className={`pb-3 transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
                            activeTab === "sessions"
                                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                                : "border-transparent text-foreground/60 hover:text-foreground"
                        }`}
                    >
                        <span>Treatment Sessions</span>
                        <span className="rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] px-2 py-0.5">
                            {sessions.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab("ledger")}
                        className={`pb-3 transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
                            activeTab === "ledger"
                                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                                : "border-transparent text-foreground/60 hover:text-foreground"
                        }`}
                    >
                        <span>Financial Ledger</span>
                        <span className="rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 text-[10px] px-2 py-0.5 font-mono">
                            {ledger.length}
                        </span>
                    </button>
                </div>

                {/* TAB 1: OVERVIEW */}
                {activeTab === "overview" && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-800/30 p-4 space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Treatment Status</span>
                                <div className="text-base font-bold text-foreground capitalize mt-1">
                                    {referral.status_label}
                                </div>
                                <span className="text-xs text-foreground/60 block">Assigned: {referral.assigned_physiotherapist}</span>
                            </div>

                            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-800/30 p-4 space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Sessions Progress</span>
                                <div className="text-base font-bold text-foreground mt-1">
                                    {treatment_plan.sessions_completed} Completed
                                    {treatment_plan.sessions_remaining !== null && (
                                        <span className="text-xs font-normal text-foreground/60"> / {treatment_plan.sessions_remaining} left</span>
                                    )}
                                </div>
                                <span className="text-xs text-foreground/60 block">Total conducted: {sessions.length}</span>
                            </div>

                            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-800/30 p-4 space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Amount Paid</span>
                                <div className="text-base font-bold font-mono text-emerald-600 mt-1">
                                    ₹{(financial_summary.total_payments ?? 0).toLocaleString()}
                                </div>
                                <span className="text-xs text-foreground/60 block">
                                    Total Cost: ₹{(financial_summary.total_charges ?? 0).toLocaleString()}
                                </span>
                            </div>

                            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-800/30 p-4 space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Balance Amount</span>
                                <div className="text-base font-bold font-mono mt-1">
                                    {financial_summary.outstanding_balance > 0 ? (
                                        <span className="text-red-600">Due: ₹{financial_summary.outstanding_balance?.toLocaleString()}</span>
                                    ) : financial_summary.available_advance_credit > 0 ? (
                                        <span className="text-purple-600">Credit: ₹{financial_summary.available_advance_credit?.toLocaleString()}</span>
                                    ) : (
                                        <span className="text-emerald-600">₹0 (Settled)</span>
                                    )}
                                </div>
                                <span className="text-xs text-foreground/60 block">Status: {financial_summary.payment_status}</span>
                            </div>
                        </div>

                        {/* Clinical Remarks & Treatment Instructions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-xl border border-black/10 dark:border-white/10 p-5 space-y-2 bg-white dark:bg-zinc-900">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/70 flex items-center gap-2">
                                    <HeartPulse className="h-4 w-4 text-purple-600" />
                                    Clinical Referral Instructions
                                </h3>
                                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                    {referral.treatment_instructions || "No specific instructions provided."}
                                </p>
                            </div>

                            <div className="rounded-xl border border-black/10 dark:border-white/10 p-5 space-y-2 bg-white dark:bg-zinc-900">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/70 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-purple-600" />
                                    Doctor Clinical Remarks & Diagnosis
                                </h3>
                                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                    {referral.clinical_remarks || "No clinical remarks recorded."}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: SESSIONS */}
                {activeTab === "sessions" && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-foreground">Treatment Sessions History</h3>
                                <p className="text-xs text-foreground/60">Chronological audit of all physiotherapy sessions</p>
                            </div>

                            {!active_session && !isClosed && (
                                <Button
                                    variant="filled"
                                    size="sm"
                                    onClick={handleStartSession}
                                    disabled={isStartingSession}
                                    className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                                >
                                    <Play className="h-4 w-4 fill-current" />
                                    Start Next Session
                                </Button>
                            )}
                        </div>

                        {sessions.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-black/15 dark:border-white/15 p-12 text-center text-xs text-foreground/60">
                                No therapy sessions conducted yet for this referral. Click &ldquo;Start Next Session&rdquo; above.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sessions.map((s: any) => (
                                    <div
                                        key={s.id}
                                        className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-sm"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 dark:border-white/5 pb-2.5">
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono font-bold text-sm text-purple-600">
                                                    Session #{s.session_number}
                                                </span>
                                                <span className="text-xs text-foreground/60">
                                                    {formatDateDisplay(s.date)} • {s.start_time}{s.end_time ? ` - ${s.end_time}` : ""}
                                                </span>
                                                <span className="text-xs font-medium text-foreground/50">
                                                    Therapist: {s.physiotherapist_name}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {s.status === "in_progress" ? (
                                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                        In Progress
                                                    </span>
                                                ) : s.status === "completed" ? (
                                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                        Completed
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-100 text-zinc-700">
                                                        Cancelled
                                                    </span>
                                                )}

                                                {s.charge_amount !== null && (
                                                    <span className="font-mono text-xs font-semibold text-foreground/80">
                                                        {s.charge_amount > 0 ? `₹${s.charge_amount.toLocaleString()}` : "Covered by Package"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                            <div className="space-y-1">
                                                <span className="font-bold text-foreground/60 block text-[11px]">Treatment Performed</span>
                                                <p className="text-foreground/80">{s.treatment_performed || "In progress..."}</p>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="font-bold text-foreground/60 block text-[11px]">Patient Response</span>
                                                <p className="text-foreground/80">{s.patient_response || "—"}</p>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="font-bold text-foreground/60 block text-[11px]">Progress Remarks</span>
                                                <p className="text-foreground/80">{s.progress_remarks || "—"}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: LEDGER */}
                {activeTab === "ledger" && (
                    <div className="space-y-6 animate-in fade-in">
                        {/* Financial Ledger Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800/40 p-4">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Total Charges</span>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                    ₹{financial_summary.total_charges?.toLocaleString()}
                                </div>
                            </div>

                            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800/40 p-4">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Total Payments</span>
                                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                                    ₹{financial_summary.total_payments?.toLocaleString()}
                                </div>
                            </div>

                            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800/40 p-4">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Outstanding Balance</span>
                                <div className="text-xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
                                    ₹{financial_summary.outstanding_balance?.toLocaleString()}
                                </div>
                            </div>

                            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800/40 p-4">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Available Credit</span>
                                <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
                                    ₹{financial_summary.available_advance_credit?.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Chronological Transaction Table */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-foreground">Chronological Transaction Ledger</h3>
                                <Button
                                    variant="filled"
                                    size="sm"
                                    onClick={() => {
                                        setPayAmount(financial_summary.outstanding_balance > 0 ? String(Math.round(Number(financial_summary.outstanding_balance))) : "");
                                        setPaymentModalOpen(true);
                                    }}
                                    className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                                >
                                    <IndianRupee className="h-4 w-4" />
                                    Record Payment
                                </Button>
                            </div>

                            <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden shadow-sm">
                                <table className="w-full text-left text-xs text-foreground">
                                    <thead className="border-b border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-foreground/60">
                                        <tr>
                                            <th className="px-4 py-3 font-bold">Ref #</th>
                                            <th className="px-4 py-3 font-bold">Date</th>
                                            <th className="px-4 py-3 font-bold">Transaction Type</th>
                                            <th className="px-4 py-3 font-bold">Description</th>
                                            <th className="px-4 py-3 font-bold">Payment Method</th>
                                            <th className="px-4 py-3 text-right font-bold">Amount (₹)</th>
                                            <th className="px-4 py-3 text-right font-bold">Allocated</th>
                                            <th className="px-4 py-3 font-bold">Recorded By</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                        {ledger.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-8 text-center text-foreground/50">
                                                    No financial ledger transactions recorded yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            ledger.map((entry: any) => (
                                                <tr key={entry.id} className={entry.is_reversed ? "bg-zinc-50 dark:bg-zinc-900/50" : ""}>
                                                    <td className="px-4 py-3 font-mono font-bold text-purple-600">
                                                        {entry.reference_number}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {formatDateDisplay(entry.transaction_date)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                            entry.is_charge
                                                                ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                                                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                        }`}>
                                                            {entry.transaction_type_label}
                                                        </span>
                                                        {entry.is_reversed && (
                                                            <span className="ml-1.5 text-[10px] text-zinc-500 font-semibold">(Reversed)</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 max-w-xs truncate text-foreground/80">
                                                        {entry.description}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium uppercase text-foreground/70">
                                                        {entry.payment_method || "—"}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-mono font-bold ${
                                                        entry.transaction_type === "payment_received" || entry.transaction_type === "advance_credit"
                                                            ? "text-emerald-600"
                                                            : "text-red-600"
                                                    }`}>
                                                        {entry.transaction_type === "payment_received" || entry.transaction_type === "advance_credit"
                                                            ? `+₹${entry.amount?.toLocaleString()}`
                                                            : `-₹${entry.amount?.toLocaleString()}`}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-foreground/60">
                                                        ₹{entry.allocated_amount?.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-foreground/70">
                                                        {entry.created_by}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 4: TREATMENT PLAN */}
                {activeTab === "plan" && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="rounded-xl border border-black/10 dark:border-white/10 p-6 space-y-4 bg-white dark:bg-zinc-900">
                            <h3 className="text-base font-bold text-foreground">Treatment Plan Arrangement</h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                <div className="space-y-1">
                                    <span className="text-foreground/50 block font-bold">Billing Model</span>
                                    <span className="text-sm font-bold text-foreground">{billing_plan.billing_type_label}</span>
                                </div>

                                {billing_plan.billing_type === "package" ? (
                                    <>
                                        <div className="space-y-1">
                                            <span className="text-foreground/50 block font-bold">Package Name</span>
                                            <span className="text-sm font-bold text-foreground">{billing_plan.package_name || "Physio Package"}</span>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-foreground/50 block font-bold">Package Total Price</span>
                                            <span className="text-sm font-bold font-mono text-purple-600">₹{billing_plan.package_price?.toLocaleString()}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-1">
                                        <span className="text-foreground/50 block font-bold">Agreed Per-Session Rate</span>
                                        <span className="text-sm font-bold font-mono text-purple-600">₹{billing_plan.session_charge?.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>

                            {billing_plan.billing_type === "package" && (
                                <div className="space-y-2 pt-4 border-t border-black/5 dark:border-white/5">
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span>Package Session Consumption</span>
                                        <span>{treatment_plan.sessions_completed} / {billing_plan.included_sessions} Sessions Completed</span>
                                    </div>
                                    <div className="h-3 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                        <div
                                            className="h-full bg-purple-600 transition-all rounded-full"
                                            style={{
                                                width: `${Math.min(100, Math.round((treatment_plan.sessions_completed / (billing_plan.included_sessions || 1)) * 100))}%`,
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: RECORD PAYMENT */}
            {paymentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white dark:bg-zinc-900 dark:border-white/10 p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <IndianRupee className="h-5 w-5 text-purple-600" />
                                Record Physiotherapy Payment
                            </h3>
                            <button onClick={() => setPaymentModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-black/5 dark:border-white/5 text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-foreground/60">Patient:</span>
                                <span className="font-bold text-foreground">{patient.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-foreground/60">Outstanding Balance:</span>
                                <span className="font-bold text-red-600 font-mono">₹{financial_summary.outstanding_balance?.toLocaleString()}</span>
                            </div>
                        </div>

                        <form onSubmit={handleRecordPayment} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-foreground mb-1">
                                    Amount Received (₹) *
                                </label>
                                <input
                                    type="number"
                                    step="1"
                                    min="1"
                                    required
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value.replace(/\D/g, ""))}
                                    placeholder="Enter payment amount..."
                                    className="h-10 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 px-3 text-sm font-semibold text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-foreground mb-1">
                                    Payment Method *
                                </label>
                                <select
                                    value={payMethod}
                                    onChange={(e) => setPayMethod(e.target.value)}
                                    className="h-10 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 px-3 text-xs font-semibold text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                >
                                    <option value="cash">Cash</option>
                                    <option value="upi">UPI / QR Code</option>
                                    <option value="card">Debit / Credit Card</option>
                                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-foreground mb-1">
                                    Transaction / Reference # (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={payRef}
                                    onChange={(e) => setPayRef(e.target.value)}
                                    placeholder="e.g. UPI Ref / Card Last 4"
                                    className="h-9 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 px-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-foreground mb-1">
                                    Payment Notes (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={payNotes}
                                    onChange={(e) => setPayNotes(e.target.value)}
                                    placeholder="Remarks or desk notes..."
                                    className="w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 p-2 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setPaymentModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isPostingPay}
                                    className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
                                >
                                    {isPostingPay ? "Posting..." : "Post Payment"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: COMPLETE SESSION */}
            {completeSessionModalOpen && active_session && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white dark:bg-zinc-900 dark:border-white/10 p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                Complete Session #{active_session.session_number}
                            </h3>
                            <button onClick={() => setCompleteSessionModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCompleteSession} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-foreground mb-1">
                                    Treatment Performed *
                                </label>
                                <textarea
                                    rows={3}
                                    required
                                    value={treatmentPerformed}
                                    onChange={(e) => setTreatmentPerformed(e.target.value)}
                                    placeholder="Specify procedures conducted (e.g. 15 min lumbar traction, core exercises, cold pack)..."
                                    className="w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 p-2.5 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-foreground mb-1">
                                    Patient Response (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={patientResponse}
                                    onChange={(e) => setPatientResponse(e.target.value)}
                                    placeholder="e.g. Pain relieved from 7/10 to 4/10; good tolerance"
                                    className="h-9 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 px-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-foreground mb-1">
                                    Progress Remarks & Clinical Notes (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={progressRemarks}
                                    onChange={(e) => setProgressRemarks(e.target.value)}
                                    placeholder="Observations on mobility, next plan, home exercises..."
                                    className="w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 p-2.5 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setCompleteSessionModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isCompletingSession}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                                >
                                    {isCompletingSession ? "Completing..." : "Complete Session"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: COMPLETE TREATMENT */}
            {treatmentCompleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white dark:bg-zinc-900 dark:border-white/10 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                Conclude Treatment Plan
                            </h3>
                            <button onClick={() => setTreatmentCompleteModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <p className="text-xs text-foreground/70">
                            Marking treatment as completed records the final outcome and patient progress. Outstanding financial balances will remain accessible.
                        </p>

                        <form onSubmit={handleCompleteTreatment} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-foreground mb-1">
                                    Final Clinical Remarks & Discharge Summary *
                                </label>
                                <textarea
                                    rows={4}
                                    required
                                    value={finalRemarks}
                                    onChange={(e) => setFinalRemarks(e.target.value)}
                                    placeholder="Summary of patient rehabilitation, range of motion improvements, and recommended home exercises..."
                                    className="w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 p-2.5 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setTreatmentCompleteModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isClosingTreatment}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {isClosingTreatment ? "Saving..." : "Mark Treatment Completed"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
