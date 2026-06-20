import { Link, Outlet, useLocation } from "react-router-dom";
import { LogOut, Calendar, Map, Clock, Settings, UserCircle, Moon, Sun } from "lucide-react";
import { cn } from "../App";
import { useFirebaseSync } from "../hooks/useFirebaseSync";
import { useStore } from "../store/useStore";
import { useState, useEffect } from "react";

export default function Layout({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  useFirebaseSync();
  const loading = useStore((s) => s.loading);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const nav = [
    { name: "Emploi du temps", href: "/schedule", icon: Calendar },
    { name: "Activités & Absences", href: "/activities", icon: Clock },
    { name: "Paramètres", href: "/settings", icon: Settings },
  ];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-medium">Chargement des données...</div>;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-hidden font-sans transition-colors">
      <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm shrink-0 z-30 no-print transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">E</div>
          <h1 className="text-xl font-semibold tracking-tight">EPS Planner <span className="text-slate-400 font-normal">| Gestion</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDark(!isDark)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-700" title="Basculer le thème">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400 px-3 py-1.5 rounded-full text-xs font-medium border border-emerald-100">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            Synchronisé
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 relative z-20 no-print">
          <div className="p-4 flex flex-col gap-1">
            {nav.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "p-3 rounded-lg transition-colors cursor-pointer flex items-center gap-3 text-sm",
                    isActive
                      ? "bg-white/10 text-white"
                      : "hover:bg-white/5"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="mt-auto p-4 border-t border-slate-800">
            <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <UserCircle className="w-8 h-8 text-slate-400 shrink-0" />
                <div className="truncate">
                  <p className="text-sm font-medium text-white truncate">Administrateur</p>
                  <p className="text-[10px] text-slate-400 truncate">Accès libre sécurisé</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                title="Se déconnecter"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-slate-900 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
