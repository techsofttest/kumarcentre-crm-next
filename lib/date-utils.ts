/**
 * Shared date & time formatting utilities locked to Indian Standard Time (Asia/Kolkata).
 */

export const IST_TIMEZONE = "Asia/Kolkata";

const MONTH_NAMES_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const ymdFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

/**
 * Formats a JS Date object as YYYY-MM-DD in Asia/Kolkata.
 */
export function formatDateToIstYmd(date: Date): string {
    if (isNaN(date.getTime())) return "";
    const parts = ymdFormatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    return year && month && day ? `${year}-${month}-${day}` : "";
}

/**
 * Returns today's calendar date (or offset by N days) as YYYY-MM-DD in Asia/Kolkata.
 */
export function getTodayIstYmd(offsetDays = 0): string {
    const target = new Date(Date.now() + offsetDays * 86_400_000);
    return formatDateToIstYmd(target);
}

/**
 * Returns the first day of the current month as YYYY-MM-DD in Asia/Kolkata.
 */
export function getMonthStartIstYmd(): string {
    const today = getTodayIstYmd();
    return today ? `${today.slice(0, 7)}-01` : "";
}

/**
 * Converts a date or ISO timestamp string into an IST calendar date string (YYYY-MM-DD).
 * Full ISO timestamps (containing "T", "Z", or a UTC offset) are converted to Asia/Kolkata
 * before extracting the calendar date so UTC-midnight offsets never shift dates by -1 day.
 */
export function toIstYmd(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    const trimmed = dateStr.trim();
    if (!trimmed) return "";

    if (trimmed.includes("T") || trimmed.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            return formatDateToIstYmd(parsed);
        }
    }

    const cleanDate = trimmed.includes("T") ? trimmed.split("T")[0] : trimmed.split(" ")[0];
    const parts = cleanDate.split("-");
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
        }
        if (parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
    }

    return "";
}

/**
 * Formats a date or ISO timestamp string in IST as DD-MMM-YYYY (e.g. 28-Nov-2026).
 */
export function formatIstDate(dateStr: string | null | undefined, fallback = "—"): string {
    if (!dateStr) return fallback;
    const ymd = toIstYmd(dateStr);
    if (!ymd) return dateStr;

    const [year, monthStr, day] = ymd.split("-");
    const monthNum = parseInt(monthStr, 10);
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        return `${day}-${MONTH_NAMES_SHORT[monthNum - 1]}-${year}`;
    }

    return dateStr;
}

/**
 * Formats a date or ISO timestamp string in IST as DD-MM-YYYY (e.g. 28-11-2026).
 */
export function formatIstDateNumeric(dateStr: string | null | undefined, fallback = ""): string {
    if (!dateStr) return fallback;
    const ymd = toIstYmd(dateStr);
    if (!ymd) return dateStr;

    const [year, month, day] = ymd.split("-");
    return `${day}-${month}-${year}`;
}

/**
 * Formats a time string ("HH:mm[:ss]", "YYYY-MM-DD HH:mm:ss", or ISO timestamp) in IST 12h format.
 */
export function formatIstTime12h(
    timeStr: string | null | undefined,
    fallback = "",
    padHour = true
): string {
    if (!timeStr) return fallback;
    const trimmed = timeStr.trim();
    if (!trimmed) return fallback;

    if (trimmed.includes("T") || trimmed.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString("en-US", {
                hour: padHour ? "2-digit" : "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone: IST_TIMEZONE,
            });
        }
    }

    const match12h = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12h) {
        const hourNum = parseInt(match12h[1], 10);
        const h = padHour ? String(hourNum).padStart(2, "0") : String(hourNum);
        return `${h}:${match12h[2]} ${match12h[3].toUpperCase()}`;
    }

    let timeOnly = trimmed;
    if (timeOnly.includes(" ") && timeOnly.includes("-")) {
        const part = timeOnly.split(" ")[1];
        if (part) {
            timeOnly = part;
        }
    }

    const cleanTime = timeOnly.includes("T") ? timeOnly.split("T")[1] : timeOnly;
    const parts = cleanTime.slice(0, 5).split(":");
    if (parts.length !== 2) return timeStr;

    const h = parseInt(parts[0], 10);
    const m = parts[1];
    if (isNaN(h)) return timeStr;

    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const hourFormatted = padHour ? String(hour12).padStart(2, "0") : String(hour12);
    return `${hourFormatted}:${m} ${period}`;
}

/**
 * Formats a datetime or ISO timestamp string in IST as "DD-MMM-YYYY h:mm AM/PM".
 */
export function formatIstDateTime12h(dateTimeStr: string | null | undefined, fallback = "—"): string {
    if (!dateTimeStr) return fallback;
    const datePart = formatIstDate(dateTimeStr, "");
    const timePart = formatIstTime12h(dateTimeStr, "", false);
    if (datePart && timePart) {
        return `${datePart} ${timePart}`;
    }
    return datePart || timePart || fallback;
}
