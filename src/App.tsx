/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { Calendar, Map, CheckSquare, Settings as SettingsIcon, LogOut } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Pages placeholder
import Layout from "./components/Layout";
import Schedule from "./pages/Schedule";
import Activities from "./pages/Activities";
import Settings from "./pages/Settings";
import SlotManager from "./pages/SlotManager";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("eps_auth") === "RP26";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "RP26") {
      localStorage.setItem("eps_auth", "RP26");
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Mot de passe incorrect");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("eps_auth");
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg shadow-slate-200/50 border border-slate-200 max-w-sm w-full space-y-8 text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">EPS Planner</h1>
            <p className="text-slate-500 text-sm mt-2">Connectez-vous pour gérer l'emploi du temps et les installations.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full form-input text-sm rounded-md border-slate-300"
              required
            />
            {error && <p className="text-red-500 text-xs text-left">{error}</p>}
            <button
              type="submit"
              className="w-full bg-slate-800 text-white font-medium py-3 rounded border border-transparent hover:bg-slate-900 transition-colors shadow-sm text-sm"
            >
              Se connecter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout onLogout={handleLogout} />}>
          <Route index element={<Navigate to="/schedule" replace />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="slot-manager" element={<SlotManager />} />
          <Route path="activities" element={<Activities />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
