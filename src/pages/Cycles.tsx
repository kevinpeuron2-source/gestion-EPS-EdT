import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { Plus, Trash2, CalendarDays } from "lucide-react";

export default function Cycles() {
  const { cycles, absences, classes } = useStore();

  const [newCycleName, setNewCycleName] = useState("");
  const [newCycleStart, setNewCycleStart] = useState<number>(1);
  const [newCycleEnd, setNewCycleEnd] = useState<number>(6);

  const [selClassId, setSelClassId] = useState("");
  const [absReason, setAbsReason] = useState("");
  const [absStart, setAbsStart] = useState<number>(1);
  const [absEnd, setAbsEnd] = useState<number>(1);

  const addCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCycleName) return;
    await addDoc(collection(db, "cycles"), {
      name: newCycleName,
      startWeek: newCycleStart,
      endWeek: newCycleEnd,
      createdAt: new Date()
    });
    setNewCycleName("");
  };

  const addAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selClassId || !absReason) return;
    await addDoc(collection(db, "absences"), {
      classId: selClassId,
      reason: absReason,
      startWeek: absStart,
      endWeek: absEnd,
      createdAt: new Date()
    });
    setAbsReason("");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Cycles & Absences</h2>
        <p className="text-slate-500 text-sm mt-1">Définissez vos périodes de planification en semaines et les stages des classes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Cycles */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 inline-flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Cycles
          </h3>
          <ul className="space-y-2 mb-6 max-h-60 overflow-y-auto">
            {cycles.sort((a,b)=>a.startWeek - b.startWeek).map(c => (
              <li key={c.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200 group">
                <div>
                  <span className="text-sm font-medium">{c.name}</span>
                  <div className="text-xs text-slate-400">Semaine {c.startWeek} à {c.endWeek} ({(c.endWeek - c.startWeek) + 1} sem.)</div>
                </div>
                <button onClick={() => deleteDoc(doc(db, "cycles", c.id))} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
            {cycles.length === 0 && <p className="text-sm text-slate-400 italic">Aucun cycle défini.</p>}
          </ul>

          <form onSubmit={addCycle} className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-600 uppercase">Nouveau cycle</h4>
            <input value={newCycleName} onChange={e=>setNewCycleName(e.target.value)} placeholder="Nom (ex: Cycle 1)" className="form-input w-full text-sm rounded-md border-slate-300" required />
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="52" value={newCycleStart} onChange={e=>setNewCycleStart(parseInt(e.target.value))} placeholder="De" className="form-input flex-1 text-sm rounded-md border-slate-300" required />
              <span className="text-sm text-slate-400">à</span>
              <input type="number" min="1" max="52" value={newCycleEnd} onChange={e=>setNewCycleEnd(parseInt(e.target.value))} placeholder="À" className="form-input flex-1 text-sm rounded-md border-slate-300" required />
            </div>
            <button type="submit" className="w-full bg-slate-800 text-white font-medium py-2 rounded-md text-sm hover:bg-slate-900 flex justify-center items-center gap-2 shadow-sm">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </form>
        </section>

        {/* Absences */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 inline-flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Classes en Stage
          </h3>
          <ul className="space-y-2 mb-6 max-h-60 overflow-y-auto">
            {absences.map(a => {
              const cls = classes.find(c => c.id === a.classId);
              return (
                <li key={a.id} className="flex items-center justify-between p-2 bg-blue-50/50 rounded border border-blue-100 group">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <div>
                      <span className="text-sm font-medium">{cls?.name || 'Classe inconnue'} <span className="font-normal text-slate-500">— {a.reason}</span></span>
                      <div className="text-[10px] text-slate-400">Sem. {a.startWeek}-{a.endWeek}</div>
                    </div>
                  </div>
                  <button onClick={() => deleteDoc(doc(db, "absences", a.id))} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
            {absences.length === 0 && (
              <div className="flex items-center gap-2 p-2 opacity-50">
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                <span className="text-sm flex-1 italic text-slate-500">Ajouter une classe...</span>
              </div>
            )}
          </ul>

          <form onSubmit={addAbsence} className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-600 uppercase">Nouvelle absence</h4>
            <select value={selClassId} onChange={e=>setSelClassId(e.target.value)} className="form-select w-full text-sm rounded-md border-slate-300 bg-white" required>
              <option value="">Sélectionner une classe</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={absReason} onChange={e=>setAbsReason(e.target.value)} placeholder="Motif (ex: Stage)" className="form-input w-full text-sm rounded-md border-slate-300" required />
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="52" value={absStart} onChange={e=>setAbsStart(parseInt(e.target.value))} className="form-input flex-1 text-sm rounded-md border-slate-300" required />
              <span className="text-sm text-slate-400">à</span>
              <input type="number" min="1" max="52" value={absEnd} onChange={e=>setAbsEnd(parseInt(e.target.value))} className="form-input flex-1 text-sm rounded-md border-slate-300" required />
            </div>
            <button type="submit" className="w-full bg-slate-800 text-white font-medium py-2 rounded-md text-sm hover:bg-slate-900 flex justify-center items-center gap-2 shadow-sm">
              <Plus className="w-4 h-4" /> Planifier
            </button>
          </form>
        </section>

      </div>
    </div>
  );
}
