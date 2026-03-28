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
    handleConfirmSpam: () => Promise<boolean | Id>
}

const ConfirmSpam = ({ handleConfirmSpam, setConfirmSpamReview, setConfirmSpam, confirmSpamReview }: RequestReviewModalProps) => {
    const auth = getAuth();
    const recaptchaContainerRef = useRef<HTMLDivElement>(null);  // ✅ ref instead of id
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null); // ✅ local ref, not window

    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [otp, setOtp] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const [loading, setLoading] = useState(false)

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
        // 1. Logic to initialize
        const initRecaptcha = () => {
            if (!recaptchaContainerRef.current || recaptchaVerifierRef.current) return;

            // Ensure the container is empty to avoid the "already rendered" error
            recaptchaContainerRef.current.innerHTML = '<div id="recaptcha-wrapper"></div>';

            recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-wrapper', {
                size: 'invisible',
                callback: () => { },
                'expired-callback': () => {
                    // Handle expired recaptcha
                    recaptchaVerifierRef.current?.clear();
                    recaptchaVerifierRef.current = null;
                    initRecaptcha(); // Re-init on expiry
                }
            });
        };

        initRecaptcha();

        return () => {
            if (recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current.clear();
                recaptchaVerifierRef.current = null;
            }
        };
    }, [auth]);

    const handleSendOTP = async () => {
        const rawPhone = confirmSpamReview.phone;
        if (!rawPhone || rawPhone.length < 9) {
            toast.error(t.errValidPhone);
            return;
        }

        const formatted = rawPhone.startsWith('+')
            ? rawPhone
            : `+60${rawPhone.startsWith('0') ? rawPhone.substring(1) : rawPhone}`;
        console.log("formatted phone: ", formatted)
        setIsVerifying(true);
        try {
            if (!recaptchaVerifierRef.current) {
                throw new Error("reCAPTCHA not initialized");
            }
            const result = await signInWithPhoneNumber(
                auth,
                formatted,
                recaptchaVerifierRef.current!
            );
            setConfirmationResult(result);
            setStep('otp');
            toast.success(t.successOtpSent + formatted);
        } catch (error: any) {
            console.error("SMS Error:", error);

            // IMPORTANT: Just reset the widget, don't try to re-render a new one here
            // Firebase handles invisible reCAPTCHA resets automatically most of the time.
            // If it's a critical failure, we let the user try again which uses the existing ref.

            const messages: Record<string, string> = {
                'auth/invalid-phone-number': 'Invalid phone number format.',
                'auth/too-many-requests': 'Too many attempts. Please wait.',
                'auth/quota-exceeded': 'SMS quota exceeded.',
            };
            toast.error(messages[error.code] || "Failed to send SMS.");
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

    const submitSpamRequest = async () => {
        try {
            setLoading(true)
            await handleConfirmSpam()

        } catch (error) {
            console.log("Error while submitting scam request")
        } finally {
            setLoading(false)
        }
    }
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={() => setConfirmSpam(false)}
            />

            <div ref={recaptchaContainerRef} />

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
                        // Disable if not verified OR if currently loading
                        disabled={!isVerified || loading}
                        className={`flex-1 p-2 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${isVerified && !loading
                                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-95"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none"
                            }`}
                        onClick={() => submitSpamRequest()}
                    >
                        {loading ? (
                            <>
                                {/* Tailwind Spinner */}
                                <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Processing...</span>
                            </>
                        ) : (
                            "Confirm Request"
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConfirmSpam