"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    CreditCard,
    IndianRupee,
    Search,
    Loader2,
    RefreshCw,
    X,
    AlertCircle,
    CheckCircle2,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    Plus,
    Calendar,
    Users,
    FileText,
    Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertifyToast } from "@/components/ui/alertify-toast";
import { api, ApiError } from "@/lib/api";
import { formatIstDate } from "@/lib/date-utils";

function formatDateDisplay(dateStr: string | null | undefined): string {
    return formatIstDate(dateStr, "—");
}

export default function FinancialLedger() {
    const router = useRouter();

    const [userRole, setUserRole] = useState<string>("Receptionist");
    const [entries, setEntries] = useState<Array<any>>([]);
    const [summary, setSummary] = useState({
        total_charges: 0,
        total_payments: 0,
        net_balance: 0,
        available_credit: 0,
    });
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<"all" | "charges" | "payments">("all");

    // Reversal State (Admin Only)
    const [reversalModalOpen, setReversalModalOpen] = useState(false);
    const [selectedEntryForReversal, setSelectedEntryForReversal] = useState<any | null>(null);
    const [reversalReason, setReversalReason] = useState("");
    const [isReversing, setIsReversing] = useState(false);

    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [isAdminOrReceptionist, setIsAdminOrReceptionist] = useState(false);

    useEffect(() => {
        const storedRole = localStorage.getItem("userRole");
        if (storedRole) {
            setUserRole(storedRole);
            const r = storedRole.toLowerCase();
            setIsAdminOrReceptionist(r.includes("admin") || r.includes("receptionist"));
        }
    }, []);

    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportFromDate, setExportFromDate] = useState("");
    const [exportToDate, setExportToDate] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    const handleExportExcel = async (e: React.FormEvent) => {
        e.preventDefault();
        setExportError(null);

        if (!exportFromDate || !exportToDate) {
            setExportError("Both From Date and To Date are required.");
            return;
        }
        if (exportFromDate > exportToDate) {
            setExportError("From Date cannot be later than To Date.");
            return;
        }

        setIsExporting(true);
        try {
            const blob = await api.exportPhysioLedger(exportFromDate, exportToDate);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `physio-ledger-${exportFromDate}-to-${exportToDate}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setExportModalOpen(false);
        } catch (err: any) {
            setExportError(err.message || "Failed to export physiotherapy ledger.");
        } finally {
            setIsExporting(false);
        }
    };

    const isAdmin = userRole.toLowerCase().includes("admin");

    const fetchLedger = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await api.getPhysioLedger({ page });
            setEntries(res.data || []);
            setSummary(res.summary);
            setMeta(res.meta || { current_page: 1, last_page: 1, total: 0 });
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load physiotherapy ledger.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLedger();
    }, [page]);

    const handleReverseTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEntryForReversal) return;
        if (!reversalReason.trim()) {
            setErrorMessage("Please enter an audit reason for transaction reversal.");
            return;
        }

        setIsReversing(true);
        setErrorMessage(null);
        try {
            await api.reversePhysioLedgerEntry(selectedEntryForReversal.id, reversalReason.trim());
            setAlertMessage(`Transaction #${selectedEntryForReversal.reference_number} successfully reversed.`);
            setReversalModalOpen(false);
            setSelectedEntryForReversal(null);
            setReversalReason("");
            fetchLedger();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to reverse transaction.");
        } finally {
            setIsReversing(false);
        }
    };

    const filteredEntries = entries.filter((e) => {
        if (filterType === "charges") {
            if (!e.transaction_type.includes("charge")) return false;
        } else if (filterType === "payments") {
            if (!e.transaction_type.includes("payment") && !e.transaction_type.includes("credit")) return false;
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const ref = (e.reference_number || "").toLowerCase();
            const pat = (e.patient_name || "").toLowerCase();
            const desc = (e.description || "").toLowerCase();
            const pRef = (e.referral_number || "").toLowerCase();
            return ref.includes(q) || pat.includes(q) || desc.includes(q) || pRef.includes(q);
        }

        return true;
    });

    return (
        <div className="flex flex-col min-h-screen w-full bg-background p-6 md:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <CreditCard className="h-8 w-8 text-purple-600" />
                        Physiotherapy Master Financial Ledger
                    </h1>
                    <p className="text-sm text-foreground/60 mt-1">
                        Unified ledger synchronized between Reception Desk, Physiotherapy Clinics and Administration
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {isAdminOrReceptionist && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setExportError(null);
                                setExportModalOpen(true);
                            }}
                            className="gap-2"
                        >
                            Export to Excel
                        </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={fetchLedger} disabled={isLoading} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh Ledger
                    </Button>

                    <Link href="/dashboard/physiotherapist">
                        <Button variant="outline" size="sm" className="gap-2">
                            <Users className="h-4 w-4 text-purple-600" />
                            Physio Dashboard
                        </Button>
                    </Link>
                </div>
            </div>

            <AlertifyToast type="success" message={alertMessage} onClose={() => setAlertMessage(null)} />
            <AlertifyToast type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />

            {/* Financial Overview Cards (4 KPIs) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 space-y-1 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Total Ledger Charges</span>
                    <div className="text-2xl font-bold font-mono text-foreground mt-1">
                        ₹{summary.total_charges?.toLocaleString()}
                    </div>
                    <span className="text-xs text-foreground/50">Debited packages & sessions</span>
                </div>

                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 space-y-1 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Total Collections</span>
                    <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        ₹{summary.total_payments?.toLocaleString()}
                    </div>
                    <span className="text-xs text-emerald-600/80">Payments & advance receipts</span>
                </div>

                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 space-y-1 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Outstanding Balance</span>
                    <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
                        ₹{summary.net_balance?.toLocaleString()}
                    </div>
                    <span className="text-xs text-red-600/80">Net uncollected receivables</span>
                </div>

                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 space-y-1 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Available Advance Credit</span>
                    <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
                        ₹{summary.available_credit?.toLocaleString()}
                    </div>
                    <span className="text-xs text-purple-600/80">Pre-paid unallocated balance</span>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
                <div className="relative w-64 md:w-80">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                    <input
                        type="text"
                        placeholder="Search Txn #, Patient, Ref #..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-900 pl-9 pr-4 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                    />
                </div>
            </div>

            {/* Master Ledger Table */}
            <div className="rounded-xl border border-black/15 bg-white dark:bg-zinc-900 dark:border-white/15 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-foreground">
                        <thead className="border-b border-black/10 bg-zinc-50 text-[11px] uppercase tracking-wider text-foreground/60 dark:border-white/10 dark:bg-zinc-800/50">
                            <tr>
                                <th className="px-5 py-3.5 font-bold">Ref #</th>
                                <th className="px-5 py-3.5 font-bold">Date</th>
                                <th className="px-5 py-3.5 font-bold">Patient / Referral</th>
                                <th className="px-5 py-3.5 font-bold">Transaction Type</th>
                                <th className="px-5 py-3.5 font-bold">Description</th>
                                <th className="px-5 py-3.5 font-bold">Payment Method</th>
                                <th className="px-5 py-3.5 text-right font-bold">Amount (₹)</th>
                                <th className="px-5 py-3.5 text-right font-bold">Allocated</th>
                                <th className="px-5 py-3.5 font-bold">Created By</th>
                                {isAdmin && <th className="px-5 py-3.5 text-right font-bold">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={isAdmin ? 10 : 9} className="py-12 text-center text-foreground/50">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                                            <span>Loading master financial ledger...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdmin ? 10 : 9} className="py-12 text-center text-foreground/50">
                                        No financial ledger records found matching your query.
                                    </td>
                                </tr>
                            ) : (
                                filteredEntries.map((e) => {
                                    const isCharge = e.transaction_type.includes("charge");
                                    return (
                                        <tr
                                            key={e.id}
                                            className={`hover:bg-black/[.02] dark:hover:bg-white/[.02] ${
                                                e.is_reversed ? "bg-zinc-50 dark:bg-zinc-800/30" : ""
                                            }`}
                                        >
                                            <td className="px-5 py-4 font-mono font-bold text-purple-600 whitespace-nowrap">
                                                {e.reference_number}
                                            </td>

                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {formatDateDisplay(e.transaction_date)}
                                            </td>

                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground">{e.patient_name}</span>
                                                    <div className="flex items-center gap-1.5 text-[11px] text-foreground/50">
                                                        <span>Ref: {e.referral_number}</span>
                                                        {e.patient_file_number && (
                                                            <span className="font-mono">({e.patient_file_number})</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                        isCharge
                                                            ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                    }`}
                                                >
                                                    {e.transaction_type_label}
                                                </span>
                                                {e.is_reversed && (
                                                    <span className="ml-1 text-[10px] text-zinc-500 font-bold block">(Reversed)</span>
                                                )}
                                            </td>

                                            <td className="px-5 py-4 max-w-xs truncate text-foreground/80">
                                                {e.description}
                                            </td>

                                            <td className="px-5 py-4 font-medium uppercase text-foreground/70 whitespace-nowrap">
                                                {e.payment_method || "—"}
                                            </td>

                                            <td
                                                className={`px-5 py-4 text-right font-mono font-bold whitespace-nowrap ${
                                                    e.transaction_type === "payment_received" || e.transaction_type === "advance_credit"
                                                        ? "text-emerald-600"
                                                        : "text-red-600"
                                                }`}
                                            >
                                                {e.transaction_type === "payment_received" || e.transaction_type === "advance_credit"
                                                    ? `+₹${e.amount?.toLocaleString()}`
                                                    : `-₹${e.amount?.toLocaleString()}`}
                                            </td>

                                            <td className="px-5 py-4 text-right font-mono text-foreground/60 whitespace-nowrap">
                                                ₹{e.allocated_amount?.toLocaleString()}
                                            </td>

                                            <td className="px-5 py-4 text-foreground/70 whitespace-nowrap">
                                                {e.created_by}
                                            </td>

                                            {isAdmin && (
                                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                                    {!e.is_reversed && e.transaction_type !== "reversal" && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedEntryForReversal(e);
                                                                setReversalModalOpen(true);
                                                            }}
                                                            className="h-7 px-2 text-[11px] text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/20"
                                                        >
                                                            <RotateCcw className="h-3 w-3 mr-1" />
                                                            Reverse
                                                        </Button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {meta.last_page > 1 && (
                    <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 px-5 py-3">
                        <span className="text-xs text-foreground/60">
                            Page {meta.current_page} of {meta.last_page} ({meta.total} records)
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= meta.last_page}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: ADMIN TRANSACTION REVERSAL */}
            {reversalModalOpen && selectedEntryForReversal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white dark:bg-zinc-900 dark:border-white/10 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
                                <RotateCcw className="h-5 w-5" />
                                Authorize Transaction Reversal
                            </h3>
                            <button onClick={() => setReversalModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-red-800 dark:text-red-300 font-bold">Transaction:</span>
                                <span className="font-mono font-bold">{selectedEntryForReversal.reference_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-red-800 dark:text-red-300 font-bold">Amount:</span>
                                <span className="font-mono font-bold">₹{selectedEntryForReversal.amount?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-red-800 dark:text-red-300 font-bold">Type:</span>
                                <span>{selectedEntryForReversal.transaction_type_label}</span>
                            </div>
                        </div>

                        <form onSubmit={handleReverseTransaction} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-foreground mb-1">
                                    Audit Reason for Reversal *
                                </label>
                                <textarea
                                    rows={3}
                                    required
                                    value={reversalReason}
                                    onChange={(e) => setReversalReason(e.target.value)}
                                    placeholder="e.g. Duplicate swipe, patient refund authorization, clerical billing mistake..."
                                    className="w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-800 p-2.5 text-xs text-foreground focus:border-red-600 focus:outline-none dark:border-white/15"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setReversalModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isReversing}
                                    className="bg-red-600 hover:bg-red-700 text-white min-w-[140px]"
                                >
                                    {isReversing ? "Reversing..." : "Confirm Reversal"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Export to Excel Modal */}
            {exportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-md rounded-2xl border border-black/10 dark:border-white/10 bg-background p-6 shadow-xl space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">Export Physiotherapy Ledger</h2>
                            <button
                                type="button"
                                onClick={() => setExportModalOpen(false)}
                                className="text-foreground/50 hover:text-foreground text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleExportExcel} className="space-y-4">
                            {exportError && (
                                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                                    {exportError}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground/80">From Date *</label>
                                <input
                                    type="date"
                                    required
                                    value={exportFromDate}
                                    onChange={(e) => setExportFromDate(e.target.value)}
                                    className="w-full rounded-lg border border-black/15 dark:border-white/15 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground/80">To Date *</label>
                                <input
                                    type="date"
                                    required
                                    value={exportToDate}
                                    onChange={(e) => setExportToDate(e.target.value)}
                                    className="w-full rounded-lg border border-black/15 dark:border-white/15 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setExportModalOpen(false)}
                                    disabled={isExporting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isExporting}
                                    className="min-w-[130px]"
                                >
                                    {isExporting ? "Exporting..." : "Export"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
