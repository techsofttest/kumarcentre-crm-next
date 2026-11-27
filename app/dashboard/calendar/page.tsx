"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Filter,
    Clock,
    Search,
    Stethoscope,
    Activity,
    Loader2,
    RefreshCw
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { normalizeRole } from "@/lib/roles";

interface StaffLane {
    id: number | string;
    name: string;
    role: "Doctor" | "Physiotherapist";
    specialization?: string;
}

interface MatrixAppointment {
    id: number;
    reference: string;
    patient: string;
    service: string;
    staffId: number | string;
    date: string;
    startTime: string; // "09:30"
    durationMinutes: number;
    status: "pending_confirmation" | "confirmed" | "completed" | "cancelled" | "rejected";
}

const formatDateYMD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const convertTimeToMinutes = (t: string): number => {
    if (!t) return 0;
    const parts = t.split(":");
    const hrs = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    return hrs * 60 + mins;
};

export default function CalendarMatrix() {
    const router = useRouter();

    // Date navigation
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const formattedDate = useMemo(() => formatDateYMD(currentDate), [currentDate]);

    // Data from Backend
    const [staffList, setStaffList] = useState<StaffLane[]>([]);
    const [appointments, setAppointments] = useState<MatrixAppointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<"All" | "Doctor" | "Physiotherapist">("All");

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Grid configuration: 08:00 to 18:00 (10 hours)
    const startHour = 8;
    const endHour = 18;
    const hours = Array.from({ length: endHour - startHour }, (_, i) => i + startHour);
    const rowHeight = 110; // 110px per hour

    const loadMatrixData = async () => {
        const storedRole = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
        const normalizedRole = normalizeRole(storedRole);
        if (normalizedRole === "Physiotherapist") {
            router.replace("/dashboard/physiotherapist");
            return;
        }

        setIsLoading(true);
        try {
            // 1. Fetch doctors and appointments (gracefully fall back to public doctors if admin endpoint is forbidden)
            const fetchDoctors = async () => {
                try {
                    return await api.getAdminDoctors();
                } catch {
                    const pub = await api.getPublicDoctors();
                    return { data: pub.data, specializations: [] };
                }
            };

            const [doctorsRes, appointmentsRes] = await Promise.all([
                fetchDoctors(),
                api.getAppointments({ date: formattedDate }),
            ]);

            const lanes: StaffLane[] = [];

            // Add registered doctors
            (doctorsRes.data || []).forEach((doc: any) => {
                lanes.push({
                    id: doc.id,
                    name: doc.name,
                    role: "Doctor",
                    specialization: doc.specialization?.name || "Consultant",
                });
            });

            // Add active physiotherapist lane
            if (appointmentsRes.physiotherapists && appointmentsRes.physiotherapists.length > 0) {
                appointmentsRes.physiotherapists.forEach((p: any) => {
                    lanes.push({
                        id: `physio-${p.id}`,
                        name: p.name,
                        role: "Physiotherapist",
                        specialization: "Physical Therapy & Rehab",
                    });
                });
            } else {
                lanes.push({
                    id: "physio-default",
                    name: "Lead Physiotherapist",
                    role: "Physiotherapist",
                    specialization: "Physical Therapy & Rehab",
                });
            }

            setStaffList(lanes);

            // 2. Map appointments onto grid
            const mappedAppointments: MatrixAppointment[] = (appointmentsRes.data || []).map((apt: any) => {
                const startMins = convertTimeToMinutes(apt.start_time);
                const endMins = convertTimeToMinutes(apt.end_time);
                const duration = Math.max(endMins - startMins, 30);

                // Determine lane: if procedure and assigned to physio, assign to physio lane, else doctor lane
                let laneId: number | string = apt.doctor_id;
                if (apt.appointment_type === "procedure") {
                    laneId = apt.assigned_physio_id ? `physio-${apt.assigned_physio_id}` : "physio-default";
                }

                return {
                    id: apt.id,
                    reference: apt.reference,
                    patient: apt.patient?.name || "Patient",
                    service: (apt.appointment_type || "Consultation").replace('_', ' '),
                    staffId: laneId,
                    date: apt.appointment_date?.slice(0, 10),
                    startTime: apt.start_time?.slice(0, 5),
                    durationMinutes: duration,
                    status: apt.status,
                };
            });

            setAppointments(mappedAppointments);
        } catch (err: any) {
            console.error("Failed to load live calendar matrix:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const storedRole = localStorage.getItem("userRole") || "";
        const normalized = (normalizeRole(storedRole) ?? "").toLowerCase();
        if (normalized === "doctor") {
            router.replace("/dashboard/doctor/appointments");
            return;
        }
        loadMatrixData();
    }, [formattedDate, router]);

    // Prev / Next / Today
    const handlePrevDay = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 1);
        setCurrentDate(d);
    };

    const handleNextDay = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 1);
        setCurrentDate(d);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -300, behavior: "smooth" });
        }
    };

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 300, behavior: "smooth" });
        }
    };

    // Filter staff lanes
    const displayedStaff = useMemo(() => {
        return staffList.filter((staff) => {
            const matchesRole = roleFilter === "All" || staff.role === roleFilter;
            const matchesSearch =
                staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (staff.specialization || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                appointments.some(
                    (a) =>
                        String(a.staffId) === String(staff.id) &&
                        a.patient.toLowerCase().includes(searchQuery.toLowerCase())
                );
            return matchesRole && matchesSearch;
        });
    }, [staffList, roleFilter, searchQuery, appointments]);

    // Calculate vertical offset and height
    const calculatePosition = (startTimeStr: string, durationMinutes: number) => {
        const startMins = convertTimeToMinutes(startTimeStr);
        const gridStartMins = startHour * 60;
        const offsetMins = Math.max(startMins - gridStartMins, 0);

        const top = (offsetMins / 60) * rowHeight;
        const height = Math.max((durationMinutes / 60) * rowHeight, 40);

        return { top: `${top}px`, height: `${height}px` };
    };

    const getStatusColors = (status: string) => {
        switch (status) {
            case "confirmed":
                return "bg-green-100 border-green-300 text-green-900 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300";
            case "completed":
                return "bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300";
            case "pending_confirmation":
                return "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300";
            case "cancelled":
            case "rejected":
                return "bg-red-100 border-red-300 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 line-through opacity-70";
            default:
                return "bg-slate-100 border-slate-300 text-slate-800 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200";
        }
    };

    return (
        <div className="flex h-full w-full flex-col p-8">
            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Calendar Matrix
                    </h1>
                </div>

                {/* Date Controls & Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-1 rounded-lg border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-zinc-900">
                        <button
                            onClick={handlePrevDay}
                            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-foreground/70 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={handleToday}
                            className="px-2.5 py-1 text-xs font-bold text-foreground hover:bg-slate-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        >
                            Today
                        </button>
                        <button
                            onClick={handleNextDay}
                            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-foreground/70 transition-colors"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                        <span className="font-bold text-xs text-purple-700 dark:text-purple-300 px-2 border-l border-black/10 dark:border-white/10">
                            {formattedDate}
                        </span>
                    </div>

                    {/* Search */}
                    <div className="relative w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
                        <input
                            type="text"
                            placeholder="Filter staff or patient..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-md border border-foreground/20 bg-white dark:bg-zinc-900 pl-8 pr-3 py-1 text-xs text-foreground focus:border-purple-600 focus:outline-none"
                        />
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        icon={RefreshCw}
                        onClick={loadMatrixData}
                        disabled={isLoading}
                    >
                        {isLoading ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>
            </div>

            {/* Matrix Viewport */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-auto thin-scrollbar rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900"
            >
                <div
                    className="flex flex-col"
                    style={{
                        minWidth: "100%",
                        width: `${Math.max(80 + displayedStaff.length * 240, 800)}px`,
                    }}
                >
                    {/* Sticky Column Headers (Staff Lanes) */}
                    <div className="sticky top-0 z-40 flex border-b border-black/10 bg-slate-50 dark:bg-zinc-900 dark:border-white/10">
                        {/* Time column header */}
                        <div className="sticky left-0 z-50 w-20 border-r border-black/10 bg-slate-50 dark:bg-zinc-900 p-3.5 dark:border-white/10">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                                Time
                            </span>
                        </div>

                        {/* Staff Lanes */}
                        {displayedStaff.map((staff) => (
                            <div
                                key={staff.id}
                                className="flex flex-1 min-w-[240px] flex-col items-center justify-center border-r border-black/10 py-3 last:border-r-0 dark:border-white/10"
                            >
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    {staff.role === "Physiotherapist" ? (
                                        <Activity className="h-3.5 w-3.5 text-teal-600" />
                                    ) : (
                                        <Stethoscope className="h-3.5 w-3.5 text-purple-600" />
                                    )}
                                    {staff.name}
                                </span>
                                <span className="text-[11px] text-foreground/50 mt-0.5">
                                    {staff.specialization}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Grid Body */}
                    <div className="relative flex">
                        {/* Y-Axis: Time Slots */}
                        <div className="sticky left-0 z-30 w-20 border-r border-black/10 bg-white dark:bg-zinc-900 dark:border-white/10">
                            {hours.map((hour) => (
                                <div
                                    key={hour}
                                    className="flex flex-col items-end pr-2.5 pt-2 text-[11px] font-semibold text-foreground/50 border-b border-black/5 dark:border-white/5"
                                    style={{ height: `${rowHeight}px` }}
                                >
                                    {hour === 12 ? "12:00 PM" : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                                </div>
                            ))}
                        </div>

                        {/* X-Axis: Staff Columns & Appointments */}
                        <div className="relative flex flex-1">
                            {/* Grid Lines */}
                            <div className="absolute inset-0 flex flex-col pointer-events-none">
                                {hours.map((hour) => (
                                    <div
                                        key={`line-${hour}`}
                                        className="w-full border-b border-black/5 dark:border-white/5"
                                        style={{ height: `${rowHeight}px` }}
                                    />
                                ))}
                            </div>

                            {/* Staff Appointment Lanes */}
                            {displayedStaff.map((staff) => {
                                const staffAppointments = appointments.filter(
                                    (a) => String(a.staffId) === String(staff.id)
                                );

                                return (
                                    <div
                                        key={`lane-${staff.id}`}
                                        className="relative flex-1 min-w-[240px] border-r border-black/10 last:border-r-0 dark:border-white/10"
                                    >
                                        {staffAppointments.map((apt) => {
                                            const { top, height } = calculatePosition(
                                                apt.startTime,
                                                apt.durationMinutes
                                            );

                                            return (
                                                <div
                                                    key={apt.id}
                                                    onClick={() => router.push(`/dashboard/appointments`)}
                                                    className={`absolute left-2 right-2 z-10 flex flex-col overflow-hidden rounded-lg border p-2.5 cursor-pointer transition-all hover:ring-2 hover:ring-purple-600 ${getStatusColors(
                                                        apt.status
                                                    )}`}
                                                    style={{ top, height }}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-xs truncate">
                                                            {apt.patient}
                                                        </span>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                                                            {apt.status.replace('_', ' ')}
                                                        </span>
                                                    </div>

                                                    <div className="text-[11px] font-medium opacity-90 truncate mt-0.5">
                                                        {apt.service}
                                                    </div>

                                                    <div className="mt-auto flex items-center justify-between text-[10px] opacity-80 pt-1 font-mono">
                                                        <span>{apt.startTime} ({apt.durationMinutes}m)</span>
                                                        <span>{apt.reference}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {staffAppointments.length === 0 && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <span className="text-[11px] text-foreground/20 italic">
                                                    No bookings
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Legend & Scroll Controls */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-foreground/70">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-sm bg-amber-400"></div> Pending
                    </span>
                    <span className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-sm bg-green-500"></div> Confirmed
                    </span>
                    <span className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-sm bg-blue-500"></div> Completed
                    </span>
                    <span className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-sm bg-red-600 opacity-70"></div> Cancelled / Rejected
                    </span>
                </div>

                {displayedStaff.length > 2 && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={scrollLeft}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-black/10 bg-white hover:bg-slate-100 text-foreground dark:border-white/10 dark:bg-zinc-800 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={scrollRight}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-black/10 bg-white hover:bg-slate-100 text-foreground dark:border-white/10 dark:bg-zinc-800 transition-colors"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
