"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type ToastType = "success" | "error";

interface ToastItem {
    id: number;
    type: ToastType;
    message: string;
}

const TOAST_EVENT = "kumar-alertify-toast";

export const alertify = {
    success(message: string) {
        if (typeof window !== "undefined" && message) {
            window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { type: "success", message } }));
        }
    },
    error(message: string) {
        if (typeof window !== "undefined" && message) {
            window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { type: "error", message } }));
        }
    },
};

export function AlertifyToaster() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ type: ToastType; message: string }>).detail;
            if (!detail?.message) return;

            const id = Date.now() + Math.floor(Math.random() * 1000);
            setToasts((prev) => [...prev.filter((t) => t.message !== detail.message), { id, type: detail.type, message: detail.message }]);

            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, 4500);
        };

        window.addEventListener(TOAST_EVENT, handler);
        return () => window.removeEventListener(TOAST_EVENT, handler);
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-5 right-5 z-[120] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    role="alert"
                    className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3.5 text-sm font-medium text-white shadow-2xl transition-all animate-in fade-in slide-in-from-top-3 ${
                        toast.type === "success"
                            ? "bg-emerald-600 border border-emerald-500"
                            : "bg-red-600 border border-red-500"
                    }`}
                >
                    {toast.type === "success" ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-white mt-0.5" />
                    ) : (
                        <AlertCircle className="h-5 w-5 shrink-0 text-white mt-0.5" />
                    )}
                    <span className="flex-1 leading-snug">{toast.message}</span>
                    <button
                        type="button"
                        onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                        className="text-white/80 hover:text-white shrink-0"
                        aria-label="Close notification"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

export function AlertifyToast({
    type,
    message,
    onClose,
}: {
    type: ToastType;
    message: string | null;
    onClose?: () => void;
}) {
    useEffect(() => {
        if (!message) return;
        if (type === "success") {
            alertify.success(message);
        } else {
            alertify.error(message);
        }
        if (onClose) {
            onClose();
        }
    }, [type, message, onClose]);

    return null;
}
