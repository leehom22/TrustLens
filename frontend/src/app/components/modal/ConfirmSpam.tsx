import { MalaysiaState, SpamReviewInterface } from '@/app/types/type'
import React, { useEffect, useRef, useState } from 'react'
import { Id, toast } from 'react-toastify'
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult
} from "firebase/auth";
import { useLanguage } from "@/app/components/LanguageProvider"; // Make sure this path is correct

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

    // --- LANGUAGE CONTEXT ---
    const { language } = useLanguage();
    const t = {
        en: {
            title: "Confirm Document as Spam",
            desc: "To prevent spam reports, we require a quick mobile verification.",
            stateLabel: "State",
            phoneLabel: "Phone Number",
            phonePlaceholder: "e.g. 0123456789",
            sendOtp: "Send OTP",
            sending: "Sending...",
            verified: "✓ Verified",
            otpLabel: "Enter 6-Digit OTP",
            verifyBtn: "Verify",
            doneBtn: "✓ Done",
            changePhone: "← Change phone number",
            commentLabel: "Comment (Optional)",
            commentPlaceholder: "Briefly describe why this document requires human oversight...",
            cancel: "Cancel",
            confirmReq: "Confirm Request",
            // Toasts & Errors
            errRecaptcha: "reCAPTCHA expired. Please try again.",
            errValidPhone: "Please enter a valid Malaysian phone number.",
            successOtpSent: "OTP sent to ",
            errFormat: "Invalid phone number format.",
            errTooMany: "Too many attempts. Please wait and try again.",
            errAppCred: "App not authorized. Contact support.",
            errQuota: "SMS quota exceeded for today.",
            errSendFallback: "Failed to send SMS.",
            errReqOtp: "Please request an OTP first.",
            errFullOtp: "Please enter the full 6-digit OTP.",
            successVerify: "Phone verified successfully!",
            errWrongCode: "Incorrect OTP code.",
            errExpiredCode: "OTP has expired. Please request a new one.",
            errInvalidOtpFallback: "Invalid or expired OTP."
        },
        ms: {
            title: "Sahkan Dokumen sebagai Scam",
            desc: "Untuk mengelakkan laporan scam, kami memerlukan pengesahan mudah alih yang pantas.",
            stateLabel: "Negeri",
            phoneLabel: "Nombor Telefon",
            phonePlaceholder: "cth. 0123456789",
            sendOtp: "Hantar OTP",
            sending: "Menghantar...",
            verified: "✓ Disahkan",
            otpLabel: "Masukkan 6-Digit OTP",
            verifyBtn: "Sahkan",
            doneBtn: "✓ Selesai",
            changePhone: "← Tukar nombor telefon",
            commentLabel: "Komen (Pilihan)",
            commentPlaceholder: "Terangkan secara ringkas mengapa dokumen ini memerlukan semakan manusia...",
            cancel: "Batal",
            confirmReq: "Sahkan Permintaan",
            // Toasts & Errors
            errRecaptcha: "reCAPTCHA tamat tempoh. Sila cuba lagi.",
            errValidPhone: "Sila masukkan nombor telefon Malaysia yang sah.",
            successOtpSent: "OTP dihantar ke ",
            errFormat: "Format nombor telefon tidak sah.",
            errTooMany: "Terlalu banyak percubaan. Sila tunggu dan cuba lagi.",
            errAppCred: "Aplikasi tidak dibenarkan. Hubungi sokongan.",
            errQuota: "Kuota SMS melebihi had untuk hari ini.",
            errSendFallback: "Gagal menghantar SMS.",
            errReqOtp: "Sila minta OTP terlebih dahulu.",
            errFullOtp: "Sila masukkan OTP 6-digit penuh.",
            successVerify: "Telefon berjaya disahkan!",
            errWrongCode: "Kod OTP tidak betul.",
            errExpiredCode: "OTP telah tamat tempoh. Sila minta yang baru.",
            errInvalidOtpFallback: "OTP tidak sah atau tamat tempoh."
        }
    }[language];

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
                        toast.warning(t.errRecaptcha);
                    }
                }
            );
        };

        initRecaptcha();

        // Proper cleanup when modal unmounts
        return () => {
            recaptchaVerifierRef.current?.clear();
            recaptchaVerifierRef.current = null;
            // Also clean up any lingering global reference
            if ((window as any).recaptchaVerifier) {
                (window as any).recaptchaVerifier.clear?.();
                delete (window as any).recaptchaVerifier;
            }
        };
    }, [auth, t.errRecaptcha]); // Runs once on mount (and translation load)

    const handleSendOTP = async () => {
        const rawPhone = confirmSpamReview.phone;
        if (!rawPhone || rawPhone.length < 9) {
            toast.error(t.errValidPhone);
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
            toast.success(t.successOtpSent + formatted);
        } catch (error: any) {
            console.error("SMS Error:", error);

            recaptchaVerifierRef.current?.clear();
            recaptchaVerifierRef.current = null;

            // Surface a user-friendly message for common errors
            const messages: Record<string, string> = {
                'auth/invalid-phone-number': t.errFormat,
                'auth/too-many-requests': t.errTooMany,
                'auth/invalid-app-credential': t.errAppCred,
                'auth/quota-exceeded': t.errQuota,
            };
            toast.error(messages[error.code] || error.message || t.errSendFallback);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!confirmationResult) {
            toast.error(t.errReqOtp);
            return;
        }
        if (otp.length !== 6) {
            toast.error(t.errFullOtp);
            return;
        }

        try {
            await confirmationResult.confirm(otp);
            setIsVerified(true);
            toast.success(t.successVerify);
        } catch (error: any) {
            const messages: Record<string, string> = {
                'auth/invalid-verification-code': t.errWrongCode,
                'auth/code-expired': t.errExpiredCode,
            };
            toast.error(messages[error.code] || t.errInvalidOtpFallback);
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
                            {t.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {t.desc}
                        </p>
                    </div>
                </div>

                {/* State Selection */}
                <div className="flex flex-col gap-2 mb-4">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t.stateLabel} <span className="text-red-500">*</span>
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
                            <label className="text-xs font-semibold uppercase text-slate-500">{t.phoneLabel}</label>
                            <div className="flex gap-2">
                                <input
                                    type="tel"
                                    placeholder={t.phonePlaceholder}
                                    disabled={isVerified}
                                    onChange={(e) => setConfirmSpamReview(prev => ({ ...prev, phone: e.target.value }))}
                                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                />
                                <button
                                    onClick={handleSendOTP}
                                    disabled={isVerifying || isVerified}
                                    className="bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50"
                                >
                                    {isVerifying ? t.sending : isVerified ? t.verified : t.sendOtp}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300">
                            <label className="text-xs font-semibold uppercase text-slate-500">{t.otpLabel}</label>
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
                                    {isVerified ? t.doneBtn : t.verifyBtn}
                                </button>
                            </div>
                            <button
                                onClick={handleChangePhone}
                                className="text-left text-[10px] text-blue-500 hover:underline"
                            >
                                {t.changePhone}
                            </button>
                        </div>
                    )}
                </div>

                {/* Comment */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t.commentLabel}
                    </label>
                    <textarea
                        rows={3}
                        placeholder={t.commentPlaceholder}
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
                        {t.cancel}
                    </button>
                    <button
                        disabled={!isVerified}
                        className={`flex-1 p-2 rounded-lg font-bold transition-all shadow-lg ${isVerified
                            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-95"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none"
                            }`}
                        onClick={handleConfirmSpam}
                    >
                        {t.confirmReq}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConfirmSpam