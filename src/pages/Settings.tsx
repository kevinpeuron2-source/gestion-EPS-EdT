import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { Trash2, Plus, GripVertical, Download, Upload } from "lucide-react";
import { Teacher, ClassGroup, Facility } from "../types";

export default function Settings() {
  const { teachers, classes, facilities, settings, courses } = useStore();

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

  // Basic global time settings (Recess, Lunch break, School Year)
  const [recesses, setRecesses] = useState([...(settings?.recessTimes || [{ id: "rec-init", start: "10:15", end: "10:30", name: "Matin" }])]);
  const [lunchBreak, setLunchBreak] = useState(settings?.lunchBreak || { start: "12:30", end: "14:00" });
  const [schoolYearWeeks, setSchoolYearWeeks] = useState(settings?.schoolYearWeeks || 36);
  const [holidays, setHolidays] = useState([...(settings?.holidays || [])]);
  const [bellTimes, setBellTimes] = useState(settings?.bellTimes || ["08:15", "09:10", "10:05", "10:20", "11:15", "11:55", "12:20", "12:45", "13:15", "13:45", "14:45", "15:15", "15:45", "16:50"]);

  React.useEffect(() => {
    if (settings) {
      if (settings.recessTimes) setRecesses(settings.recessTimes);
      if (settings.lunchBreak) setLunchBreak(settings.lunchBreak);
      if (settings.schoolYearWeeks) setSchoolYearWeeks(settings.schoolYearWeeks);
      if (settings.holidays) setHolidays(settings.holidays);
      if (settings.bellTimes) setBellTimes(settings.bellTimes);
    }
  }, [settings]);

  const addRecess = () => {
    setRecesses([...recesses, { id: Date.now().toString(), start: "16:00", end: "16:15", name: "Après-midi" }]);
  };

  const removeRecess = (id: string) => {
    setRecesses(recesses.filter(r => r.id !== id));
  };

  const updateRecess = (id: string, field: string, value: string) => {
    setRecesses(recesses.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addHoliday = () => {
    setHolidays([...holidays, { id: Date.now().toString(), startWeek: 1, endWeek: 2, name: "Vacances" }]);
  };

  const removeHoliday = (id: string) => {
    setHolidays(holidays.filter(h => h.id !== id));
  };

  const updateHoliday = (id: string, field: string, value: any) => {
    setHolidays(holidays.map(h => h.id === id ? { ...h, [field]: value } : h));
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const sortedBells = [...bellTimes].sort((a, b) => a.localeCompare(b));
    const updated = {
      recessTimes: recesses,
      lunchBreak,
      schoolYearWeeks,
      holidays,
      bellTimes: sortedBells,
      updatedAt: new Date()
    };
    
    if (settings?.id) {
      await updateDoc(doc(db, "settings", settings.id), updated);
    } else {
      await setDoc(doc(collection(db, "settings"), "main"), updated);
    }
    alert("Paramètres enregistrés");
  };

  const exportData = () => {
    const data = { teachers, classes, facilities, courses, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eps_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     const reader = new FileReader();
     reader.onload = async (event) => {
         try {
             const data = JSON.parse(event.target?.result as string);
             if (!confirm("Attention, l'import effacera toutes les données actuelles. Continuer ?")) return;
             
             // Very simple "wipe and insert":
             for (const c of courses) await deleteDoc(doc(db, "courses", c.id));
             for (const t of teachers) await deleteDoc(doc(db, "teachers", t.id));
             for (const cl of classes) await deleteDoc(doc(db, "classes", cl.id));
             for (const f of facilities) await deleteDoc(doc(db, "facilities", f.id));

             const newSet = {...data.settings};
             delete newSet.id;
             if (settings?.id) {
                 await updateDoc(doc(db, "settings", settings.id), newSet);
             } else if (data.settings) {
                 await setDoc(doc(collection(db, "settings"), "main"), newSet);
             }

             const clean = (obj: any) => { const o = {...obj}; delete o.id; return o; };

             // Re-insert with same IDs to preserve relations
             for (const t of (data.teachers||[])) await setDoc(doc(db, "teachers", t.id), clean(t));
             for (const cl of (data.classes||[])) await setDoc(doc(db, "classes", cl.id), clean(cl));
             for (const f of (data.facilities||[])) await setDoc(doc(db, "facilities", f.id), clean(f));
             for (const c of (data.courses||[])) await setDoc(doc(db, "courses", c.id), clean(c));

             alert("Import réussi. La page va se recharger.");
             window.location.reload();
         } catch (err) {
             console.error(err);
             alert("Erreur lors de l'import");
         }
     };
     reader.readAsText(file);
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
            <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Fonctionnement de l'établissement</h3>
            <form onSubmit={saveSettings} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Year settings */}
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                     <h4 className="text-sm font-medium text-slate-700 mb-3">Année scolaire</h4>
                     <div className="flex items-center justify-between gap-4">
                        <label className="text-sm text-slate-600">Nombre de semaines (cycle)</label>
                        <input type="number" min="1" max="52" value={schoolYearWeeks} onChange={e => setSchoolYearWeeks(parseInt(e.target.value))} className="form-input text-sm rounded-md border-slate-300 w-24" />
                     </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-medium text-slate-700">Périodes de vacances</h4>
                      <button type="button" onClick={addHoliday} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Ajouter</button>
                    </div>
                    <div className="space-y-2">
                      {holidays.map(h => (
                        <div key={h.id} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 shadow-sm">
                          <input type="text" value={h.name} onChange={e => updateHoliday(h.id, "name", e.target.value)} placeholder="Nom (ex: Toussaint)" className="form-input text-xs rounded border-slate-300 flex-1" />
                          <input type="number" min="1" max="52" value={h.startWeek} onChange={e => updateHoliday(h.id, "startWeek", parseInt(e.target.value))} className="form-input text-xs rounded border-slate-300 w-16" title="Semaine de début" />
                          <span className="text-slate-400 text-xs">à</span>
                          <input type="number" min="1" max="52" value={h.endWeek} onChange={e => updateHoliday(h.id, "endWeek", parseInt(e.target.value))} className="form-input text-xs rounded border-slate-300 w-16" title="Semaine de fin" />
                          <button type="button" onClick={() => removeHoliday(h.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      {holidays.length === 0 && <p className="text-xs text-slate-400 italic">Aucune vacance configurée</p>}
                    </div>
                  </div>
                </div>

                {/* Day settings */}
                <div className="space-y-4">
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                    <h4 className="text-sm font-medium text-amber-800 mb-3">Pause méridienne</h4>
                    <div className="flex items-center gap-2">
                      <input type="time" value={lunchBreak.start} onChange={e => setLunchBreak({ ...lunchBreak, start: e.target.value })} className="form-input text-sm rounded-md border-amber-200 w-full bg-white text-amber-900" required />
                      <span className="text-amber-600 text-sm">à</span>
                      <input type="time" value={lunchBreak.end} onChange={e => setLunchBreak({ ...lunchBreak, end: e.target.value })} className="form-input text-sm rounded-md border-amber-200 w-full bg-white text-amber-900" required />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-medium text-slate-700">Pauses & Récréations</h4>
                      <button type="button" onClick={addRecess} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Ajouter</button>
                    </div>
                    <div className="space-y-2">
                      {recesses.map(r => (
                        <div key={r.id} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 shadow-sm">
                          <input type="text" value={r.name} onChange={e => updateRecess(r.id, "name", e.target.value)} placeholder="Nom" className="form-input text-xs rounded border-slate-300 flex-1" />
                          <input type="time" value={r.start} onChange={e => updateRecess(r.id, "start", e.target.value)} className="form-input text-xs rounded border-slate-300 w-24" />
                          <span className="text-slate-400 text-xs">à</span>
                          <input type="time" value={r.end} onChange={e => updateRecess(r.id, "end", e.target.value)} className="form-input text-xs rounded border-slate-300 w-24" />
                          <button type="button" onClick={() => removeRecess(r.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-medium text-slate-700">Horaires / Sonneries</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {bellTimes.map((b, i) => (
                          <div key={i} className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-slate-200 text-sm font-mono text-slate-700 shadow-sm">
                            <span>{b}</span>
                            <button type="button" onClick={() => setBellTimes(bellTimes.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500 ml-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="time" id="newBellTime" className="form-input text-sm rounded-md border-slate-300 w-24 bg-white" />
                        <button type="button" onClick={() => { const v = (document.getElementById('newBellTime') as HTMLInputElement).value; if (v && !bellTimes.includes(v)) { setBellTimes([...bellTimes, v]); (document.getElementById('newBellTime') as HTMLInputElement).value = ''; } }} className="text-xs border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md font-medium">+ Ajouter</button>
                      </div>
                      <p className="text-[10px] text-slate-500 italic mt-1">Utilisés pour construire la grille de l'emploi du temps.</p>
                    </div>
                  </div>

                </div>

              </div>
              <div className="pt-2 border-t border-slate-100">
                <button type="submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 shadow-sm transition-colors w-full sm:w-auto">
                  Enregistrer les paramètres de l'établissement
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
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-sm font-medium text-slate-800 flex-1">{t.name}</span>
                  <input type="number" value={t.targetHours || 20} onChange={(e) => updateDoc(doc(db, "teachers", t.id), { targetHours: parseInt(e.target.value) || 20 })} className="w-16 form-input text-xs rounded border-slate-300 px-1 py-0.5" title="Heures cibles" placeholder="20h" />
                </div>
                <button onClick={() => deleteItem("teachers", t.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
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
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                    <span className="text-sm font-medium text-slate-800 flex-1">{f.name}</span>
                    <input type="number" min="1" max="10" value={f.capacity || 1} onChange={(e) => updateDoc(doc(db, "facilities", f.id), { capacity: parseInt(e.target.value) || 1 })} className="w-14 form-input text-xs rounded border-slate-300 px-1 py-0.5" title="Capacité (Nb. de classes)" placeholder="1" />
                  </div>
                  <button onClick={() => deleteItem("facilities", f.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
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

        {/* Data Management */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase mb-1">Sauvegarde & Importation</h3>
            <p className="text-xs text-slate-500 max-w-sm">Sauvegardez l'ensemble de votre base de données (professeurs, classes, emplois du temps) dans un fichier au format .json local.</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={exportData} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
                <Download className="w-4 h-4" />
                Sauvegarder
            </button>
            <label className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                Importer
                <input type="file" accept=".json" onChange={importData} className="hidden" />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
