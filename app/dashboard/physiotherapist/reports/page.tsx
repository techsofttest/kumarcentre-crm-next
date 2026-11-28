"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Activity,
    Calendar,
    ChevronLeft,
    Clock,
    FileText,
    CheckCircle2,
    IndianRupee,
    Loader2,
    RefreshCw,
    TrendingUp,
    Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

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

export default function PhysioReportsPage() {
    const router = useRouter();

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split("T")[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

    const [reportData, setReportData] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fetchReports = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await api.getPhysioReports({ start_date: startDate, end_date: endDate });
            setReportData(res);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load treatment reports.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [startDate, endDate]);

    return (
        <div className="flex flex-col min-h-screen w-full bg-background p-6 md:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-6">
                <div>
                   
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <FileText className="h-8 w-8 text-emerald-600" />
                        Physiotherapy Reports
                    </h1>
                   
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 p-2 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2 text-xs">
                        <label className="font-bold text-foreground/60">From:</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="rounded-lg border border-black/15 bg-zinc-50 dark:bg-zinc-800 dark:border-white/15 px-2 py-1 text-xs text-foreground focus:outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <label className="font-bold text-foreground/60">To:</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="rounded-lg border border-black/15 bg-zinc-50 dark:bg-zinc-800 dark:border-white/15 px-2 py-1 text-xs text-foreground focus:outline-none"
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchReports} disabled={isLoading} className="h-8 px-2.5">
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>

            {reportData && (
                <>
                    {/* Summary KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 space-y-1 shadow-sm">
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Total Sessions</span>
                            <div className="text-2xl font-bold text-foreground">{reportData.summary.total_sessions}</div>
                            <span className="text-xs text-emerald-600 font-semibold">{reportData.summary.completed_sessions} Completed</span>
                        </div>

                        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 space-y-1 shadow-sm">
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Collections</span>
                            <div className="text-2xl font-bold font-mono text-emerald-600">
                                ₹{reportData.summary.total_collections?.toLocaleString()}
                            </div>
                            <span className="text-xs text-foreground/50">Recorded payments in range</span>
                        </div>

                        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 space-y-1 shadow-sm">
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Active Treatment</span>
                            <div className="text-2xl font-bold text-blue-600">{reportData.summary.active_referrals}</div>
                            <span className="text-xs text-foreground/50">Referrals currently undergoing therapy</span>
                        </div>

                        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 space-y-1 shadow-sm">
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Finished Courses</span>
                            <div className="text-2xl font-bold text-purple-600">{reportData.summary.completed_referrals}</div>
                            <span className="text-xs text-foreground/50">{reportData.summary.closed_referrals} Closed referrals</span>
                        </div>
                    </div>

                    {/* Sessions Breakdown Table */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Clock className="h-5 w-5 text-purple-600" />
                            Sessions Conducted in Date Range ({reportData.sessions?.length || 0})
                        </h2>

                        <div className="rounded-xl border border-black/15 bg-white dark:bg-zinc-900 dark:border-white/15 overflow-hidden shadow-sm">
                            <table className="w-full text-left text-xs text-foreground">
                                <thead className="border-b border-black/10 bg-zinc-50 text-[11px] uppercase tracking-wider text-foreground/60 dark:border-white/10 dark:bg-zinc-800/50">
                                    <tr>
                                        <th className="px-5 py-3.5 font-bold">Date & Time</th>
                                        <th className="px-5 py-3.5 font-bold">Patient Name</th>
                                        <th className="px-5 py-3.5 font-bold">File #</th>
                                        <th className="px-5 py-3.5 font-bold">Session Remark</th>
                                        <th className="px-5 py-3.5 font-bold">Patient Response</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                    {reportData.sessions.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-foreground/50">
                                                No sessions found in the selected date range.
                                            </td>
                                        </tr>
                                    ) : (
                                        reportData.sessions.map((s: any) => (
                                            <tr key={s.id} className="hover:bg-black/[.02] dark:hover:bg-white/[.02]">
                                                <td className="px-5 py-4 font-medium">
                                                    {formatDateDisplay(s.date)} • {s.time}
                                                </td>
                                                <td className="px-5 py-4 font-bold text-foreground">
                                                    {s.patient_name}
                                                </td>
                                                <td className="px-5 py-4 font-mono text-foreground/60">
                                                    {s.patient_file_number || "—"}
                                                </td>
                                                <td className="px-5 py-4 text-foreground/80">
                                                    {s.session_remark?.trim() ? s.session_remark : "-"}
                                                </td>
                                                <td className="px-5 py-4 text-foreground/80">
                                                    {s.patient_response?.trim() ? s.patient_response : "-"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
