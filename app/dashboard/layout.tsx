"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/global/Sidebar";
import { normalizeRole, getRoleDashboardPath } from "@/lib/roles";
import { getAuthToken } from "@/lib/api";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const redirect = (path: string) => {
            setTimeout(() => router.replace(path), 0);
        };

        const token = getAuthToken();
        const storedRole = localStorage.getItem("userRole");

        if (!token || !storedRole) {
            setIsAuthorized(false);
            redirect("/login");
            return;
        }

        const activeRole = storedRole;
        setUserRole(activeRole);
        const normalized = normalizeRole(activeRole);
        const defaultPath = getRoleDashboardPath(activeRole);

        // If user visits /dashboard root, redirect them to their specific role dashboard
        if (pathname === "/dashboard") {
            router.replace(defaultPath);
            return;
        }

        // If non-admin accesses /dashboard/overview, route them to their specialized dashboard
        if (pathname === "/dashboard/overview" && normalized !== "admin") {
            router.replace(defaultPath);
            return;
        }

        // Doctor route protection
        if (normalized === "Doctor") {
            if (pathname === "/dashboard/schedule") {
                router.replace("/dashboard/doctor/schedule");
                return;
            }
            if (pathname === "/dashboard/calendar") {
                router.replace("/dashboard/doctor/appointments");
                return;
            }
            const allowedDoctor =
                pathname.startsWith("/dashboard/doctor") ||
                pathname.startsWith("/dashboard/patients");
            if (!allowedDoctor) {
                router.replace(defaultPath);
                return;
            }
        }

        // Physiotherapist route protection
        if (normalized === "Physiotherapist") {
            const allowedPhysio =
                pathname.startsWith("/dashboard/physiotherapist") ||
                pathname.startsWith("/dashboard/patients") ||
                pathname === "/dashboard/payments";
            if (!allowedPhysio) {
                router.replace(defaultPath);
                return;
            }
        }

        // Receptionist route protection
        if (normalized === "Receptionist") {
            const blockedForReceptionist =
                pathname.startsWith("/dashboard/doctor") ||
                pathname === "/dashboard/physiotherapist" ||
                pathname === "/dashboard/physiotherapist/reports" ||
                pathname === "/dashboard/staff" ||
                pathname === "/dashboard/reports";
            if (blockedForReceptionist) {
                router.replace(defaultPath);
                return;
            }
        }

        setIsAuthorized(true);
    }, [pathname, router]);

    if (!isAuthorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-50/60 dark:bg-black/60 text-xs text-foreground/60">
                Verifying session...
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-transparent">
            <div className="flex h-full w-full border border-black/10 dark:border-white/10 bg-transparent">
                {userRole && <Sidebar userRole={userRole} />}

                <main className="flex-1 overflow-hidden m-2 ml-0 rounded-[2rem] bg-slate-50/60 dark:bg-black/60 backdrop-blur-md border border-black/10 dark:border-white/10">
                    <div className="h-full w-full overflow-y-auto thin-scrollbar ">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
