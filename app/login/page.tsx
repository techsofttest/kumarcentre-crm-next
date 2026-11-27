"use client";

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRoleDashboardPath } from '@/lib/roles';
import { api, setAuthSession, ApiError } from '@/lib/api';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const router = useRouter();
    const { setTheme } = useTheme();

    useEffect(() => {
        setTheme('light');
    }, [setTheme]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setIsLoading(true);

        try {
            const response = await api.login({ email, password });

            // Automatically detect role from user response
            const user = response.user;
            setAuthSession(response.token, user);

            // Redirect automatically to the dashboard assigned to the authenticated user's role
            const targetPath = getRoleDashboardPath(user.role);
            router.push(targetPath);
        } catch (err: any) {
            if (err instanceof ApiError) {
                setErrorMessage(err.message || 'Invalid credentials. Please verify your email and password.');
            } else {
                setErrorMessage('Unable to connect to authentication server. Please check your network.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-transparent">

            {/* Left Column: Brand & Imagery (Hidden on mobile, visible on lg screens) */}
            <div className="relative hidden w-1/2 flex-col justify-between bg-brand p-12 lg:flex">
                {/* Background image tinted by the brand background */}
                <div className="absolute inset-0 bg-[url('/login/login.jpg')] bg-cover bg-center opacity-80" />

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-transparent" />

                <div className="relative z-10 text-white">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
                        Clinical & Healthcare Network
                    </span>
                    <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Kumar Centres</h1>
                </div>

                <div className="relative z-10">
                    <blockquote className="space-y-1 text-white">
                        <p className="text-base font-medium text-white/90 italic">
                            "Precision care and rehabilitation for superior patient outcomes."
                        </p>
                    </blockquote>
                </div>
            </div>

            {/* Right Column: Interactive Login Area */}
            <div className="flex w-full flex-col justify-center px-8 lg:w-1/2 sm:px-16 lg:px-24">
                <div className="mx-auto flex w-full max-w-md flex-col justify-center space-y-8">

                    <div className="flex flex-col space-y-2 text-center">
                        <div className="mb-2">
                            <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                Kumar Centres
                            </span>
                        </div>
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                            Portal Access
                        </h2>
                        <p className="text-sm text-foreground/60">
                            Enter your credentials to securely access your staff portal.
                        </p>
                    </div>

                    {errorMessage && (
                        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
                            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                            <div className="flex-1 font-medium">{errorMessage}</div>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label
                                htmlFor="email"
                                className="text-sm font-medium leading-none text-foreground"
                            >
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="flex h-12 w-full items-center rounded-md border border-foreground/20 bg-white/60 dark:bg-zinc-800/60 px-4 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-colors"
                                placeholder="name@kumarcentres.com"
                                required
                                disabled={isLoading}
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="password"
                                className="text-sm font-medium leading-none text-foreground"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="flex h-12 w-full items-center rounded-md border border-foreground/20 bg-white/60 dark:bg-zinc-800/60 pl-4 pr-12 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-colors"
                                    placeholder="Enter your password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground/80 transition-colors"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            variant="filled"
                            size="lg"
                            disabled={isLoading}
                            className="w-full bg-[#3C43EC] hover:bg-[#3239cb] text-white font-medium py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>

                </div>
            </div>

        </div>
    );
}
