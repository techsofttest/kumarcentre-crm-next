"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Activity,
    Search,
    Play,
    Loader2,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function ReceptionistPhysioPage() {
    const router = useRouter();
    const [referrals, setReferrals] = useState<any[]>([]);
    const [physios, setPhysios] = useState<Array<{ id: number; name: string }>>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "new" | "in_progress" | "completed">("all");
    const [isLoading, setIsLoading] = useState(true);
    const [startingId, setStartingId] = useState<number | null>(null);
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Arrange Referral Modal (Assign Physio + Update Total Cost)
    const [arrangeReferral, setArrangeReferral] = useState<any | null>(null);
    const [selectedPhysioId, setSelectedPhysioId] = useState<number | "">("");
    const [newCost, setNewCost] = useState("");
    const [costReason, setCostReason] = useState("");
    const [isSavingArrange, setIsSavingArrange] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [refRes, physioRes] = await Promise.all([
                api.getReceptionistReferrals({
                    search: searchQuery.trim() || undefined,
                    status: statusFilter === "all" ? undefined : statusFilter,
                }),
                api.getPhysiotherapists(),
            ]);
            setReferrals(refRes.data || []);
            setPhysios(physioRes.data || []);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load physiotherapy referrals.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [statusFilter]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadData();
    };

    const handleStartSession = async (referral: any) => {
        setStartingId(referral.id);
        setErrorMessage(null);
        try {
            const res = await api.startPhysioSession(referral.id);
            setAlertMessage(res.message || `Session started for ${referral.patient?.name}.`);
            loadData();
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to start treatment session.");
        } finally {
            setStartingId(null);
        }
    };

    const handleSaveArrangement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!arrangeReferral) return;
        setIsSavingArrange(true);
        setErrorMessage(null);
        try {
            if (selectedPhysioId) {
                await api.assignPhysioReferral(arrangeReferral.id, Number(selectedPhysioId));
            }
            if (newCost !== "" && costReason.trim()) {
                await api.revisePhysioCost(arrangeReferral.id, {
                    new_cost: parseFloat(newCost) || 0,
                    reason: costReason.trim(),
                });
            }
            setArrangeReferral(null);
            setNewCost("");
            setCostReason("");
            setAlertMessage("Referral updated.");
            loadData();
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to save referral arrangement.");
        } finally {
            setIsSavingArrange(false);
        }
    };

    return (
        <div className="flex w-full flex-col gap-6 p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Activity className="h-6 w-6 text-purple-600" />
                        Physiotherapy Referrals & Arrival Desk
                    </h1>
                    <p className="text-xs text-foreground/60 mt-1">
                        Search arriving patients, manage referrals, and initiate treatment sessions
                    </p>
                </div>
                <Button variant="outline" size="sm" icon={RefreshCw} onClick={loadData}>
                    Refresh
                </Button>
            </div>

            {alertMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{alertMessage}</span>
                </div>
            )}

            {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Patient Search & Status Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <form onSubmit={handleSearch} className="relative w-full md:w-96 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
                        <input
                            type="text"
                            placeholder="Search by patient name, mobile, or file #..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 w-full rounded-lg border border-black/15 bg-white dark:bg-zinc-900 pl-9 pr-3 text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15"
                        />
                    </div>
                    <Button type="submit" variant="filled" size="sm" className="bg-purple-600 text-white">
                        Search
                    </Button>
                </form>

                <div className="flex flex-wrap items-center gap-2">
                    {([
                        { id: "all", label: "All Referrals" },
                        { id: "new", label: "New / Ready" },
                        { id: "in_progress", label: "In Progress" },
                        { id: "completed", label: "Completed / Closed" },
                    ] as const).map((tab) => (
                        <Button
                            key={tab.id}
                            variant={statusFilter === tab.id ? "filled" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter(tab.id)}
                            className={statusFilter === tab.id ? "bg-purple-600 text-white" : ""}
                        >
                            {tab.label}
                        </Button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-40 items-center justify-center text-xs text-foreground/50">
                    <Loader2 className="h-5 w-5 animate-spin mr-2 text-purple-600" />
                    Loading referrals...
                </div>
            ) : referrals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-black/15 dark:border-white/15 p-10 text-center text-xs text-foreground/50">
                    No physiotherapy referrals found.
                </div>
            ) : (
                <div className="rounded-xl border border-black/10 bg-white dark:bg-zinc-900 dark:border-white/10 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-black/10 bg-slate-50/50 dark:bg-white/5 uppercase text-foreground/60">
                            <tr>
                                <th className="px-4 py-3">Referral #</th>
                                <th className="px-4 py-3">Patient</th>
                                <th className="px-4 py-3">Physiotherapist</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Outstanding</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5">
                            {referrals.map((r) => {
                                const isClosedOrCancelled = r.status === "closed" || r.status === "cancelled";
                                return (
                                    <tr key={r.id}>
                                        <td className="px-4 py-3 font-mono font-bold text-purple-600">{r.referral_number}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold">{r.patient?.name}</div>
                                            <div className="text-[11px] text-foreground/50">
                                                {r.patient?.file_number || `#${r.patient?.id}`} • {r.patient?.mobile_number}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {r.assigned_physiotherapist || <span className="text-amber-600 font-semibold">Unassigned</span>}
                                        </td>
                                        <td className="px-4 py-3 capitalize">
                                            {r.status === "awaiting_billing" ? (
                                                <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-0.5 text-[11px] font-semibold">
                                                    Awaiting Billing
                                                </span>
                                            ) : (
                                                r.status_label || r.status
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono">
                                            ₹{Number(r.outstanding_balance ?? 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right space-x-2">
                                            {!isClosedOrCancelled && (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setArrangeReferral(r);
                                                            setSelectedPhysioId(physios[0]?.id || "");
                                                        }}
                                                    >
                                                        Arrange / Billing
                                                    </Button>
                                                </>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => router.push(`/dashboard/physiotherapist/referrals/${r.id}`)}
                                            >
                                                Open
                                                <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Arrange Referral Modal */}
            {arrangeReferral && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="font-bold text-sm">Arrange Referral {arrangeReferral.referral_number}</h3>
                            <button onClick={() => setArrangeReferral(null)}><X className="h-4 w-4" /></button>
                        </div>
                        <form onSubmit={handleSaveArrangement} className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold mb-1">Assign Physiotherapist</label>
                                <select
                                    value={selectedPhysioId}
                                    onChange={(e) => setSelectedPhysioId(Number(e.target.value))}
                                    className="h-9 w-full rounded-lg border px-3 bg-white dark:bg-zinc-800"
                                >
                                    {physios.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block font-bold mb-1">New Total Treatment Cost (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={newCost}
                                    onChange={(e) => setNewCost(e.target.value)}
                                    placeholder={`Current: ₹${arrangeReferral.total_charges ?? 0}`}
                                    className="h-9 w-full rounded-lg border px-3 bg-white dark:bg-zinc-800"
                                />
                            </div>
                            {newCost !== "" && (
                                <div>
                                    <label className="block font-bold mb-1">Reason for Cost Revision *</label>
                                    <input
                                        type="text"
                                        required
                                        value={costReason}
                                        onChange={(e) => setCostReason(e.target.value)}
                                        placeholder="Mandatory reason..."
                                        className="h-9 w-full rounded-lg border px-3 bg-white dark:bg-zinc-800"
                                    />
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setArrangeReferral(null)}>Cancel</Button>
                                <Button type="submit" variant="filled" size="sm" disabled={isSavingArrange} className="bg-purple-600 text-white">
                                    {isSavingArrange ? "Saving..." : "Save Arrangement"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
