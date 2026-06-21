import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { Plus, Trash2, Lock, LockOpen, Printer } from "lucide-react";
import { Course } from "../types";
import { format, parse, differenceInMinutes, addMinutes } from "date-fns";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const TIME_START = 8;  // 08:00
const TIME_END = 19;   // 19:00
const PX_PER_MINUTE = 2;

export default function Schedule() {
  const { teachers, classes, facilities, courses, settings } = useStore();
  const [addingCourse, setAddingCourse] = useState<{ day: string; time: string } | null>(null);

  const [tId, setTId] = useState("");
  const [coTIds, setCoTIds] = useState<string[]>([]);
  const [cId, setCId] = useState("");
  const [fId, setFId] = useState("");
  const [startT, setStartT] = useState("");
  const [endT, setEndT] = useState("");
  const [weekType, setWeekType] = useState<'ALL' | 'A' | 'B'>('ALL');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [isUnavail, setIsUnavail] = useState(false);
  const [reason, setReason] = useState("");

  const [resizingCourse, setResizingCourse] = useState<{ id: string; initialY: number; initialEndMins: number } | null>(null);
  const [draftCourse, setDraftCourse] = useState<{ day: string; teacherId: string; startMins: number; endMins: number; initialY: number } | null>(null);
  const [optimisticEnd, setOptimisticEnd] = useState<{ [id: string]: string }>({});

  const [history, setHistory] = useState<Course[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(courses)));
    if (newHistory.length > 20) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = async () => {
    if (historyIndex < 0) return;
    const prevCourses = history[historyIndex];
    setHistoryIndex(historyIndex - 1);
    await syncCourses(prevCourses);
  };

  const redo = async () => {
    if (historyIndex >= history.length - 1) return;
    const nextCourses = history[historyIndex + 1];
    setHistoryIndex(historyIndex + 1);
    await syncCourses(nextCourses);
  };

  const syncCourses = async (targetCourses: Course[]) => {
    const currentMap = new Map(courses.map(c => [c.id, c]));
    const targetMap = new Map(targetCourses.map(c => [c.id, c]));
    
    // Add & Update
    for (const [id, targetCourse] of targetMap.entries()) {
      const currentCourse = currentMap.get(id);
      if (!currentCourse) {
        const { id: _, ...data } = targetCourse;
        await setDoc(doc(db, "courses", id), data);
      } else if (JSON.stringify(currentCourse) !== JSON.stringify(targetCourse)) {
        const { id: _, ...data } = targetCourse;
        await updateDoc(doc(db, "courses", id), data);
      }
    }
    
    // Delete
    for (const id of currentMap.keys()) {
      if (!targetMap.has(id)) {
        await deleteDoc(doc(db, "courses", id));
      }
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
           e.preventDefault();
           redo();
        } else {
           e.preventDefault();
           undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex, courses]);

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  React.useEffect(() => {
    if (!resizingCourse) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizingCourse.initialY;
      const deltaMins = Math.round((deltaY / PX_PER_MINUTE) / 5) * 5;
      
      const course = courses.find(c => c.id === resizingCourse.id);
      if (!course) return;

      const startMins = timeToMinutes(course.startTime);
      const newEndMins = Math.max(startMins + 15, resizingCourse.initialEndMins + deltaMins);
      
      const h = Math.floor(newEndMins / 60);
      const m = newEndMins % 60;
      const newEnd = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      
      setOptimisticEnd({ [course.id]: newEnd });
    };

    const handleMouseUp = async () => {
      const courseId = resizingCourse.id;
      const newEnd = optimisticEnd[courseId];
      
      setResizingCourse(null);
      setOptimisticEnd({});
      
      if (newEnd) {
         try {
             pushHistory();
             await updateDoc(doc(db, "courses", courseId), { endTime: newEnd });
         } catch(e) {}
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCourse, optimisticEnd, courses]);

  React.useEffect(() => {
    if (!draftCourse) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - draftCourse.initialY;
      const deltaMins = Math.round(deltaY / PX_PER_MINUTE);
      
      // Snap the end time to 15 min increments based on delta
      const newEndMins = Math.max(draftCourse.startMins + 15, Math.ceil((draftCourse.startMins + 30 + deltaMins) / 15) * 15);
      
      setDraftCourse(prev => prev ? { ...prev, endMins: newEndMins } : null);
    };

    const handleMouseUp = () => {
      if (!draftCourse) return;
      
      const startH = Math.floor(draftCourse.startMins / 60) + TIME_START;
      const startM = draftCourse.startMins % 60;
      const endH = Math.floor(draftCourse.endMins / 60) + TIME_START;
      const endM = draftCourse.endMins % 60;
      
      setTId(draftCourse.teacherId);
      handleAddClick(draftCourse.day, 
         `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`,
         `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
      );
      
      setDraftCourse(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draftCourse]);

  const handleAddClick = (dayOfDay: string, start: string, end: string) => {
    setAddingCourse({ day: dayOfDay, time: start });
    setStartT(start);
    setEndT(end);
    setCId("");
    setFId("");
    setCoTIds([]);
    setWeekType('ALL');
    setEditingCourseId(null);
    setIsUnavail(false);
    setReason("");
  };

  const setDuration = (mins: number) => {
     if (!startT) return;
     const [h, m] = startT.split(':').map(Number);
     const total = h * 60 + m + mins;
     const nh = Math.floor(total / 60);
     const nm = total % 60;
     setEndT(`${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`);
  };

  const toggleLock = async (id: string, current: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    pushHistory();
    await updateDoc(doc(db, "courses", id), { locked: !current });
  };

  const minutesToTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const handleDragStart = (e: React.DragEvent, course: Course) => {
    if (course.locked) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "COURSE", id: course.id }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, dayId: string, teacherId: string) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json") || "{}");
      if (data.type !== "COURSE") return;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const yOffset = e.clientY - rect.top;
      let droppedMinutes = TIME_START * 60 + Math.floor(yOffset / PX_PER_MINUTE);
      
      // Snap to 5 minutes
      droppedMinutes = Math.round(droppedMinutes / 5) * 5;
      
      const course = courses.find(c => c.id === data.id);
      if (!course) return;

      const [sh, sm] = course.startTime.split(':').map(Number);
      const [eh, em] = course.endTime.split(':').map(Number);
      const duration = (eh * 60 + em) - (sh * 60 + sm);

      const newStart = minutesToTime(droppedMinutes);
      const newEnd = minutesToTime(droppedMinutes + duration);
      
      // If moving to a new teacher, update teacherId. If it was a coTeacher, switch them? Let's just override teacherId and clear coTeachers for simplicity if it changed columns
      let newTeacherId = course.teacherId;
      let newCoTeacherIds = course.coTeacherIds || [];
      
      if (course.teacherId !== teacherId && !newCoTeacherIds.includes(teacherId)) {
          newTeacherId = teacherId;
          newCoTeacherIds = [];
      } else if (newCoTeacherIds.includes(teacherId)) {
          // If dragged onto a co-teacher's column, maybe swap the main teacher?
          newTeacherId = teacherId;
          newCoTeacherIds = [course.teacherId, ...newCoTeacherIds.filter(id => id !== teacherId)];
      }

      // Only update if changed
      if (course.dayOfWeek === dayId && course.teacherId === newTeacherId && course.startTime === newStart) return;

      pushHistory();
      await updateDoc(doc(db, "courses", course.id), {
         dayOfWeek: dayId,
         teacherId: newTeacherId,
         coTeacherIds: newCoTeacherIds,
         startTime: newStart,
         endTime: newEnd,
         updatedAt: new Date()
      });
    } catch(err) {}
  };

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tId || (!isUnavail && !cId) || !addingCourse) return;
    
    pushHistory();
    const data = {
        teacherId: tId,
        coTeacherIds: isUnavail ? [] : coTIds,
        classId: isUnavail ? "UNAVAILABLE" : cId,
        facilityId: isUnavail ? null : (fId || null),
        dayOfWeek: addingCourse.day,
        startTime: startT,
        endTime: endT,
        weekType,
        isUnavailability: isUnavail,
        reason: isUnavail ? reason : null,
    };

    if (editingCourseId) {
      await updateDoc(doc(db, "courses", editingCourseId), { ...data, updatedAt: new Date() });
    } else {
      await addDoc(collection(db, "courses"), { ...data, createdAt: new Date() });
    }
    setAddingCourse(null);
    setEditingCourseId(null);
  };

  const removeCourse = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Supprimer ce cours ?")) {
      pushHistory();
      await deleteDoc(doc(db, "courses", id));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden schedule-container">
      <header className="p-6 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between no-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Emploi du temps</h2>
          <p className="text-slate-500 text-sm mt-1">Gérez le planning hebdomadaire. Cliquez sur un créneau pour ajouter un cours.</p>
        </div>
        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <div className="flex items-center gap-1 mr-2 no-print">
              <button 
                onClick={undo} 
                disabled={historyIndex < 0}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded text-sm font-medium transition-colors"
                title="Annuler (Ctrl+Z)"
              >
                Annuler
              </button>
              <button 
                onClick={redo} 
                disabled={historyIndex >= history.length - 1}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded text-sm font-medium transition-colors"
                title="Rétablir (Ctrl+Y)"
              >
                Rétablir
              </button>
            </div>
          )}
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
              <Printer className="w-4 h-4" />
              Imprimer (PDF)
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-slate-100 p-6 flex gap-6 items-start print:overflow-visible print:flex print:h-auto print:bg-white print:p-0">
        {/* Time axis */}
        <div className="w-12 shrink-0 relative mt-16">
          {/* Draw standard hour markers */}
          {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => {
            const hour = TIME_START + i;
            if (hour === TIME_END) return null; // Don't draw the very last one at the exact bottom boundary
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            const isBellTime = settings?.bellTimes?.includes(timeStr);
            if (isBellTime) return null; // Will be drawn by bellTimes
            
            return (
              <div key={`h-${i}`} className="absolute w-full text-right pr-2 text-[10px] text-slate-300 font-medium font-mono" style={{ top: i * 60 * PX_PER_MINUTE - 6 }}>
                {timeStr}
              </div>
            );
          })}
          
          {/* Draw bell times prominently */}
          {Array.from(new Set([
            ...(settings?.bellTimes || []), 
            ...Array.from({ length: 12 }).map((_, h) => `${(h + 8).toString().padStart(2, '0')}:00`),
            "18:30"
          ].filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b))).map((time, i) => {
            if (typeof time !== 'string') return null;
            if (time.endsWith(':00')) return null; // let standard hour markers handle it
            const t = timeToMinutes(time) - TIME_START * 60;
            if (t < 0) return null;
            return (
              <div key={i} className="absolute w-full text-right pr-2 text-[10px] text-slate-600 font-bold font-mono" style={{ top: t * PX_PER_MINUTE - 6 }}>
                {time}
              </div>
            );
          })}
        </div>

        {/* Days Grid */}
        <div className="flex flex-auto shrink-0 min-w-[1200px] border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm divide-x divide-slate-100">
          {DAYS.map((day, dIdx) => (
            <div key={day} className="flex-1 flex flex-col min-w-[200px]">
              <div className="h-8 border-b border-slate-200 flex items-center justify-center bg-slate-100 font-bold text-sm text-slate-700 uppercase tracking-wider">
                {day}
              </div>
              
              <div className="flex flex-1 divide-x divide-slate-100">
                {teachers.length === 0 ? (
                  <div className="flex-1 bg-slate-50/20 p-4 text-center text-xs text-slate-400 italic">Ajoutez des professeurs dans Paramètres</div>
                ) : teachers.map((teacher) => {
                  const teacherCourses = courses.filter(c => (c.teacherId === teacher.id || c.coTeacherIds?.includes(teacher.id)) && !c.isUnavailability);
                  const totalMins = teacherCourses.reduce((acc, c) => {
                     const [sh, sm] = c.startTime.split(':').map(Number);
                     const [eh, em] = c.endTime.split(':').map(Number);
                     const mins = (eh * 60 + em) - (sh * 60 + sm);
                     // If it's week A or B, it's half an hour per week on average
                     const factor = c.weekType && c.weekType !== 'ALL' ? 0.5 : 1;
                     return acc + (mins * factor);
                  }, 0);
                  const totalHours = totalMins / 60;
                  const targetHours = teacher.targetHours || 20;

                  return (
                  <div key={teacher.id} className="flex-1 flex flex-col min-w-[80px]">
                    <div 
                      className="h-14 border-b border-slate-200 flex flex-col items-center justify-center text-xs font-semibold text-white px-1 print:h-10"
                      style={{ backgroundColor: teacher.color }}
                      title={teacher.name}
                    >
                      <span className="truncate w-full text-center leading-tight">{teacher.name}</span>
                      <span className="text-[9px] font-bold opacity-80 leading-tight print:hidden">[{totalHours.toFixed(1)}h / {targetHours}h]</span>
                      
                      <button 
                        onClick={() => {
                          setTId(teacher.id);
                          handleAddClick(day, "08:00", "09:00");
                        }}
                        className="mt-0.5 bg-white/20 hover:bg-white/30 text-white rounded px-2 py-0.5 flex items-center gap-1 text-[9px] transition-colors print:hidden"
                      >
                        <Plus className="w-2.5 h-2.5" /> Ajouter
                      </button>
                    </div>
                    
                    <div 
                      className="relative flex-1 bg-slate-50/20 shadow-inner group/col" 
                      style={{ height: (TIME_END - TIME_START) * 60 * PX_PER_MINUTE }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={(e) => handleDrop(e, day, teacher.id)}
                      onMouseDown={(e) => {
                         if (e.target !== e.currentTarget) return; // Only process if the user clicks directly on the background
                         const rect = e.currentTarget.getBoundingClientRect();
                         const y = e.clientY - rect.top;
                         const startMins = Math.floor(y / PX_PER_MINUTE);
                         // Snap to 15 min or 5 min? Let's snap to closest 15 mins for start
                         const snappedStart = Math.floor(startMins / 15) * 15;
                         
                         setDraftCourse({
                            day,
                            teacherId: teacher.id,
                            startMins: snappedStart,
                            endMins: snappedStart + 30, // 30 min initial default length
                            initialY: e.clientY
                         });
                      }}
                    >
                      {/* Standard hourly grid lines */}
                      {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => {
                          const hour = TIME_START + i;
                          if (hour === TIME_END) return null;
                          return <div key={`grid-h-${i}`} className="absolute w-full border-t border-slate-200 pointer-events-none" style={{ top: i * 60 * PX_PER_MINUTE, zIndex: 5 }} />
                      })}

                      {/* Bell times grid lines */}
                      {Array.from(new Set([
                        ...(settings?.bellTimes || []), 
                        ...Array.from({ length: 12 }).map((_, h) => `${(h + 8).toString().padStart(2, '0')}:00`),
                        "18:30"
                      ].filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b))).map((time, i) => {
                         if (typeof time !== 'string' || time.endsWith(':00')) return null; // Avoid overlapping with standard hours
                         const t = timeToMinutes(time) - TIME_START * 60;
                         if (t < 0) return null;
                         return <div key={i} className="absolute w-full border-t border-slate-300 border-dashed pointer-events-none" style={{ top: t * PX_PER_MINUTE, zIndex: 5 }} />
                      })}

                      {/* Recess & Lunch Blocks background */}
                      {settings?.recessTimes?.map(r => {
                        const s = timeToMinutes(r.start) - TIME_START * 60;
                        const duration = timeToMinutes(r.end) - timeToMinutes(r.start);
                        if (s < 0) return null;
                        return <div key={r.id || r.start} className="absolute w-full bg-pink-100/70 border-y border-pink-200 flex flex-col items-center justify-center pointer-events-none overflow-hidden" style={{ top: s * PX_PER_MINUTE, height: duration * PX_PER_MINUTE, zIndex: 14 }}><span className="text-[10px] text-pink-600 font-bold uppercase tracking-widest opacity-80 truncate w-full text-center">{r.name || 'Récré'}</span></div>;
                      })}
                      {settings?.lunchBreak && (
                        (() => {
                          const s = timeToMinutes(settings.lunchBreak.start) - TIME_START * 60;
                          const duration = timeToMinutes(settings.lunchBreak.end) - timeToMinutes(settings.lunchBreak.start);
                          if (s < 0) return null;
                          return <div className="absolute w-full bg-amber-100/70 border-y border-amber-200 flex flex-col items-center justify-center pointer-events-none overflow-hidden" style={{ top: s * PX_PER_MINUTE, height: duration * PX_PER_MINUTE, zIndex: 14 }}><span className="text-[10px] text-amber-700 font-bold uppercase tracking-widest opacity-80 truncate w-full text-center">Pause Midi</span></div>;
                        })()
                      )}

                      {/* Draft Course */}
                      {draftCourse && draftCourse.day === day && draftCourse.teacherId === teacher.id && (
                        <div 
                          className="absolute w-full bg-blue-500/20 border-2 border-blue-500 border-dashed rounded z-30 pointer-events-none drop-shadow-sm flex items-center justify-center print:hidden"
                          style={{
                             top: draftCourse.startMins * PX_PER_MINUTE,
                             height: (draftCourse.endMins - draftCourse.startMins) * PX_PER_MINUTE,
                          }}
                        >
                           <span className="text-xs font-bold text-blue-700 bg-white/80 px-1 rounded shadow-sm">
                             {Math.floor(draftCourse.startMins / 60) + TIME_START}:{String(draftCourse.startMins % 60).padStart(2,'0')} - {Math.floor(draftCourse.endMins / 60) + TIME_START}:{String(draftCourse.endMins % 60).padStart(2,'0')}
                           </span>
                        </div>
                      )}

                      {/* Placed Courses */}
                      {courses.filter(c => c.dayOfWeek === day && (c.teacherId === teacher.id || c.coTeacherIds?.includes(teacher.id))).map(course => {
                        const tClass = classes.find(c => c.id === course.classId);
                        const tFac = facilities.find(f => f.id === course.facilityId);
                        
                        const startMin = timeToMinutes(course.startTime) - TIME_START * 60;
                        const durMin = timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
                        
                        const wType = course.weekType || 'ALL';
                        const isHalf = wType !== 'ALL';
                        const isLeft = wType === 'A';
                        
                        const isUnavail = course.isUnavailability;
                        
                        const endMinToUse = optimisticEnd[course.id] ? timeToMinutes(optimisticEnd[course.id]) - TIME_START * 60 : durMin + startMin;
                        const optimisticDurMin = endMinToUse - startMin;

                        if (isUnavail) {
                            return (
                              <div
                                key={course.id}
                                draggable={!course.locked}
                                onDragStart={(e) => handleDragStart(e, course)}
                                className={`absolute rounded p-1.5 shadow-sm border border-slate-400 overflow-hidden group hover:z-30 hover:shadow-md transition-shadow ${course.locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isHalf ? (isLeft ? 'left-0.5 right-1/2' : 'left-1/2 right-0.5') : 'left-0.5 right-0.5'}`}
                                style={{
                                  top: startMin * PX_PER_MINUTE + 1,
                                  height: Math.max(10, optimisticDurMin * PX_PER_MINUTE - 2),
                                  backgroundColor: '#cbd5e1',
                                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)',
                                  color: '#334155',
                                  zIndex: 15
                                }}
                                onClick={() => {
                                  if (course.locked) return;
                                  setAddingCourse({ day: course.dayOfWeek, time: course.startTime });
                                  setStartT(course.startTime);
                                  setEndT(course.endTime);
                                  setTId(course.teacherId);
                                  setCoTIds(course.coTeacherIds || []);
                                  setIsUnavail(true);
                                  setReason(course.reason || "");
                                  setWeekType(course.weekType || 'ALL');
                                  setEditingCourseId(course.id);
                                }}
                              >
                                <div className="relative z-10 flex flex-col h-full items-center justify-center text-center">
                                  <div className="absolute top-0 right-0 flex gap-1 bg-white/80 rounded px-1 mt-0.5 mr-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => toggleLock(course.id, !!course.locked, e)} className="text-slate-600 hover:text-slate-900"><Lock className="w-3 h-3" /></button>
                                    {!course.locked && <button onClick={(e) => removeCourse(course.id, e)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>}
                                  </div>
                                  <span className="font-bold text-[10px] uppercase tracking-wider">{course.reason || 'Indisponible'}</span>
                                  {isHalf && <span className="text-[8px] font-bold opacity-90 mt-0.5 bg-white/50 inline-block px-1 rounded-sm">Sem. {wType}</span>}
                                </div>
                                {!course.locked && (
                                  <div 
                                    className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize z-50 hover:bg-black/20"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      setResizingCourse({ id: course.id, initialY: e.clientY, initialEndMins: timeToMinutes(course.endTime) });
                                    }}
                                  />
                                )}
                              </div>
                            );
                        }

                        return (
                          <div
                            key={course.id}
                            draggable={!course.locked}
                            onDragStart={(e) => handleDragStart(e, course)}
                            className={`absolute rounded p-1.5 shadow-sm border border-slate-900/10 overflow-hidden group hover:z-30 hover:shadow-md transition-shadow ${course.locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isHalf ? (isLeft ? 'left-0.5 right-1/2' : 'left-1/2 right-0.5') : 'left-0.5 right-0.5'}`}
                            style={{
                              top: startMin * PX_PER_MINUTE + 1,
                              height: Math.max(10, optimisticDurMin * PX_PER_MINUTE - 2),
                              backgroundColor: tClass?.color || '#e2e8f0',
                              color: tClass?.color ? '#fff' : '#334155',
                              zIndex: 20,
                              opacity: course.locked ? 0.9 : 1
                            }}
                            onClick={() => {
                              if (course.locked) return;
                              setAddingCourse({ day: course.dayOfWeek, time: course.startTime });
                              setStartT(course.startTime);
                              setEndT(course.endTime);
                              setTId(course.teacherId);
                              setCoTIds(course.coTeacherIds || []);
                              setCId(course.classId);
                              setFId(course.facilityId || "");
                              setWeekType(course.weekType || 'ALL');
                              setIsUnavail(false);
                              setEditingCourseId(course.id);
                            }}
                          >
                            <div className="absolute inset-0 bg-black/10 mix-blend-multiply pointer-events-none" />
                            
                            <div className="relative z-10 flex flex-col h-full">
                              <div className="flex justify-between items-start">
                                <span className="text-[9px] font-mono font-bold opacity-90 leading-none">{course.startTime} - {optimisticEnd[course.id] || course.endTime}</span>
                                <div className="flex gap-1 bg-black/20 rounded px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => toggleLock(course.id, !!course.locked, e)} className="text-white/80 hover:text-white mt-0.5 mb-0.5">
                                        {course.locked ? <Lock className="w-2.5 h-2.5" /> : <LockOpen className="w-2.5 h-2.5" />}
                                    </button>
                                    {!course.locked && <button onClick={(e) => removeCourse(course.id, e)} className="text-white/80 hover:text-red-300 mt-0.5 mb-0.5"><Trash2 className="w-2.5 h-2.5" /></button>}
                                </div>
                              </div>
                              <div className="font-bold text-xs tracking-tight leading-none mt-1 truncate">{tClass?.name || '?'}</div>
                              {isHalf && <div className="text-[8px] font-bold opacity-90 mt-0.5 bg-white/20 inline-block px-1 rounded-sm w-max">Sem. {wType}</div>}
                              {tFac && (
                                <div className="mt-auto text-[8px] uppercase font-bold tracking-wider opacity-90 pt-0.5 border-t border-white/20 truncate">
                                  {tFac.name} {course.coTeacherIds && course.coTeacherIds.length > 0 && '(Co-Ens.)'}
                                </div>
                              )}
                              {!tFac && course.coTeacherIds && course.coTeacherIds.length > 0 && (
                                <div className="mt-auto text-[8px] uppercase font-bold tracking-wider opacity-90 pt-0.5 border-t border-white/20 truncate">
                                  (Co-Ens.)
                                </div>
                              )}
                            </div>
                            {!course.locked && (
                                <div 
                                  className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize z-50 hover:bg-black/20"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setResizingCourse({ id: course.id, initialY: e.clientY, initialEndMins: timeToMinutes(course.endTime) });
                                  }}
                                />
                            )}
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

      {/* Legend (Visible only on print, or minimally at bottom) */}
      <div className="hidden print:block mt-8 text-sm p-4 border-t border-slate-300">
         <h4 className="font-bold mb-2">Légende</h4>
         <div className="flex flex-wrap gap-4">
            {classes.map(c => (
              <div key={c.id} className="flex items-center gap-2">
                 <div className="w-4 h-4 rounded" style={{ backgroundColor: c.color }} />
                 <span>{c.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
                 <div className="w-4 h-4 rounded" style={{ backgroundColor: '#cbd5e1', backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,.5) 3px, rgba(255,255,255,.5) 6px)' }} />
                 <span>Indisponibilité / Réunion</span>
            </div>
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
              <div className="flex bg-slate-100 p-1 rounded-md mb-2">
                <button type="button" onClick={() => setIsUnavail(false)} className={`flex-1 text-xs font-semibold py-1.5 rounded transition-colors ${!isUnavail ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Cours</button>
                <button type="button" onClick={() => setIsUnavail(true)} className={`flex-1 text-xs font-semibold py-1.5 rounded transition-colors ${isUnavail ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}`}>Indisponibilité</button>
              </div>

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

              {/* Quick Durations */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                 {[30, 45, 55, 90, 110].map(mins => (
                   <button key={mins} type="button" onClick={() => setDuration(mins)} className="px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded text-xs font-medium">+{mins}m</button>
                 ))}
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-xs font-medium text-slate-600">Professeur</label>
                <select value={tId} onChange={e=>setTId(e.target.value)} required className="form-select w-full text-sm rounded-md border-slate-300 bg-white">
                  <option value="">-- Choisir --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {!isUnavail ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Co-enseignants (Optionnel)</label>
                    <select multiple value={coTIds} onChange={e => setCoTIds(Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value))} className="form-select w-full text-sm rounded-md border-slate-300 bg-white h-20">
                      {teachers.filter(t => t.id !== tId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  {/* Week Parity */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Périodicité</label>
                    <div className="flex gap-2">
                      <label className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded border text-sm font-medium cursor-pointer transition-colors ${weekType === 'ALL' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <input type="radio" name="wType" value="ALL" checked={weekType === 'ALL'} onChange={() => setWeekType('ALL')} className="hidden" />
                        Toutes
                      </label>
                      <label className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded border text-sm font-medium cursor-pointer transition-colors ${weekType === 'A' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <input type="radio" name="wType" value="A" checked={weekType === 'A'} onChange={() => setWeekType('A')} className="hidden" />
                        Sem. A
                      </label>
                      <label className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded border text-sm font-medium cursor-pointer transition-colors ${weekType === 'B' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <input type="radio" name="wType" value="B" checked={weekType === 'B'} onChange={() => setWeekType('B')} className="hidden" />
                        Sem. B
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Classe</label>
                    <select value={cId} onChange={e=>setCId(e.target.value)} required={!isUnavail} className="form-select w-full text-sm rounded-md border-slate-300 bg-white">
                      <option value="">-- Choisir --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Installation (Lieu)</label>
                    <select value={fId} onChange={e=>setFId(e.target.value)} className="form-select w-full text-sm rounded-md border-slate-300 bg-white">
                      <option value="">-- Non défini --</option>
                      {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Motif</label>
                  <input type="text" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ex: Décharge de coordination, Réunion..." required={isUnavail} className="form-input w-full text-sm rounded-md border-slate-300" />
                </div>
              )}
              
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
