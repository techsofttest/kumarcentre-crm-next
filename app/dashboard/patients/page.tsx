"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Search,
    Plus,
    User,
    Phone,
    Mail,
    ChevronRight,
    Loader2,
    Calendar,
    FileText
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { normalizeRole } from "@/lib/roles";
import { formatIstDate, formatIstDateNumeric } from "@/lib/date-utils";

interface PatientItem {
    id: number;
    name: string;
    mobile_number: string;
    alternate_contact_number?: string | null;
    email?: string | null;
    file_number?: string | null;
    date_of_birth?: string | null;
    age?: number | null;
    gender?: string | null;
    registration_date?: string | null;
    created_at?: string | null;
    total_appointments?: number;
    upcoming_appointments_count?: number;
}

function formatDateDisplay(dateStr: string | null | undefined): string {
    return formatIstDate(dateStr, "—");
}

function formatDobNumeric(dateStr: string | null | undefined): string {
    return formatIstDateNumeric(dateStr, "");
}

export default function PatientCRM() {
    const router = useRouter();
    const [userRole, setUserRole] = useState<string>("Receptionist");
    const [patients, setPatients] = useState<PatientItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    const normalizedRole = normalizeRole(userRole);
    const isDoctor = normalizedRole === "Doctor";
    const isPhysio = normalizedRole === "Physiotherapist";

    useEffect(() => {
        const storedRole = localStorage.getItem("userRole");
        if (storedRole) {
            setUserRole(storedRole);
        }
    }, []);

    const fetchPatients = async (query = "") => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await api.getPatients(query);
            setPatients(res.data || []);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load patients from database.");
            setPatients([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchPatients(searchQuery);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .filter(Boolean)
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .substring(0, 2);
    };

    return (
        <div className="flex h-full w-full overflow-hidden">
            <div className="flex flex-col w-full">
                {/* Header & Search */}
                <div className="flex flex-col gap-4 border-b border-black/[.15] p-8 dark:border-white/[.22]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Patient Database</h1>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-64 md:w-80">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search by Name, Phone, File #..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-10 w-full rounded-md border border-black/[.15] bg-white dark:bg-zinc-900 pl-9 pr-4 text-sm text-foreground focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 dark:border-white/[.22]"
                                />
                            </div>
                            {!isDoctor && !isPhysio && (
                                <Button variant="filled" icon={Plus} onClick={() => router.push("/dashboard/appointments/new")}>
                                    New Appointment
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Database Table */}
                <div className="flex-1 overflow-hidden p-8">
                    {errorMessage && (
                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                            {errorMessage}
                        </div>
                    )}

                    <div className="h-full rounded-xl border border-black/[.15] bg-white dark:bg-zinc-900 dark:border-white/[.22] overflow-auto thin-scrollbar">
                        <table className="w-full text-left text-sm text-foreground">
                            <thead className="border-b border-black/[.15] bg-black/[.02] text-xs uppercase text-foreground/60 dark:border-white/[.22] dark:bg-white/[.02]">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Patient Info</th>
                                    <th className="px-6 py-4 font-medium">Contact Details</th>
                                    <th className="px-6 py-4 font-medium">File / Reference #</th>
                                    <th className="px-6 py-4 font-medium">Registered Date</th>
                                    <th className="px-6 py-4 text-right font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/[.08] dark:divide-white/[.145]">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-foreground/50">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                                                <span>Loading dynamic patient database...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : patients.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-foreground/50">
                                            No patients found matching your search.
                                        </td>
                                    </tr>
                                ) : (
                                    patients.map((patient) => (
                                        <tr
                                            key={patient.id}
                                            onClick={() => router.push(`/dashboard/patients/${patient.id}`)}
                                            className="cursor-pointer transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
                                        >
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-sm">
                                                        {getInitials(patient.name)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-foreground">{patient.name}</span>
                                                        <span className="text-xs text-foreground/50">
                                                            {patient.gender ? `${patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : "Other"}` : ""}
                                                            {patient.gender && patient.age !== null && patient.age !== undefined ? " • " : ""}
                                                            {patient.age !== null && patient.age !== undefined ? `Age: ${patient.age}` : ""}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="flex items-center gap-1.5 text-xs text-foreground/80 font-medium">
                                                        <Phone className="h-3 w-3 text-foreground/50" /> {patient.mobile_number}
                                                    </span>
                                                    {patient.alternate_contact_number && (
                                                        <span className="text-[11px] text-foreground/50">
                                                            Alt: {patient.alternate_contact_number}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                {patient.file_number ? (
                                                    <span className="rounded bg-purple-100 px-2 py-0.5 font-mono text-xs font-semibold text-purple-900 dark:bg-purple-950/60 dark:text-purple-300">
                                                        {patient.file_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-foreground/40 font-mono">
                                                        #{patient.id}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-xs text-foreground/70">
                                                {formatDateDisplay(patient.registration_date || patient.created_at)}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right">
                                                <ChevronRight className="ml-auto h-4 w-4 text-foreground/40" />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
