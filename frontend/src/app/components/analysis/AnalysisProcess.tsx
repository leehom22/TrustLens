import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { Language } from "../../App";

interface AnalysisStep {
  id: string;
  title: string;
  description: string;
  aiModel: string;
  status: "pending" | "processing" | "complete";
}

interface AnalysisProcessProps {
  language?: Language;
}

const translations = {
  en: {
    analysisInProgress: "Analysis in Progress",
    aiExamining: "AI is examining your document",
    processing: "Processing",
    complete: "Complete",
    pending: "Pending",
    overallProgress: "Overall Progress",
    stepsComplete: "steps complete",
    pipelineLogic: "Pipeline Logic",
    pipelineDesc: (
      <>
        Your document is currently moving through two specialized AI stages. First, the{" "}
        <span className="font-semibold text-blue-500"> Forensic Pipeline</span> extracts raw
        metadata and analyzes visual tampering. Second, the{" "}
        <span className="font-semibold text-blue-500"> Gemini-powered Restructuring Engine </span>
        transforms technical data into the dashboard view you see, ensuring all findings are
        grounded in the original image context.
      </>
    ),
    aiModel: "AI Model:",
    steps: [
      {
        id: "ingestion",
        title: "Multi-Layer Risk Aggregator & Judge",
        description: "Consolidates evidence from L1-L4 analysis layers. It applies weighted scoring based on document profiles, evaluates 'Hard Fail' triggers (such as unauthorized screenshots), and calculates a final risk level (SAFE to CRITICAL) while allowing for specific policy overrides like creative software forgiveness.",
        aiModel: "Gemini 1.5 Flash",
      },
      {
        id: "forensics",
        title: "Multi-Layer Forensic Pipeline",
        description: "Executing deep analysis on Metadata, Visual layers, Content, and Logic consistency.",
        aiModel: "Gemini-2.5-Pro + Gemini-3-Flash-Preview",
      },
      {
        id: "mapping",
        title: "Data Restructuring",
        description: "Mapping raw forensic findings into standardized dashboard schemas using Vision-Context.",
        aiModel: "Gemini-Flash-Latest",
      },
      {
        id: "finalization",
        title: "Insight Refactoring",
        description: "Generating user-friendly summaries and actionable next steps without altering risk scores.",
        aiModel: "Gemini-Flash-Latest",
      },
    ],
  },
  ms: {
    analysisInProgress: "Analisis Sedang Berjalan",
    aiExamining: "AI sedang memeriksa dokumen anda",
    processing: "Sedang Diproses",
    complete: "Selesai",
    pending: "Menunggu",
    overallProgress: "Kemajuan Keseluruhan",
    stepsComplete: "langkah selesai",
    pipelineLogic: "Logik Saluran Paip",
    pipelineDesc: (
      <>
        Dokumen anda sedang melalui dua peringkat AI yang khusus. Pertama,{" "}
        <span className="font-semibold text-blue-500"> Saluran Forensik</span> mengekstrak
        metadata mentah dan menganalisis manipulasi visual. Kedua,{" "}
        <span className="font-semibold text-blue-500"> Enjin Penstrukturan Semula berkuasa Gemini </span>
        mengubah data teknikal kepada paparan dashboard, memastikan semua penemuan
        berdasarkan konteks imej asal.
      </>
    ),
    aiModel: "Model AI:",
    steps: [
      {
        id: "ingestion",
        title: "Pengagregat Risiko Pelbagai Lapisan & Hakim",
        description: "Menggabungkan bukti dari lapisan analisis L1-L4. Ia menerapkan pemarkahan berwajaran berdasarkan profil dokumen, menilai pencetus 'Hard Fail' (seperti tangkapan skrin tidak dibenarkan), dan mengira tahap risiko akhir (SELAMAT hingga KRITIKAL).",
        aiModel: "Gemini 1.5 Flash",
      },
      {
        id: "forensics",
        title: "Saluran Forensik Pelbagai Lapisan",
        description: "Melaksanakan analisis mendalam pada Metadata, lapisan Visual, Kandungan, dan konsistensi Logik.",
        aiModel: "Gemini-2.5-Pro + Gemini-3-Flash-Preview",
      },
      {
        id: "mapping",
        title: "Penstrukturan Semula Data",
        description: "Memetakan penemuan forensik mentah ke dalam skema dashboard piawai menggunakan Vision-Context.",
        aiModel: "Gemini-Flash-Latest",
      },
      {
        id: "finalization",
        title: "Pemfaktoran Semula Penemuan",
        description: "Menjana ringkasan mesra pengguna dan langkah seterusnya yang boleh diambil tindakan tanpa mengubah skor risiko.",
        aiModel: "Gemini-Flash-Latest",
      },
    ],
  },
};

export function AnalysisProcess({ language = "en" }: AnalysisProcessProps) {
  const t = translations[language];

  const [steps, setSteps] = useState<AnalysisStep[]>(
    t.steps.map(s => ({ ...s, status: "pending" as const }))
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (currentStepIndex < steps.length) {
      setSteps(prev => prev.map((step, idx) => 
        idx === currentStepIndex ? { ...step, status: "processing" } : step
      ));

      const timer = setTimeout(() => {
        setSteps(prev => prev.map((step, idx) => 
          idx === currentStepIndex ? { ...step, status: "complete" } : step
        ));
        setCurrentStepIndex(prev => prev + 1);
      }, 15000); // Simulate 16 seconds per step

      return () => clearTimeout(timer);
    }
  }, [currentStepIndex, steps.length]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-600/20 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t.analysisInProgress}</h2>
            <p className="text-sm text-gray-600 dark:text-slate-400">{t.aiExamining}</p>
          </div>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-lg border transition-all ${
                  step.status === "processing"
                    ? "bg-blue-50 dark:bg-blue-600/10 border-blue-300 dark:border-blue-600/50 shadow-md"
                    : step.status === "complete"
                    ? "bg-green-50 dark:bg-green-600/10 border-green-300 dark:border-green-600/50"
                    : "bg-gray-50 dark:bg-slate-700/30 border-gray-200 dark:border-slate-600/50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {step.status === "processing" && (
                      <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                    )}
                    {step.status === "complete" && (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    )}
                    {step.status === "pending" && (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-slate-600" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{step.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        step.status === "processing"
                          ? "bg-blue-200 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400"
                          : step.status === "complete"
                          ? "bg-green-200 dark:bg-green-600/20 text-green-700 dark:text-green-400"
                          : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400"
                      }`}>
                        {step.status === "processing" ? t.processing : step.status === "complete" ? t.complete : t.pending}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">{step.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-slate-500">{t.aiModel}</span>
                      <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{step.aiModel}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-slate-400 mb-2">
            <span>{t.overallProgress}</span>
            <span>{Math.min(currentStepIndex, steps.length)}/{steps.length} {t.stepsComplete}</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
              initial={{ width: "0%" }}
              animate={{ width: `${(Math.min(currentStepIndex, steps.length) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t.pipelineLogic}</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
          {t.pipelineDesc}
        </p>
      </div>
    </div>
  );
}