import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { Teacher, ClassGroup, Facility } from "../types";

export default function Settings() {
  const { teachers, classes, facilities, settings } = useStore();

  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherColor, setNewTeacherColor] = useState("#4f46e5");

  const [newClassName, setNewClassName] = useState("");
  const [newClassColor, setNewClassColor] = useState("#10b981");

  const [newFacilityName, setNewFacilityName] = useState("");
  const [newFacilityColor, setNewFacilityColor] = useState("#f43f5e");

  const addTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName) return;
    await addDoc(collection(db, "teachers"), { name: newTeacherName, color: newTeacherColor, createdAt: new Date() });
    setNewTeacherName("");
  };

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName) return;
    await addDoc(collection(db, "classes"), { name: newClassName, color: newClassColor, createdAt: new Date() });
    setNewClassName("");
  };

  const addFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacilityName) return;
    await addDoc(collection(db, "facilities"), { name: newFacilityName, color: newFacilityColor, type: "General", createdAt: new Date() });
    setNewFacilityName("");
  };

  const deleteItem = async (cName: string, id: string) => {
    if (confirm("Supprimer cet élément ?")) {
      await deleteDoc(doc(db, cName, id));
    }
  };

  // Basic global time settings (Recess, Lunch break)
  const saveTimes = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const recStart = data.get("recStart") as string;
    const recEnd = data.get("recEnd") as string;
    const lunchStart = data.get("lunchStart") as string;
    const lunchEnd = data.get("lunchEnd") as string;
    
    // We will assume 1 recess time for simplicity in this baseline form, though model allows many
    const updated = {
      recessTimes: [{ start: recStart, end: recEnd }],
      lunchBreak: { start: lunchStart, end: lunchEnd },
      bellTimes: settings?.bellTimes || ["08:00"],
      updatedAt: new Date()
    };
    
    if (settings?.id) {
      await updateDoc(doc(db, "settings", settings.id), updated);
    } else {
      await setDoc(doc(collection(db, "settings"), "main"), updated);
    }
    alert("Horaires enregistrés");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Paramètres globaux</h2>
        <p className="text-slate-500 text-sm mt-1">Configurez les éléments de base de votre établissement.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Global Timings */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-1 md:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Horaires de l'établissement</h3>
            <form onSubmit={saveTimes} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <h4 className="text-sm font-medium text-slate-700">Récréation</h4>
                  <div className="flex items-center gap-2">
                    <input name="recStart" type="time" defaultValue={settings?.recessTimes[0]?.start || "10:15"} className="form-input text-sm rounded-md border-slate-300 w-full" required />
                    <span className="text-slate-400 text-sm">à</span>
                    <input name="recEnd" type="time" defaultValue={settings?.recessTimes[0]?.end || "10:30"} className="form-input text-sm rounded-md border-slate-300 w-full" required />
                  </div>
                </div>
                <div className="space-y-3 bg-amber-50 p-4 rounded-lg border border-amber-100">
                  <h4 className="text-sm font-medium text-amber-800">Pause méridienne</h4>
                  <div className="flex items-center gap-2">
                    <input name="lunchStart" type="time" defaultValue={settings?.lunchBreak?.start || "12:30"} className="form-input text-sm rounded-md border-amber-200 w-full bg-white text-amber-900" required />
                    <span className="text-amber-600 text-sm">à</span>
                    <input name="lunchEnd" type="time" defaultValue={settings?.lunchBreak?.end || "14:00"} className="form-input text-sm rounded-md border-amber-200 w-full bg-white text-amber-900" required />
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 shadow-sm transition-colors">
                  Enregistrer les horaires
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Teachers */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Professeurs</h3>
          <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {teachers.map(t => (
              <li key={t.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group border border-transparent hover:border-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-sm font-medium text-slate-800">{t.name}</span>
                </div>
                <button onClick={() => deleteItem("teachers", t.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
            {teachers.length === 0 && <li className="text-sm text-slate-400 italic">Aucun professeur</li>}
          </ul>
          <form onSubmit={addTeacher} className="flex gap-2 pt-4 border-t border-slate-100">
            <input type="color" value={newTeacherColor} onChange={e => setNewTeacherColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer p-1 bg-white border border-slate-300 shrink-0" />
            <input value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} placeholder="Nom (ex: M. Dupont)" className="form-input flex-1 text-sm rounded-md border-slate-300" required />
            <button type="submit" className="bg-slate-800 text-white px-3 py-2 rounded-md hover:bg-slate-900 transition-colors shadow-sm"><Plus className="w-4 h-4" /></button>
          </form>
        </section>

        {/* Classes */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Classes</h3>
          <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {classes.map(c => (
              <li key={c.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group border border-transparent hover:border-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-sm font-medium text-slate-800">{c.name}</span>
                </div>
                <button onClick={() => deleteItem("classes", c.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
            {classes.length === 0 && <li className="text-sm text-slate-400 italic">Aucune classe</li>}
          </ul>
          <form onSubmit={addClass} className="flex gap-2 pt-4 border-t border-slate-100">
            <input type="color" value={newClassColor} onChange={e => setNewClassColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer p-1 bg-white border border-slate-300 shrink-0" />
            <input value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="Nom (ex: 6e A)" className="form-input flex-1 text-sm rounded-md border-slate-300" required />
            <button type="submit" className="bg-slate-800 text-white px-3 py-2 rounded-md hover:bg-slate-900 transition-colors shadow-sm"><Plus className="w-4 h-4" /></button>
          </form>
        </section>

        {/* Facilities */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Installations (Lieux)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ul className="space-y-2 max-h-48 overflow-y-auto w-full pr-4">
              {facilities.map(f => (
                <li key={f.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group border border-transparent hover:border-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                    <span className="text-sm font-medium text-slate-800">{f.name}</span>
                  </div>
                  <button onClick={() => deleteItem("facilities", f.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
              {facilities.length === 0 && <li className="text-sm text-slate-400 italic">Aucune installation</li>}
            </ul>
            <form onSubmit={addFacility} className="flex gap-2 flex-col justify-end">
              <label className="text-xs font-semibold text-slate-600 uppercase">Nouvelle installation</label>
              <div className="flex gap-2">
                <input type="color" value={newFacilityColor} onChange={e => setNewFacilityColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer p-1 bg-white border border-slate-300 shrink-0" />
                <input value={newFacilityName} onChange={e => setNewFacilityName(e.target.value)} placeholder="Nom (ex: Gymnase Nord)" className="form-input flex-1 text-sm rounded-md border-slate-300" required />
                <button type="submit" className="bg-slate-800 text-white px-3 py-2 rounded-md hover:bg-slate-900 transition-colors shadow-sm"><Plus className="w-4 h-4" /></button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
