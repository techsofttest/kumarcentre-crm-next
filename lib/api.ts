/**
 * API Client for Kumar Centres Clinical Management System
 * Connects to Laravel Backend API (/api/v1)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

export class ApiError extends Error {
    constructor(
        public message: string,
        public status: number,
        public errors?: Record<string, string[]>,
        public data?: any
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
}

export function setAuthSession(token: string, user: any) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('userRole', user.role);
}

export function clearAuthSession() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
}

export function getCurrentUser() {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

export async function apiClient<T = any>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${cleanEndpoint}`;

    const res = await fetch(url, {
        ...options,
        headers,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const errorMsg = data?.message || (res.status === 401 ? 'Unauthenticated. Please log in again.' : `Request failed with status ${res.status}`);
        if (res.status === 401 && typeof window !== 'undefined') {
            clearAuthSession();
        }
        throw new ApiError(errorMsg, res.status, data?.errors, data);
    }

    return data;
}

export const api = {
    // Auth
    login: (credentials: { email: string; password: string }) =>
        apiClient<{ token: string; user: any; message: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        }),
    me: () => apiClient<{ user: any }>('/auth/me'),
    logout: () => apiClient<{ message: string }>('/auth/logout', { method: 'POST' }),

    // Receptionist
    getAppointments: (params?: Record<string, string>) => {
        const searchParams = new URLSearchParams(params);
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return apiClient(`/receptionist/appointments${query}`);
    },
    confirmAppointment: (id: number) =>
        apiClient(`/receptionist/appointments/${id}/confirm`, { method: 'PATCH' }),
    checkInAppointment: (id: number) =>
        apiClient<{ message: string; appointment: any }>(`/receptionist/appointments/${id}/check-in`, { method: 'POST' }),
    rejectAppointment: (id: number, reason: string) =>
        apiClient(`/receptionist/appointments/${id}/reject`, {
            method: 'PATCH',
            body: JSON.stringify({ reason }),
        }),
    cancelAppointment: (id: number, reason: string) =>
        apiClient(`/receptionist/appointments/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),
    rescheduleAppointment: (id: number, payload: { appointment_date: string; start_time: string }) =>
        apiClient(`/receptionist/appointments/${id}/reschedule`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    assignPhysiotherapist: (id: number, physio_id: number) =>
        apiClient(`/receptionist/appointments/${id}/assign-physio`, {
            method: 'PATCH',
            body: JSON.stringify({ physio_id }),
        }),
    searchPatients: (query: string, type: 'mobile' | 'file_number') =>
        apiClient<{ data: Array<{
            id: number;
            name: string;
            mobile_number: string;
            alternate_contact_number?: string | null;
            file_number?: string | null;
            date_of_birth?: string | null;
            age?: number | null;
            gender?: string | null;
            registration_date?: string | null;
        }> }>(
            `/receptionist/patients/search?query=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`
        ),
    registerPatientInline: (payload: {
        name: string;
        mobile_number: string;
        alternate_contact_number?: string;
        date_of_birth?: string;
        gender?: 'M' | 'F' | 'O';
        allow_duplicate?: boolean;
    }) =>
        apiClient<{ message: string; patient: {
            id: number;
            name: string;
            mobile_number: string;
            alternate_contact_number?: string | null;
            file_number?: string | null;
            date_of_birth?: string | null;
            age?: number | null;
            gender?: string | null;
            registration_date?: string | null;
        } }>(
            '/receptionist/patients',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        ),
    createReceptionistAppointment: (payload: {
        patient_id: number;
        doctor_id: number;
        appointment_type: string;
        appointment_date: string;
        start_time: string;
        assigned_physio_id?: number | null;
        internal_notes?: string;
        send_whatsapp?: boolean;
    }) =>
        apiClient<{
            message: string;
            appointment: {
                id: number;
                reference: string;
                appointment_type: string;
                appointment_date: string;
                start_time: string;
                end_time: string;
                status: string;
                status_label: string;
                patient: { id: number; name: string; file_number: string | null; mobile_number: string };
                doctor: { id: number; name: string };
                assigned_physiotherapist?: { id: number; name: string } | null;
            };
        }>('/receptionist/appointments', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    // Patients CRM
    getPatients: (search?: string) => {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        return apiClient<{
            data: Array<{
                id: number;
                name: string;
                mobile_number: string;
                alternate_contact_number?: string | null;
                email?: string | null;
                file_number?: string | null;
                date_of_birth?: string | null;
                age?: number | null;
                gender?: string | null;
                registration_date?: string | null;
                notes?: string | null;
                total_appointments?: number;
                upcoming_appointments_count?: number;
            }>;
            meta: { current_page: number; last_page: number; per_page: number; total: number };
        }>(`/patients${query}`);
    },
    getPatientDetail: (id: string | number) =>
        apiClient<{
            patient: {
                id: number;
                name: string;
                mobile_number: string;
                alternate_contact_number?: string | null;
                email?: string | null;
                file_number?: string | null;
                date_of_birth?: string | null;
                age?: number | null;
                gender?: string | null;
                registration_date?: string | null;
                notes?: string | null;
                created_at?: string | null;
            };
            upcoming_appointments: Array<{
                id: number;
                reference: string;
                doctor_id: number;
                doctor_name: string;
                doctor_specialization?: string | null;
                appointment_type: string;
                appointment_type_label: string;
                appointment_date: string;
                start_time: string;
                end_time: string;
                status: string;
                status_label: string;
                internal_notes?: string | null;
            }>;
            completed_appointments: Array<{
                id: number;
                reference: string;
                doctor_id: number;
                doctor_name: string;
                doctor_specialization?: string | null;
                appointment_type: string;
                appointment_type_label: string;
                appointment_date: string;
                start_time: string;
                end_time: string;
                status: string;
                status_label: string;
                notes?: string | null;
                physio_completion_notes?: string | null;
                completed_at?: string | null;
            }>;
        }>(`/patients/${id}`),
    updatePatientDetail: (id: string | number, payload: {
        name: string;
        mobile_number: string;
        alternate_contact_number?: string | null;
        email?: string | null;
        date_of_birth?: string | null;
        gender?: 'M' | 'F' | 'O' | null;
        notes?: string | null;
    }) =>
        apiClient<{
            message: string;
            patient: {
                id: number;
                name: string;
                mobile_number: string;
                alternate_contact_number?: string | null;
                email?: string | null;
                file_number?: string | null;
                date_of_birth?: string | null;
                age?: number | null;
                gender?: string | null;
                registration_date?: string | null;
                notes?: string | null;
            };
        }>(`/patients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),

    // Physiotherapist
    getPhysioQueue: (search?: string) => {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        return apiClient(`/physiotherapist/queue${query}`);
    },
    completePhysioSession: (id: number, completion_notes?: string) =>
        apiClient(`/physiotherapist/sessions/${id}/complete`, {
            method: 'POST',
            body: JSON.stringify({ completion_notes }),
        }),
    getPhysioDashboard: (params?: { search?: string; filter?: string; page?: number }) => {
        const sp = new URLSearchParams();
        if (params?.search) sp.append('search', params.search);
        if (params?.filter) sp.append('filter', params.filter);
        if (params?.page) sp.append('page', String(params.page));
        const query = sp.toString() ? `?${sp.toString()}` : '';
        return apiClient<{
            summary: {
                total_assigned_patients: number;
                new_referrals: number;
                undergoing_treatment: number;
                today_sessions: number;
                completed_sessions: number;
                awaiting_closure: number;
            };
            today_sessions: Array<{
                id: number;
                session_number: number;
                status: string;
                status_label: string;
                started_at: string | null;
                completed_at: string | null;
                treatment_performed: string | null;
                physiotherapist_name: string;
                referral_id: number;
                referral_number: string;
                patient_name: string;
                patient_file_number: string | null;
                patient_mobile_number: string;
            }>;
            referrals: {
                data: Array<{
                    id: number;
                    referral_number: string;
                    patient: {
                        id: number;
                        name: string;
                        file_number: string | null;
                        mobile_number: string;
                        age?: number | null;
                        gender?: string | null;
                    };
                    referral_date: string;
                    referring_doctor: string;
                    assigned_physiotherapist: string;
                    status: string;
                    status_label: string;
                    treatment_instructions: string;
                    billing_model: string;
                    billing_type: string;
                    session_charge: number | null;
                    package_price: number | null;
                    included_sessions: number | null;
                    sessions_completed: number;
                    sessions_remaining: number | null;
                    total_charges: number;
                    total_payments: number;
                    outstanding_balance: number;
                    available_advance_credit: number;
                    payment_status: string;
                    last_session_date: string | null;
                }>;
                meta: {
                    current_page: number;
                    last_page: number;
                    total: number;
                    per_page: number;
                };
            };
        }>(`/physiotherapist/dashboard${query}`, { cache: 'no-store' });
    },
    getPhysioReferralDetail: (id: number) =>
        apiClient<{
            referral: {
                id: number;
                referral_number: string;
                referral_date: string;
                referring_doctor: string;
                assigned_physiotherapist: string;
                assigned_physio_id?: number | null;
                clinical_remarks: string | null;
                treatment_instructions: string;
                status: string;
                status_label: string;
                completion_notes: string | null;
                treatment_completed_at: string | null;
                closed_at: string | null;
            };
            patient: {
                id: number;
                name: string;
                file_number: string | null;
                mobile_number: string;
                alternate_contact_number: string | null;
                email: string | null;
                date_of_birth: string | null;
                age: number | null;
                gender: string | null;
            };
            billing_plan: {
                billing_type: string;
                billing_type_label: string;
                session_charge: number | null;
                package_name: string | null;
                package_price: number | null;
                included_sessions: number | null;
            };
            financial_summary: {
                total_charges: number;
                total_payments: number;
                outstanding_balance: number;
                available_advance_credit: number;
                payment_status: string;
            };
            treatment_plan: {
                billing_type: string;
                sessions_completed: number;
                sessions_remaining: number | null;
                package_payment_progress: number | null;
            };
            active_session: {
                id: number;
                session_number: number;
                started_at: string;
                physiotherapist_name: string;
                status: string;
            } | null;
            sessions: Array<{
                id: number;
                session_number: number;
                date: string;
                start_time: string;
                end_time: string | null;
                physiotherapist_name: string;
                treatment_performed: string | null;
                patient_response: string | null;
                progress_remarks: string | null;
                additional_notes: string | null;
                status: string;
                status_label: string;
                charge_amount: number | null;
            }>;
            ledger: Array<{
                id: number;
                reference_number: string;
                transaction_type: string;
                transaction_type_label: string;
                amount: number;
                description: string;
                transaction_date: string;
                payment_method: string | null;
                payment_method_label: string | null;
                payment_reference: string | null;
                notes: string | null;
                created_by: string;
                received_by: string | null;
                is_charge: boolean;
                is_payment: boolean;
                allocated_amount: number;
                unallocated_amount: number;
                is_reversed: boolean;
                reversal_reason: string | null;
            }>;
        }>(`/physiotherapist/referrals/${id}`, { cache: 'no-store' }),

    startPhysioSession: (referralId: number) =>
        apiClient<{ message: string; session: any }>(`/physiotherapist/referrals/${referralId}/start-session`, {
            method: 'POST',
        }),

    completePhysioTreatmentSession: (sessionId: number, payload: {
        treatment_performed: string;
        patient_response?: string;
        progress_remarks?: string;
        additional_notes?: string;
        charge_amount?: number;
        completed_at?: string;
    }) =>
        apiClient<{ message: string; session: any }>(`/physiotherapist/treatment-sessions/${sessionId}/complete`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    cancelPhysioTreatmentSession: (sessionId: number, reason?: string) =>
        apiClient<{ message: string; session: any }>(`/physiotherapist/treatment-sessions/${sessionId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),

    completePhysioTreatment: (referralId: number, remarks: string) =>
        apiClient<{ message: string; status: string; treatment_completed_at: string }>(`/physiotherapist/referrals/${referralId}/complete-treatment`, {
            method: 'POST',
            body: JSON.stringify({ remarks }),
        }),

    closePhysioReferral: (referralId: number) =>
        apiClient<{ message: string; status: string; closed_at: string }>(`/physiotherapist/referrals/${referralId}/close`, {
            method: 'POST',
        }),

    cancelPhysioReferral: (referralId: number, reason: string) =>
        apiClient<{ message: string; status: string }>(`/physiotherapist/referrals/${referralId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),

    assignPhysioReferral: (referralId: number, assignedPhysioId: number) =>
        apiClient<{ message: string; assigned_physio_id: number; assigned_physiotherapist: string }>(`/receptionist/referrals/${referralId}/assign`, {
            method: 'PATCH',
            body: JSON.stringify({ assigned_physio_id: assignedPhysioId }),
        }),

    configurePhysioBillingPlan: (referralId: number, data: {
        billing_type: 'per_session' | 'package';
        session_charge?: number;
        package_name?: string;
        package_price?: number;
        included_sessions?: number;
    }) =>
        apiClient<{ message: string; referral_status?: string; billing_plan: any }>(`/physiotherapist/referrals/${referralId}/billing-plan`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    revisePhysioCost: (referralId: number, data: { new_cost: number; reason: string }) =>
        apiClient<{ message: string; treatment_cost: number; outstanding_balance: number; excess_payment: number; revision: any }>(`/referrals/${referralId}/revise-cost`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    recordPhysioRefund: (referralId: number, data: { amount: number; payment_method: string; payment_reference?: string; refund_date?: string; reason: string }) =>
        apiClient<{ message: string; transaction: any }>(`/receptionist/referrals/${referralId}/refund`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    allocatePhysioCredit: (referralId: number, data: { amount: number; credit_date?: string; reason: string }) =>
        apiClient<{ message: string; transaction: any }>(`/receptionist/referrals/${referralId}/credit`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    recordPhysioPayment: (payload: {
        referral_id: number;
        amount: number;
        payment_method: string;
        payment_reference?: string;
        payment_date?: string;
        notes?: string;
        idempotency_key?: string;
    }) =>
        apiClient<{ message: string; transaction: any; financial_summary: any }>('/physiotherapist/payments', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    getPhysioLedger: (params?: { referral_id?: number; patient_id?: number; page?: number }) => {
        const sp = new URLSearchParams();
        if (params?.referral_id) sp.append('referral_id', String(params.referral_id));
        if (params?.patient_id) sp.append('patient_id', String(params.patient_id));
        if (params?.page) sp.append('page', String(params.page));
        const query = sp.toString() ? `?${sp.toString()}` : '';
        return apiClient<{
            data: Array<any>;
            meta: { current_page: number; last_page: number; total: number };
            summary: {
                total_charges: number;
                total_payments: number;
                net_balance: number;
                available_credit: number;
            };
        }>(`/physiotherapist/ledger${query}`, { cache: 'no-store' });
    },

    exportPhysioLedger: async (fromDate: string, toDate: string): Promise<Blob> => {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const userRole = typeof window !== 'undefined' ? (localStorage.getItem('userRole') || '').toLowerCase() : '';
        const prefix = userRole.includes('admin') ? '/admin' : '/receptionist';

        const response = await fetch(
            `${baseUrl}${prefix}/physio/ledger/export?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`,
            {
                method: 'GET',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    Accept: 'application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            }
        );

        if (!response.ok) {
            let message = 'Failed to export physiotherapy ledger.';
            try {
                const err = await response.json();
                if (err?.message) message = err.message;
            } catch {
                // ignore non-JSON error body
            }
            throw new Error(message);
        }

        return response.blob();
    },

    getPhysioReports: (params?: { start_date?: string; end_date?: string }) => {
        const sp = new URLSearchParams();
        if (params?.start_date) sp.append('start_date', params.start_date);
        if (params?.end_date) sp.append('end_date', params.end_date);
        const query = sp.toString() ? `?${sp.toString()}` : '';
        return apiClient<{
            date_range: { start_date: string; end_date: string };
            summary: {
                total_sessions: number;
                completed_sessions: number;
                in_progress_sessions: number;
                total_collections: number;
                total_referrals: number;
                active_referrals: number;
                completed_referrals: number;
                closed_referrals: number;
            };
            sessions: Array<{
                id: number;
                session_number: number;
                date: string;
                time: string;
                patient_name: string;
                patient_file_number: string | null;
                physiotherapist_name: string;
                status: string;
                charge_amount: number;
            }>;
        }>(`/physiotherapist/reports${query}`, { cache: 'no-store' });
    },

    createPhysioReferral: (payload: {
        patient_id: number;
        appointment_id?: number | null;
        referring_doctor_id?: number | null;
        referred_by?: string;
        assigned_physio_id?: number | null;
        referral_date?: string;
        treatment_instructions: string;
        treatment_cost: number;
        clinical_remarks?: string;
    }) =>
        apiClient<{ message: string; referral: any }>('/receptionist/referrals', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    getPhysiotherapists: () =>
        apiClient<{ data: Array<{ id: number; name: string; email: string; mobile_number: string | null }> }>('/receptionist/physiotherapists'),

    getReceptionistReferrals: (params?: { status?: string; search?: string; page?: number }) => {
        const sp = new URLSearchParams();
        if (params?.status) sp.append('status', params.status);
        if (params?.search) sp.append('search', params.search);
        if (params?.page) sp.append('page', String(params.page));
        const q = sp.toString() ? `?${sp.toString()}` : '';
        return apiClient<{ data: Array<any>; meta: { current_page: number; last_page: number; total: number } }>(`/receptionist/referrals${q}`, { cache: 'no-store' });
    },

    getPhysioSlots: (date: string, durationMinutes?: number) => {
        const sp = new URLSearchParams({ date });
        if (durationMinutes) sp.append('duration_minutes', String(durationMinutes));
        return apiClient<{
            date: string;
            default_duration_minutes: number;
            buffer_minutes: number;
            slots: Array<{ start_time: string; end_time: string; reserved_until: string; label: string; duration_minutes: number; buffer_minutes: number }>;
        }>(`/receptionist/physio-appointments/slots?${sp.toString()}`, { cache: 'no-store' });
    },

    getPhysioAppointments: (params?: { date?: string; scope?: string; status?: string; referral_id?: number; patient_id?: number }) => {
        const sp = new URLSearchParams();
        if (params?.date) sp.append('date', params.date);
        if (params?.scope) sp.append('scope', params.scope);
        if (params?.status) sp.append('status', params.status);
        if (params?.referral_id) sp.append('referral_id', String(params.referral_id));
        if (params?.patient_id) sp.append('patient_id', String(params.patient_id));
        const q = sp.toString() ? `?${sp.toString()}` : '';
        return apiClient<{ data: Array<any>; meta: { current_page: number; last_page: number; total: number } }>(`/receptionist/physio-appointments${q}`, { cache: 'no-store' });
    },

    createPhysioAppointment: (payload: { referral_id: number; appointment_date: string; start_time: string; duration_minutes?: number; notes?: string }) =>
        apiClient<{ message: string; appointment: any }>('/receptionist/physio-appointments', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    checkInPhysioAppointment: (id: number) =>
        apiClient<{ message: string; status: string }>(`/receptionist/physio-appointments/${id}/check-in`, { method: 'POST' }),

    reschedulePhysioAppointment: (id: number, payload: { appointment_date: string; start_time: string; duration_minutes?: number }) =>
        apiClient<{ message: string; appointment: any }>(`/receptionist/physio-appointments/${id}/reschedule`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    cancelPhysioAppointment: (id: number, reason: string) =>
        apiClient<{ message: string; status: string }>(`/receptionist/physio-appointments/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),

    noShowPhysioAppointment: (id: number, reason?: string) =>
        apiClient<{ message: string; status: string }>(`/receptionist/physio-appointments/${id}/no-show`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),

    getPhysiotherapistAppointments: (params?: { scope?: string; date?: string; status?: string }) => {
        const sp = new URLSearchParams();
        if (params?.scope) sp.append('scope', params.scope);
        if (params?.date) sp.append('date', params.date);
        if (params?.status) sp.append('status', params.status);
        const q = sp.toString() ? `?${sp.toString()}` : '';
        return apiClient<{ data: Array<any>; meta: any }>(`/physiotherapist/appointments${q}`, { cache: 'no-store' });
    },

    startPhysioAppointmentTreatment: (id: number) =>
        apiClient<{ message: string; session: any; appointment_status: string }>(`/physiotherapist/appointments/${id}/start-treatment`, {
            method: 'POST',
        }),

    getPhysioAdminQueue: (search?: string) => {
        const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
        return apiClient<{ referrals: Array<any>; waiting_visits: Array<any>; in_progress_visits: Array<any> }>(`/physio-admin/queue${q}`, { cache: 'no-store' });
    },

    checkInPhysioReferral: (referralId: number) =>
        apiClient<{ message: string; visit: any }>(`/physio-admin/referrals/${referralId}/check-in`, { method: 'POST' }),

    startPhysioVisitSession: (visitId: number) =>
        apiClient<{ message: string; visit: any; session: any }>(`/physio-admin/visits/${visitId}/start-session`, { method: 'POST' }),

    reversePhysioLedgerEntry: (id: number, reason: string) =>
        apiClient<{ message: string; reversal: any }>(`/admin/physio/ledger/${id}/reverse`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),

    // Doctor
    getDoctorQueue: (params?: { date?: string; search?: string; doctor_id?: number }) => {
        const searchParams = new URLSearchParams();
        if (params?.date) searchParams.append('date', params.date);
        if (params?.search) searchParams.append('search', params.search);
        if (params?.doctor_id) searchParams.append('doctor_id', String(params.doctor_id));
        searchParams.append('_t', Date.now().toString());
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return apiClient<{
            date: string;
            doctor: { id: number; name: string; specialization: string } | null;
            summary: {
                today_total: number;
                waiting: number;
                in_consultation: number;
                completed: number;
            };
            waiting_patients: Array<any>;
            in_consultation: Array<any>;
            completed_consultations: Array<any>;
        }>(`/doctor/queue${query}`, { cache: 'no-store' });
    },
    getDoctorAppointments: (params?: {
        date?: string;
        start_date?: string;
        end_date?: string;
        status?: string;
        type?: string;
        search?: string;
        doctor_id?: number;
    }) => {
        const searchParams = new URLSearchParams();
        if (params?.date) searchParams.append('date', params.date);
        if (params?.start_date) searchParams.append('start_date', params.start_date);
        if (params?.end_date) searchParams.append('end_date', params.end_date);
        if (params?.status) searchParams.append('status', params.status);
        if (params?.type) searchParams.append('type', params.type);
        if (params?.search) searchParams.append('search', params.search);
        if (params?.doctor_id) searchParams.append('doctor_id', String(params.doctor_id));
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return apiClient<{
            doctor: { id: number; name: string; specialization: string } | null;
            appointments: Array<any>;
            summary: {
                total: number;
                confirmed: number;
                checked_in: number;
                in_consultation: number;
                completed: number;
                cancelled: number;
            };
        }>(`/doctor/appointments${query}`, { cache: 'no-store' });
    },
    startDoctorConsultation: (appointmentId: number) =>
        apiClient<{ message: string; appointment: any; consultation: any }>(
            `/doctor/appointments/${appointmentId}/start-consultation`,
            { method: 'POST' }
        ),
    getDoctorConsultationDetails: (appointmentId: number) =>
        apiClient<{
            appointment: any;
            consultation: any;
            patient_history: Array<{
                id: number;
                consultation_date: string;
                doctor_name: string;
                remarks: string | null;
                outcome: string;
                referred_to_physio: boolean;
                physiotherapy_instructions?: string | null;
            }>;
        }>(`/doctor/appointments/${appointmentId}/consultation`),
    saveDoctorConsultationDraft: (appointmentId: number, remarks: string) =>
        apiClient<{ message: string; consultation: any }>(
            `/doctor/appointments/${appointmentId}/draft`,
            {
                method: 'POST',
                body: JSON.stringify({ remarks }),
            }
        ),
    getDoctorPhysiotherapists: () =>
        apiClient<{ data: Array<{ id: number; name: string; email: string; mobile_number: string | null }> }>('/doctor/physiotherapists'),

    completeDoctorConsultation: (
        appointmentId: number,
        payload: {
            remarks: string;
            outcome: 'completed' | 'referred_to_physio';
            treatment_instructions?: string;
            assigned_physio_id?: number | null;
            treatment_cost?: number | null;
        }
    ) =>
        apiClient<{ message: string; appointment: any; consultation: any }>(
            `/doctor/appointments/${appointmentId}/complete-consultation`,
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        ),
    saveConsultation: (id: number, payload: any) =>
        apiClient(`/doctor/consultations/${id}`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    getDoctorPatients: (params?: { search?: string; page?: number; per_page?: number; doctor_id?: number }) => {
        const searchParams = new URLSearchParams();
        if (params?.search) searchParams.append('search', params.search);
        if (params?.page) searchParams.append('page', String(params.page));
        if (params?.per_page) searchParams.append('per_page', String(params.per_page));
        if (params?.doctor_id) searchParams.append('doctor_id', String(params.doctor_id));
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return apiClient<{
            data: Array<{
                id: number;
                name: string;
                file_number: string | null;
                mobile_number: string;
                age: number | null;
                gender: string | null;
                date_of_birth: string | null;
                registration_date: string | null;
                last_consultation_date: string | null;
                upcoming_appointment: {
                    id: number;
                    reference: string;
                    appointment_date: string;
                    start_time: string;
                    status: string;
                } | null;
            }>;
            meta: { current_page: number; last_page: number; per_page: number; total: number };
        }>(`/doctor/patients${query}`);
    },
    getDoctorPatientProfile: (id: number | string) =>
        apiClient<{
            patient: {
                id: number;
                name: string;
                file_number: string | null;
                mobile_number: string;
                alternate_contact_number: string | null;
                email: string | null;
                date_of_birth: string | null;
                age: number | null;
                gender: string | null;
                registration_date: string | null;
                notes: string | null;
            };
            appointments: Array<any>;
            consultations: Array<{
                id: number;
                appointment_id: number;
                consultation_date: string;
                doctor_name: string;
                remarks: string | null;
                outcome: string;
                referred_to_physio: boolean;
                physiotherapy_instructions?: string | null;
                physiotherapy_status?: string | null;
                physiotherapy_completion_notes?: string | null;
                completed_at: string | null;
            }>;
            physiotherapy_referrals: Array<{
                id: number;
                referral_date: string;
                referring_doctor: string;
                assigned_physiotherapist?: string | null;
                treatment_instructions: string;
                status: string;
                completion_notes?: string | null;
                completed_at?: string | null;
            }>;
        }>(`/doctor/patients/${id}`),
    getDoctorConsultationHistory: (params?: {
        search?: string;
        start_date?: string;
        end_date?: string;
        outcome?: string;
        referred_to_physio?: string;
        page?: number;
        per_page?: number;
        doctor_id?: number;
    }) => {
        const searchParams = new URLSearchParams();
        if (params?.search) searchParams.append('search', params.search);
        if (params?.start_date) searchParams.append('start_date', params.start_date);
        if (params?.end_date) searchParams.append('end_date', params.end_date);
        if (params?.outcome) searchParams.append('outcome', params.outcome);
        if (params?.referred_to_physio) searchParams.append('referred_to_physio', params.referred_to_physio);
        if (params?.page) searchParams.append('page', String(params.page));
        if (params?.per_page) searchParams.append('per_page', String(params.per_page));
        if (params?.doctor_id) searchParams.append('doctor_id', String(params.doctor_id));
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return apiClient<{
            data: Array<any>;
            meta: { current_page: number; last_page: number; per_page: number; total: number };
        }>(`/doctor/consultations${query}`);
    },
    getDoctorConsultationDetail: (id: number | string) =>
        apiClient<{
            consultation: any;
        }>(`/doctor/consultations/${id}`),
    getDoctorProfile: () =>
        apiClient<{
            user: {
                id: number;
                name: string;
                email: string;
                mobile_number: string;
                role: string;
                role_label: string;
            };
            doctor: {
                id: number;
                name: string;
                email: string;
                mobile_number: string;
                specialization: string;
                specialization_id: number;
                profile_photo?: string | null;
                public_profile_description?: string | null;
                default_appointment_duration: number;
            } | null;
        }>('/doctor/profile'),
    updateDoctorProfile: (payload: {
        name: string;
        email: string;
        mobile_number: string;
        public_profile_description?: string;
        profile_photo?: string;
    }) =>
        apiClient<{ message: string; user: any; doctor: any }>('/doctor/profile', {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),
    changeDoctorPassword: (payload: {
        current_password: string;
        password: string;
        password_confirmation: string;
    }) =>
        apiClient<{ message: string }>('/doctor/password', {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),
    getStaffClinicSchedule: () =>
        apiClient<{
            working_days: Array<{
                id: number;
                day_of_week: number;
                is_working: boolean;
                sessions: Array<{
                    id: number;
                    start_time: string;
                    end_time: string;
                    breaks: Array<{ id: number; start_time: string; end_time: string }>;
                }>;
            }>;
            exclusions: Array<{
                id: number;
                doctor_id: number | null;
                exclusion_date: string;
                start_time: string | null;
                end_time: string | null;
                reason: string | null;
                doctor?: { id: number; name: string } | null;
            }>;
            doctors: Array<{ id: number; name: string }>;
        }>('/clinic-schedule'),

    // Public & Booking Flow
    getPublicDoctors: () => apiClient<{ data: Array<{ id: number; name: string; specialization: string; profile_photo: string | null; description: string; slot_duration: number }> }>('/public/doctors'),
    getDoctorSlots: (doctorId: number, date: string, appointmentType?: string) => {
        const query = new URLSearchParams({ date, _t: Date.now().toString() });
        if (appointmentType) query.append('appointment_type', appointmentType);
        return apiClient<{
            date: string;
            doctor_id: number;
            doctor_name: string;
            is_date_available?: boolean;
            message?: string;
            exclusion?: { id: number; is_clinic_wide: boolean; reason: string | null } | null;
            slots: Array<{ start_time: string; start_time_24: string; end_time: string; end_time_24: string; is_available: boolean }>;
        }>(`/public/doctors/${doctorId}/slots?${query.toString()}`, { cache: 'no-store' });
    },
    verifyFileNumber: (file_number: string) =>
        apiClient<{ valid: boolean; patient: { name: string; mobile_number: string; file_number: string }; message?: string }>('/public/verify-file-number', {
            method: 'POST',
            body: JSON.stringify({ file_number }),
        }),
    createBooking: (payload: {
        name: string;
        mobile_number: string;
        alternate_contact_number?: string;
        email?: string;
        appointment_type: string;
        file_number?: string;
        doctor_id: number;
        appointment_date: string;
        start_time: string;
        notes?: string;
    }) =>
        apiClient<{ message: string; reference: string; status: string; status_label: string; appointment: any }>('/public/bookings', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    // Admin Doctor & Schedule Management
    getAdminDoctors: () => apiClient<{ data: any[]; specializations: any[] }>('/admin/doctors'),
    resetDoctorPassword: (id: number, password: string, password_confirmation: string) =>
        apiClient<{ message: string }>(`/admin/doctors/${id}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ password, password_confirmation }),
        }),
    createDoctor: (payload: any) =>
        apiClient('/admin/doctors', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateDoctor: (id: number, payload: any) =>
        apiClient(`/admin/doctors/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    updateDoctorSchedules: (id: number, schedules: any[]) =>
        apiClient(`/admin/doctors/${id}/schedules`, {
            method: 'PUT',
            body: JSON.stringify({ schedules }),
        }),
    addDoctorException: (id: number, payload: { date: string; exception_type: string; reason?: string }) =>
        apiClient(`/admin/doctors/${id}/exceptions`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    removeDoctorException: (id: number, exceptionId: number) =>
        apiClient(`/admin/doctors/${id}/exceptions/${exceptionId}`, {
            method: 'DELETE',
        }),

    // Common Clinic Schedule & Exclusions
    getClinicSchedule: () =>
        apiClient<{
            working_days: Array<{
                id: number;
                day_of_week: number;
                is_working: boolean;
                sessions: Array<{
                    id: number;
                    start_time: string;
                    end_time: string;
                    breaks: Array<{ id: number; start_time: string; end_time: string }>;
                }>;
            }>;
            exclusions: Array<{
                id: number;
                doctor_id: number | null;
                exclusion_date: string;
                start_time: string | null;
                end_time: string | null;
                reason: string | null;
                doctor?: { id: number; name: string } | null;
            }>;
            doctors: Array<{ id: number; name: string }>;
        }>('/clinic-schedule'),
    updateClinicSchedule: (days: any[]) =>
        apiClient('/admin/clinic-schedule', {
            method: 'PUT',
            body: JSON.stringify({ days }),
        }),
    addScheduleExclusion: (payload: {
        doctor_id?: number | null;
        exclusion_date: string;
        start_time?: string | null;
        end_time?: string | null;
        reason?: string;
    }) =>
        apiClient<{ message: string; warning?: string | null; conflicts_count?: number; data: any }>(
            '/admin/clinic-schedule/exclusions',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        ),
    removeScheduleExclusion: (id: number) =>
        apiClient(`/admin/clinic-schedule/exclusions/${id}`, {
            method: 'DELETE',
        }),

    // Admin
    getAdminStats: () => apiClient('/admin/dashboard-stats'),
    getDailyReport: (date?: string) => {
        const query = date ? `?date=${encodeURIComponent(date)}` : '';
        return apiClient(`/admin/reports/daily${query}`);
    },
    getExportUrl: (startDate?: string, endDate?: string) => {
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        const token = getAuthToken();
        const query = params.toString() ? `?${params.toString()}` : '';
        return `${API_BASE_URL}/admin/reports/export${query}${query ? '&' : '?'}token=${token || ''}`;
    },
};

