"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Plus,
    X,
    Stethoscope,
    Phone,
    Mail,
    GraduationCap,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Calendar,
    UserCheck,
    Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

interface DoctorRecord {
    id: number;
    name: string;
    specialization: { id: number; name: string } | null;
    specialization_id: number;
    email: string | null;
    login_email?: string | null;
    mobile_number: string | null;
    default_appointment_duration: number;
    public_profile_description: string | null;
    is_active: boolean;
    show_on_public_booking: boolean;
}

interface SpecializationItem {
    id: number;
    name: string;
}

export default function StaffManagement() {
    const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
    const [specializations, setSpecializations] = useState<SpecializationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Modal state for adding a new Doctor
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newDocName, setNewDocName] = useState("");
    const [newDocSpecId, setNewDocSpecId] = useState<number | "">("");
    const [newDocEmail, setNewDocEmail] = useState("");
    const [newDocPhone, setNewDocPhone] = useState("");
    const [newDocDuration, setNewDocDuration] = useState(30);
    const [newDocDesc, setNewDocDesc] = useState("");

    const fetchStaff = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await api.getAdminDoctors();
            setDoctors(res.data || []);
            setSpecializations(res.specializations || []);
            if (res.specializations && res.specializations.length > 0 && !newDocSpecId) {
                setNewDocSpecId(res.specializations[0].id);
            }
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load staff records.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const handleCreateDoctor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDocName.trim() || !newDocSpecId) return;

        setIsSaving(true);
        setErrorMessage(null);
        try {
            await api.createDoctor({
                name: newDocName.trim(),
                specialization_id: Number(newDocSpecId),
                email: newDocEmail.trim() || undefined,
                mobile_number: newDocPhone.trim() || undefined,
                default_appointment_duration: Number(newDocDuration),
                public_profile_description: newDocDesc.trim() || undefined,
                is_active: true,
                show_on_public_booking: true,
            });

            setShowAddModal(false);
            setNewDocName("");
            setNewDocEmail("");
            setNewDocPhone("");
            setNewDocDesc("");
            setAlertMessage(`Dr. ${newDocName} registered successfully with default working schedules!`);
            fetchStaff();
            setTimeout(() => setAlertMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to create doctor profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (doctor: DoctorRecord) => {
        try {
            await api.updateDoctor(doctor.id, {
                is_active: !doctor.is_active,
            });
            setAlertMessage(`${doctor.name} status updated.`);
            fetchStaff();
            setTimeout(() => setAlertMessage(null), 3000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to update doctor status.");
        }
    };

    const filteredDoctors = doctors.filter((doc) =>
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.specialization?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.mobile_number || "").includes(searchTerm)
    );

    return (
        <div className="flex w-full flex-col gap-8 p-8">
            {/* Notifications */}
            {alertMessage && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-sm font-medium">{alertMessage}</span>
                </div>
            )}

            {errorMessage && (
                <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Doctor & Clinician Management
                    </h1>
                </div>

                <div className="flex gap-2.5">
                    <Link href="/dashboard/schedule">
                        <Button variant="outline" icon={Calendar}>
                            Working Schedules
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Search Filter */}
            <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6  dark:border-white/10 dark:bg-zinc-900">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
                        Active Clinician Roster ({filteredDoctors.length})
                    </div>

                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                        <input
                            type="text"
                            placeholder="Search doctor, spec, phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-md border border-foreground/20 bg-slate-50 dark:bg-zinc-800 pl-9 pr-3 py-1.5 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex h-32 items-center justify-center text-xs text-foreground/50">
                        <Loader2 className="h-5 w-5 animate-spin mr-2 text-purple-600" />
                        Loading staff records...
                    </div>
                ) : filteredDoctors.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-xs text-foreground/50">
                        No doctors match the search criteria.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-black/10 bg-slate-50/50 dark:border-white/10 dark:bg-white/5 uppercase text-foreground/60">
                                <tr>
                                    <th className="px-4 py-3">Clinician / Doctor</th>
                                    <th className="px-4 py-3">Username</th>
                                    <th className="px-4 py-3">Contact</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {filteredDoctors.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
                                        <td className="px-4 py-3.5">
                                            <div className="font-bold text-foreground flex items-center gap-2">
                                                <Stethoscope className="h-4 w-4 text-purple-600" />
                                                {doc.name}
                                            </div>
                                            {doc.public_profile_description && (
                                                <div className="text-[11px] text-foreground/50 max-w-sm truncate mt-0.5">
                                                    {doc.public_profile_description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 font-medium text-foreground">
                                            {doc.login_email || "—"}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="text-foreground">{doc.mobile_number || "—"}</div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                                doc.is_active
                                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                            }`}>
                                                {doc.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right space-x-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newPass = window.prompt(`Enter new password for ${doc.name} (min 8 characters):`);
                                                    if (!newPass) return;
                                                    if (newPass.length < 8) {
                                                        setErrorMessage("Password must be at least 8 characters.");
                                                        return;
                                                    }
                                                    api.resetDoctorPassword(doc.id, newPass, newPass)
                                                        .then((res) => setAlertMessage(res.message || `Password reset for ${doc.name}.`))
                                                        .catch((err: any) => setErrorMessage(err.message || "Failed to reset password."));
                                                }}
                                                className="text-xs font-semibold text-amber-600 hover:text-amber-800 dark:text-amber-400"
                                            >
                                                Reset Password
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(doc)}
                                                className="text-xs font-semibold text-purple-600 hover:text-purple-800 dark:text-purple-400"
                                            >
                                                {doc.is_active ? "Deactivate" : "Activate"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal: Register New Doctor */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6  dark:bg-zinc-900 border border-black/10 dark:border-white/10">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Stethoscope className="h-4 w-4 text-purple-600" /> Register Clinical Doctor
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-foreground/50 hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateDoctor} className="mt-4 flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-1">
                                    Doctor Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newDocName}
                                    onChange={(e) => setNewDocName(e.target.value)}
                                    placeholder="e.g. Dr. Rajesh Pillai"
                                    className="w-full rounded-md border border-foreground/20 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1">
                                        Specialization <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={newDocSpecId}
                                        onChange={(e) => setNewDocSpecId(Number(e.target.value))}
                                        className="w-full rounded-md border border-foreground/20 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-foreground focus:border-purple-600 focus:outline-none cursor-pointer"
                                    >
                                        {specializations.map((spec) => (
                                            <option key={spec.id} value={spec.id}>
                                                {spec.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1">
                                        Slot Duration (Mins) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min={10}
                                        max={120}
                                        step={5}
                                        value={newDocDuration}
                                        onChange={(e) => setNewDocDuration(Number(e.target.value))}
                                        className="w-full rounded-md border border-foreground/20 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={newDocEmail}
                                        onChange={(e) => setNewDocEmail(e.target.value)}
                                        placeholder="doctor@kumarcentres.com"
                                        className="w-full rounded-md border border-foreground/20 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1">
                                        Mobile Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={newDocPhone}
                                        onChange={(e) => setNewDocPhone(e.target.value)}
                                        placeholder="+91 98400 00000"
                                        className="w-full rounded-md border border-foreground/20 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-1">
                                    Clinical Profile / Qualifications (Optional)
                                </label>
                                <textarea
                                    value={newDocDesc}
                                    onChange={(e) => setNewDocDesc(e.target.value)}
                                    placeholder="MBBS, MS (Ortho), Fellowship in Spine Rehabilitation..."
                                    rows={2}
                                    className="w-full rounded-md border border-foreground/20 bg-white dark:bg-zinc-800 p-2.5 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                                />
                            </div>

                            <div className="mt-4 flex justify-end gap-2.5">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAddModal(false)}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isSaving}
                                    className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5"
                                >
                                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    {isSaving ? "Registering..." : "Register Doctor"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

