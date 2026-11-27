"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Activity,
    Users,
    Clock,
    CheckCircle2,
    Calendar,
    ChevronRight,
    HeartPulse,
    FileText,
    Search,
    Loader2,
    RefreshCw,
    X,
    AlertCircle,
    Check,
    CreditCard,
    DollarSign,
    IndianRupee,
    Play,
    Plus,
    TrendingUp,
    ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { formatTime12h } from "@/lib/patient-utils";

const MONTH_NAMES_SHORT = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec"
];

function formatDateDisplay(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.split(" ")[0];
    const parts = cleanDate.split("-");
    if (parts.length === 3) {
        let year: string;
        let monthStr: string;
        let day: string;
        if (parts[0].length === 4) {
            year = parts[0];
            monthStr = parts[1];
            day = parts[2].padStart(2, "0");
        } else if (parts[2].length === 4) {
            day = parts[0].padStart(2, "0");
            monthStr = parts[1];
            year = parts[2];
        } else {
            return dateStr;
        }
        const monthNum = parseInt(monthStr, 10);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
            return `${day}-${MONTH_NAMES_SHORT[monthNum - 1]}-${year}`;
        }
    }
    return dateStr;
}

export default function PhysiotherapistDashboard() {
    const router = useRouter();

    const [summary, setSummary] = useState({
        total_assigned_patients: 0,
        new_referrals: 0,
        undergoing_treatment: 0,
        today_sessions: 0,
        completed_sessions: 0,
        awaiting_closure: 0,
    });
    const [todaySessions, setTodaySessions] = useState<Array<any>>([]);
    const [referrals, setReferrals] = useState<Array<any>>([]);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
    const [isLoading, setIsLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("");

    // Quick Payment Modal
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedReferralForPay, setSelectedReferralForPay] = useState<any | null>(null);
    const [payAmount, setPayAmount] = useState("");
    const [payMethod, setPayMethod] = useState("cash");
    const [payRef, setPayRef] = useState("");
    const [payNotes, setPayNotes] = useState("");
    const [isSavingPay, setIsSavingPay] = useState(false);

    // Quick Complete Session Modal
    const [completeSessionModalOpen, setCompleteSessionModalOpen] = useState(false);
    const [activeSessionToComplete, setActiveSessionToComplete] = useState<any | null>(null);
    const [treatmentPerformed, setTreatmentPerformed] = useState("");
    const [patientResponse, setPatientResponse] = useState("");
    const [progressRemarks, setProgressRemarks] = useState("");
    const [isSavingSession, setIsSavingSession] = useState(false);

    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fetchDashboard = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await api.getPhysioDashboard({
                search: searchTerm.trim() || undefined,
                filter: filterStatus || undefined,
            });
            setSummary(res.summary);
            setTodaySessions(res.today_sessions || []);
            setReferrals(res.referrals?.data || []);
            setMeta(res.referrals?.meta || { current_page: 1, last_page: 1, total: 0, per_page: 20 });
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load physiotherapy treatment dashboard.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, [filterStatus]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchDashboard();
        }, 350);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReferralForPay) return;
        const amt = parseFloat(payAmount);
        if (isNaN(amt) || amt <= 0) {
            setErrorMessage("Please enter a valid payment amount.");
            return;
        }

        setIsSavingPay(true);
        setErrorMessage(null);
        try {
            await api.recordPhysioPayment({
                referral_id: selectedReferralForPay.id,
                amount: amt,
                payment_method: payMethod,
                payment_reference: payRef.trim() || undefined,
                notes: payNotes.trim() || undefined,
                idempotency_key: crypto.randomUUID(),
            });
            setAlertMessage(`Payment of ₹${amt.toLocaleString()} recorded successfully for ${selectedReferralForPay.patient?.name}!`);
            setPaymentModalOpen(false);
            setPayAmount("");
            setPayRef("");
            setPayNotes("");
            setSelectedReferralForPay(null);
            fetchDashboard();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to record payment.");
        } finally {
            setIsSavingPay(false);
        }
    };

    const handleCompleteSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeSessionToComplete) return;
        if (!treatmentPerformed.trim()) {
            setErrorMessage("Treatment performed remarks are required.");
            return;
        }

        setIsSavingSession(true);
        setErrorMessage(null);
        try {
            await api.completePhysioTreatmentSession(activeSessionToComplete.id, {
                treatment_performed: treatmentPerformed.trim(),
                patient_response: patientResponse.trim() || undefined,
                progress_remarks: progressRemarks.trim() || undefined,
            });
            setAlertMessage(`Session #${activeSessionToComplete.session_number} completed successfully!`);
            setCompleteSessionModalOpen(false);
            setTreatmentPerformed("");
            setPatientResponse("");
            setProgressRemarks("");
            setActiveSessionToComplete(null);
            fetchDashboard();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to complete treatment session.");
        } finally {
            setIsSavingSession(false);
        }
    };

    const getStatusBadge = (status: string, label: string) => {
        switch (status) {
            case "new":
            case "pending":
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">New Referral</span>;
            case "in_progress":
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">In Progress</span>;
            case "treatment_completed":
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Treatment Completed</span>;
            case "closed":
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">Closed</span>;
            case "cancelled":
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">Cancelled</span>;
            default:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-800">{label}</span>;
        }
    };

    const getPaymentBadge = (status: string) => {
        switch (status) {
            case "Paid":
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Paid</span>;
            case "Partial":
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Partial</span>;
            case "Advance Credit":
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">Advance Credit</span>;
            case "Unpaid":
            default:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">Unpaid</span>;
        }
    };

    return (
        <div className="flex flex-col min-h-screen w-full bg-background p-6 md:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Activity className="h-8 w-8 text-purple-600" />
                        Physiotherapy Treatment Dashboard
                    </h1>
                    <p className="text-sm text-foreground/60 mt-1">
                        Clinical treatment management, sessions, patient rehabilitation and financial ledgers
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchDashboard}
                        disabled={isLoading}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>

                    <Link href="/dashboard/payments">
                        <Button variant="outline" size="sm" className="gap-2">
                            <CreditCard className="h-4 w-4 text-purple-600" />
                            Physio Ledger
                        </Button>
                    </Link>

                    <Link href="/dashboard/physiotherapist/reports">
                        <Button variant="outline" size="sm" className="gap-2">
                            <FileText className="h-4 w-4 text-emerald-600" />
                            Treatment Reports
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Notification Alerts */}
            {alertMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300 flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        <span>{alertMessage}</span>
                    </div>
                    <button onClick={() => setAlertMessage(null)} className="text-emerald-800 hover:text-emerald-950">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                    <button onClick={() => setErrorMessage(null)} className="text-red-800 hover:text-red-950">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Summary KPI Cards (3 Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Assigned Patients</span>
                    <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-foreground">{summary.total_assigned_patients}</span>
                        <Users className="h-5 w-5 text-purple-600/70" />
                    </div>
                </div>

                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">In Treatment</span>
                    <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.undergoing_treatment}</span>
                        <HeartPulse className="h-5 w-5 text-blue-600/70" />
                    </div>
                </div>

                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Completed Sessions</span>
                    <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.completed_sessions}</span>
                        <CheckCircle2 className="h-5 w-5 text-emerald-600/70" />
                    </div>
                </div>
            </div>

            {/* SECTION A: TODAY'S SESSIONS */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Clock className="h-5 w-5 text-purple-600" />
                            Today's Treatment Sessions ({todaySessions.length})
                        </h2>
                        <p className="text-xs text-foreground/60 mt-0.5">
                            Individual therapy sessions active or completed today
                        </p>
                    </div>
                </div>

                {todaySessions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-black/15 dark:border-white/15 p-8 text-center text-xs text-foreground/60 bg-zinc-50/50 dark:bg-zinc-900/20">
                        No active treatment sessions recorded for today. Open any assigned patient below to start a new session.
                    </div>
                ) : (
                    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-black/10 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-800/60 text-foreground/60 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Session #</th>
                                        <th className="px-4 py-3 font-semibold">Patient</th>
                                        <th className="px-4 py-3 font-semibold">Referral #</th>
                                        <th className="px-4 py-3 font-semibold">Started At</th>
                                        <th className="px-4 py-3 font-semibold">Treatment Notes</th>
                                        <th className="px-4 py-3 font-semibold">Status</th>
                                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                    {todaySessions.map((session) => (
                                        <tr key={session.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                            <td className="px-4 py-3 font-mono font-bold text-purple-600">
                                                #{session.session_number}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-foreground">{session.patient_name}</div>
                                                <div className="text-[11px] text-foreground/50">
                                                    {session.patient_file_number ? `${session.patient_file_number} • ` : ""}{session.patient_mobile_number}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-foreground/80">
                                                {session.referral_number}
                                            </td>
                                            <td className="px-4 py-3 text-foreground/70">
                                                {session.started_at ? formatTime12h(session.started_at) : "—"}
                                            </td>
                                            <td className="px-4 py-3 max-w-xs truncate text-foreground/70">
                                                {session.treatment_performed || <span className="italic text-foreground/40">Treatment in progress...</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {session.status === "in_progress" ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                        In Progress
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Completed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => router.push(`/dashboard/physiotherapist/referrals/${session.referral_id}`)}
                                                    className="h-8 px-2.5 text-xs"
                                                >
                                                    Open Referral
                                                </Button>
                                                {session.status === "in_progress" && (
                                                    <Button
                                                        variant="filled"
                                                        size="sm"
                                                        onClick={() => {
                                                            setActiveSessionToComplete(session);
                                                            setCompleteSessionModalOpen(true);
                                                        }}
                                                        className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    >
                                                        Complete Session
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* SECTION B: MY PATIENTS (ASSIGNED REFERRALS) */}
            <div className="space-y-4 pt-4 border-t border-black/10 dark:border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Users className="h-5 w-5 text-purple-600" />
                            My Patients & Assigned Referrals
                        </h2>
                        <p className="text-xs text-foreground/60 mt-0.5">
                            All physiotherapy referrals assigned to your care with live billing and treatment progress
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative w-64 md:w-80">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                            <input
                                type="text"
                                placeholder="Search by Name, Mobile, File #..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-10 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-900 pl-9 pr-4 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                            />
                        </div>
                    </div>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2">
                    {[
                        { key: "", label: "All Referrals" },
                        { key: "new", label: "New Referrals" },
                        { key: "in_progress", label: "In Progress" },
                        { key: "treatment_completed", label: "Treatment Completed" },
                        { key: "closed", label: "Closed Referrals" },
                        { key: "outstanding", label: "Outstanding Payments" },
                    ].map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFilterStatus(f.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${filterStatus === f.key
                                ? "bg-purple-600 text-white shadow-sm"
                                : "bg-zinc-100 hover:bg-zinc-200 text-foreground/70 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Referrals Database Table */}
                <div className="rounded-xl border border-black/15 bg-white dark:bg-zinc-900 dark:border-white/15 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-foreground">
                            <thead className="border-b border-black/10 bg-zinc-50 text-[11px] uppercase tracking-wider text-foreground/60 dark:border-white/10 dark:bg-zinc-800/50">
                                <tr>
                                    <th className="px-5 py-3.5 font-bold">Patient Details</th>
                                    <th className="px-5 py-3.5 font-bold">Referral Info</th>
                                    <th className="px-5 py-3.5 font-bold">Referring Doctor</th>
                                    <th className="px-5 py-3.5 font-bold">Treatment Status</th>
                                    <th className="px-5 py-3.5 font-bold">Billing Model</th>
                                    <th className="px-5 py-3.5 font-bold">Payment Status</th>
                                    <th className="px-5 py-3.5 font-bold">Sessions</th>
                                    <th className="px-5 py-3.5 font-bold">Last Session</th>
                                    <th className="px-5 py-3.5 text-right font-bold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-foreground/50">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                                                <span>Loading assigned patient referrals...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : referrals.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-foreground/50">
                                            No physiotherapy referrals found matching your query.
                                        </td>
                                    </tr>
                                ) : (
                                    referrals.map((r) => (
                                        <tr
                                            key={r.id}
                                            onClick={() => router.push(`/dashboard/physiotherapist/referrals/${r.id}`)}
                                            className="cursor-pointer transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.02]"
                                        >
                                            <td className="whitespace-nowrap px-5 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-foreground">{r.patient?.name}</span>
                                                    <div className="flex items-center gap-1.5 text-[11px] text-foreground/50 mt-0.5">
                                                        {r.patient?.file_number ? (
                                                            <span className="font-mono bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 px-1 py-0.2 rounded font-semibold">
                                                                {r.patient.file_number}
                                                            </span>
                                                        ) : (
                                                            <span>#{r.patient?.id}</span>
                                                        )}
                                                        <span>• {r.patient?.mobile_number}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-mono font-bold text-purple-600">{r.referral_number}</span>
                                                    <span className="text-[11px] text-foreground/50">
                                                        {formatDateDisplay(r.referral_date)}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 font-medium text-foreground/80">
                                                {r.referring_doctor}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4">
                                                {getStatusBadge(r.status, r.status_label)}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 font-mono font-semibold text-foreground/80">
                                                ₹{Number(r.total_charges ?? 0).toLocaleString()}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    {getPaymentBadge(r.payment_status)}
                                                    {r.outstanding_balance > 0 ? (
                                                        <span className="text-[10px] text-red-600 font-semibold font-mono">
                                                            Due: ₹{r.outstanding_balance.toLocaleString()}
                                                        </span>
                                                    ) : r.available_advance_credit > 0 ? (
                                                        <span className="text-[10px] text-purple-600 font-semibold font-mono">
                                                            Credit: ₹{r.available_advance_credit.toLocaleString()}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 font-mono font-semibold">
                                                {r.sessions_completed}
                                                {r.sessions_remaining !== null && (
                                                    <span className="text-foreground/50 text-[11px]"> / {r.sessions_remaining + r.sessions_completed}</span>
                                                )}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 text-foreground/60">
                                                {formatDateDisplay(r.last_session_date)}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                    {(r.visit_status === "not_checked_in" || r.visit_status === "completed") && r.status !== "closed" && r.status !== "cancelled" && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await api.checkInPhysioReferral(r.id);
                                                                    setAlertMessage(res.message);
                                                                    fetchDashboard();
                                                                } catch (err: any) {
                                                                    setErrorMessage(err.message || "Check-in failed.");
                                                                }
                                                            }}
                                                            className="h-8 px-2.5 text-xs gap-1 border-sky-300 text-sky-700 hover:bg-sky-50"
                                                        >
                                                            Check In
                                                        </Button>
                                                    )}
                                                    {r.visit_status === "checked_in" && r.active_visit_id && (
                                                        <Button
                                                            variant="filled"
                                                            size="sm"
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await api.startPhysioVisitSession(r.active_visit_id);
                                                                    setAlertMessage(res.message);
                                                                    fetchDashboard();
                                                                } catch (err: any) {
                                                                    setErrorMessage(err.message || "Failed to start session.");
                                                                }
                                                            }}
                                                            className="h-8 px-2.5 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                                        >
                                                            Start Session
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedReferralForPay(r);
                                                            setPayAmount(r.outstanding_balance > 0 ? String(r.outstanding_balance) : "");
                                                            setPaymentModalOpen(true);
                                                        }}
                                                        className="h-8 px-2.5 text-xs gap-1"
                                                    >
                                                        <IndianRupee className="h-3 w-3 text-purple-600" />
                                                        Pay
                                                    </Button>

                                                    <Button
                                                        variant="filled"
                                                        size="sm"
                                                        onClick={() => router.push(`/dashboard/physiotherapist/referrals/${r.id}`)}
                                                        className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1"
                                                    >
                                                        Open
                                                        <ChevronRight className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL 1: RECORD PAYMENT MODAL */}
            {paymentModalOpen && selectedReferralForPay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white dark:bg-zinc-900 dark:border-white/10 p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <IndianRupee className="h-5 w-5 text-purple-600" />
                                Record Physiotherapy Payment
                            </h3>
                            <button
                                onClick={() => setPaymentModalOpen(false)}
                                className="text-foreground/50 hover:text-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-black/5 dark:border-white/5 text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-foreground/60">Patient:</span>
                                <span className="font-bold text-foreground">{selectedReferralForPay.patient?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-foreground/60">Referral:</span>
                                <span className="font-mono font-semibold">{selectedReferralForPay.referral_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-foreground/60">Current Outstanding:</span>
                                <span className="font-bold text-red-600 font-mono">₹{selectedReferralForPay.outstanding_balance?.toLocaleString()}</span>
                            </div>
                        </div>

                        <form onSubmit={handleRecordPayment} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-foreground mb-1">
                                    Amount Received (₹) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    required
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
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
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPaymentModalOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isSavingPay}
                                    className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
                                >
                                    {isSavingPay ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Posting...
                                        </>
                                    ) : (
                                        "Post Payment"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: COMPLETE SESSION MODAL */}
            {completeSessionModalOpen && activeSessionToComplete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white dark:bg-zinc-900 dark:border-white/10 p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                Complete Session #{activeSessionToComplete.session_number}
                            </h3>
                            <button
                                onClick={() => setCompleteSessionModalOpen(false)}
                                className="text-foreground/50 hover:text-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-black/5 dark:border-white/5 text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-foreground/60">Patient:</span>
                                <span className="font-bold text-foreground">{activeSessionToComplete.patient_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-foreground/60">Started At:</span>
                                <span className="font-mono">{activeSessionToComplete.started_at || "Today"}</span>
                            </div>
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
                                    placeholder="Specify procedures conducted"
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
                                    placeholder=""
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
                                    placeholder=""
                                    className="w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 p-2.5 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCompleteSessionModalOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isSavingSession}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                                >
                                    {isSavingSession ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Completing...
                                        </>
                                    ) : (
                                        "Complete Session"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
