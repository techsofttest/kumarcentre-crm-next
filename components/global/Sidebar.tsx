"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
    LayoutDashboard,
    Calendar,
    Users,
    FolderHeart,
    FileText,
    Settings,
    CreditCard,
    Stethoscope,
    LogOut,
    MoreVertical,
    Bell,
    Activity,
    UserCheck,
    Building2,
    Clock,
    User
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { normalizeRole, getRoleDefaultUser, getRoleDashboardPath, UserRole } from "@/lib/roles";

// 1. Define Master Route Configuration
const sidebarConfig = [
    // Admin & Staff Dashboards
    { label: "Admin Overview", route: "/dashboard/overview", roles: ["admin", "super_admin", "administrator"], icon: LayoutDashboard },
    { label: "Physio Dashboard", route: "/dashboard/physiotherapist", roles: ["Physiotherapist"], icon: Activity },
    { label: "Reception Desk", route: "/dashboard/receptionist", roles: ["Receptionist", "reception"], icon: UserCheck },

    // Doctor Admin Navigation (6 Main Sections)
    { label: "Dashboard", route: "/dashboard/doctor", roles: ["Doctor", "clinician"], icon: LayoutDashboard },
    { label: "My Appointments", route: "/dashboard/doctor/appointments", roles: ["Doctor", "clinician"], icon: Calendar },
    { label: "Clinic Schedule", route: "/dashboard/doctor/schedule", roles: ["Doctor", "clinician"], icon: Clock },
    { label: "My Patients", route: "/dashboard/doctor/patients", roles: ["Doctor", "clinician"], icon: Users },
    { label: "Consultation History", route: "/dashboard/doctor/consultations", roles: ["Doctor", "clinician"], icon: FileText },
    { label: "My Profile", route: "/dashboard/doctor/profile", roles: ["Doctor", "clinician"], icon: User },

    // Clinical Schedules & Matrix (Admin, Receptionist)
    { label: "Calendar Matrix", route: "/dashboard/calendar", roles: ["admin", "Receptionist", "super_admin", "administrator", "reception"], icon: Calendar },
    { label: "Appointments", route: "/dashboard/appointments", roles: ["admin", "Receptionist", "super_admin", "administrator", "reception"], icon: FolderHeart },
    { label: "Physio Scheduling", route: "/dashboard/receptionist/physio", roles: ["admin", "Receptionist", "super_admin", "administrator", "reception"], icon: Activity },

    // Patients (Admin, Receptionist, Physio)
    { label: "Patient Database", route: "/dashboard/patients", roles: ["admin", "Receptionist", "Physiotherapist", "super_admin", "administrator", "reception"], icon: Users },

    // Administration & Operations
    { label: "Our Team", route: "/dashboard/staff", roles: ["admin", "super_admin", "administrator"], icon: Users },
    { label: "Physiotherapy Ledger", route: "/dashboard/payments", roles: ["admin", "Receptionist", "Physiotherapist", "super_admin", "administrator", "reception"], icon: CreditCard },
    { label: "Physio Reports", route: "/dashboard/physiotherapist/reports", roles: ["admin", "Physiotherapist", "super_admin", "administrator"], icon: FileText },

    // Clinic Operating Schedule & Exclusions (Restricted to Admin Only)
    { label: "Clinic Schedule", route: "/dashboard/schedule", roles: ["admin", "super_admin", "administrator"], icon: Calendar },
];

interface SidebarProps {
    userRole: string;
    firstName?: string;
    lastName?: string;
}

export default function Sidebar({ userRole }: SidebarProps) {
    const pathname = usePathname();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const normalized = normalizeRole(userRole);
    const defaultUser = getRoleDefaultUser(userRole);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowProfileMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter navigation items matching the role (either raw role or normalized role)
    const authorizedLinks = sidebarConfig.filter((item) =>
        item.roles.includes(userRole) || (normalized !== null && item.roles.includes(normalized))
    );

    return (
        <aside className="flex h-screen w-64 flex-col bg-transparent text-slate-900 dark:text-white transition-colors shrink-0">

            {/* Brand Header */}
            <div className="flex h-20 items-center px-6 border-b border-black/10 dark:border-white/10">
                <Link href={getRoleDashboardPath(userRole)} className="flex flex-col group">
                    <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                        Kumar Centres
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Medical & Health System
                    </span>
                </Link>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 space-y-1 overflow-y-auto p-4 thin-scrollbar">
                {authorizedLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive =
                        pathname === link.route ||
                        (link.route !== "/dashboard/overview" &&
                            link.route !== "/dashboard/doctor" &&
                            pathname.startsWith(link.route + "/"));

                    return (
                        <Link
                            key={link.route}
                            href={link.route}
                            className={`group flex items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                                isActive
                                    ? "bg-[#3C43EC] text-white "
                                    : "text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-[#01068B]/40 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <Icon
                                className={`h-5 w-5 transition-colors ${
                                    isActive ? "text-white" : "text-slate-500 dark:text-white/50 group-hover:text-slate-900 dark:group-hover:text-white"
                                }`}
                            />
                            {link.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer Profile / Logout Area */}
            <div className="relative p-4 border-t border-black/10 dark:border-white/10" ref={menuRef}>
                {showProfileMenu && (
                    <div className="absolute bottom-full left-4 mb-2 w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white p-2  dark:border-white/10 dark:bg-[#0f172a] z-50">
                        <div className="mb-2 px-2 py-1 flex items-center justify-center">
                            <ThemeToggle />
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    const { api, clearAuthSession } = await import("@/lib/api");
                                    await api.logout().catch(() => {});
                                    clearAuthSession();
                                } catch {
                                    localStorage.removeItem("token");
                                    localStorage.removeItem("user");
                                    localStorage.removeItem("userRole");
                                }
                                window.location.href = "/login";
                            }}
                            className="flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm font-normal text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/20 transition-all hover:bg-red-100 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300"
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </button>
                    </div>
                )}

                <div
                    className="flex items-center justify-between rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 p-2 transition-colors cursor-pointer select-none"
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3C43EC] text-xs font-bold text-white border border-black/10 dark:border-white/10">
                            {defaultUser.lastName ? `${defaultUser.firstName.charAt(0)}${defaultUser.lastName.charAt(0)}` : defaultUser.firstName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col truncate">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {defaultUser.lastName ? `${defaultUser.firstName} ${defaultUser.lastName}` : defaultUser.firstName}
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                                {normalized}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button className="text-slate-600 dark:text-white p-1 rounded-md bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 transition-colors">
                            <MoreVertical className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

        </aside>
    );
}

