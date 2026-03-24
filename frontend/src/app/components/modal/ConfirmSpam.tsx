import { MalaysiaState, SpamReviewInterface } from '@/app/types/type'
import React, { useEffect, useRef, useState } from 'react'
import { Id, toast } from 'react-toastify'
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult
} from "firebase/auth";

interface RequestReviewModalProps {
    setConfirmSpam: React.Dispatch<React.SetStateAction<boolean>>,
    setConfirmSpamReview: React.Dispatch<React.SetStateAction<SpamReviewInterface>>,
    confirmSpamReview: SpamReviewInterface,
    handleConfirmSpam: () => Promise<Id | undefined>
}

const ConfirmSpam = ({ handleConfirmSpam, setConfirmSpamReview, setConfirmSpam, confirmSpamReview }: RequestReviewModalProps) => {
    // New States for OTP Flow
    const auth = getAuth()
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [otp, setOtp] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => {
        const initRecaptcha = () => {
            if (recaptchaVerifierRef.current) return; // Already initialized

            recaptchaVerifierRef.current = new RecaptchaVerifier(
                auth,
                'recaptcha-container',
                {
                    size: 'invisible',
                    callback: () => {
                        console.log("reCAPTCHA solved");
                    },
                    'expired-callback': () => {
                        // Reset verifier if reCAPTCHA token expires
                        recaptchaVerifierRef.current?.clear();
                        recaptchaVerifierRef.current = null;
                        toast.warning("reCAPTCHA expired. Please try again.");
                    }
                }
            );
        };

        initRecaptcha();

        // ✅ Fix 3: Proper cleanup when modal unmounts
        return () => {
            recaptchaVerifierRef.current?.clear();
            recaptchaVerifierRef.current = null;
            // Also clean up any lingering global reference
            if ((window as any).recaptchaVerifier) {
                (window as any).recaptchaVerifier.clear?.();
                delete (window as any).recaptchaVerifier;
            }
        };
    }, []); // Empty deps — runs once on mount

    const handleSendOTP = async () => {
        const rawPhone = confirmSpamReview.phone;
        if (!rawPhone || rawPhone.length < 9) {
            toast.error("Please enter a valid Malaysian phone number.");
            return;
        }

        // Format to E.164: 0123456789 → +60123456789
        const formatted = rawPhone.startsWith('+')
            ? rawPhone
            : `+60${rawPhone.startsWith('0') ? rawPhone.substring(1) : rawPhone}`;

        setIsVerifying(true);
        try {
            if (!recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current = new RecaptchaVerifier(
                    auth,
                    'recaptcha-container',
                    { size: 'invisible' }
                );
            }

            const result = await signInWithPhoneNumber(
                auth,
                formatted,
                recaptchaVerifierRef.current
            );
            setConfirmationResult(result);
            setStep('otp');
            toast.success("OTP sent to " + formatted);
        } catch (error: any) {
            console.error("SMS Error:", error);

            recaptchaVerifierRef.current?.clear();
            recaptchaVerifierRef.current = null;

            // Surface a user-friendly message for common errors
            const messages: Record<string, string> = {
                'auth/invalid-phone-number': 'Invalid phone number format.',
                'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
                'auth/invalid-app-credential': 'App not authorized. Contact support.',
                'auth/quota-exceeded': 'SMS quota exceeded for today.',
            };
            toast.error(messages[error.code] || error.message || "Failed to send SMS.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!confirmationResult) {
            toast.error("Please request an OTP first.");
            return;
        }
        if (otp.length !== 6) {
            toast.error("Please enter the full 6-digit OTP.");
            return;
        }

        try {
            await confirmationResult.confirm(otp);
            setIsVerified(true);
            toast.success("Phone verified successfully!");
        } catch (error: any) {
            const messages: Record<string, string> = {
                'auth/invalid-verification-code': 'Incorrect OTP code.',
                'auth/code-expired': 'OTP has expired. Please request a new one.',
            };
            toast.error(messages[error.code] || "Invalid or expired OTP.");
        }
    };

    const handleChangePhone = () => {
        setStep('phone');
        setOtp('');
        setConfirmationResult(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={() => setConfirmSpam(false)}
            />

            {/* ✅ reCAPTCHA container must be in the DOM when verifier initializes */}
            <div id="recaptcha-container" />

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                            Confirm Document as Spam
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            To prevent spam reports, we require a quick mobile verification.
                        </p>
                    </div>
                </div>

                {/* State Selection */}
                <div className="flex flex-col gap-2 mb-4">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        State <span className="text-red-500">*</span>
                    </label>
                    <select
                        required
                        value={confirmSpamReview.state || "Johor"}
                        onChange={(e) => setConfirmSpamReview(prev => ({ ...prev, state: e.target.value as MalaysiaState }))}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                        {["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah", "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Labuan", "Putrajaya"].map(state => (
                            <option key={state} value={state}>{state}</option>
                        ))}
                    </select>
                </div>

                {/* OTP Section */}
                <div className="flex flex-col gap-4 mb-6 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    {step === 'phone' ? (
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold uppercase text-slate-500">Phone Number</label>
                            <div className="flex gap-2">
                                <input
                                    type="tel"
                                    placeholder="e.g. 0123456789"
                                    disabled={isVerified}
                                    onChange={(e) => setConfirmSpamReview(prev => ({ ...prev, phone: e.target.value }))}
                                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                />
                                <button
                                    onClick={handleSendOTP}
                                    disabled={isVerifying || isVerified}
                                    className="bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50"
                                >
                                    {isVerifying ? "Sending..." : isVerified ? "✓ Verified" : "Send OTP"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300">
                            <label className="text-xs font-semibold uppercase text-slate-500">Enter 6-Digit OTP</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="· · · · · ·"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} // numbers only
                                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-blue-500 rounded-lg text-center tracking-[1em] font-bold text-lg"
                                />
                                <button
                                    onClick={handleVerifyOTP}
                                    disabled={isVerified || otp.length !== 6}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                                >
                                    {isVerified ? "✓ Done" : "Verify"}
                                </button>
                            </div>
                            <button
                                onClick={handleChangePhone}
                                className="text-left text-[10px] text-blue-500 hover:underline"
                            >
                                ← Change phone number
                            </button>
                        </div>
                    )}
                </div>

                {/* Comment */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Comment (Optional)
                    </label>
                    <textarea
                        rows={3}
                        placeholder="Briefly describe why this document requires human oversight..."
                        onChange={(e) => setConfirmSpamReview(prev => ({ ...prev, comment: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                    />
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                    <button
                        className="flex-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-gray-300 dark:border-slate-600 p-2 rounded-lg transition-colors"
                        onClick={() => setConfirmSpam(false)}
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!isVerified}
                        className={`flex-1 p-2 rounded-lg font-bold transition-all shadow-lg ${isVerified
                            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-95"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none"
                            }`}
                        onClick={handleConfirmSpam}
                    >
                        Confirm Request
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConfirmSpam