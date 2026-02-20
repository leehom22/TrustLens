import { useState, useEffect, ReactNode } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, onAuthStateChanged, User } from "firebase/auth";
import { Button } from "@/app/components/ui/button";
import { Shield, LogOut, LayoutDashboard, ArrowUpFromLine, FileScan, FileClock, BadgeAlert, Menu, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import logo from '../images/logo.jpg'
import userLogo from '../images/user.png'
import { NavLink, useNavigate } from "react-router-dom";

interface SidebarProps {
  user: User | null
}
const Sidebar = ({ user }: SidebarProps) => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  // Controls whether the mobile drawer is open
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close sidebar on route change (mobile)
  const closeMobile = () => setMobileOpen(false);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: <LayoutDashboard />, requiredRole: "user" },
    { name: "Dashboard", path: "/admin-dashboard", icon: <LayoutDashboard />, requiredRole: "expert" },
    { name: "Upload", path: "/upload-document", icon: <FileScan />, requiredRole: "user" },
    { name: "History", path: "/history", icon: <FileClock />, requiredRole: "user" },
    { name: "Review", path: "/review-document-list", icon: <FileClock />, requiredRole: "expert" },
  ];

  const filteredItems = navItems.filter(
    (item) => !item.requiredRole || role === item.requiredRole
  );

  const handleSignOut = async () => {
    try {
      closeMobile();
      navigate("/login");
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Shared sidebar content
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div
        className="flex p-6 border-b border-gray-100 dark:border-slate-800 gap-2 justify-start items-center cursor-pointer"
        onClick={() => { navigate("/dashboard"); closeMobile(); }}
      >
        <img src={logo} alt="TrustLens" className="w-13 rounded-md border-primary/10" />
        <p className="text-3xl"><b>Trust</b>Lens</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-4 pt-10 space-y-7">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={closeMobile}
            className={({ isActive }) => `
              flex items-center gap-5 p-4 transition-all duration-200 ease-in-out group
              ${isActive
                ? "bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-sm"
                : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-white"
              }
            `}
          >
            <div className="transition-transform duration-200 group-hover:scale-110">
              {item.icon}
            </div>
            <span className="text-lg">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-4 mb-1 border-t border-gray-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-lg font-medium text-gray-500">Theme</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 rounded-md"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <img
            src={user!.photoURL || userLogo}
            alt={user!.displayName || ""}
            className="w-10 rounded-xl border-2 border-primary/10 dark:bg-white flex-shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <p className="text-md font-semibold text-gray-900 dark:text-white leading-tight truncate">
              {user!.displayName}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400 truncate">
              {user!.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile hamburger button ── */}
      <button
        className="lg:hidden fixed top-4 left-4 z-[60] p-2 rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-md"
        onClick={() => setMobileOpen((prev) => !prev)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* ── Mobile backdrop overlay ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile slide-in drawer ── */}
      <aside
        className={`
          lg:hidden fixed inset-y-0 left-0 z-[56] w-72 bg-white dark:bg-slate-900
          border-r border-gray-200 dark:border-slate-800 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        aria-label="Mobile navigation"
      >
        <SidebarContent />
      </aside>

      {/* ── Desktop fixed sidebar ── */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-75 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex-col"
        aria-label="Desktop navigation"
      >
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar