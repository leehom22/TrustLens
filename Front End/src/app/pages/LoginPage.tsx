import { onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import React, { ReactNode, useEffect, useState } from 'react'
import { auth, googleProvider } from "@/lib/firebase";
import { Button } from "@/app/components/ui/button";
import { Moon, Shield, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { theme, setTheme } = useTheme();
    const navigate = useNavigate()
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
    
        return () => unsubscribe();
      }, []);

    const handleGoogleSignIn = async () => {
        try {
            setError(null);
            await signInWithPopup(auth, googleProvider);
            navigate('/dashboard')
        } catch (error: any) {
            console.error("Error signing in with Google:", error);

            // Handle specific Firebase errors
            if (error.code === "auth/unauthorized-domain") {
                setError("unauthorized-domain");
            } else if (error.code === "auth/popup-closed-by-user") {
                setError("popup-closed");
            } else if (error.code === "auth/popup-blocked") {
                setError("popup-blocked");
            } else {
                setError("generic");
            }
        }
    };
    interface AuthGateProps {
        children: ReactNode;
    }
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 bg-gradient-to-br dark:bg-gradient-to-br from-gray-50 dark:from-slate-900 via-gray-100 dark:via-slate-800 to-gray-50 dark:to-slate-900">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 bg-gradient-to-br dark:bg-gradient-to-br from-gray-50 dark:from-slate-900 via-gray-100 dark:via-slate-800 to-gray-50 dark:to-slate-900">
            {/* Theme Toggle Button */}
            <div className="absolute top-4 right-4">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="rounded-full"
                >
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </div>

            <div className="max-w-md w-full p-8 bg-white dark:bg-slate-800 bg-white dark:bg-slate-800/50 rounded-2xl shadow-2xl backdrop-blur-lg border border-gray-200 dark:border-slate-700">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-600 mb-6">
                        <Shield className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                        TrustLens
                    </h1>
                    <p className="text-gray-600 dark:text-slate-300">
                        Authenticate to access advanced document analysis
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-600/10 rounded-lg border border-blue-200 dark:border-blue-600/30">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                            Why Authentication?
                        </h3>
                        <ul className="text-xs text-gray-600 dark:text-slate-300 space-y-1">
                            <li>• Secure access to forensic analysis tools</li>
                            <li>• Email notifications when analysis completes</li>
                            <li>• Save and retrieve analysis history</li>
                            <li>• Protected data privacy</li>
                        </ul>
                    </div>

                    <Button
                        onClick={handleGoogleSignIn}
                        className="w-full bg-white dark:bg-white hover:bg-gray-50 dark:hover:bg-gray-50 text-gray-900 dark:text-gray-900 border border-gray-300 dark:border-gray-300"
                        size="lg"
                    >
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="currentColor"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Sign in with Google
                    </Button>

                    <p className="text-xs text-center text-gray-500 dark:text-slate-400 mt-4">
                        By signing in, you agree to our Terms of Service and Privacy Policy
                    </p>

                    {/* PROMINENT Error Message with Fix Instructions - SHOWN FIRST */}
                    {error === "unauthorized-domain" && (
                        <div className="mt-6 p-6 bg-red-100 dark:bg-red-600/20 rounded-xl border-4 border-red-500 dark:border-red-500 shadow-2xl animate-pulse">
                            <div className="text-center mb-4">
                                <h2 className="text-3xl font-black text-red-900 dark:text-red-300 mb-2">
                                    🚫 FIREBASE SETUP REQUIRED 🚫
                                </h2>
                                <p className="text-lg font-bold text-red-800 dark:text-red-300">
                                    You must configure Firebase before sign-in will work!
                                </p>
                            </div>

                            <div className="bg-white dark:bg-red-900/40 p-6 rounded-lg border-2 border-red-600 space-y-4">
                                <div className="text-center space-y-2">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                                        📍 YOUR CURRENT DOMAIN:
                                    </p>
                                    <div className="bg-black dark:bg-red-950 px-6 py-4 rounded-lg">
                                        <code className="text-2xl font-black text-yellow-400">{window.location.hostname}</code>
                                    </div>
                                </div>

                                <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-lg border-2 border-yellow-500">
                                    <h3 className="text-base font-black text-gray-900 dark:text-yellow-300 mb-3 text-center">
                                        ⚡ 3-MINUTE FIX - DO THIS NOW:
                                    </h3>
                                    <ol className="space-y-3 text-sm font-semibold text-gray-900 dark:text-white">
                                        <li className="flex gap-3">
                                            <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</span>
                                            <div>
                                                <strong>Open Firebase:</strong> Click here → <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 font-black text-base">console.firebase.google.com</a>
                                            </div>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</span>
                                            <div>
                                                <strong>Select your project</strong> from the project list
                                            </div>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</span>
                                            <div>
                                                Click <strong className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">"Authentication"</strong> in left sidebar
                                            </div>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">4</span>
                                            <div>
                                                Click <strong className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">"Settings"</strong> tab at top
                                            </div>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">5</span>
                                            <div>
                                                Scroll to <strong className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">"Authorized domains"</strong>
                                            </div>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">6</span>
                                            <div>
                                                Click <strong className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">"Add domain"</strong> button
                                            </div>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="flex-shrink-0 w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">7</span>
                                            <div className="space-y-2">
                                                <p><strong>Type this EXACT domain:</strong></p>
                                                <div className="bg-black dark:bg-green-950 px-4 py-3 rounded border-2 border-green-500">
                                                    <code className="text-xl font-black text-green-400">{window.location.hostname}</code>
                                                </div>
                                                <p className="text-red-600 dark:text-red-400 font-black text-xs">
                                                    ⚠️ DO NOT ADD PORT NUMBERS (no :3000, :5173, etc.)
                                                </p>
                                            </div>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="flex-shrink-0 w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">8</span>
                                            <div>
                                                Click <strong className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">"Save"</strong>
                                            </div>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="flex-shrink-0 w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">9</span>
                                            <div>
                                                <strong>Refresh this page</strong> and try again! ✨
                                            </div>
                                        </li>
                                    </ol>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border-2 border-blue-500">
                                    <p className="font-bold text-sm text-gray-900 dark:text-blue-300 mb-2">💡 PRO TIP - Add these common domains too:</p>
                                    <ul className="space-y-1 text-xs text-gray-800 dark:text-blue-200">
                                        <li>✓ <code className="bg-blue-200 dark:bg-blue-900 px-2 py-1 rounded font-bold">localhost</code></li>
                                        <li>✓ <code className="bg-blue-200 dark:bg-blue-900 px-2 py-1 rounded font-bold">127.0.0.1</code></li>
                                        <li>✓ <code className="bg-blue-200 dark:bg-blue-900 px-2 py-1 rounded font-bold">{window.location.hostname}</code> (current)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && error !== "unauthorized-domain" && (
                        <div className="mt-6 p-4 bg-red-50 dark:bg-red-600/10 rounded-lg border border-red-200 dark:border-red-600/30">
                            <p className="text-xs text-red-800 dark:text-red-300">
                                <strong>Error:</strong>{' '}
                                {error === "popup-closed"
                                    ? "The sign-in popup was closed. Please try again."
                                    : error === "popup-blocked"
                                        ? "Your browser blocked the sign-in popup. Please allow popups for this site and try again."
                                        : "An error occurred during sign-in. Please try again or check the console for details."}
                            </p>
                        </div>
                    )}

                    <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-600/10 rounded-lg border border-yellow-200 dark:border-yellow-600/30">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            <strong>Firebase Configuration Required:</strong> Replace the placeholder
                            values in <code className="text-xs bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded">/src/lib/firebase.ts</code> with
                            your actual Firebase project credentials.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default LoginPage