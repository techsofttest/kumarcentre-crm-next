"use client";

import { useState, useEffect } from "react";
import {
    User,
    Mail,
    Phone,
    Lock,
    Stethoscope,
    CheckCircle2,
    AlertCircle,
    Save,
    KeyRound,
    Loader2,
    RefreshCw,
    ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

export default function DoctorProfilePage() {
    // Profile Fields
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [mobileNumber, setMobileNumber] = useState("");
    const [specialization, setSpecialization] = useState("");
    const [description, setDescription] = useState("");
    const [roleLabel, setRoleLabel] = useState("");
    const [defaultDuration, setDefaultDuration] = useState(30);

    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Password Fields
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
    const [profileError, setProfileError] = useState<string | null>(null);

    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const fetchProfile = async () => {
        setIsLoadingProfile(true);
        setProfileError(null);
        try {
            const res = await api.getDoctorProfile();
            if (res.user) {
                setName(res.user.name || "");
                setEmail(res.user.email || "");
                setMobileNumber(res.user.mobile_number || res.doctor?.mobile_number || "");
                setRoleLabel(res.user.role_label || "Doctor");
            }
            if (res.doctor) {
                setSpecialization(res.doctor.specialization || "Medical Specialist");
                setDescription(res.doctor.public_profile_description || "");
                setDefaultDuration(res.doctor.default_appointment_duration || 30);
            }
        } catch (err: any) {
            setProfileError(err.message || "Failed to load doctor profile.");
        } finally {
            setIsLoadingProfile(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    // Handle Profile Update
    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingProfile(true);
        setProfileSuccess(null);
        setProfileError(null);
        try {
            const res = await api.updateDoctorProfile({
                name: name.trim(),
                email: email.trim(),
                mobile_number: mobileNumber.trim(),
                public_profile_description: description.trim() || undefined,
            });
            setProfileSuccess(res.message || "Profile updated successfully.");
            setTimeout(() => setProfileSuccess(null), 4000);
        } catch (err: any) {
            setProfileError(err.message || "Failed to update profile.");
        } finally {
            setIsSavingProfile(false);
        }
    };

    // Handle Password Change
    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPasswordError("New password and confirm password do not match.");
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError("New password must be at least 8 characters long.");
            return;
        }

        setIsChangingPassword(true);
        setPasswordSuccess(null);
        setPasswordError(null);
        try {
            const res = await api.changeDoctorPassword({
                current_password: currentPassword,
                password: newPassword,
                password_confirmation: confirmPassword,
            });

            setPasswordSuccess(res.message || "Password changed successfully.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => setPasswordSuccess(null), 4000);
        } catch (err: any) {
            setPasswordError(err.message || "Failed to update password.");
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <div className="flex w-full flex-col gap-6 p-8">
            {/* Header & Breadcrumb */}
            <div className="flex flex-col gap-4 border-b border-black/10 dark:border-white/10 pb-5">
                <div className="flex items-center gap-2 text-xs text-foreground/50">
                    <span>Doctor Admin</span>
                    <span>/</span>
                    <span className="text-foreground font-semibold">My Profile</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Account & Profile Settings
                        </h1>
                        <p className="text-xs text-foreground/60 mt-1">
                            Manage your professional profile details, contact information, and account security
                        </p>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        icon={RefreshCw}
                        onClick={fetchProfile}
                        disabled={isLoadingProfile}
                    >
                        {isLoadingProfile ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>
            </div>

            {isLoadingProfile ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-xs text-foreground/50">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                    <span>Loading profile details...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* LEFT COLUMN: BASIC PROFILE INFORMATION (7 cols) */}
                    <div className="lg:col-span-7 rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 p-6 shadow-xs">
                        <div className="border-b border-black/5 dark:border-white/5 pb-3 mb-5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-purple-600" />
                                <h2 className="text-sm font-bold text-foreground">
                                    Doctor Profile Details
                                </h2>
                            </div>
                            <span className="rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                                {roleLabel}
                            </span>
                        </div>

                        {profileSuccess && (
                            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                <span>{profileSuccess}</span>
                            </div>
                        )}

                        {profileError && (
                            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-300">
                                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                                <span>{profileError}</span>
                            </div>
                        )}

                        <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                            {/* Doctor Name */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Dr. Sasikumar"
                                    className="w-full rounded-lg border border-black/10 bg-slate-50 dark:border-white/10 dark:bg-zinc-800/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-purple-600"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Email */}
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">
                                        Email Address <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="doctor@kumarcentres.com"
                                        className="w-full rounded-lg border border-black/10 bg-slate-50 dark:border-white/10 dark:bg-zinc-800/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-purple-600"
                                    />
                                </div>

                                {/* Mobile */}
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">
                                        Mobile Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={mobileNumber}
                                        onChange={(e) => setMobileNumber(e.target.value)}
                                        placeholder="9840012345"
                                        className="w-full rounded-lg border border-black/10 bg-slate-50 dark:border-white/10 dark:bg-zinc-800/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-purple-600"
                                    />
                                </div>
                            </div>

                            {/* Specialization (Read-only managed by admin) */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">
                                    Clinical Specialization
                                </label>
                                <div className="rounded-lg border border-black/10 dark:border-white/10 bg-slate-100/60 dark:bg-zinc-800/30 px-3 py-2 text-xs text-foreground/80 font-medium flex items-center justify-between">
                                    <span>{specialization || "General Medicine / Spine"}</span>
                                    
                                </div>
                            </div>

                            {/* Public Profile Description */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">
                                    Professional Bio & Public Description
                                </label>
                                <textarea
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief background, clinical focus areas, spine & rehabilitation expertise..."
                                    className="w-full rounded-lg border border-black/10 bg-slate-50 dark:border-white/10 dark:bg-zinc-800/60 p-3 text-xs text-foreground focus:outline-none focus:border-purple-600"
                                />
                            </div>

                            <div className="pt-3 border-t border-black/5 dark:border-white/5 flex justify-end">
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isSavingProfile}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1.5"
                                >
                                    {isSavingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                                    <Save className="h-4 w-4" />
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* RIGHT COLUMN: CHANGE PASSWORD & SECURITY (5 cols) */}
                    <div className="lg:col-span-5 rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900 p-6 shadow-xs space-y-5">
                        <div className="border-b border-black/5 dark:border-white/5 pb-3 flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-purple-600" />
                            <h2 className="text-sm font-bold text-foreground">
                                Change Password
                            </h2>
                        </div>

                        {passwordSuccess && (
                            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                <span>{passwordSuccess}</span>
                            </div>
                        )}

                        {passwordError && (
                            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-300">
                                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                                <span>{passwordError}</span>
                            </div>
                        )}

                        <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">
                                    Current Password <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full rounded-lg border border-black/10 bg-slate-50 dark:border-white/10 dark:bg-zinc-800/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-purple-600"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">
                                    New Password <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Minimum 8 characters"
                                    className="w-full rounded-lg border border-black/10 bg-slate-50 dark:border-white/10 dark:bg-zinc-800/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-purple-600"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">
                                    Confirm New Password <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter new password"
                                    className="w-full rounded-lg border border-black/10 bg-slate-50 dark:border-white/10 dark:bg-zinc-800/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-purple-600"
                                />
                            </div>

                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    variant="filled"
                                    size="sm"
                                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center justify-center gap-1.5"
                                >
                                    {isChangingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                                    <Lock className="h-4 w-4" />
                                    Update Password
                                </Button>
                            </div>
                        </form>

                        <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/40 p-3 border border-black/5 dark:border-white/5 text-[11px] text-foreground/60 space-y-1">
                            <span className="font-semibold block text-foreground/80 flex items-center gap-1">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                Password Requirements
                            </span>
                            <p>• Must be at least 8 characters in length.</p>
                            
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
