import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Printer, Users, User, X, Trash2, Plus, Edit, ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckSquare } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Course } from "../types";
import { startOfWeek, addDays, getISOWeek, format, subWeeks, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const TIME_START = 8;
const TIME_END = 19;
const PX_PER_MINUTE = 1.3; // 78px per hour
const HEADER_HEIGHT = 64; 

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

export default function Schedule() {
  const { teachers, classes, facilities, courses, activities, scheduledActivities, absences, settings } = useStore();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState<'global' | 'teachers' | null>(null);
  const [selectingTeachers, setSelectingTeachers] = useState(false);
  const [selectedTeachersForPrint, setSelectedTeachersForPrint] = useState<string[]>([]);
  const [printFit, setPrintFit] = useState<'contain' | 'width' | 'height'>('contain');
  const [printType, setPrintType] = useState<'neutral' | 'planned'>('neutral');

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [creatingClass, setCreatingClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [addingSA, setAddingSA] = useState(false);
      const [newSA, setNewSA] = useState({ activityId: '', startWeek: 1, endWeek: 1 });
      const [editingCourse, setEditingCourse] = useState<{
    id?: string;
    dayOfWeek: string;
    teacherId: string;
    startTime: string;
    endTime: string;
    classId: string;
    facilityId: string;
    activityId?: string;
    isUnavailability?: boolean;
    reason?: string;
    weekType?: 'ALL' | 'A' | 'B';
  }>({
    dayOfWeek: "Lundi",
    teacherId: "",
    startTime: "08:00",
    endTime: "09:00",
    classId: "",
      facilityId: "",
      activityId: "",
      weekType: "ALL"
  });

  const pxPerMinute = printMode ? 1.0 : PX_PER_MINUTE; // Fallback for specific scale
  const totalMins = (TIME_END - TIME_START) * 60;

  // PERIOD LOGIC
  const getWeekNumbers = (start: number, end: number) => {
    const weeks = [];
    let current = start;
    while (true) {
      weeks.push(current);
      if (current === end) break;
      current++;
      if (current > 52) current = 1;
      if (weeks.length > 53) break;
    }
    return weeks;
  };

  const currentCalendarWeek = getISOWeek(currentDate);
  const startW = settings?.startWeek || 36;
  const endW = settings?.endWeek || 26;
  const weekNumbers = getWeekNumbers(startW, endW);
  const currentInternalWeek = weekNumbers.indexOf(currentCalendarWeek) + 1;
  const isWeekA = currentCalendarWeek % 2 === 0;

  const currentWeekPeriod = React.useMemo(() => {
    const sigObj: any = {};
    const hStartWeeks = settings?.holidays?.map(h => getWeekNumbers(h.startWeek, h.endWeek)).flat() || [];
    const isHoli = hStartWeeks.includes(currentCalendarWeek);

    const checkIfAbsent = (cId: string) => {
      if (absences.some(a => a.classId === cId && currentCalendarWeek >= a.startWeek && currentCalendarWeek <= a.endWeek)) return true;
      const cls = classes.find(c => c.id === cId);
      if (cls?.internships && currentInternalWeek > 0) {
        if (cls.internships.some(i => currentInternalWeek >= i.startWeek && currentInternalWeek <= i.endWeek)) return true;
      }
      return false;
    };

    courses.forEach(c => {
       const absent = isHoli || checkIfAbsent(c.classId);
       let facId = c.facilityId;
       let actId = c.activityId || undefined;
       if (!absent && currentInternalWeek > 0) {
          const sa = scheduledActivities.find(sa => sa.classId === c.classId && currentInternalWeek >= sa.startWeek && currentInternalWeek <= sa.endWeek);
          // If the course explicitly has an activityId, we use it, otherwise fallback to class scheduled activity
          const resolvedActId = c.activityId || sa?.activityId;
          if (resolvedActId) {
             const act = activities.find(a => a.id === resolvedActId);
             actId = act?.id;
             // Only override facility if course didn't have a specific facility assigned manually, OR if it's the class schedule overriding it
             if (act && act.facilityId && (!c.facilityId || !c.activityId)) facId = act.facilityId;
          }
       }
       sigObj[c.id] = absent ? "ABS" : { facId, actId };
    });

    return {
       id: 'current',
       isHoliday: isHoli,
       filter: (course: Course) => {
          if (course.weekType && course.weekType !== 'ALL') {
             if (isWeekA && course.weekType === 'B') return false;
             if (!isWeekA && course.weekType === 'A') return false;
          }
          return sigObj[course.id] !== "ABS";
       },
       getFacility: (course: Course) => {
          const sig = sigObj[course.id];
          if (sig && sig !== "ABS" && sig.facId) return facilities.find(f => f.id === sig.facId);
          return facilities.find(f => f.id === course.facilityId);
       },
       getActivity: (course: Course) => {
          const sig = sigObj[course.id];
          if (sig && sig !== "ABS" && sig.actId) return activities.find(a => a.id === sig.actId);
          return activities.find(a => a.id === course.activityId);
       },
       isAbsent: (course: Course) => sigObj[course.id] === "ABS"
    };
  }, [currentCalendarWeek, currentInternalWeek, isWeekA, courses, absences, classes, scheduledActivities, activities, facilities, settings]);

  const periods = React.useMemo(() => {
    if (printType === 'neutral') return [{ id: 'neutral', name: 'Neutre', filter: () => true, getFacility: (course: any) => facilities.find(f => f.id === course.facilityId), getActivity: (course: any) => activities.find(a => a.id === course.activityId), isAbsent: () => false }];

    const startW = settings?.startWeek || 36;
    const endW = settings?.endWeek || 26;
    const weekNumbers = getWeekNumbers(startW, endW);

    const isHoliday = (wk: number) => {
      const calendarWeek = weekNumbers[wk - 1];
      return settings?.holidays?.some(h => {
          const hStart = getWeekNumbers(h.startWeek, h.endWeek);
          return hStart.includes(calendarWeek);
      }) || false;
    };

    const checkIfAbsent = (cId: string, internalWk: number, calWk: number) => {
      if (absences.some(a => a.classId === cId && calWk >= a.startWeek && calWk <= a.endWeek)) return true;
      const cls = classes.find(c => c.id === cId);
      if (cls?.internships) {
        if (cls.internships.some(i => internalWk >= i.startWeek && internalWk <= i.endWeek)) return true;
      }
      return false;
    };

    const periodList: any[] = [];
    let currentPeriod: any = null;

    for (let w = 1; w <= weekNumbers.length; w++) {
      if (isHoliday(w)) continue;

      const calW = weekNumbers[w - 1];
      const sigObj: any = {};

      courses.forEach(c => {
         const absent = checkIfAbsent(c.classId, w, calW);
         let facId = c.facilityId;
         let actId = c.activityId || undefined;
         if (!absent) {
            const sa = scheduledActivities.find(sa => sa.classId === c.classId && w >= sa.startWeek && w <= sa.endWeek);
            const resolvedActId = c.activityId || sa?.activityId;
            if (resolvedActId) {
               const act = activities.find(a => a.id === resolvedActId);
               actId = act?.id;
               if (act && act.facilityId && (!c.facilityId || !c.activityId)) facId = act.facilityId;
            }
         }
         sigObj[c.id] = absent ? "ABS" : { facId, actId };
      });

      const signature = JSON.stringify(sigObj);

      if (!currentPeriod || currentPeriod.signature !== signature) {
         if (currentPeriod) periodList.push(currentPeriod);
         currentPeriod = {
            startInternalWk: w,
            endInternalWk: w,
            signature,
            sigObj
         };
      } else {
         currentPeriod.endInternalWk = w;
      }
    }
    if (currentPeriod) periodList.push(currentPeriod);

    return periodList.map((p, i) => ({
       id: `period-${i}`,
       name: `Période ${i + 1} (Sem ${weekNumbers[p.startInternalWk - 1]} à ${weekNumbers[p.endInternalWk - 1]})`,
       filter: (course: any) => p.sigObj[course.id] !== "ABS",
       getFacility: (course: any) => {
          const sig = p.sigObj[course.id];
          if (sig && sig !== "ABS" && sig.facId) return facilities.find(f => f.id === sig.facId);
          return facilities.find(f => f.id === course.facilityId);
       },
       getActivity: (course: any) => {
          const sig = p.sigObj[course.id];
          if (sig && sig !== "ABS" && sig.actId) return activities.find(a => a.id === sig.actId);
          return activities.find(a => a.id === course.activityId);
       },
       isAbsent: (course: any) => p.sigObj[course.id] === "ABS"
    }));
  }, [printType, settings, courses, absences, classes, scheduledActivities, activities, facilities]);

  const handleOpenPrintModal = () => {
    setSelectedTeachersForPrint(teachers.map(t => t.id));
    setSelectingTeachers(false);
    setShowPrintModal(true);
  };

  const getContainerHeightStyle = () => {
     if (printMode) {
        if (printFit === 'contain' || printFit === 'height') {
           // Fit to height approx 180mm (A4 height is 210mm minus margins and headers)
           return { height: '175mm' };
        }
     }
     return { height: totalMins * pxPerMinute };
  };

  const executePrint = (mode: 'global' | 'teachers') => {
    setPrintMode(mode);
    setShowPrintModal(false);
    setSelectingTeachers(false);
    setTimeout(() => {
      const style = document.createElement('style');
      style.innerHTML = `
        @media print { 
          @page { size: A4 landscape; margin: 8mm; }
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
          }
        }
      `;
      document.head.appendChild(style);
      
      const afterPrint = () => {
         setPrintMode(null);
         if (document.head.contains(style)) document.head.removeChild(style);
         window.removeEventListener('afterprint', afterPrint);
      };
      window.addEventListener('afterprint', afterPrint);
      
      window.print();
    }, 300);
  };

  const handleGridClick = (day: string, teacherId: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (printMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    
    // Calculate which hour was clicked
    const minSinceStart = (offsetY / rect.height) * totalMins;
    const hour = Math.floor(minSinceStart / 60) + TIME_START;
    
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

    setEditingCourse({
      dayOfWeek: day,
      teacherId,
      startTime,
      endTime,
      classId: "",
      facilityId: "",
      activityId: "",
      weekType: "ALL"
    });
    setShowCourseModal(true);
  };

  const handleCourseClick = (course: Course, e: React.MouseEvent) => {
    e.stopPropagation();
    if (printMode) return;
    setEditingCourse({ ...course, weekType: course.weekType || 'ALL' });
    setShowCourseModal(true);
  };

  
  const handleSaveSA = async () => {
    if (!newSA.activityId || !editingCourse.id || !editingCourse.classId) return;
    try {
      await addDoc(collection(db, "scheduledActivities"), {
        activityId: newSA.activityId,
        classId: editingCourse.classId,
        courseId: editingCourse.id,
        startWeek: newSA.startWeek,
        endWeek: newSA.endWeek,
        isLocked: true
      });
      setAddingSA(false);
      alert("La période a été programmée.\nN'oubliez pas d'aller dans 'Répartition des activités' et de regénérer la répartition si nécessaire pour adapter le reste de l'année.");
    } catch(err) {
      console.error(err);
    }
  };

  const handleDeleteSA = async (saId: string) => {
    if (confirm("Supprimer cette activité programmée ?")) {
      try {
        await deleteDoc(doc(db, "scheduledActivities", saId));
        alert("Activité supprimée.\nN'oubliez pas d'aller dans 'Répartition des activités' et de regénérer la répartition si nécessaire.");
      } catch(err) {
         console.error(err);
      }
    }
  };

  const saveCourse = async (e: React.FormEvent) => {

    e.preventDefault();
    try {
      const payload: any = {};
      Object.entries(editingCourse).forEach(([key, value]) => {
        if (value !== undefined) {
          payload[key] = value;
        }
      });
      
      if (editingCourse.id) {
        const { id, ...data } = payload;
        await updateDoc(doc(db, "courses", id), data);
      } else {
        await addDoc(collection(db, "courses"), payload);
      }
      setShowCourseModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  
  const handleSaveNewClass = async () => {
    if (!newClassName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, "classes"), {
        name: newClassName.trim(),
        color: "#" + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
        level: ""
      });
      setEditingCourse({ ...editingCourse, classId: docRef.id });
      setCreatingClass(false);
      setNewClassName("");
    } catch (e) {
      console.error(e);
    }
  };

  const deleteCourse = async () => {
    if (!editingCourse.id) return;
    try {
      await deleteDoc(doc(db, "courses", editingCourse.id));
      setShowCourseModal(false);
    } catch (err) {}
  };

  const activePeriods = printMode ? periods : [currentWeekPeriod];

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header (Hidden when printing usually, but we also use screen-only classes) */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Emploi du temps global</h1>
          <p className="text-sm text-slate-500">Vue de l'emploi du temps par jour et par enseignant.</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
           {/* Date Navigator */}
           <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
              <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-1 hover:bg-slate-100 rounded-md transition-colors">
                 <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="px-4 py-1 flex items-center gap-2 min-w-[200px] justify-center" onClick={() => setCurrentDate(new Date())} title="Revenir à aujourd'hui">
                 <CalendarIcon className="w-4 h-4 text-blue-600 cursor-pointer" />
                 <span className="font-semibold text-slate-800 text-sm cursor-pointer hover:text-blue-600">
                    Sem. du {format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: fr })}
                 </span>
                 <span className="text-xs text-slate-500 font-medium ml-1">
                    (Sem. {isWeekA ? 'A' : 'B'})
                 </span>
              </div>
              <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-1 hover:bg-slate-100 rounded-md transition-colors">
                 <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
           </div>
           
           <div className="flex gap-2">
             <button 
               onClick={() => {
                 setEditingCourse({
                   dayOfWeek: "Lundi",
                   teacherId: teachers[0]?.id || "",
                   startTime: "08:00",
                   endTime: "10:00",
                   classId: "",
      facilityId: "",
      activityId: "",
      weekType: "ALL"
                 });
                 setShowCourseModal(true);
               }} 
               className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-colors"
             >
               <Plus className="w-4 h-4" /> Ajouter
             </button>
             <button onClick={handleOpenPrintModal} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-colors">
               <Printer className="w-4 h-4" /> Imprimer
             </button>
           </div>
        </div>
      </header>

      {/* Main scrolling view for screen (hidden when we want to print ONLY teachers) */}
      <div className={`flex-1 overflow-auto bg-slate-50 flex items-start flex-col ${printMode === 'teachers' ? 'print:hidden' : 'print:p-0 print:overflow-visible'}`}>
        {activePeriods.map(period => (
          <div key={period.id} className={`w-full flex-1 flex items-start ${printMode && activePeriods.length > 1 ? 'print:page-break-after-always pb-8' : ''}`}>
            <div className={`flex flex-row w-max min-w-full relative ${printMode === 'teachers' ? '' : 'print:w-max'}`}>
              
              {/* Optional Title for Planification Mode Print */}
              {printMode && activePeriods.length > 1 && (
                <div className="absolute -top-12 left-0 font-bold text-xl hidden print:block">Emploi du temps global - {period.name}</div>
              )}

              {/* Time Axis */}
              <div className={`w-12 shrink-0 bg-slate-50 ${printMode === 'teachers' ? '' : 'print:bg-white border-r border-slate-200 sticky left-0 z-30 print:static'}`}>
                <div className="border-b border-slate-200" style={{ height: HEADER_HEIGHT }}></div>
                <div className="relative" style={getContainerHeightStyle()}>
                   {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => (
                     <div key={i} className="absolute w-full px-1 text-right text-[10px] text-slate-400 font-medium transform -translate-y-1/2" style={{ top: `${(i * 60 / totalMins) * 100}%` }}>
                       {TIME_START + i}h
                     </div>
                   ))}
                </div>
              </div>
    
              {/* Days */}
              <div className="flex flex-row flex-1">
                {DAYS.map((day, dIdx) => (
                  <div key={day} className="flex flex-col border-r-2 border-slate-300 last:border-r-0 flex-1 min-w-0">
                    {/* Day Header */}
                    <div className={`h-8 bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-1 ${printMode === 'teachers' ? '' : 'print:bg-slate-200 print:text-black print:border-b print:border-slate-300'}`}>
                      <span>{day}</span>
                      {!printMode && (
                         <span className="text-xs font-medium opacity-80">
                            {format(addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), dIdx), "d/MM")}
                         </span>
                      )}
                    </div>
                    {/* Teachers Header */}
                    <div className="flex flex-row h-8 border-b border-slate-200 bg-white">
                      {teachers.map(teacher => (
                        <div key={teacher.id} className={`w-24 ${printMode === 'teachers' ? '' : 'print:w-20'} shrink-0 border-r border-slate-100 last:border-r-0 flex items-center justify-center text-[10px] font-bold text-slate-700 truncate px-1`} title={teacher.name}>
                          {teacher.name}
                        </div>
                      ))}
                    </div>
                    {/* Columns for this day */}
                    <div className="flex flex-row relative bg-white" style={getContainerHeightStyle()}>
                      {/* Hourly grid lines */}
                      {Array.from({ length: TIME_END - TIME_START }).map((_, i) => (
                        <div key={i} className="absolute w-full border-t border-slate-100 pointer-events-none" style={{ top: `${((i + 1) * 60 / totalMins) * 100}%` }}></div>
                      ))}
    
                      {teachers.map((teacher, tIdx) => {
                        const dayCourses = courses.filter(c => c.dayOfWeek === day && (c.teacherId === teacher.id || c.coTeacherIds?.includes(teacher.id)));
                        
                        return (
                          <div key={teacher.id} 
                            onClick={(e) => handleGridClick(day, teacher.id, e)}
                            className={`w-24 ${printMode === 'teachers' ? '' : 'print:w-20'} shrink-0 relative border-r border-slate-100 last:border-r-0 cursor-pointer hover:bg-blue-50/30 transition-colors ${tIdx % 2 !== 0 ? 'bg-slate-50/50 ' + (printMode === 'teachers' ? '' : 'print:bg-transparent') : ''}`}
                          >
                            {dayCourses.filter(period.filter).map(course => {
                                const startMins = timeToMinutes(course.startTime) - TIME_START * 60;
                                const dur = timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
                                const tClass = classes.find(c => c.id === course.classId);
                                const fac = period.getFacility(course);
                                const act = period.getActivity ? period.getActivity(course) : undefined;
                                const isAbsent = period.isAbsent(course);
                                const isUnavail = course.isUnavailability;
                                const bgColor = isUnavail ? '#f1f5f9' : (fac?.color || tClass?.color || '#e2e8f0');
    
                                return (
                                  <div key={course.id} 
                                    onClick={(e) => handleCourseClick(course, e)}
                                    className={`absolute left-0 right-0 rounded border p-1 overflow-hidden m-0.5 cursor-pointer hover:shadow-md hover:brightness-95 transition-all ${printMode === 'teachers' ? '' : 'print:break-inside-avoid'}`}
                                    style={{
                                      top: `${(startMins / totalMins) * 100}%`,
                                      height: `calc(${(dur / totalMins) * 100}% - 4px)`,
                                      backgroundColor: bgColor,
                                      borderColor: isUnavail ? '#cbd5e1' : 'rgba(0,0,0,0.1)',
                                      borderStyle: isUnavail ? 'dashed' : 'solid'
                                    }}
                                  >
                                    <div className="flex flex-col h-full pointer-events-none">
                                      <div className="text-[8px] font-mono leading-none text-slate-700/90 mb-0.5">
                                        {course.startTime}-{course.endTime}
                                        {course.weekType && course.weekType !== 'ALL' && <span className="ml-1 text-[7px] bg-white/60 px-0.5 rounded text-slate-600">Sem.{course.weekType}</span>}
                                      </div>
                                      {isUnavail ? (
                                        <div className="text-[9px] font-bold uppercase text-slate-600 truncate">{course.reason || 'Indispo'}</div>
                                      ) : isAbsent ? (
                                        <div className="text-[9px] font-bold uppercase text-red-600 bg-red-100 px-1 py-0.5 rounded inline-block truncate mt-1">Absent</div>
                    
                    ) : (

                                        <>
                                          <div className="font-bold text-[10px] leading-tight text-slate-800 truncate">{tClass?.name || '?'}</div>
                                          {act && <div className="text-[8px] font-bold text-slate-900 mt-0.5 truncate">{act.name}</div>}
                                          {fac && <div className="text-[8px] font-medium text-slate-700 mt-0.5 bg-white/40 px-0.5 rounded inline-block truncate max-w-full">{fac.name}</div>}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Print Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 shrink-0">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Options d'impression</h3>
            </div>
            <div className="p-6 flex flex-col gap-3">
              {!selectingTeachers ? (
                <>
                  <div className="mb-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Type d'emploi du temps</label>
                    <select value={printType} onChange={(e) => setPrintType(e.target.value as any)} className="form-select w-full text-sm rounded-md border-slate-300">
                       <option value="neutral">Neutre (Structure de base)</option>
                       <option value="planned">Planification (Une page par période unique)</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ajustement de l'échelle</label>
                    <select value={printFit} onChange={(e) => setPrintFit(e.target.value as any)} className="form-select w-full text-sm rounded-md border-slate-300">
                       <option value="contain">Ajuster à la page (Hauteur et Largeur)</option>
                       <option value="width">Ajuster à la largeur (La hauteur peut dépasser)</option>
                       <option value="height">Ajuster à la hauteur (Fit vertical)</option>
                    </select>
                  </div>
                  <button onClick={() => executePrint('global')} className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left group">
                    <div className="bg-slate-100 p-2 rounded-md group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors text-slate-600">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">Emploi du temps global</div>
                      <div className="text-xs text-slate-500">Imprimer tous les enseignants sur la même grille (vue actuelle)</div>
                    </div>
                  </button>
                  
                  <button onClick={() => setSelectingTeachers(true)} className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left group">
                    <div className="bg-slate-100 p-2 rounded-md group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors text-slate-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">Par enseignant</div>
                      <div className="text-xs text-slate-500">Sélectionner et imprimer 1 page par enseignant</div>
                    </div>
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-700">Sélectionnez les enseignants</span>
                    <button onClick={() => setSelectedTeachersForPrint(teachers.map(t => t.id))} className="text-xs text-blue-600 hover:underline">Tout cocher</button>
                  </div>
                  {teachers.map(t => (
                    <label key={t.id} className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded border border-slate-100 hover:bg-slate-100">
                      <input type="checkbox" checked={selectedTeachersForPrint.includes(t.id)} 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTeachersForPrint([...selectedTeachersForPrint, t.id]);
                          else setSelectedTeachersForPrint(selectedTeachersForPrint.filter(id => id !== t.id));
                        }} 
                        className="rounded text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="text-sm font-medium text-slate-700">{t.name}</span>
                    </label>
                  ))}
                  {teachers.length === 0 && <p className="text-sm text-slate-500 italic">Aucun enseignant</p>}
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button type="button" onClick={() => {
                if (selectingTeachers) setSelectingTeachers(false);
                else setShowPrintModal(false);
              }} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium transition-colors text-sm">Annuler</button>
              {selectingTeachers && (
                <button type="button" onClick={() => executePrint('teachers')} disabled={selectedTeachersForPrint.length === 0} className="px-4 py-2 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white rounded-md font-medium transition-colors text-sm">
                  Valider
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden print-only view for 'teachers' mode */}
      {printMode === 'teachers' && (
        <div className="hidden print:block w-full text-slate-900 bg-white">
          {teachers.filter(teacher => selectedTeachersForPrint.includes(teacher.id)).map(teacher => (
             <React.Fragment key={teacher.id}>
               {periods.map(period => (
                 <div key={`${teacher.id}-${period.id}`} className="print:page-break-after-always pb-8">
                   <h2 className="text-2xl font-bold mb-4">{teacher.name} - Emploi du temps {periods.length > 1 ? `- ${period.name}` : ''}</h2>
                   <div className="flex border border-slate-300">
                     {/* Time Axis for Teacher */}
                     <div className="w-16 shrink-0 bg-slate-100 border-r border-slate-300">
                       <div className="h-10 border-b border-slate-300"></div>
                       <div className="relative" style={getContainerHeightStyle()}>
                         {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => (
                           <div key={i} className="absolute w-full px-2 text-right text-xs text-slate-600 font-medium transform -translate-y-1/2" style={{ top: `${(i * 60 / totalMins) * 100}%` }}>
                             {TIME_START + i}h
                           </div>
                         ))}
                       </div>
                     </div>
     
                     {/* Days for Teacher */}
                     <div className="flex flex-row flex-1">
                       {DAYS.map((day, dIdx) => {
                         let dayCourses = courses.filter(c => c.dayOfWeek === day && (c.teacherId === teacher.id || c.coTeacherIds?.includes(teacher.id)));
                         // Apply filters for planifications
                         dayCourses = dayCourses.filter(period.filter);

                         return (
                           <div key={day} className={`flex flex-col flex-1 ${dIdx < DAYS.length - 1 ? 'border-r border-slate-300' : ''}`}>
                             <div className="h-10 bg-slate-200 text-slate-800 font-bold flex items-center justify-center border-b border-slate-300">
                               {day}
                             </div>
                             <div className="relative bg-white" style={getContainerHeightStyle()}>
                               {/* Hourly horizontal lines */}
                               {Array.from({ length: TIME_END - TIME_START }).map((_, i) => (
                                 <div key={i} className="absolute w-full border-t border-slate-200 pointer-events-none" style={{ top: `${((i + 1) * 60 / totalMins) * 100}%` }}></div>
                               ))}
     
                               {/* Courses */}
                               {dayCourses.map(course => {
                                 const startMins = timeToMinutes(course.startTime) - TIME_START * 60;
                                 const dur = timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
                                 const tClass = classes.find(c => c.id === course.classId);
                                 const fac = period.getFacility(course);
                                const act = period.getActivity ? period.getActivity(course) : undefined;
                                const isAbsent = period.isAbsent(course);
                                 const isUnavail = course.isUnavailability;
                                 const bgColor = isUnavail ? '#f1f5f9' : (fac?.color || tClass?.color || '#e2e8f0');
     
                                 return (
                                   <div key={course.id} className="absolute left-1 right-1 rounded-md border p-1.5 overflow-hidden break-inside-avoid shadow-sm"
                                     style={{
                                       top: `${(startMins / totalMins) * 100}%`,
                                       height: `calc(${(dur / totalMins) * 100}% - 4px)`,
                                       backgroundColor: bgColor,
                                       borderColor: isUnavail ? '#cbd5e1' : 'rgba(0,0,0,0.15)',
                                       borderStyle: isUnavail ? 'dashed' : 'solid'
                                     }}
                                   >
                                     <div className="text-[10px] font-mono font-bold text-slate-700/90 leading-none mb-1">
                                        {course.startTime}-{course.endTime}
                                        {course.weekType && course.weekType !== 'ALL' && <span className="ml-1 text-[9px] font-semibold bg-white/60 px-1 rounded text-slate-600">Sem.{course.weekType}</span>}
                                     </div>
                                     {course.isUnavailability ? (
                                       <div className="text-xs font-bold uppercase text-slate-800">{course.reason || 'Indisponible'}</div>
                                     ) : period.isAbsent(course) ? (
                                       <div className="text-xs font-bold uppercase text-red-600 bg-red-100 px-1.5 py-0.5 rounded inline-block mt-1">Absent</div>
                                     ) : (
                                       <>
                                         <div className="font-bold text-sm text-slate-900 leading-tight">{tClass?.name || 'Classe inconnue'}</div>
                                         {fac && <div className="text-xs font-medium text-slate-800 mt-1 bg-white/50 px-1 rounded inline-block">{fac.name}</div>}
                                       </>
                                     )}
                                   </div>
                                 )
                               })}
                             </div>
                           </div>
                         )
                       })}
                     </div>
                   </div>
                 </div>
               ))}
             </React.Fragment>
          ))}
        </div>
      )}

      {/* Course Edit Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800 text-lg">{editingCourse.id ? 'Modifier le créneau' : 'Ajouter un créneau'}</h2>
              <button onClick={() => setShowCourseModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="course-form" onSubmit={saveCourse} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Enseignant</label>
                    <select required value={editingCourse.teacherId} onChange={e => setEditingCourse({...editingCourse, teacherId: e.target.value})} className="form-select w-full text-sm rounded-md border-slate-300">
                      <option value="">-- Choisir --</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Jour</label>
                    <select required value={editingCourse.dayOfWeek} onChange={e => setEditingCourse({...editingCourse, dayOfWeek: e.target.value})} className="form-select w-full text-sm rounded-md border-slate-300">
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Début</label>
                    <input type="time" required value={editingCourse.startTime} onChange={e => setEditingCourse({...editingCourse, startTime: e.target.value})} className="form-input w-full text-sm rounded-md border-slate-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Fin</label>
                    <input type="time" required value={editingCourse.endTime} onChange={e => setEditingCourse({...editingCourse, endTime: e.target.value})} className="form-input w-full text-sm rounded-md border-slate-300" />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fréquence (Semaines)</label>
                  <select value={editingCourse.weekType || 'ALL'} onChange={e => setEditingCourse({...editingCourse, weekType: e.target.value as any})} className="form-select w-full text-sm rounded-md border-slate-300">
                    <option value="ALL">Toutes les semaines</option>
                    <option value="A">Semaines Paires (Semaine A)</option>
                    <option value="B">Semaines Impaires (Semaine B)</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-semibold text-slate-700">Type de créneau</label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editingCourse.isUnavailability || false} onChange={e => setEditingCourse({...editingCourse, isUnavailability: e.target.checked, classId: '', facilityId: ''})} className="rounded text-blue-600" />
                      <span className="text-sm text-slate-600">Marquer comme indisponibilité</span>
                    </label>
                  </div>

                  {!editingCourse.isUnavailability ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Classe</label>
                        {creatingClass ? (
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              autoFocus
                              placeholder="Nom (ex: 6e A)" 
                              value={newClassName}
                              onChange={e => setNewClassName(e.target.value)}
                              className="form-input text-sm flex-1 rounded-md border-slate-300"
                            />
                            <button type="button" onClick={handleSaveNewClass} className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700"><CheckSquare className="w-4 h-4" /></button>
                            <button type="button" onClick={() => { setCreatingClass(false); setNewClassName(""); }} className="bg-slate-200 text-slate-700 px-3 py-1 rounded-md text-sm hover:bg-slate-300"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <select required value={editingCourse.classId} onChange={e => {
                            if (e.target.value === "NEW") setCreatingClass(true);
                            else setEditingCourse({...editingCourse, classId: e.target.value});
                          }} className="form-select w-full text-sm rounded-md border-slate-300">
                            <option value="">-- Choisir --</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            <option value="NEW">+ Ajouter une classe...</option>
                          </select>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Installation sportive</label>
                        <select value={editingCourse.facilityId || ""} onChange={e => setEditingCourse({...editingCourse, facilityId: e.target.value})} className="form-select w-full text-sm rounded-md border-slate-300">
                          <option value="">-- Optionnel --</option>
                          {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Motif d'indisponibilité</label>
                      <input type="text" placeholder="Ex: Réunion, Décharge..." value={editingCourse.reason || ""} onChange={e => setEditingCourse({...editingCourse, reason: e.target.value})} className="form-input w-full text-sm rounded-md border-slate-300" />
                    </div>
                  )}
{editingCourse.id && !editingCourse.isUnavailability && editingCourse.classId && (
                      <div className="pt-4 mt-2 border-t border-slate-100 col-span-2">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-semibold text-slate-700">Programmation manuelle (Activités)</label>
                          <button type="button" onClick={() => setAddingSA(true)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"><Plus className="w-3 h-3"/> Ajouter une période</button>
                        </div>
                        
                        {addingSA && (
                          <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-md mb-3 space-y-3">
                            <div>
                               <label className="block text-xs font-semibold text-slate-600 mb-1">Activité</label>
                               <select value={newSA.activityId} onChange={e => {
                                  const actId = e.target.value;
                                  const act = activities.find(a => a.id === actId);
                                  setNewSA({
                                    ...newSA, 
                                    activityId: actId,
                                    endWeek: act ? Math.min(52, newSA.startWeek + act.durationWeeks - 1) : newSA.endWeek
                                  });
                               }} className="form-select w-full text-sm rounded-md border-slate-300">
                                 <option value="">-- Choisir --</option>
                                 {activities.filter(a => a.classIds.includes(editingCourse.classId!)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                               </select>
                            </div>
                            <div className="flex gap-3">
                               <div className="flex-1">
                                 <label className="block text-xs font-semibold text-slate-600 mb-1">Début (Sem.)</label>
                                 <input type="number" min="1" max="52" value={newSA.startWeek} onChange={e => setNewSA({...newSA, startWeek: parseInt(e.target.value) || 1})} className="form-input w-full text-sm rounded-md border-slate-300" />
                               </div>
                               <div className="flex-1">
                                 <label className="block text-xs font-semibold text-slate-600 mb-1">Fin (Sem.)</label>
                                 <input type="number" min="1" max="52" value={newSA.endWeek} onChange={e => setNewSA({...newSA, endWeek: parseInt(e.target.value) || 1})} className="form-input w-full text-sm rounded-md border-slate-300" />
                               </div>
                            </div>
                            <div className="flex gap-2 justify-end pt-1">
                               <button type="button" onClick={() => setAddingSA(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors">Annuler</button>
                               <button type="button" onClick={handleSaveSA} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm">Enregistrer la période</button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                           {scheduledActivities.filter(sa => sa.courseId === editingCourse.id).sort((a,b) => a.startWeek - b.startWeek).map(sa => {
                              const act = activities.find(a => a.id === sa.activityId);
                              return (
                                 <div key={sa.id} className="flex items-center justify-between bg-white border border-slate-200 shadow-sm rounded-md p-2.5 text-xs group">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-800">{act?.name || 'Activité inconnue'}</span> 
                                      <span className="text-slate-500 font-medium mt-0.5">Semaine {sa.startWeek} à {sa.endWeek}</span>
                                    </div>
                                    <button type="button" onClick={() => handleDeleteSA(sa.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Supprimer">
                                      <Trash2 className="w-3.5 h-3.5"/>
                                    </button>
                                 </div>
                              )
                           })}
                           {scheduledActivities.filter(sa => sa.courseId === editingCourse.id).length === 0 && !addingSA && (
                             <div className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 border border-slate-100 rounded-md">
                               Aucune activité programmée spécifiquement sur ce créneau.
                             </div>
                           )}
                        </div>
                      </div>
                    )}
                  
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between gap-2">
              {editingCourse.id ? (
                <button type="button" onClick={deleteCourse} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-md font-medium transition-colors text-sm flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Supprimer
                </button>
              ) : <div></div>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCourseModal(false)} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium transition-colors text-sm">Annuler</button>
                <button type="submit" form="course-form" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors text-sm flex items-center gap-2">
                  {editingCourse.id ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editingCourse.id ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
