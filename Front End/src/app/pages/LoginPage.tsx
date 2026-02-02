import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, signInWithPopup, updateProfile, User } from 'firebase/auth';
import React, { ReactNode, useEffect, useState } from 'react'
import { auth, googleProvider } from "@/lib/firebase";
import { Button } from "@/app/components/ui/button";
import { Eye, EyeClosed, Loader2, Moon, Shield, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import logo from '../images/logo.jpg'
import axios from 'axios';
import { toast } from 'react-toastify';

const LoginPage = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [registerLoading, setRegisterLoading] = useState(false)
    const [error, setError] = useState<string | null>(null);
    const { theme, setTheme } = useTheme();
    const [showPassword, setShowPassword] = useState(false)
    const [showRegister, setShowRegister] = useState(false)
    const [registerExpert, setRegisterExpert] = useState(false)
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

            const res = await axios.post(`${backendUrl}/user/register_user`, {
                "email": email,
                "password": password,
                "display_name": userName,
                "role": role
            })

            console.log("response registration: ", res)

            if (res.status === 200) {
                toast.success("Register success. Please login again")
                // // await signInWithEmailAndPassword(auth, email, password)
                
                // const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // await updateProfile(userCredential.user, {
                //     displayName: userName
                // });

                navigate('/login')
                setShowRegister(false)
                // navigate("/dashboard")
            }

        } catch (error) {
            console.log("Original Code: ", error.code);

            // 1. Create a map of user-friendly messages
            const errorMessages = {
                "auth/email-already-in-use": "This email is already registered.",
                "auth/invalid-email": "The email address is not valid.",
                "auth/weak-password": "Your password is too weak.",
                "auth/network-request-failed": "Please check your internet connection."
            };

            // 2. Extract the clean message or use a fallback
            const cleanMessage = errorMessages[error.code] || "An unexpected error occurred.";

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
            console.log("the password and email is, ", email, password)
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
                        <img src={logo} alt="TrustLens" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                        TrustLens
                    </h1>
                    <p className="text-gray-600 dark:text-slate-300">
                        Authenticate to access advanced document analysis
                    </p>
                </div>
                {
                    showRegister === false ?
                        <div className="space-y-4">

                            <form className="w-full max-w-lg p-6 rounded-xl bg-white space-y-4" onSubmit={(e) => handleManualSignIn(e)}>

                                {/* Email */}
                                <div className="flex flex-col space-y-1">
                                    <label className="text-md font-semibold text-gray-700">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="Enter email"
                                        name='email'
                                        id='email'
                                        // value={"newUser@gmail.com"}
                                        className="px-3 py-2 text-md border rounded-md outline-none
                                            border-gray-300 focus:border-blue-600"
                                    />
                                </div>

                                {/* Password */}
                                <div className="flex flex-col space-y-1">
                                    <label className="text-md font-semibold text-gray-700">
                                        Password
                                    </label>

                                    <div className="relative flex items-center">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter password"
                                            name='password'
                                            id='password'
                                            // value={"newUser123"}
                                            className="w-full px-3 py-2 pr-10 text-sm border rounded-md
                                            outline-none border-gray-300 focus:border-blue-600"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 text-lg text-gray-500 hover:text-gray-700"
                                        >
                                            {showPassword ?
                                                <EyeClosed size={16} /> :
                                                <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className='w-full flex items-center justify-center'>
                                    <button type='submit' className='rounded-lg border-2 py-2 w-full cursor-pointer text-sky-500 border-sky-500'>Sign In</button>
                                </div>

                            </form>
                            <div className='flex w-full justify-center items-center gap-2'>
                                <p>Dont have a account?</p>
                                <button className='text-blue-600 underline cursor-pointer' onClick={() => setShowRegister(true)}>Create a account</button>
                            </div>
                            <div className='w-full flex items-center justify-center text-lg'>
                                <p>or</p>
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
                        </div> :
                        <div className='space-y-7'>
                            <form className="w-full max-w-lg p-6 rounded-xl bg-white space-y-4" onSubmit={(e) => handleUserRegister(e)}>
                                {/* Email */}
                                <div className="flex flex-col space-y-1">
                                    <label className="text-md font-semibold text-gray-700">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="Enter email"
                                        name='email'
                                        id='email'
                                        // value={"newUser@gmail.com"}
                                        className="px-3 py-2 text-md border rounded-md outline-none
                                            border-gray-300 focus:border-blue-600"
                                    />
                                </div>

                                <div className="flex flex-col space-y-1">
                                    <label className="text-md font-semibold text-gray-700">
                                        User name
                                    </label>
                                    <input
                                        type="username"
                                        placeholder="Enter username"
                                        name='username'
                                        id='username'
                                        // value={"Expert Testing"}
                                        className="px-3 py-2 text-md border rounded-md outline-none
                                            border-gray-300 focus:border-blue-600"
                                    />
                                </div>

                                <div className="flex flex-col space-y-2">
                                    <label className="text-md font-semibold text-gray-700">
                                        I'm a 
                                    </label>
                                    <select name="role" id="role" className="px-3 py-2 text-md border rounded-md outline-none border-gray-300 focus:border-blue-600">
                                       
                                        <option value="user">User</option>
                                        <option value="expert">Expert</option>
                                    </select>
                                </div>

                                {/* Password */}
                                <div className="flex flex-col space-y-1">
                                    <label className="text-md font-semibold text-gray-700">
                                        Password
                                    </label>

                                    <div className="relative flex items-center">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter password"
                                            name='password'
                                            id='password'
                                            // value={"newUser123"}
                                            className="w-full px-3 py-2 pr-10 text-sm border rounded-md
                                            outline-none border-gray-300 focus:border-blue-600"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 text-lg text-gray-500 hover:text-gray-700"
                                        >
                                            {showPassword ?
                                                <EyeClosed size={16} /> :
                                                <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className='flex w-full justify-center items-center gap-2 my-5'>
                                    <p>Have a account?</p>
                                    <button className='text-blue-600 underline cursor-pointer' onClick={() => setShowRegister(false)}>Sign In</button>
                                </div>
                                <div className='w-full flex items-center justify-center'>
                                    <button
                                        type='submit'
                                        disabled={registerLoading} // 1. Prevent double submission
                                        className={`
                                        flex items-center justify-center gap-2 rounded-lg border-2 py-2 w-full transition-all
                                        ${registerLoading
                                                ? 'cursor-not-allowed opacity-70 bg-sky-50 border-sky-300 text-sky-300'
                                                : 'cursor-pointer text-sky-500 border-sky-500 hover:bg-sky-50 active:scale-[0.98]'
                                            }
                                        `}
                                    >
                                        {registerLoading ? (
                                            <>
                                                <Loader2 className="animate-spin" size={20} /> {/* 2. Force rotation and size */}
                                                <span>Registering...</span> {/* 3. Maintain width by keeping text or label */}
                                            </>
                                        ) : (
                                            'Register'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                }

            </div>
        </div>
    );
}

export default LoginPage