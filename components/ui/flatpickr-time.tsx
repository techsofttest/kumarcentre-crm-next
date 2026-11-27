"use client";

import React, { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Clock } from "lucide-react";

interface FlatpickrTimeProps {
    value: string; // "09:00", "09:00:00", "14:30", etc. in 24h format
    onChange: (val: string) => void; // emits "09:00", "14:30" (24h format for backend consistency)
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function FlatpickrTime({
    value,
    onChange,
    placeholder = "--:-- --",
    disabled = false,
    className = "",
}: FlatpickrTimeProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const fpRef = useRef<flatpickr.Instance | null>(null);

    useEffect(() => {
        if (!inputRef.current) return;

        // Ensure 24h formatted string for initial date parsing
        const initialVal = value ? value.slice(0, 5) : "";

        fpRef.current = flatpickr(inputRef.current, {
            enableTime: true,
            noCalendar: true,
            dateFormat: "h:i K", // Displays e.g. "09:00 AM", "02:30 PM"
            time_24hr: false,   // 12-hour AM/PM picker
            defaultDate: initialVal || undefined,
            disableMobile: true,
            onChange: (selectedDates) => {
                if (selectedDates && selectedDates.length > 0) {
                    const d = selectedDates[0];
                    const hours = String(d.getHours()).padStart(2, "0");
                    const minutes = String(d.getMinutes()).padStart(2, "0");
                    onChange(`${hours}:${minutes}`);
                }
            },
        });

        return () => {
            if (fpRef.current) {
                fpRef.current.destroy();
                fpRef.current = null;
            }
        };
    }, []);

    // Sync external value changes (e.g. from state reset or fetch)
    useEffect(() => {
        if (fpRef.current && value) {
            const time24 = value.slice(0, 5);
            const currentSelected = fpRef.current.selectedDates[0];
            const current24 = currentSelected
                ? `${String(currentSelected.getHours()).padStart(2, "0")}:${String(currentSelected.getMinutes()).padStart(2, "0")}`
                : "";

            if (current24 !== time24) {
                fpRef.current.setDate(time24, false, "H:i");
            }
        }
    }, [value]);

    return (
        <div className={`relative inline-flex items-center ${className}`}>
            <input
                ref={inputRef}
                type="text"
                disabled={disabled}
                placeholder={placeholder}
                className="w-28 rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-center font-mono text-xs text-foreground focus:border-purple-600 focus:outline-none dark:border-white/15 dark:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer tracking-tight"
            />
            <Clock className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-foreground/40" />
        </div>
    );
}

