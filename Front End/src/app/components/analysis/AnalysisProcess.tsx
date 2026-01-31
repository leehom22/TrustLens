import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, CheckCircle2 } from "lucide-react";

interface AnalysisStep {
  id: string;
  title: string;
  description: string;
  aiModel: string;
  status: "pending" | "processing" | "complete";
}

export function AnalysisProcess() {
  const [steps, setSteps] = useState<AnalysisStep[]>([
    {
      id: "metadata",
      title: "Metadata Extraction",
      description: "Extracting document properties, creation date, author information, and modification history",
      aiModel: "MetaForge AI v2.1",
      status: "pending"
    },
    {
      id: "signature",
      title: "Digital Signature Analysis",
      description: "Verifying digital signatures and analyzing edit patterns across document versions",
      aiModel: "SignatureNet Deep Learning",
      status: "pending"
    },
    {
      id: "software",
      title: "Software Detection",
      description: "Identifying editing software used (Canva, MS Word, Photoshop, etc.) and detecting traces",
      aiModel: "SoftwareTrace Neural Network",
      status: "pending"
    },
    {
      id: "visual",
      title: "Visual Forensics",
      description: "Analyzing pixel-level modifications and generating heatmap of altered regions",
      aiModel: "VisionForensic CNN",
      status: "pending"
    },
    {
      id: "content",
      title: "Content Analysis",
      description: "Scanning document content for fraudulent clauses, suspicious terms, and scam indicators",
      aiModel: "FraudDetect LLM",
      status: "pending"
    },
    {
      id: "network",
      title: "Network Trace Analysis",
      description: "Tracing document origin, IP addresses, and geographical information",
      aiModel: "NetTrace AI",
      status: "pending"
    }
  ]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (currentStepIndex < steps.length) {
      // Set current step to processing
      setSteps(prev => prev.map((step, idx) => 
        idx === currentStepIndex 
          ? { ...step, status: "processing" }
          : step
      ));

      // Complete current step after delay
      const timer = setTimeout(() => {
        setSteps(prev => prev.map((step, idx) => 
          idx === currentStepIndex 
            ? { ...step, status: "complete" }
            : step
        ));
        setCurrentStepIndex(prev => prev + 1);
      }, 1200); // Each step takes 1.2 seconds

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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Analysis in Progress</h2>
            <p className="text-sm text-gray-600 dark:text-slate-400">AI is examining your document</p>
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
                        {step.status === "processing" ? "Processing" : step.status === "complete" ? "Complete" : "Pending"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">{step.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-slate-500">AI Model:</span>
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
            <span>Overall Progress</span>
            <span>{Math.min(currentStepIndex, steps.length)}/{steps.length} steps complete</span>
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
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">What's Happening?</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
          Our advanced AI system is performing a comprehensive forensic analysis of your document. 
          We're using multiple specialized neural networks to examine metadata, detect alterations, 
          identify editing software traces, and scan for fraudulent content. This multi-layered 
          approach ensures maximum accuracy in detecting any potential document manipulation or fraud.
        </p>
      </div>
    </div>
  );
}