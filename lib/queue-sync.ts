/**
 * Real-time Clinical Queue Synchronization
 *
 * Provides cross-tab and cross-window real-time notification using the browser's
 * BroadcastChannel API, plus a storage event fallback.
 *
 * When a receptionist checks in a patient, this dispatches a lightweight event
 * that any open Doctor Dashboard catches immediately to re-fetch the live queue.
 */

const CHANNEL_NAME = "kumar_clinical_queue_sync";

export interface QueueSyncMessage {
    type: "CHECK_IN" | "STATUS_CHANGE" | "QUEUE_REFRESH";
    appointmentId?: number;
    patientName?: string;
    timestamp: number;
}

export function notifyQueueUpdate(
    type: QueueSyncMessage["type"] = "CHECK_IN",
    payload?: { appointmentId?: number; patientName?: string }
): void {
    if (typeof window === "undefined") return;

    const message: QueueSyncMessage = {
        type,
        appointmentId: payload?.appointmentId,
        patientName: payload?.patientName,
        timestamp: Date.now(),
    };

    try {
        if ("BroadcastChannel" in window) {
            const channel = new BroadcastChannel(CHANNEL_NAME);
            channel.postMessage(message);
            channel.close();
        }
    } catch {
        // Fallback for environments where BroadcastChannel is blocked
    }

    try {
        // Also trigger localStorage event as secondary cross-window fallback
        localStorage.setItem(CHANNEL_NAME, JSON.stringify(message));
    } catch {
        // Ignore quota/access errors
    }
}

export function subscribeToQueueUpdates(
    onUpdate: (message: QueueSyncMessage) => void
): () => void {
    if (typeof window === "undefined") return () => {};

    let channel: BroadcastChannel | null = null;

    try {
        if ("BroadcastChannel" in window) {
            channel = new BroadcastChannel(CHANNEL_NAME);
            channel.onmessage = (event) => {
                if (event.data && event.data.type) {
                    onUpdate(event.data);
                }
            };
        }
    } catch {
        // Fallback
    }

    const handleStorage = (event: StorageEvent) => {
        if (event.key === CHANNEL_NAME && event.newValue) {
            try {
                const data = JSON.parse(event.newValue);
                onUpdate(data);
            } catch {
                // Ignore parse errors
            }
        }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
        if (channel) {
            try {
                channel.close();
            } catch {
                // Ignore close errors
            }
        }
        window.removeEventListener("storage", handleStorage);
    };
}
