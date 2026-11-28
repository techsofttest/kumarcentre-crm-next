/**
 * Utility functions for patient demographic calculations
 */

import { formatIstTime12h, getTodayIstYmd, toIstYmd } from "@/lib/date-utils";

export function calculateAgeFromDob(dobStr: string | null | undefined): number | null {
    if (!dobStr) return null;

    const istDob = toIstYmd(dobStr);
    if (!istDob) return null;

    const [yStr, mStr, dStr] = istDob.split("-");
    const birthYear = parseInt(yStr, 10);
    const birthMonth = parseInt(mStr, 10);
    const birthDay = parseInt(dStr, 10);
    if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return null;

    const todayIst = getTodayIstYmd();
    if (!todayIst) return null;
    const [tyStr, tmStr, tdStr] = todayIst.split("-");
    const todayYear = parseInt(tyStr, 10);
    const todayMonth = parseInt(tmStr, 10);
    const todayDay = parseInt(tdStr, 10);

    let age = todayYear - birthYear;
    if (todayMonth < birthMonth || (todayMonth === birthMonth && todayDay < birthDay)) {
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
    return formatIstTime12h(timeStr, "", false);
}
