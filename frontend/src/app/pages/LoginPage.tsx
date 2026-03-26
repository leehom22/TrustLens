import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, signInWithPopup, updateProfile, User } from 'firebase/auth';
import React, { ReactNode, useEffect, useState } from 'react'
import { auth, googleProvider } from "@/lib/firebase";
import { Button } from "@/app/components/ui/button";
import { Eye, EyeClosed, Loader2, Moon, Shield, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import logo from '../images/logo.jpg'
import google from '../images/google.png'
import axios from 'axios';
import { toast } from 'react-toastify';
import { LanguageToggleButton } from '../components/LanguageToggleButton';
import { useLanguage } from '../components/LanguageProvider';

// ─── All visible text in EN and BM ───────────────────────────────────────────
const T = {
  en: {
    tagline: "Authenticate to access advanced document analysis",
    roleUser: "👤 User",
    roleExpert: "🧑‍💼 Expert",
    googleHint: "Users must authenticate using Google.",
    continueGoogle: "Continue with Google",
    expertEmail: "Expert Email",
    expertEmailPlaceholder: "Enter expert email",
    password: "Password",
    passwordPlaceholder: "Enter password",
    signInExpert: "Sign In as Expert",
    expertNote: "Expert accounts require prior approval.",
    email: "Email",
    emailPlaceholder: "Enter email",
    username: "Username",
    usernamePlaceholder: "Enter username",
    iAmA: "I'm a",
    optionUser: "User",
    optionExpert: "Expert",
    haveAccount: "Have an account?",
    signIn: "Sign In",
    registering: "Registering...",
    register: "Register",
  },
  ms: {
    tagline: "Log masuk untuk mengakses analisis dokumen lanjutan",
    roleUser: "👤 Pengguna",
    roleExpert: "🧑‍💼 Pakar",
    googleHint: "Pengguna mesti mengesahkan identiti menggunakan Google.",
    continueGoogle: "Teruskan dengan Google",
    expertEmail: "E-mel Pakar",
    expertEmailPlaceholder: "Masukkan e-mel pakar",
    password: "Kata Laluan",
    passwordPlaceholder: "Masukkan kata laluan",
    signInExpert: "Log Masuk sebagai Pakar",
    expertNote: "Akaun pakar memerlukan kelulusan terlebih dahulu.",
    email: "E-mel",
    emailPlaceholder: "Masukkan e-mel",
    username: "Nama Pengguna",
    usernamePlaceholder: "Masukkan nama pengguna",
    iAmA: "Saya ialah",
    optionUser: "Pengguna",
    optionExpert: "Pakar",
    haveAccount: "Sudah ada akaun?",
    signIn: "Log Masuk",
    registering: "Mendaftar...",
    register: "Daftar",
  },
} as const;

const LoginPage = () => {
    const [user, setUser] = useState<User | null>(null);
    const { language } = useLanguage();
    const t = T[language];
    const [loading, setLoading] = useState(true);
    const [registerLoading, setRegisterLoading] = useState(false)
    const [error, setError] = useState<string | null>(null);
    const { theme, setTheme } = useTheme();
    const [showPassword, setShowPassword] = useState(false)
    const [showRegister, setShowRegister] = useState(false)
    const [registerExpert, setRegisterExpert] = useState(false)
    const [selectedRole, setSelectedRole] = useState<string>("user")
    const navigate = useNavigate()
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

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

    const handleUserRegister = async (e: React.FormEvent<HTMLFormElement>) => {
        try {
            e.preventDefault()
            setRegisterLoading(true)
            const formData = new FormData(e.currentTarget)
            const role = formData.get("role") as string
            const email = formData.get("email") as string
            const password = formData.get("password") as string
            const userName = formData.get("username") as string
            const passkey = formData.get("passkey") as string

            // Validate inputs
            if (!email || !password || !userName || !role) {
                toast.error("Please fill in all required fields");
                setRegisterLoading(false);
                return;
            }

            // Validate passkey for expert registration
            if (role === "expert" && !passkey) {
                toast.error("Passkey is required for expert registration");
                setRegisterLoading(false);
                return;
            }

            // Register user with backend (which will create in Firebase)
            const res = await axios.post(`${backendUrl}/user/register_user`, {
                "email": email,
                "password": password,
                "display_name": userName,
                "role": role,
                ...(role === "expert" && { "passkey": passkey })
            })

            // console.log("response registration: ", res)

            if (res.status === 201) {
                toast.success("Registration successful! Logging you in...")
                // Now sign in with Firebase using the created credentials
                await signInWithEmailAndPassword(auth, email, password);
                navigate('/dashboard')
                setShowRegister(false)
            }

        } catch (error: any) {
            console.log("Registration Error: ", error);

            // 1. Create a map of user-friendly messages
            const errorMessages: { [key: string]: string } = {
                "auth/email-already-in-use": "This email is already registered.",
                "auth/invalid-email": "The email address is not valid.",
                "auth/weak-password": "Your password is too weak (minimum 6 characters).",
                "auth/network-request-failed": "Please check your internet connection."
            };

            // 2. Extract the clean message or use a fallback
            let cleanMessage = errorMessages[error.code] || error.message || "An unexpected error occurred.";

            // Check for API error responses
            if (error.response?.status === 400) {
                cleanMessage = error.response?.data?.detail || "Registration failed. Please check your inputs.";
            }

            toast.error(cleanMessage);
        } finally {
            setRegisterLoading(false)
        }
    }
    const handleManualSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
        try {
            e.preventDefault()
            setLoading(true)
            const formData = new FormData(e.currentTarget)
            const email = formData.get("email") as string
            const password = formData.get("password") as string
            // console.log("the password and email is, ", email, password)
            const res = await axios.post(`${backendUrl}/user/signIn_user`, {
                "email": email,
                "password": password
            })

            if (res.status === 200) {
                toast.success("Login success")
                const { token } = res.data
                await signInWithEmailAndPassword(auth, email, password)

                navigate("/dashboard")
            } else {
                toast.error("Login Failed")
                return
            }
        } catch (error) {
            console.log("Login Error: ", error)
            toast.error("Login Failed")
            return
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 bg-gradient-to-br dark:bg-gradient-to-br from-gray-50 dark:from-slate-900 via-gray-100 dark:via-slate-800 to-gray-50 dark:to-slate-900">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }
    return (
        <div className="min-h-screen flex items-center justify-center transition-colors duration-300 bg-gray-50 dark:bg-slate-950 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            {/* Top-right controls: theme + language toggle */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
                {/* Language toggle — persists globally */}
                <LanguageToggleButton variant="default" />
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="rounded-full bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                >
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-yellow-500" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-blue-400" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </div>

            <div className="max-w-md w-full p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl backdrop-blur-lg border border-gray-200 dark:border-slate-700">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 mb-6 overflow-hidden">
                        <img src={logo} alt="TrustLens" className="w-12 h-12 " />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                        TrustLens
                    </h1>
                    <p className="text-gray-600 dark:text-slate-300">
                        {t.tagline}
                    </p>
                </div>

                {showRegister === false ? (
                    <div className="space-y-6">

                        {/* Role Selector */}
                        <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
                            <button
                                type="button"
                                onClick={() => setSelectedRole("user")}
                                className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${selectedRole === "user"
                                        ? "bg-white dark:bg-slate-900 shadow text-blue-600"
                                        : "text-gray-600 dark:text-slate-300"
                                    }`}
                            >
                                {t.roleUser}
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedRole("expert")}
                                className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${selectedRole === "expert"
                                        ? "bg-white dark:bg-slate-900 shadow text-blue-600"
                                        : "text-gray-600 dark:text-slate-300"
                                    }`}
                            >
                                {t.roleExpert}
                            </button>
                        </div>

                        {/* USER LOGIN (Google Only) */}
                        {selectedRole === "user" && (
                            <div className="space-y-4 text-center">

                                <p className="text-sm text-gray-600 dark:text-slate-400">
                                    {t.googleHint}
                                </p>

                                <Button
                                    onClick={handleGoogleSignIn}
                                    className="w-full bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600"
                                    size="lg"
                                >
                                    <img src={google} alt="google" className="w-5 h-5 mr-2" />
                                    {t.continueGoogle}
                                </Button>
                            </div>
                        )}

                        {/* EXPERT LOGIN (Manual Only) */}
                        {selectedRole === "expert" && (
                            <form className="space-y-4" onSubmit={handleManualSignIn}>

                                <div className="flex flex-col space-y-1">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                                        {t.expertEmail}
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder={t.expertEmailPlaceholder}
                                        className="px-3 py-2 border rounded-md bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                                    />
                                </div>

                                <div className="flex flex-col space-y-1">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                                        {t.password}
                                    </label>

                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            placeholder={t.passwordPlaceholder}
                                            className="w-full px-3 py-2 pr-10 border rounded-md bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-2.5 text-gray-500 hover:text-gray-700 dark:text-slate-400"
                                        >
                                            {showPassword ? <EyeClosed size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                >
                                    {t.signInExpert}
                                </button>

                                <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
                                    {t.expertNote}
                                </p>

                            </form>
                        )}

                    </div>
                ) : (
                    <div className="space-y-4">
                        <form className="w-full space-y-4" onSubmit={(e) => handleUserRegister(e)}>
                            <div className="flex flex-col space-y-1">
                                <label className="text-md font-semibold text-gray-700 dark:text-slate-200">{t.email}</label>
                                <input
                                    type="email"
                                    placeholder={t.emailPlaceholder}
                                    name="email"
                                    className="px-3 py-2 text-md border rounded-md outline-none bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:border-blue-600"
                                />
                            </div>

                            <div className="flex flex-col space-y-1">
                                <label className="text-md font-semibold text-gray-700 dark:text-slate-200">{t.username}</label>
                                <input
                                    type="text"
                                    placeholder={t.usernamePlaceholder}
                                    name="username"
                                    className="px-3 py-2 text-md border rounded-md outline-none bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:border-blue-600"
                                />
                            </div>

                            <div className="flex flex-col space-y-2">
                                <label className="text-md font-semibold text-gray-700 dark:text-slate-200">{t.iAmA}</label>
                                <select
                                    name="role"
                                    className="px-3 py-2 text-md border rounded-md outline-none bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:border-blue-600"
                                >
                                    <option value="user">{t.optionUser}</option>
                                    <option value="expert">{t.optionExpert}</option>
                                </select>
                            </div>

                            <div className="flex flex-col space-y-1">
                                <label className="text-md font-semibold text-gray-700 dark:text-slate-200">{t.password}</label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder={t.passwordPlaceholder}
                                    name="password"
                                    className="px-3 py-2 border rounded-md outline-none bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:border-blue-600"
                                />
                            </div>

                            <div className="flex w-full justify-center items-center gap-2 pt-2">
                                <p className="text-gray-600 dark:text-slate-400">{t.haveAccount}</p>
                                <button type="button" className="text-blue-600 dark:text-blue-400 underline" onClick={() => setShowRegister(false)}>
                                    {t.signIn}
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={registerLoading}
                                className={`rounded-lg border-2 py-2 w-full transition-all font-semibold ${registerLoading
                                    ? 'cursor-not-allowed opacity-70 bg-gray-100 dark:bg-slate-800 text-gray-400'
                                    : 'text-sky-500 border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/30'
                                    }`}
                            >
                                {registerLoading ? t.registering : t.register}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

export default LoginPage