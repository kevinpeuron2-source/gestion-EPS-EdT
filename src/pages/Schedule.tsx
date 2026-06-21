import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Trash2, Lock, LockOpen, Printer } from "lucide-react";
import { Course } from "../types";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const TIME_START = 8;
const TIME_END = 19;
const PX_PER_MINUTE = 2; // 1 hour = 120 pixels

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const formatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export default function Schedule() {
  const { teachers, classes, facilities, courses, settings } = useStore();

  const [modalData, setModalData] = useState<{
    id?: string;
    dayOfWeek: string;
    teacherId: string;
    startTime: string;
    endTime: string;
    classId?: string;
    facilityId?: string;
    coTeacherIds?: string[];
    isUnavailability?: boolean;
    reason?: string;
    weekType?: 'ALL' | 'A' | 'B';
    locked?: boolean;
  } | null>(null);

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>, day: string, teacherId: string) => {
    // Only trigger if we click directly on the background
    if (e.target !== e.currentTarget) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let clickedMins = TIME_START * 60 + Math.floor(y / PX_PER_MINUTE);

    // Snap to 15 min or 55 min intervals? 15 min snap
    const snappedMins = Math.floor(clickedMins / 15) * 15;
    
    // Check if adding this would span past TIME_END
    const startMins = Math.min(snappedMins, TIME_END * 60 - 55);
    const endMins = startMins + 55; // Default 55 min duration

    setModalData({
      dayOfWeek: day,
      teacherId,
      startTime: formatTime(startMins),
      endTime: formatTime(endMins),
      classId: "",
      facilityId: "",
      coTeacherIds: [],
      weekType: 'ALL',
      isUnavailability: false,
    });
  };

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalData) return;

    try {
      if (modalData.id) {
        const { id, ...data } = modalData;
        await updateDoc(doc(db, "courses", id), data);
      } else {
        await addDoc(collection(db, "courses"), modalData);
      }
      setModalData(null);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCourse = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm("Supprimer ce créneau ?")) return;
    try {
      await deleteDoc(doc(db, "courses", id));
      if (modalData?.id === id) setModalData(null);
    } catch (err) {}
  };

  const toggleLock = async (course: Course, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "courses", course.id), { locked: !course.locked });
    } catch (err) {}
  };

  const handleDragStart = (e: React.DragEvent, course: Course) => {
    if (course.locked) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', course.id);
  };

  const handleDrop = async (e: React.DragEvent, day: string, teacherId: string) => {
    e.preventDefault();
    const courseId = e.dataTransfer.getData('text/plain');
    if (!courseId) return;

    const course = courses.find(c => c.id === courseId);
    if (!course || course.locked) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    const duration = timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
    let startMins = TIME_START * 60 + Math.floor(y / PX_PER_MINUTE);
    
    // Snap to 5 mins
    startMins = Math.round(startMins / 5) * 5;
    const endMins = startMins + duration;

    try {
      await updateDoc(doc(db, "courses", courseId), {
        dayOfWeek: day,
        teacherId: teacherId, // move to this teacher
        startTime: formatTime(startMins),
        endTime: formatTime(endMins)
      });
    } catch (err) {}
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Emploi du temps</h1>
          <p className="text-sm text-slate-500">Cliquez sur une case vide pour ajouter un cours. Glissez-déposez pour déplacer.</p>
        </div>
        <button onClick={() => window.print()} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm">
          <Printer className="w-4 h-4" /> Imprimer
        </button>
      </header>

      <div className="flex-1 overflow-auto bg-slate-50 p-6 print:overflow-visible print:bg-white print:p-0 print:block">
        <div className="flex flex-col gap-8 print:block">
          {DAYS.map(day => (
            <div key={day} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:mb-8 print:shadow-none print:border-none print:break-inside-avoid">
              <div className="bg-slate-800 text-white px-4 py-2 font-bold text-lg text-center print:bg-slate-200 print:text-black">
                {day}
              </div>
              
              <div className="flex items-stretch overflow-x-auto min-w-full">
                {/* Timeline axis */}
                <div className="w-16 shrink-0 border-r border-slate-200 bg-white relative print:hidden">
                   <div className="h-10 border-b border-slate-200"></div> {/* Header spacer */}
                   <div className="relative" style={{ height: (TIME_END - TIME_START) * 60 * PX_PER_MINUTE }}>
                     {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => (
                       <div key={i} className="absolute w-full text-right pr-2 text-xs text-slate-400 font-medium transform -translate-y-1/2" style={{ top: i * 60 * PX_PER_MINUTE }}>
                         {TIME_START + i}h00
                       </div>
                     ))}
                   </div>
                </div>

                {/* Teachers Columns */}
                {teachers.map(teacher => {
                  const dayCourses = courses.filter(c => c.dayOfWeek === day && (c.teacherId === teacher.id || c.coTeacherIds?.includes(teacher.id)));
                  const totalHours = courses
                    .filter(c => !c.isUnavailability && (c.teacherId === teacher.id || c.coTeacherIds?.includes(teacher.id)))
                    .reduce((acc, c) => acc + (timeToMinutes(c.endTime) - timeToMinutes(c.startTime)) / 60, 0);

                  return (
                    <div key={teacher.id} className="flex-1 min-w-[150px] border-r border-slate-200 last:border-r-0 relative flex flex-col">
                      {/* Teacher Header */}
                      <div className="h-12 border-b border-slate-200 flex flex-col items-center justify-center font-bold text-sm text-white sticky top-0 z-20 print:text-black print:border" style={{ backgroundColor: teacher.color || '#334155' }}>
                        <span className="leading-tight">{teacher.name}</span>
                        {teacher.targetHours && (
                          <span className="text-[9px] opacity-80 print:hidden font-mono mt-0.5" title="Heures planifiées / Objectif">
                            [{totalHours.toFixed(1)}h / {teacher.targetHours}h]
                          </span>
                        )}
                      </div>

                      {/* Interactive Grid Area */}
                      <div 
                        className="relative flex-1 bg-white hover:bg-slate-50/50 transition-colors cursor-crosshair group print:border"
                        style={{ height: (TIME_END - TIME_START) * 60 * PX_PER_MINUTE }}
                        onClick={(e) => handleBackgroundClick(e, day, teacher.id)}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                        onDrop={(e) => handleDrop(e, day, teacher.id)}
                      >
                        {/* Drop Hint */}
                        <div className="absolute inset-0 hidden group-hover:block pointer-events-none bg-blue-50/20 z-0"></div>

                        {/* Grid lines 1 hr */}
                        {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => (
                          <div key={i} className="absolute w-full border-t border-slate-100 pointer-events-none" style={{ top: i * 60 * PX_PER_MINUTE }} />
                        ))}
                        {/* Grid lines 30 mins */}
                        {Array.from({ length: TIME_END - TIME_START }).map((_, i) => (
                          <div key={i} className="absolute w-full border-t border-slate-50 border-dashed pointer-events-none" style={{ top: (i * 60 + 30) * PX_PER_MINUTE }} />
                        ))}

                        {/* Recess backgrounds */}
                        {settings?.recessTimes?.map(r => {
                          const s = timeToMinutes(r.start) - TIME_START * 60;
                          const dur = timeToMinutes(r.end) - timeToMinutes(r.start);
                          if (s < 0) return null;
                          return <div key={r.id} className="absolute w-full flex items-center justify-center bg-pink-50 border-y border-pink-100 pointer-events-none z-0" style={{ top: s * PX_PER_MINUTE, height: dur * PX_PER_MINUTE }}><span className="text-[10px] uppercase font-bold text-pink-400">{r.name}</span></div>;
                        })}

                        {/* Lunch background */}
                        {settings?.lunchBreak && (() => {
                          const s = timeToMinutes(settings.lunchBreak.start) - TIME_START * 60;
                          const dur = timeToMinutes(settings.lunchBreak.end) - timeToMinutes(settings.lunchBreak.start);
                          if (s < 0) return null;
                          return <div className="absolute w-full flex items-center justify-center bg-amber-50 pointer-events-none z-0" style={{ top: s * PX_PER_MINUTE, height: dur * PX_PER_MINUTE }}><span className="text-[10px] uppercase font-bold text-amber-500 text-center uppercase tracking-widest break-words w-full">Pause</span></div>;
                        })()}

                        {/* Courses */}
                        {dayCourses.map(course => {
                          const startMins = timeToMinutes(course.startTime) - TIME_START * 60;
                          const dur = timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
                          const tClass = classes.find(c => c.id === course.classId);
                          const fac = facilities.find(f => f.id === course.facilityId);

                          const isUnavail = course.isUnavailability;

                          return (
                            <div
                              key={course.id}
                              draggable={!course.locked}
                              onDragStart={(e) => handleDragStart(e, course)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalData(course as any);
                              }}
                              className={`absolute left-0.5 right-0.5 rounded p-1.5 shadow-sm border overflow-hidden group hover:z-30 hover:shadow-md transition-shadow ${course.locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
                              style={{
                                top: startMins * PX_PER_MINUTE + 1,
                                height: Math.max(15, dur * PX_PER_MINUTE - 2),
                                backgroundColor: isUnavail ? '#e2e8f0' : (tClass?.color || '#cbd5e1'),
                                border: isUnavail ? '1px dashed #94a3b8' : '1px solid rgba(0,0,0,0.1)',
                                color: isUnavail ? '#4f46e5' : '#fff',
                                zIndex: 10,
                                opacity: course.locked ? 0.9 : 1
                              }}
                            >
                              {/* Content */}
                              <div className="flex flex-col h-full relative z-10 pointer-events-none">
                                <div className="flex justify-between items-start">
                                  <span className="text-[10px] font-mono font-bold leading-none drop-shadow-sm text-white/90">{course.startTime}-{course.endTime}</span>
                                </div>
                                
                                {isUnavail ? (
                                  <div className="flex-1 flex items-center justify-center mt-0.5">
                                    <span className="font-bold text-[10px] uppercase text-slate-600 text-center break-words leading-tight">{course.reason || "Indisponible"}</span>
                                  </div>
                                ) : (
                                  <div className="mt-0.5 flex-1 flex flex-col items-center justify-center text-center">
                                    <span className="font-bold text-xs drop-shadow-md leading-tight">{tClass?.name || '???'}</span>
                                    {fac && <span className="text-[9px] font-medium opacity-90 mt-0.5 px-1 bg-black/20 rounded drop-shadow-sm">{fac.name}</span>}
                                  </div>
                                )}
                              </div>
                              
                              {/* Controls */}
                              <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 print:hidden">
                                <button onClick={(e) => toggleLock(course, e)} className="p-1 bg-black/20 hover:bg-black/30 rounded backdrop-blur-sm shadow-sm transition-colors text-white">
                                  {course.locked ? <Lock className="w-3 h-3 text-red-100" /> : <LockOpen className="w-3 h-3" />}
                                </button>
                                <button onClick={(e) => deleteCourse(course.id, e)} className="p-1 bg-black/20 hover:bg-black/30 rounded backdrop-blur-sm shadow-sm transition-colors text-white">
                                  <Trash2 className="w-3 h-3 text-red-100" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 shrink-0">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">{modalData.id ? 'Modifier le créneau' : 'Nouveau créneau'}</h3>
            </div>
            
            <div className="bg-slate-100 px-6 py-2 flex gap-2 border-b border-slate-200">
              <button 
                type="button"
                className={`flex-1 text-xs py-1.5 rounded font-semibold ${!modalData.isUnavailability ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}
                onClick={() => setModalData({...modalData, isUnavailability: false})}
              >Cours</button>
              <button 
                type="button"
                className={`flex-1 text-xs py-1.5 rounded font-semibold ${modalData.isUnavailability ? 'bg-white shadow text-red-600' : 'text-slate-500 hover:bg-slate-200'}`}
                onClick={() => setModalData({...modalData, isUnavailability: true})}
              >Indisponibilité</button>
            </div>

            <form onSubmit={saveCourse} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Début</label>
                  <input type="time" required value={modalData.startTime} onChange={e => setModalData({...modalData, startTime: e.target.value})} className="form-input w-full text-sm rounded-md border-slate-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fin</label>
                  <input type="time" required value={modalData.endTime} onChange={e => setModalData({...modalData, endTime: e.target.value})} className="form-input w-full text-sm rounded-md border-slate-300" />
                </div>
              </div>

              {!modalData.isUnavailability ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Classe</label>
                    <select required value={modalData.classId} onChange={e => setModalData({...modalData, classId: e.target.value})} className="form-select w-full text-sm rounded-md border-slate-300">
                      <option value="">Sélectionner une classe</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Salle (Optionnel)</label>
                    <select value={modalData.facilityId} onChange={e => setModalData({...modalData, facilityId: e.target.value})} className="form-select w-full text-sm rounded-md border-slate-300">
                      <option value="">Aucune salle</option>
                      {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Motif</label>
                  <input type="text" placeholder="Ex: Réunion, Formation..." value={modalData.reason || ''} onChange={e => setModalData({...modalData, reason: e.target.value})} className="form-input w-full text-sm rounded-md border-slate-300" />
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setModalData(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors text-sm">Annuler</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
