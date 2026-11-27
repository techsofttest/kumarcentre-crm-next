/**
 * Utility functions for patient demographic calculations
 */

export function calculateAgeFromDob(dobStr: string | null | undefined): number | null {
    if (!dobStr) return null;

    let birthDate: Date;
    if (dobStr.includes("T")) {
        // ISO string e.g. "2013-06-16T18:30:00.000000Z"
        birthDate = new Date(dobStr);
    } else {
        const clean = dobStr.split(" ")[0];
        const parts = clean.split("-");
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // YYYY-MM-DD
                birthDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            } else {
                // DD-MM-YYYY
                birthDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            }
        } else {
            birthDate = new Date(dobStr);
        }
    }

    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 0 ? age : null;
}

export function getPatientAge(patient?: { age?: number | null; date_of_birth?: string | null } | null): number | null {
    if (!patient) return null;
    if (typeof patient.age === "number" && !isNaN(patient.age) && patient.age >= 0) {
        return patient.age;
    }
    return calculateAgeFromDob(patient.date_of_birth);
}

export function formatAgeGender(patient?: { age?: number | null; date_of_birth?: string | null; gender?: string | null } | null): string {
    if (!patient) return "—";
    const age = getPatientAge(patient);
    const ageStr = age !== null ? `${age} yrs` : "—";
    const genderStr = patient.gender ? ` • ${patient.gender}` : "";
    return `${ageStr}${genderStr}`;
}

export function formatTime12h(timeStr: string | null | undefined): string {
    if (!timeStr) return "";

    // If it's a full ISO or datetime timestamp (contains T, Z, or space with date)
    if (timeStr.includes("T") || timeStr.includes("Z")) {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata",
            });
        }
    }

    // If it's "YYYY-MM-DD HH:mm:ss"
    if (timeStr.includes(" ") && timeStr.includes("-")) {
        const timeOnly = timeStr.split(" ")[1];
        if (timeOnly) {
            timeStr = timeOnly;
        }
    }

    const cleanTime = timeStr.includes("T") ? timeStr.split("T")[1] : timeStr;
    const parts = cleanTime.slice(0, 5).split(":");
    if (parts.length !== 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    if (isNaN(h)) return timeStr;
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${m} ${period}`;
}
