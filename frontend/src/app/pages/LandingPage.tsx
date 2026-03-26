import React, { useState, useEffect } from "react";
import {
  FileSearch,
  Bot,
  Mail,
  Zap,
  ScanEye,
  ArrowRight,
  ShieldAlert,
  CheckCircle,
  FileText,
  Clock,
  Menu,
  X,
  Shield,
  Lock,
} from "lucide-react";
import logoImg from "../images/logo.jpg";
import { LanguageToggleButton } from "../components/LanguageToggleButton";

/* ------------------------------------------------------------------ */
/*  INLINE STYLES (so the file is fully self-contained)                */
/* ------------------------------------------------------------------ */
function InlineStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      @keyframes ticker {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .animate-ticker {
        animation: ticker 50s linear infinite;
      }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/*  NAVIGATION                                                         */
/* ------------------------------------------------------------------ */
function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        scrolled
          ? "bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/5 py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-[1180px] mx-auto px-6 md:px-10 flex items-center justify-between">
        {/* Logo */}
          <a href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-blue-500/30">
              <img src={logoImg} alt="TrustLens Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-black tracking-tight text-white uppercase">
              TrustLens
            </span>
          </a>

        {/* Desktop Links */}
        <nav className="hidden lg:flex items-center gap-8">
          {["Features", "How It Works", "Security"].map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s/g, "-")}`}
              className="text-[15px] font-semibold text-white/80 hover:text-white transition-colors"
            >
              {link}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          {/* Language toggle — visible from landing page, persists globally */}
          <LanguageToggleButton variant="dark" className="hidden lg:inline-flex" />
          <a
            href="/login"
            className="hidden lg:inline-flex items-center justify-center px-5 h-[44px] text-[14px] font-semibold text-white/80 hover:text-white border border-white/20 rounded-full hover:border-white/40 transition-all"
          >
            Log In
          </a>
          <a
            href="/analyze"
            className="inline-flex items-center justify-center px-6 h-[44px] text-[14px] font-bold text-[#0B0F19] bg-white rounded-full hover:bg-white/90 transition-all shadow-lg"
          >
            Get Started
          </a>
          <button
            className="lg:hidden text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-[#0B0F19] z-[110] p-8 lg:hidden">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden">
                  <img src={logoImg} alt="TrustLens Logo" className="w-full h-full object-cover" />
                </div>
              <span className="text-xl font-black text-white uppercase">TrustLens</span>
            </div>
            <button onClick={() => setMobileOpen(false)}>
              <X size={28} className="text-white" />
            </button>
          </div>
          <nav className="flex flex-col gap-6">
            {["Features", "How It Works", "Security"].map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase().replace(/\s/g, "-")}`}
                className="text-white text-[20px] font-semibold"
                onClick={() => setMobileOpen(false)}
              >
                {link}
              </a>
            ))}
          </nav>
          <div className="absolute bottom-10 left-8 right-8 flex flex-col gap-3">
            <a
              href="/analyze"
              className="w-full block text-center bg-white text-[#0B0F19] py-4 rounded-full font-bold"
            >
              Get Started
            </a>
            <a
              href="/login"
              className="w-full block text-center border border-white/30 text-white py-4 rounded-full font-semibold hover:bg-white/10 transition-all"
            >
              Log In
            </a>
            <div className="flex justify-center pt-1">
              <LanguageToggleButton variant="dark" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  HERO                                                               */
/* ------------------------------------------------------------------ */
function HeroSection() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#0B0F19] via-[#101630] to-[#0B0F19] pt-[100px] lg:pt-[140px] pb-[80px]">
      {/* Background effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-[50%] left-[-5%] w-[400px] h-[400px] bg-cyan-600/8 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-[1180px] mx-auto px-6 md:px-10 relative z-10">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-blue-300 tracking-widest uppercase">
              AI-Powered Forensic Engine
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-[40px] md:text-[56px] lg:text-[72px] font-black text-white leading-[0.95] tracking-[-0.02em] uppercase mb-6 max-w-[900px]" style={{ fontFamily: "'Inter', sans-serif" }}>
            Intelligent Fraud Detection{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              for Any Documents
            </span>
          </h1>

          <p className="text-[16px] md:text-[20px] text-[#8B92A5] leading-[1.6] max-w-[600px] mx-auto mb-10">
            Stop relying on the naked eye. TrustLens uses 5-layer AI forensics
            to detect metadata tampering, Photoshop edits, and forged signatures
            in seconds.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <a
              href="/analyze"
              className="inline-flex items-center justify-center gap-2 px-8 h-[56px] text-[18px] font-bold text-[#0B0F19] bg-white rounded-[28px] hover:bg-white/90 transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)]"
            >
              Start Analyzing Now <ArrowRight size={20} />
            </a>
            <a
              href="#features"
              className="inline-flex items-center justify-center px-8 h-[56px] text-[18px] font-bold text-white bg-white/10 border border-white/20 rounded-[28px] hover:bg-white/20 transition-all"
            >
              See How It Works
            </a>
          </div>

          {/* Dashboard Mockup */}
          <DashboardMockup />
        </div>
      </div>

      {/* Wave transition */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] pointer-events-none">
        <svg
          className="relative block w-full h-[60px]"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,0 C150,110 350,110 500,110 C650,110 850,110 1200,0 L1200,120 L0,120 Z"
            fill="#0B0F19"
          />
        </svg>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  DASHBOARD MOCKUP                                                   */
/* ------------------------------------------------------------------ */
function DashboardMockup() {
  return (
    <div className="relative mx-auto max-w-[1000px] w-full group">
      {/* Glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[40px] blur opacity-20 group-hover:opacity-30 transition duration-700" />

      <div className="relative bg-[#F8F9FA] rounded-[28px] shadow-2xl overflow-hidden border border-white/10">
        {/* Browser bar */}
        <div className="h-10 bg-white border-b border-gray-200 flex items-center px-4 gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="ml-4 flex-1 bg-gray-100 h-6 rounded-md max-w-sm mx-auto flex items-center px-3 text-xs text-gray-400">
            trustlens.ai/dashboard
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-6 md:p-8 bg-[#F8F9FA] grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* KPIs */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            {[
              { icon: FileText, label: "Total Documents", value: "28", color: "bg-blue-100 text-blue-600" },
              { icon: ShieldAlert, label: "High/Med Risk Flagged", value: "4", color: "bg-red-100 text-red-600" },
              { icon: CheckCircle, label: "Model Accuracy", value: "94.2%", color: "bg-green-100 text-green-600" },
              { icon: Clock, label: "Pending Review", value: "2", color: "bg-orange-100 text-orange-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className={`p-3 rounded-lg ${kpi.color} w-fit mb-4`}>
                  <kpi.icon size={20} />
                </div>
                <h3 className="text-gray-500 text-xs font-medium uppercase">{kpi.label}</h3>
                <h2 className="text-2xl font-bold text-gray-800">{kpi.value}</h2>
              </div>
            ))}
          </div>

          {/* Pie chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <h3 className="text-gray-700 font-bold mb-6 self-start text-sm">Risk Distribution</h3>
            <div
              className="relative w-36 h-36 rounded-full"
              style={{
                background:
                  "conic-gradient(#10B981 0% 85%, #EF4444 85% 90%, #F59E0B 90% 100%)",
              }}
            >
              <div className="absolute inset-4 bg-white rounded-full" />
            </div>
            <div className="mt-5 w-full space-y-2">
              <div className="flex items-center text-xs text-gray-600">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2" /> Low Risk (Safe)
              </div>
              <div className="flex items-center text-xs text-gray-600">
                <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2" /> Medium Risk
              </div>
              <div className="flex items-center text-xs text-gray-600">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-2" /> High Risk
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm">Flagged Documents</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-4 gap-4 text-xs font-semibold text-gray-400 uppercase mb-3 px-2">
                <div>Name</div>
                <div className="col-span-2">Detected Issue</div>
                <div>Risk Level</div>
              </div>
              {[
                { name: "Invoice_QTX_882.pdf", issue: "Metadata Erasure & Canva Editing Traces", risk: "High" },
                { name: "Uber_Receipt_992.png", issue: "Arithmetic Mismatch (Total sum incorrect)", risk: "High" },
              ].map((row) => (
                <div key={row.name} className="grid grid-cols-4 gap-4 items-center p-2 rounded-lg border-b border-gray-50">
                  <div className="flex items-center gap-2 font-medium text-gray-800 text-sm">
                    <FileText size={14} className="text-blue-500" /> {row.name}
                  </div>
                  <div className="col-span-2 text-gray-500 text-xs">{row.issue}</div>
                  <div>
                    <span className="bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded text-xs font-medium">
                      {row.risk}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SCROLLING BANNER                                                   */
/* ------------------------------------------------------------------ */
function ScrollingBanner() {
  const items = ["DETECT", "ANALYZE", "PROTECT", "VERIFY", "TRUST"];
  const repeated = Array(8).fill(items).flat();

  return (
    <section className="relative w-full overflow-hidden bg-[#0B0F19] py-[24px] border-t border-b border-white/10">
      <div className="flex whitespace-nowrap">
        <div className="flex items-center gap-x-[48px] animate-ticker px-[24px]">
          {repeated.map((text, i) => (
            <React.Fragment key={i}>
              <div className="flex items-center gap-x-[48px]">
                <div className="w-[36px] h-[36px] rounded-lg overflow-hidden flex-shrink-0">
                  <img src={logoImg} alt="TrustLens Logo" className="w-full h-full object-cover" />
                </div>
                <span className="text-white font-black text-[clamp(28px,4vw,56px)] leading-none select-none tracking-[-0.02em] uppercase opacity-40">
                  {text}
                </span>
              </div>
            </React.Fragment>
          ))}
          {repeated.map((text, i) => (
            <React.Fragment key={`d-${i}`}>
              <div className="flex items-center gap-x-[48px]">
                <div className="w-[36px] h-[36px] rounded-lg overflow-hidden flex-shrink-0">
                  <img src={logoImg} alt="TrustLens Logo" className="w-full h-full object-cover" />
                </div>
                <span className="text-white font-black text-[clamp(28px,4vw,56px)] leading-none select-none tracking-[-0.02em] uppercase opacity-40">
                  {text}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  BENTO FEATURE CARDS                                                */
/* ------------------------------------------------------------------ */
function FeatureBento() {
  return (
    <section id="features" className="py-[80px] md:py-[120px] px-5 md:px-10 bg-[#0B0F19]">
      <div className="max-w-[1180px] mx-auto space-y-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-white font-black text-[32px] md:text-[48px] uppercase tracking-[-0.02em] leading-[1.1] mb-4">
            Smart Tools for{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              Smarter Decisions
            </span>
          </h2>
          <p className="text-[#8B92A5] text-[16px] md:text-[18px] max-w-[500px] mx-auto">
            Every feature built for catching what humans miss.
          </p>
        </div>

        {/* Card 1 — AI Assistant */}
        <div className="relative rounded-[40px] md:rounded-[60px] overflow-hidden bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] min-h-[480px] flex flex-col md:flex-row items-center shadow-2xl">
          <div className="w-full md:w-1/2 p-10 md:p-16 z-10">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
              <Bot size={28} className="text-white" />
            </div>
            <h2 className="text-white font-black text-[28px] md:text-[42px] uppercase leading-[1.1] mb-5 tracking-[-0.02em]">
              AI Assistant Chat
            </h2>
            <p className="text-white/80 text-[16px] md:text-[18px] leading-[1.6] max-w-[440px]">
              Talk to your documents. Ask &ldquo;Is this signature real?&rdquo;
              and get instant answers backed by forensic analysis across metadata,
              pixel data, and structural patterns.
            </p>
          </div>
          <div className="w-full md:w-1/2 p-8 md:p-12 flex items-center justify-center">
            {/* Chat mockup */}
            <div className="w-full max-w-[360px] bg-[#0F172A] rounded-2xl p-5 shadow-2xl border border-white/10 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="bg-white/10 rounded-xl rounded-tl-none px-4 py-3 text-white/90 text-sm leading-relaxed">
                  I detected <span className="text-yellow-300 font-semibold">metadata erasure</span> and
                  Canva editing traces. The creation date was stripped and the font
                  doesn&apos;t match the issuer&apos;s template.
                </div>
              </div>
              <div className="flex items-start gap-3 justify-end">
                <div className="bg-blue-600 rounded-xl rounded-tr-none px-4 py-3 text-white text-sm">
                  What&apos;s the risk score?
                </div>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                  U
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="bg-white/10 rounded-xl rounded-tl-none px-4 py-3 text-white/90 text-sm leading-relaxed">
                  Risk Score: <span className="text-red-400 font-bold">87/100</span> — flagged as High Risk.
                </div>
              </div>
            </div>
          </div>
          {/* Decorative glow */}
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[100px] pointer-events-none" />
        </div>

        {/* Two-column row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 2 — Metadata Heatmaps */}
          <div className="relative rounded-[40px] overflow-hidden bg-gradient-to-br from-[#059669] to-[#10B981] min-h-[420px] p-10 md:p-14 flex flex-col justify-end shadow-2xl">
            <div className="absolute top-8 right-8 opacity-20 pointer-events-none">
              <ScanEye size={120} className="text-white" />
            </div>
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-5">
              <ScanEye size={28} className="text-white" />
            </div>
            <h3 className="text-white font-black text-[24px] md:text-[32px] uppercase leading-[1.1] mb-4 tracking-[-0.02em]">
              Metadata Heatmaps
            </h3>
            <p className="text-white/80 text-[15px] md:text-[17px] leading-[1.6] max-w-[400px]">
              Visualize pixel-level edits. See exactly where Photoshop, Canva, or
              any editor was used to alter your documents.
            </p>
          </div>

          {/* Card 3 — Risk Scoring */}
          <div className="relative rounded-[40px] overflow-hidden bg-gradient-to-br from-[#991B1B] to-[#DC2626] min-h-[420px] p-10 md:p-14 flex flex-col justify-end shadow-2xl">
            <div className="absolute top-8 right-8 opacity-20 pointer-events-none">
              <ShieldAlert size={120} className="text-white" />
            </div>
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-5">
              <ShieldAlert size={28} className="text-white" />
            </div>
            <h3 className="text-white font-black text-[24px] md:text-[32px] uppercase leading-[1.1] mb-4 tracking-[-0.02em]">
              Risk Determination
            </h3>
            <p className="text-white/80 text-[15px] md:text-[17px] leading-[1.6] max-w-[400px]">
              Every file gets analyzed. Prioritize high-risk contracts
              and flag suspicious invoices automatically.
            </p>
          </div>
        </div>

        {/* Card 4 — Automated Reports */}
        <div className="relative rounded-[40px] md:rounded-[60px] overflow-hidden min-h-[480px] flex flex-col md:flex-row items-center shadow-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(88,101,242,0.5) 0%, rgba(139,92,246,0.5) 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="w-full md:w-1/2 p-10 md:p-16 z-10">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
              <Mail size={28} className="text-white" />
            </div>
            <h2 className="text-white font-black text-[28px] md:text-[42px] uppercase leading-[1.1] mb-5 tracking-[-0.02em]">
              Automated Forensic Reports
            </h2>
            <p className="text-white/80 text-[16px] md:text-[18px] leading-[1.6] max-w-[440px]">
              Receive comprehensive PDF forensic reports via email instantly after
              analysis. Share with compliance teams, legal counsel, or auditors with
              one click.
            </p>
          </div>
          <div className="w-full md:w-1/2 p-8 md:p-12 flex items-center justify-center">
            {/* Report mockup */}
            <div className="w-full max-w-[320px] bg-white rounded-2xl p-6 shadow-2xl text-left">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="text-gray-900 font-bold text-sm">Forensic Report</h4>
                  <p className="text-gray-400 text-xs">Invoice_QTX_882.pdf</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Metadata Analysis", status: "Tampering Detected", color: "text-red-500" },
                  { label: "Pixel Forensics", status: "Edits Found (3 regions)", color: "text-yellow-600" },
                  { label: "Signature Verification", status: "Mismatch", color: "text-red-500" },
                  { label: "Arithmetic Check", status: "Passed", color: "text-green-600" },
                  { label: "Font Consistency", status: "2 Anomalies", color: "text-yellow-600" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center text-xs border-b border-gray-100 pb-2">
                    <span className="text-gray-600 font-medium">{item.label}</span>
                    <span className={`font-bold ${item.color}`}>{item.status}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-gray-400">Overall Risk</span>
                <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-1 rounded-full text-xs font-bold">
                  87 / 100 — High
                </span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />
        </div>

        {/* Bottom row — three small cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: FileSearch,
              title: "Audit History",
              color: "text-orange-400",
              bg: "bg-orange-500/10",
              desc: "Securely archive every analysis. Search past reports for compliance audits anytime.",
            },
            {
              icon: Zap,
              title: "Lightning Fast",
              color: "text-cyan-400",
              bg: "bg-cyan-500/10",
              desc: "Process complex financial documents in under 10 seconds with 99.9% uptime.",
            },
            {
              icon: Lock,
              title: "Bank-Grade Security",
              color: "text-indigo-400",
              bg: "bg-indigo-500/10",
              desc: "End-to-end encryption. Your documents are never stored after analysis completes.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group p-8 rounded-[28px] bg-[#131B2C] border border-white/5 hover:border-white/15 transition-all hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className={`w-14 h-14 ${f.bg} rounded-2xl flex items-center justify-center mb-6 ${f.color} group-hover:scale-110 transition-transform`}>
                <f.icon size={28} />
              </div>
              <h4 className="text-white font-bold text-lg mb-3 uppercase tracking-tight">{f.title}</h4>
              <p className="text-[#8B92A5] text-sm leading-relaxed group-hover:text-[#A0A8BD] transition-colors">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  HOW IT WORKS                                                       */
/* ------------------------------------------------------------------ */
function HowItWorks() {
  const steps = [
    { num: "01", title: "Upload Document", desc: "Drag and drop any PDF, image, or scanned document into TrustLens.", icon: FileText },
    { num: "02", title: "AI Analyzes", desc: "5-layer forensic engine checks metadata, pixels, fonts, signatures, and arithmetic.", icon: ScanEye },
    { num: "03", title: "Get Results", desc: "Receive a detailed risk score, heatmap, and downloadable forensic report.", icon: CheckCircle },
  ];

  return (
    <section id="how-it-works" className="py-[80px] md:py-[120px] px-5 md:px-10 bg-[#0B0F19]">
      <div className="max-w-[1180px] mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-white font-black text-[32px] md:text-[48px] uppercase tracking-[-0.02em] leading-[1.1] mb-4">
            How It Works
          </h2>
          <p className="text-[#8B92A5] text-[16px] md:text-[18px] max-w-[500px] mx-auto">
            Three steps. Zero guesswork. Total clarity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.num} className="relative group">
              <div className="p-10 rounded-[28px] bg-[#131B2C] border border-white/5 hover:border-blue-500/30 transition-all text-center">
                <span className="text-[64px] font-black text-white/5 absolute top-4 right-6 select-none pointer-events-none">
                  {step.num}
                </span>
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                  <step.icon size={32} />
                </div>
                <h3 className="text-white font-bold text-xl mb-3 uppercase tracking-tight">{step.title}</h3>
                <p className="text-[#8B92A5] text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  PRE-FOOTER CTA                                                     */
/* ------------------------------------------------------------------ */
function PreFooterCTA() {
  return (
    <section id="security" className="relative w-full overflow-hidden bg-gradient-to-b from-[#0B0F19] to-[#101630] pt-[100px] pb-[80px]">
      <div
        className="absolute inset-0 z-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="max-w-[1180px] relative z-10 mx-auto px-10 text-center">
        <h2 className="mx-auto max-w-[800px] text-[32px] md:text-[48px] font-black leading-[1.1] tracking-[-0.02em] text-white uppercase mb-6">
          Stop Getting Scams by
          <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Fraudulent Documents
          </span>
        </h2>
        <p className="text-[#8B92A5] text-[16px] md:text-[18px] max-w-[500px] mx-auto mb-10">
          Use TrustLens to protect their finances and
          ensure document integrity.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/analyze"
            className="inline-flex items-center justify-center gap-2 px-8 h-[56px] text-[18px] font-bold text-[#0B0F19] bg-white rounded-[28px] hover:bg-white/90 transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)]"
          >
            Get Started Free <ArrowRight size={20} />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  FOOTER                                                             */
/* ------------------------------------------------------------------ */
function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#080B14] py-12">
      <div className="max-w-[1180px] mx-auto px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden">
            <img src={logoImg} alt="TrustLens Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">TrustLens</span>
        </div>
        <p className="text-gray-600 text-sm">
          &copy; 2026 TrustLens Security. All rights reserved.
        </p>
        <div className="flex gap-6">
          <a href="#" className="text-gray-500 hover:text-white transition text-sm">Privacy</a>
          <a href="#" className="text-gray-500 hover:text-white transition text-sm">Terms</a>
          <a href="#" className="text-gray-500 hover:text-white transition text-sm">Support</a>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN EXPORT                                                        */
/* ------------------------------------------------------------------ */
const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <InlineStyles />
      <Navigation />
      <HeroSection />
      <ScrollingBanner />
      <FeatureBento />
      <HowItWorks />
      <PreFooterCTA />
      <Footer />
    </div>
  );
};

export default LandingPage;
