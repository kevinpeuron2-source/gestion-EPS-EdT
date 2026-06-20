import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Trash2 } from "lucide-react";
import { Course } from "../types";
import { format, parse, differenceInMinutes, addMinutes } from "date-fns";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const TIME_START = 8;  // 08:00
const TIME_END = 18;   // 18:00
const PX_PER_MINUTE = 1;

export default function Schedule() {
  const { teachers, classes, facilities, courses, settings } = useStore();
  const [addingCourse, setAddingCourse] = useState<{ day: string; time: string } | null>(null);

  const [tId, setTId] = useState("");
  const [cId, setCId] = useState("");
  const [fId, setFId] = useState("");
  const [startT, setStartT] = useState("");
  const [endT, setEndT] = useState("");

  const handleAddClick = (dayOfDay: string, hour: number) => {
    setAddingCourse({ day: dayOfDay, time: `${hour.toString().padStart(2, '0')}:00` });
    setStartT(`${hour.toString().padStart(2, '0')}:00`);
    setEndT(`${(hour + 1).toString().padStart(2, '0')}:00`);
    setTId("");
    setCId("");
    setFId("");
  };

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tId || !cId || !addingCourse) return;
    
    await addDoc(collection(db, "courses"), {
      teacherId: tId,
      classId: cId,
      facilityId: fId || null,
      dayOfWeek: addingCourse.day,
      startTime: startT,
      endTime: endT,
      createdAt: new Date()
    });
    setAddingCourse(null);
  };

  const removeCourse = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Supprimer ce cours ?")) {
      await deleteDoc(doc(db, "courses", id));
    }
  };

  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="p-6 bg-white border-b border-slate-200 shrink-0">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Emploi du temps</h2>
        <p className="text-slate-500 text-sm mt-1">Gérez le planning hebdomadaire. Cliquez sur un créneau pour ajouter un cours.</p>
      </header>

      <div className="flex-1 overflow-auto bg-slate-100 p-6 flex gap-6">
        {/* Time axis */}
        <div className="w-12 shrink-0 relative mt-10">
          {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => (
            <div key={i} className="absolute w-full text-right pr-2 text-xs text-slate-400 font-medium font-mono" style={{ top: i * 60 * PX_PER_MINUTE - 6 }}>
              {TIME_START + i}h00
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="flex flex-1 min-w-[800px] border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm divide-x divide-slate-100">
          {DAYS.map((day, dIdx) => (
            <div key={day} className="flex-1 flex flex-col">
              <div className="h-10 border-b border-slate-200 flex items-center justify-center bg-slate-50 font-semibold text-sm text-slate-700">
                {day}
              </div>
              <div className="relative flex-1 bg-slate-50/20" style={{ minHeight: (TIME_END - TIME_START) * 60 * PX_PER_MINUTE }}>
                {/* Horizontal grid lines */}
                {Array.from({ length: TIME_END - TIME_START }).map((_, i) => (
                  <div key={i} className="absolute w-full border-t border-slate-100" style={{ top: i * 60 * PX_PER_MINUTE, height: 60 * PX_PER_MINUTE }} />
                ))}

                {/* Recess & Lunch Blocks background */}
                {settings?.recessTimes?.map(r => {
                  const s = timeToMinutes(r.start) - TIME_START * 60;
                  const duration = timeToMinutes(r.end) - timeToMinutes(r.start);
                  if (s < 0) return null;
                  return <div key={r.id || r.start} className="absolute w-full bg-pink-50/50 border-y border-pink-100 flex items-center justify-center opacity-70 pointer-events-none" style={{ top: s * PX_PER_MINUTE, height: duration * PX_PER_MINUTE }}><span className="text-[10px] text-pink-500 font-bold uppercase tracking-wider">{r.name || 'Récréation'}</span></div>;
                })}
                {settings?.lunchBreak && (
                  (() => {
                    const s = timeToMinutes(settings.lunchBreak.start) - TIME_START * 60;
                    const duration = timeToMinutes(settings.lunchBreak.end) - timeToMinutes(settings.lunchBreak.start);
                    if (s < 0) return null;
                    return <div className="absolute w-full bg-amber-50/50 border-y border-amber-100 flex items-center justify-center opacity-70 pointer-events-none" style={{ top: s * PX_PER_MINUTE, height: duration * PX_PER_MINUTE }}><span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Méridienne</span></div>;
                  })()
                )}

                {/* Clickable areas to add courses */}
                {Array.from({ length: TIME_END - TIME_START }).map((_, i) => (
                  <div
                    key={'click'+i}
                    onClick={() => handleAddClick(day, TIME_START + i)}
                    className="absolute w-full hover:bg-slate-100/50 cursor-crosshair transition-colors"
                    style={{ top: i * 60 * PX_PER_MINUTE, height: 60 * PX_PER_MINUTE, zIndex: 10 }}
                  />
                ))}

                {/* Placed Courses */}
                {courses.filter(c => c.dayOfWeek === day).map(course => {
                  const tTeacher = teachers.find(t => t.id === course.teacherId);
                  const tClass = classes.find(c => c.id === course.classId);
                  const tFac = facilities.find(f => f.id === course.facilityId);
                  
                  const startMin = timeToMinutes(course.startTime) - TIME_START * 60;
                  const durMin = timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
                  
                  return (
                    <div
                      key={course.id}
                      className="absolute left-1 right-1 rounded-md p-2 shadow-sm border border-slate-900/10 overflow-hidden group hover:z-30 hover:shadow-md transition-shadow cursor-default"
                      style={{
                        top: startMin * PX_PER_MINUTE + 2, // Slight margin
                        height: durMin * PX_PER_MINUTE - 4, // Slight margin
                        backgroundColor: tClass?.color || '#e2e8f0',
                        color: tClass?.color ? '#fff' : '#334155',
                        zIndex: 20
                      }}
                    >
                      {/* Dark overlay for readability */}
                      <div className="absolute inset-0 bg-black/10 mix-blend-multiply pointer-events-none" />
                      
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-mono font-bold opacity-90">{course.startTime} - {course.endTime}</span>
                          <button onClick={(e) => removeCourse(course.id, e)} className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-white transition-opacity"><Trash2 className="w-3 h-3" /></button>
                        </div>
                        <div className="font-bold text-sm tracking-tight leading-tight mt-0.5">{tClass?.name || 'Classe inconnue'}</div>
                        <div className="text-xs font-medium opacity-90 mt-0.5">Prof. {tTeacher?.name}</div>
                        {tFac && (
                          <div className="mt-auto text-[10px] uppercase font-bold tracking-wider opacity-90 pt-1 border-t border-white/20">
                            {tFac.name}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Course Modal */}
      {addingCourse && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Nouveau cours — {addingCourse.day}</h3>
            </div>
            <form onSubmit={saveCourse} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Début</label>
                  <input type="time" value={startT} onChange={e=>setStartT(e.target.value)} required className="form-input w-full text-sm rounded-md border-slate-300 font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Fin</label>
                  <input type="time" value={endT} onChange={e=>setEndT(e.target.value)} required className="form-input w-full text-sm rounded-md border-slate-300 font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Classe</label>
                <select value={cId} onChange={e=>setCId(e.target.value)} required className="form-select w-full text-sm rounded-md border-slate-300 bg-white">
                  <option value="">-- Choisir --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Professeur</label>
                <select value={tId} onChange={e=>setTId(e.target.value)} required className="form-select w-full text-sm rounded-md border-slate-300 bg-white">
                  <option value="">-- Choisir --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setAddingCourse(null)} className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded-md font-medium text-sm hover:bg-slate-50">Annuler</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-md font-medium text-sm hover:bg-blue-700 shadow-sm">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
