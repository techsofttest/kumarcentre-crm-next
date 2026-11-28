"use client";

import React, { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Calendar as CalendarIcon } from "lucide-react";

interface FlatpickrDobProps {
    value: string; // ISO date string "YYYY-MM-DD"
    onChange: (val: string) => void; // emits "YYYY-MM-DD"
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    minDate?: string;
    maxDate?: string; // defaults to today
    defaultYear?: number; // defaults to 1995
}

export function FlatpickrDob({
    value,
    onChange,
    placeholder = "DD-MM-YYYY",
    disabled = false,
    className = "",
    minDate,
    maxDate = "today",
    defaultYear = 1995,
}: FlatpickrDobProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const fpRef = useRef<flatpickr.Instance | null>(null);

    useEffect(() => {
        if (!inputRef.current) return;

        fpRef.current = flatpickr(inputRef.current, {
            dateFormat: "d-m-Y", // displays as dd-MM-yyyy e.g. 15-08-1995
            minDate: minDate || undefined,
            maxDate: maxDate || undefined,
            defaultDate: value ? value.split("T")[0] : undefined,
            disableMobile: true,
            allowInput: true,
            onReady: (selectedDates, dateStr, instance) => {
                if ((!instance.selectedDates || instance.selectedDates.length === 0) && defaultYear) {
                    instance.jumpToDate(new Date(defaultYear, 0, 1));
                }
            },
            onOpen: (selectedDates, dateStr, instance) => {
                if ((!instance.selectedDates || instance.selectedDates.length === 0) && defaultYear) {
                    instance.changeYear(defaultYear);
                    instance.changeMonth(0, false);
                    instance.jumpToDate(new Date(defaultYear, 0, 1));
                }
            },
            onChange: (selectedDates) => {
                if (selectedDates && selectedDates.length > 0) {
                    const d = selectedDates[0];
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    onChange(`${y}-${m}-${day}`);
                } else {
                    onChange("");
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

    // Sync external value changes
    useEffect(() => {
        if (fpRef.current) {
            const cleanVal = value ? value.split("T")[0] : "";
            const currentSelected = fpRef.current.selectedDates[0];
            const currentVal = currentSelected
                ? `${currentSelected.getFullYear()}-${String(currentSelected.getMonth() + 1).padStart(2, "0")}-${String(currentSelected.getDate()).padStart(2, "0")}`
                : "";

            if (currentVal !== cleanVal) {
                if (cleanVal) {
                    fpRef.current.setDate(cleanVal, false, "Y-m-d");
                } else {
                    fpRef.current.clear();
                }
            }
        }
    }, [value]);

    return (
        <div className={`relative flex items-center ${className}`}>
            <input
                ref={inputRef}
                type="text"
                disabled={disabled}
                placeholder={placeholder}
                className="h-10 w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-zinc-900 px-3 pr-9 text-xs text-foreground focus:border-purple-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            />
            <CalendarIcon className="pointer-events-none absolute right-3 h-4 w-4 text-foreground/40" />
        </div>
    );
}
