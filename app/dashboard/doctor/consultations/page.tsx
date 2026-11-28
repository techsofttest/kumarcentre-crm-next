"use client";

import { useState, useEffect } from "react";
import {
    FileText,
    Search,
    Calendar,
    Activity,
    CheckCircle2,
    Eye,
    X,
    Loader2,
    RefreshCw,
    AlertCircle,
    User,
    Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { formatIstDate, formatIstTime12h } from "@/lib/date-utils";

function formatDateTable(dateStr: string | null | undefined): string {
    return formatIstDate(dateStr, "—");
}

function formatTime12h(timeStr: string | null | undefined): string {
    return formatIstTime12h(timeStr, "—", false);
}

export default function ConsultationHistoryPage() {
    const [consultations, setConsultations] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [outcomeFilter, setOutcomeFilter] = useState("all");
    const [physioFilter, setPhysioFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [isLoading, setIsLoading] = useState(true);

    // Selected Consultation for Read-Only Details Modal
    const [selectedConsultation, setSelectedConsultation] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fetchHistory = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await api.getDoctorConsultationHistory({
                search: searchQuery.trim() || undefined,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                outcome: outcomeFilter !== "all" ? outcomeFilter : undefined,
                referred_to_physio: physioFilter !== "all" ? physioFilter : undefined,
                page,
                per_page: 20,
            });
            setConsultations(res.data || []);
            setMeta(res.meta || { current_page: 1, last_page: 1, total: 0 });
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load consultation history.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [page, outcomeFilter, physioFilter]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchHistory();
    };

    const handleOpenDetails = async (id: number) => {
        setIsLoadingDetails(true);
        setIsDetailsOpen(true);
        try {
            const res = await api.getDoctorConsultationDetail(id);
            setSelectedConsultation(res.consultation);
        } catch (err: any) {
            setErrorMessage(err.message || "Unable to load consultation details.");
        } finally {
            setIsLoadingDetails(false);
        }
    };

    return (
        <div className="flex w-full flex-col gap-6 p-8">
            {/* Header & Breadcrumb */}
            <div className="flex flex-col gap-4 border-b border-black/10 dark:border-white/10 pb-5">
                <div className="flex items-center gap-2 text-xs text-foreground/50">
                    <span>Doctor Admin</span>
                    <span>/</span>
                    <span className="text-foreground font-semibold">Consultation History</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Consultation History
                        </h1>
                        <p className="text-xs text-foreground/60 mt-1">
                            Chronological archive of all completed patient consultations ({meta.total} records)
                        </p>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        icon={RefreshCw}
                        onClick={fetchHistory}
                        disabled={isLoading}
                    >
                        {isLoading ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>

                {/* Filters & Search Toolbar */}
                <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3 pt-2">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search patient, file #, phone..."
                            className="w-56 rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 pl-9 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-purple-600"
                        />
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs">
                        <span className="text-foreground/50 text-[11px]">From:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-foreground outline-none text-xs"
                        />
                        <span className="text-foreground/50 text-[11px] ml-1">To:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-foreground outline-none text-xs"
                        />
                    </div>

                    {/* Outcome Filter */}
                    <select
                        value={outcomeFilter}
                        onChange={(e) => {
                            setOutcomeFilter(e.target.value);
                            setPage(1);
                        }}
                        className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                    >
                        <option value="all">All Outcomes</option>
                        <option value="completed">Completed Consultation</option>
                        <option value="referred_to_physio">Referred to Physiotherapy</option>
                    </select>

                    {/* Physio Referral Filter */}
                    <select
                        value={physioFilter}
                        onChange={(e) => {
                            setPhysioFilter(e.target.value);
                            setPage(1);
                        }}
                        className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                    >
                        <option value="all">All Referrals</option>
                        <option value="1">Referred to Physio</option>
                        <option value="0">Not Referred</option>
                    </select>

                    <Button type="submit" variant="filled" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
                        Filter
                    </Button>

                    {(searchQuery || startDate || endDate || outcomeFilter !== "all" || physioFilter !== "all") && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setSearchQuery("");
                                setStartDate("");
                                setEndDate("");
                                setOutcomeFilter("all");
                                setPhysioFilter("all");
                                setPage(1);
                                setTimeout(fetchHistory, 0);
                            }}
                        >
                            Reset
                        </Button>
                    )}
                </form>
            </div>

            {errorMessage && (
                <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Consultation Table */}
            {isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-xs text-foreground/50">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                    <span>Loading consultation history...</span>
                </div>
            ) : consultations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-12 text-center text-xs text-foreground/50">
                    No consultation records match the specified filters.
                </div>
            ) : (
                <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-black/10 dark:border-white/10 text-foreground/50 uppercase tracking-wider text-[10px] bg-slate-50/40 dark:bg-zinc-800/20">
                                    <th className="py-3 px-4">Patient Name</th>
                                    <th className="py-3 px-4">File Number</th>
                                    <th className="py-3 px-4">Consultation Date</th>
                                    <th className="py-3 px-4">Appointment Type</th>
                                    <th className="py-3 px-4">Outcome</th>
                                    <th className="py-3 px-4">Physio Referral</th>
                                    <th className="py-3 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {consultations.map((c) => {
                                    const isReferred = c.outcome === "referred_to_physio" || c.physiotherapy_referral !== null;

                                    return (
                                        <tr
                                            key={c.id}
                                            onClick={() => handleOpenDetails(c.id)}
                                            className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                                        >
                                            <td className="py-3.5 px-4 font-bold text-foreground">
                                                {c.patient?.name}
                                                <div className="text-[11px] text-foreground/50 font-normal">{c.patient?.mobile_number}</div>
                                            </td>
                                            <td className="py-3.5 px-4 font-mono font-semibold text-purple-600">
                                                {c.patient?.file_number || "—"}
                                            </td>
                                            <td className="py-3.5 px-4 font-mono text-foreground">
                                                {formatDateTable(c.completed_at || c.created_at)}
                                            </td>
                                            <td className="py-3.5 px-4 capitalize text-foreground/80">
                                                {c.appointment?.appointment_type?.replace(/_/g, " ") || "Consultation"}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {isReferred ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 px-2.5 py-0.5 text-[10px] font-bold">
                                                        <Activity className="h-3 w-3" /> Referred to Physio
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-0.5 text-[10px] font-bold">
                                                        <CheckCircle2 className="h-3 w-3" /> Completed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {c.physiotherapy_referral ? (
                                                    <span className="font-mono text-[10px] uppercase font-bold text-teal-700 dark:text-teal-400">
                                                        Status: {c.physiotherapy_referral.status}
                                                    </span>
                                                ) : (
                                                    <span className="text-foreground/40 text-[11px]">None</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenDetails(c.id);
                                                    }}
                                                    className="text-xs"
                                                >
                                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                                    View
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
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

            {/* READ-ONLY CONSULTATION DETAILS MODAL */}
            {isDetailsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4 bg-slate-50/50 dark:bg-zinc-800/50">
                            <div>
                                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-purple-600" />
                                    Consultation Record – {selectedConsultation?.patient?.name}
                                </h2>
                                <div className="text-xs text-foreground/50 mt-0.5">
                                    File: <span className="font-mono text-purple-600 font-bold">{selectedConsultation?.patient?.file_number || "—"}</span> • Ref: {selectedConsultation?.appointment?.reference}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDetailsOpen(false)}
                                className="rounded-lg p-1.5 text-foreground/60 hover:bg-black/5 dark:hover:bg-white/5"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {isLoadingDetails ? (
                            <div className="flex h-48 items-center justify-center gap-2 text-xs text-foreground/50">
                                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                                Loading details...
                            </div>
                        ) : selectedConsultation ? (
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                                {/* Appointment & Patient Details */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 p-4 border border-black/5 dark:border-white/5">
                                    <div>
                                        <span className="text-foreground/50 text-[11px] block">Patient Name</span>
                                        <span className="font-bold text-foreground mt-0.5 block">{selectedConsultation.patient?.name}</span>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50 text-[11px] block">Consultation Date</span>
                                        <span className="font-mono font-bold text-foreground mt-0.5 block">
                                            {formatDateTable(selectedConsultation.completed_at || selectedConsultation.created_at)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50 text-[11px] block">Consulting Doctor</span>
                                        <span className="font-bold text-foreground mt-0.5 block">
                                            Dr. {selectedConsultation.doctor?.name}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50 text-[11px] block">Appointment Slot</span>
                                        <span className="font-mono text-foreground mt-0.5 block">
                                            {formatTime12h(selectedConsultation.appointment?.start_time)} – {formatTime12h(selectedConsultation.appointment?.end_time)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50 text-[11px] block">Completed At</span>
                                        <span className="font-mono text-emerald-600 font-semibold mt-0.5 block">
                                            {formatTime12h(selectedConsultation.completed_at)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-foreground/50 text-[11px] block">Outcome</span>
                                        <span className="font-bold uppercase text-purple-600 mt-0.5 block">
                                            {selectedConsultation.outcome.replace(/_/g, " ")}
                                        </span>
                                    </div>
                                </div>

                                {/* Clinical Remarks */}
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 block mb-1">
                                        Clinical Examination Remarks
                                    </span>
                                    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-800/50 p-4 text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                        {selectedConsultation.remarks || "No clinical remarks recorded."}
                                    </div>
                                </div>

                                {/* Physiotherapy Referral Details */}
                                {selectedConsultation.physiotherapy_referral && (
                                    <div className="rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20 p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-bold">
                                                <Activity className="h-4 w-4 text-teal-600" />
                                                Physiotherapy Referral Details
                                            </div>
                                            <span className="rounded-full bg-teal-200 dark:bg-teal-900 px-2 py-0.5 text-[10px] font-bold uppercase">
                                                {selectedConsultation.physiotherapy_referral.status}
                                            </span>
                                        </div>
                                        <div>
                                            <strong className="text-foreground/70 block mb-0.5">Treatment Instructions:</strong>
                                            <p className="text-foreground/90 whitespace-pre-wrap">
                                                {selectedConsultation.physiotherapy_referral.treatment_instructions}
                                            </p>
                                        </div>
                                        {selectedConsultation.physiotherapy_referral.completion_notes && (
                                            <div className="mt-2 pt-2 border-t border-teal-200 dark:border-teal-900">
                                                <strong className="text-teal-800 dark:text-teal-300 block mb-0.5">Physiotherapist Completion Notes:</strong>
                                                <p className="text-foreground/80">{selectedConsultation.physiotherapy_referral.completion_notes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : null}

                        <div className="flex justify-end border-t border-black/10 dark:border-white/10 px-6 py-3 bg-slate-50/80 dark:bg-zinc-800/80">
                            <Button variant="outline" size="sm" onClick={() => setIsDetailsOpen(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
