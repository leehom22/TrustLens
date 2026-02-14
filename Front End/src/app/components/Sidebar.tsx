import { useState, useEffect, ReactNode } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, onAuthStateChanged, User } from "firebase/auth";
import { Button } from "@/app/components/ui/button";
import { Shield, LogOut, LayoutDashboard, ArrowUpFromLine, FileScan, FileClock, BadgeAlert } from "lucide-react";
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
  const [selectedTab, setSelectedTab] = useState("")
  const navigate = useNavigate()
  const role = localStorage.getItem('role')

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard />, requiredRole: 'user' },
    { name: 'Dashboard', path: '/admin-dashboard', icon: <LayoutDashboard />, requiredRole: 'expert' },
    { name: 'Upload', path: '/upload-document', icon: <FileScan /> },
    { name: 'History', path: '/history', icon: <FileClock /> },
    // { name: 'Review', path: '/review-document', icon: <BadgeAlert />, requiredRole: 'expert' },
  ];

  const handleSignOut = async () => {
    try {
      // 1. Navigate FIRST. 
      // This ensures we are safely on the Login page before the Sidebar unmounts.
      navigate('/login'); 
      
      // 2. Then Sign Out.
      // This triggers the App state update. Since we are already on '/login' (a public route),
      // we won't get redirected to the landing page.
      await auth.signOut();
      
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-75 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col">
      {/* User Info Section (Top of Sidebar) */}
      <div className="flex p-6 border-b border-gray-100 dark:border-slate-800  gap-2 justify-start items-center cursor-pointer" onClick={() => navigate('/dashboard')}>
        <img src={logo} alt="TrustLens" className="w-13 rounded-md border-primary/10" />
        <p className="text-3xl"><b>Trust</b>Lens</p>
      </div>

      {/* Navigation Links or Actions could go here */}
      <nav className="flex-1 p-4 pt-10 space-y-7">
        {navItems.filter(item => !item.requiredRole || role === item.requiredRole).map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => `
                    flex items-center gap-5 p-4  transition-all duration-200 ease-in-out group
                    ${isActive
                ? 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-white'
              }
                `}
          >
            {/* Icon with a subtle scale effect on hover/active */}
            <div className="transition-transform duration-200 group-hover:scale-110">
              {item.icon}
            </div>

            <span className="text-lg">{item.name}</span>

            {/* Optional: The "Active Indicator" dot */}
            {({ isActive }) => isActive && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Settings/Theme/Signout (Bottom of Sidebar) */}
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
        <div className="flex items-center text-center">
          <img
            src={user!.photoURL || userLogo}
            alt={user!.displayName || ""}
            className="w-10  rounded-xl border-2 border-primary/10 dark:bg-white"
          />
          <div className="flex flex-col">
            <p className="text-md font-semibold text-gray-900 dark:text-white leading-tight">
              {user!.displayName}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400 truncate w-48">
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
    </aside>
  );
}

export default Sidebar