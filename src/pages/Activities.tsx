import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Trash2, Activity as ActivityIcon, CalendarDays, Wand2, Lock, LockOpen, Printer, Settings as SettingsIcon, MapPin } from "lucide-react";
import { getISOWeek, parseISO } from "date-fns";

export default function Activities() {
  const { activities, absences, classes, facilities, courses, scheduledActivities, settings } = useStore();

  

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'activities' | 'facilities'>('activities');
  
  const [newFacilityName, setNewFacilityName] = useState("");
  const [newFacilityColor, setNewFacilityColor] = useState("#f43f5e");
  
  const addFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacilityName) return;
    await addDoc(collection(db, "facilities"), { name: newFacilityName, color: newFacilityColor, createdAt: new Date() });
    setNewFacilityName("");
  };

  const deleteFacility = async (id: string) => {
    if(window.window.confirm("Supprimer cette installation ?")) {
       await deleteDoc(doc(db, "facilities", id));
    }
  };

  // active classes only
  const activeClasses = React.useMemo(() => {
     return classes.filter(c => courses.some(course => course.classId === c.id));
  }, [classes, courses]);
const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityChamp, setNewActivityChamp] = useState<number | "">("");
  const [newActivityDuration, setNewActivityDuration] = useState<number>(7);
  const [newActivityFacility, setNewActivityFacility] = useState("");
  const [newActivityClasses, setNewActivityClasses] = useState<string[]>([]);
  const [newActivityMaxCapacity, setNewActivityMaxCapacity] = useState<number>(1);
  const [newActivityPrefStart, setNewActivityPrefStart] = useState<number | ''>('');
  const [newActivityPrefEnd, setNewActivityPrefEnd] = useState<number | ''>('');
  const [newActivityGroup, setNewActivityGroup] = useState<boolean>(false);
  const [newActivityMandatory, setNewActivityMandatory] = useState<boolean>(false);

  const [selClassId, setSelClassId] = useState("");
  const [absReason, setAbsReason] = useState("");
  const [absStart, setAbsStart] = useState<number>(1);
  const [absEnd, setAbsEnd] = useState<number>(1);

  const [selectedSA, setSelectedSA] = useState<{ id: string, startWeekIdx: number, endWeekIdx: number, isLocked: boolean } | null>(null);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printStartWk, setPrintStartWk] = useState<number>(1);
  const [printEndWk, setPrintEndWk] = useState<number>(52);
  const [isPrintingRange, setIsPrintingRange] = useState(false);
  const [printFit, setPrintFit] = useState<'contain' | 'width' | 'height'>('contain');

  const executePrintRange = () => {
     setShowPrintModal(false);
     setIsPrintingRange(true);
     setTimeout(() => {
        const style = document.createElement('style');
        style.innerHTML = `@media print { @page { size: A4 landscape; margin: 5mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`;
        document.head.appendChild(style);
        
        const afterPrint = () => {
           setIsPrintingRange(false);
           if (document.head.contains(style)) document.head.removeChild(style);
           window.removeEventListener('afterprint', afterPrint);
        };
        window.addEventListener('afterprint', afterPrint);
        
        window.print();
     }, 300);
  };

  const handleSASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSA) return;
    try {
      await updateDoc(doc(db, "scheduledActivities", selectedSA.id), {
        startWeek: selectedSA.startWeekIdx + 1, // Store 1-based internal index
        endWeek: selectedSA.endWeekIdx + 1,
        isLocked: selectedSA.isLocked
      });
      setSelectedSA(null);
    } catch(err) {
      console.error(err);
    }
  };

  const [optimizing, setOptimizing] = useState(false);

  
  const toggleActivityClass = async (activity: any, classId: string) => {
    const safeClassIds = activity.classIds || [];
    const newClassIds = safeClassIds.includes(classId) 
        ? safeClassIds.filter((id: string) => id !== classId)
        : [...safeClassIds, classId];
    await updateDoc(doc(db, "activities", activity.id), { classIds: newClassIds });
  };

  const toggleClass = (classId: string) => {
    setNewActivityClasses(prev => 
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const addActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityName || !newActivityFacility) {
      alert("Veuillez remplir le nom et l'installation.");
      return;
    }
    const data = {
      name: newActivityName,
      champ: newActivityChamp || null,
      durationWeeks: newActivityDuration,
      maxCapacity: newActivityMaxCapacity,
      facilityId: newActivityFacility,
      classIds: newActivityClasses,
      preferredStartWeek: newActivityPrefStart || null,
      preferredEndWeek: newActivityPrefEnd || null,
      groupCycles: newActivityGroup,
      isMandatoryPeriod: newActivityMandatory,
    };
    if (editingActivityId) {
      await updateDoc(doc(db, "activities", editingActivityId), data);
      setEditingActivityId(null);
    } else {
      await addDoc(collection(db, "activities"), { ...data, createdAt: new Date() });
    }
    resetForm();
  };

  const resetForm = () => {
    setEditingActivityId(null);
    setNewActivityName("");
    setNewActivityChamp("");
    setNewActivityClasses([]);
    setNewActivityMaxCapacity(1);
    setNewActivityPrefStart('');
    setNewActivityPrefEnd('');
    setNewActivityGroup(false);
    setNewActivityMandatory(false);
  };

  const editActivity = (a: any) => {
    setEditingActivityId(a.id);
    setNewActivityName(a.name);
    setNewActivityChamp(a.champ || "");
    setNewActivityDuration(a.durationWeeks);
    setNewActivityFacility(a.facilityId);
    setNewActivityClasses(a.classIds);
    setNewActivityMaxCapacity(a.maxCapacity || 1);
    setNewActivityPrefStart(a.preferredStartWeek || '');
    setNewActivityPrefEnd(a.preferredEndWeek || '');
    setNewActivityGroup(a.groupCycles || false);
    setNewActivityMandatory(a.isMandatoryPeriod || false);
  };

  const deleteActivity = async (id: string) => {
    if (window.confirm("Supprimer cette activité ?")) {
      await deleteDoc(doc(db, "activities", id));
    }
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

  const startW = settings?.startWeek || 36;
  const endW = settings?.endWeek || 27;

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

  const weekNumbers = React.useMemo(() => getWeekNumbers(startW, endW), [startW, endW]);
  const totalWks = weekNumbers.length;

  const actualPrintStartIdx = Math.max(0, printStartWk - 1);
  const actualPrintEndIdx = Math.min(totalWks, printEndWk);
  const displayedWeekNumbers = isPrintingRange ? weekNumbers.slice(actualPrintStartIdx, actualPrintEndIdx) : weekNumbers;
  const displayedTotalWks = displayedWeekNumbers.length;
  const offsetWks = isPrintingRange ? actualPrintStartIdx : 0;

  const isHoliday = (wk: number) => {
    const calendarWeek = weekNumbers[wk - 1];
    return settings?.holidays?.some(h => {
        // holidays are given in calendar weeks
        // h.startWeek to h.endWeek
        // because of wrapping, we check mapping
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

  
  const generateSchedule = async () => {
    setOptimizing(true);
    try {
      const lockedSAs = scheduledActivities.filter(sa => sa.isLocked);
      const unlockedSAs = scheduledActivities.filter(sa => !sa.isLocked);
      
      for (const sa of unlockedSAs) {
        await deleteDoc(doc(db, "scheduledActivities", sa.id));
      }

      const timeToMin = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };

      const checkCourseOverlap = (c1: any, c2: any) => {
        if (c1.dayOfWeek === c2.dayOfWeek) {
          const start1 = timeToMin(c1.startTime);
          const end1 = timeToMin(c1.endTime);
          const start2 = timeToMin(c2.startTime);
          const end2 = timeToMin(c2.endTime);
          if (start1 < end2 && end1 > start2) return true;
        }
        return false;
      };

      const allocations: Record<string, Record<number, string[]>> = {};

      for (const sa of lockedSAs) {
         const act = activities.find(a => a.id === sa.activityId);
         if (!act) continue;
         const trackFacId = act.facilityId || 'NONE_' + act.id;
         for (let w = sa.startWeek; w <= sa.endWeek; w++) {
            if (!allocations[trackFacId]) allocations[trackFacId] = {};
            if (!allocations[trackFacId][w]) allocations[trackFacId][w] = [];
            allocations[trackFacId][w].push(sa.courseId);
         }
      }
      
      courses.forEach(c => {
         if (c.activityId && c.facilityId) { 
            const facId = c.facilityId;
            for (let w = 1; w <= totalWks; w++) {
               if (!allocations[facId]) allocations[facId] = {};
               if (!allocations[facId][w]) allocations[facId][w] = [];
               allocations[facId][w].push(c.id);
            }
         }
      });

      const toPlace = [];
      for (const a of activities) {
        for (const cid of a.classIds) {
          const isClassLockedForThis = lockedSAs.some(sa => sa.activityId === a.id && sa.classId === cid);
          if (!isClassLockedForThis) {
            toPlace.push({ activity: a, classId: cid });
          }
        }
      }
      
      toPlace.sort((x, y) => {
        if (x.activity.isMandatoryPeriod && !y.activity.isMandatoryPeriod) return -1;
        if (!x.activity.isMandatoryPeriod && y.activity.isMandatoryPeriod) return 1;
        if (x.activity.groupCycles && !y.activity.groupCycles) return -1;
        if (!x.activity.groupCycles && y.activity.groupCycles) return 1;
        if (x.activity.id !== y.activity.id) return x.activity.id.localeCompare(y.activity.id);
        return y.activity.durationWeeks - x.activity.durationWeeks;
      });

      const toSave = [];
      for (const item of toPlace) {
        const { activity, classId } = item;
        const dur = activity.durationWeeks;
        const trackFacId = activity.facilityId || 'NONE_' + activity.id;
        
        let bestStart = 1;
        let bestEnd = dur;
        let bestCourseId = null;
        let placed = false;
        let prefStartIdx = 0;
        let prefEndIdx = 0;
        
        if (activity.preferredStartWeek && activity.preferredEndWeek) {
           prefStartIdx = weekNumbers.indexOf(activity.preferredStartWeek) + 1;
           prefEndIdx = weekNumbers.indexOf(activity.preferredEndWeek) + 1;
        }

        const classCourses = courses.filter(c => c.classId === classId && !c.isUnavailability && !c.activityId);

        for (let w = 1; w <= totalWks; w++) {
          if (isHoliday(w)) continue;
          if (activity.isMandatoryPeriod && prefStartIdx > 0 && prefEndIdx > 0) {
            if (w < prefStartIdx || w > prefEndIdx) continue;
          }
          
          for (const course of classCourses) {
             let canPlace = true;
             let teachingWeeks = 0;
             let currWeek = w;
             
             while (teachingWeeks < dur && currWeek <= totalWks) {
               const isAbsent = checkIfAbsent(classId, currWeek, weekNumbers[currWeek - 1]);
               if (isHoliday(currWeek) || isAbsent) {
                 currWeek++;
                 continue;
               }
               
               const isCourseBusy = Object.values(allocations).some(facWg => facWg[currWeek]?.includes(course.id));
               if (isCourseBusy) {
                  canPlace = false; break;
               }
               
               if (activity.facilityId) {
                  const inFac = allocations[activity.facilityId]?.[currWeek] || [];
                  const overlappingCourses = inFac.filter(otherCourseId => {
                     const otherCourse = courses.find(c => c.id === otherCourseId);
                     return otherCourse ? checkCourseOverlap(course, otherCourse) : false;
                  });
                  const facility = facilities.find(f => f.id === activity.facilityId);
                  const maxCapacity = activity.maxCapacity || facility?.capacity || 1;
                  if (overlappingCourses.length >= maxCapacity) {
                     canPlace = false; break;
                  }
               }
               
               teachingWeeks++;
               if (teachingWeeks < dur) currWeek++;
             }
             
             if (canPlace && teachingWeeks === dur) {
               bestStart = w;
               bestEnd = currWeek;
               bestCourseId = course.id;
               placed = true;
               break;
             }
          }
          if (placed) break;
        }
        
        if (placed && bestCourseId) {
          let tWk = 0;
          let cw = bestStart;
          while (tWk < dur && cw <= bestEnd) {
             const isAbsent = checkIfAbsent(classId, cw, weekNumbers[cw - 1]);
             if (!isHoliday(cw) && !isAbsent) {
               if (!allocations[trackFacId]) allocations[trackFacId] = {};
               if (!allocations[trackFacId][cw]) allocations[trackFacId][cw] = [];
               allocations[trackFacId][cw].push(bestCourseId);
               tWk++;
             }
             cw++;
          }
          toSave.push({ activityId: activity.id, classId, courseId: bestCourseId, startWeek: bestStart, endWeek: bestEnd });
        }
      }

      for (const sa of toSave) {
        await addDoc(collection(db, "scheduledActivities"), sa);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération.");
    } finally {
      setOptimizing(false);
    }
  };


  return (
    <div className={`p-8 max-w-5xl mx-auto space-y-12 ${isPrintingRange ? 'print:p-0 print:space-y-0 print:max-w-none print:m-0' : ''}`}>
      <div className={isPrintingRange ? 'print:hidden' : ''}>
        
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Activités & Absences</h2>
          <button onClick={() => setShowSettingsModal(true)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-colors">
            <SettingsIcon className="w-4 h-4" /> Paramétrage des Lieux & Activités
          </button>
        </div>
        <p className="text-slate-500 text-sm mt-1">Définissez les activités, temps de cycle, installations pour la répartition automatique.</p>
      </div>


      <div className={isPrintingRange ? 'print:hidden' : ''}>
         <div className="flex items-center justify-between mb-4">
           <h3 className="font-bold text-slate-800 text-lg">Absences et Stages par Classe</h3>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeClasses.map(c => {
               const classAbsences = absences.filter(a => a.classId === c.id).sort((a,b) => a.startWeek - b.startWeek);
               return (
                 <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                       <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: c.color }}></div>
                       <h4 className="font-bold text-slate-800 flex-1">{c.name}</h4>
                    </div>
                    
                    <div className="flex-1 space-y-2 mb-4">
                       {classAbsences.map(a => (
                         <div key={a.id} className="flex justify-between items-center bg-blue-50/50 p-2 rounded text-sm border border-blue-100 group">
                           <div>
                              <div className="font-medium text-slate-800">{a.reason}</div>
                              <div className="text-xs text-slate-500">Sem. {a.startWeek} à {a.endWeek}</div>
                           </div>
                           <button onClick={() => deleteDoc(doc(db, "absences", a.id))} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       ))}
                       {classAbsences.length === 0 && <p className="text-xs text-slate-400 italic">Aucune absence</p>}
                    </div>
                    
                    
                    <div className="mt-4 pt-3 border-t border-slate-100">
                       <h5 className="text-[11px] font-bold text-slate-700 mb-2 uppercase tracking-wide">Activités du cycle</h5>
                       <div className="flex flex-wrap gap-1.5">
                         {activities.map(a => {
                            const isSelected = (a.classIds || []).includes(c.id);
                            return (
                               <button 
                                  key={a.id} 
                                  onClick={() => toggleActivityClass(a, c.id)}
                                  className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-400 hover:bg-blue-50'}`}
                               >
                                 {a.name} {a.champ && ` (CA${a.champ})`}
                               </button>
                            )
                         })}
                         {activities.length === 0 && <span className="text-[10px] text-slate-400 italic">Aucune activité définie</span>}
                       </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-100">

                       <form onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.target;
                          addDoc(collection(db, "absences"), {
                             classId: c.id,
                             reason: form.reason.value,
                             startWeek: parseInt(form.startWeek.value),
                             endWeek: parseInt(form.endWeek.value)
                          });
                          form.reset();
                       }} className="flex flex-col gap-2">
                          <input type="text" name="reason" placeholder="Motif (ex: Stage, PFMP)" className="form-input text-xs rounded-md border-slate-300 w-full" required />
                          <div className="flex items-center gap-2">
                             <div className="flex items-center flex-1 gap-1">
                                <span className="text-[10px] text-slate-500">De S.</span>
                                <input type="number" name="startWeek" min="1" max="52" className="form-input text-xs rounded-md border-slate-300 w-full px-1" required defaultValue="1"/>
                             </div>
                             <div className="flex items-center flex-1 gap-1">
                                <span className="text-[10px] text-slate-500">À S.</span>
                                <input type="number" name="endWeek" min="1" max="52" className="form-input text-xs rounded-md border-slate-300 w-full px-1" required defaultValue="1"/>
                             </div>
                             <button type="submit" className="bg-slate-800 text-white p-1.5 rounded-md hover:bg-slate-900 transition-colors shrink-0">
                                <Plus className="w-4 h-4" />
                             </button>
                          </div>
                       </form>
                    </div>
                 </div>
               );
            })}
            {activeClasses.length === 0 && (
               <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                 <CalendarDays className="w-10 h-10 mb-3 opacity-20" />
                 <p className="text-sm font-medium">Aucune classe détectée</p>
                 <p className="text-xs mt-1">Importez ou créez des cours dans l'emploi du temps pour voir les classes ici.</p>
               </div>
            )}
         </div>
      </div>
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col pt-6 mt-8 print:p-0 print:border-none print:shadow-none">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div>
            <h3 className="font-bold text-slate-800 text-lg tracking-tight">Planning Annuel Généré</h3>
            <p className="text-slate-500 text-sm mt-1">La répartition optimise l'occupation des installations selon l'emploi du temps des classes (sans chevauchement de créneaux).</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowPrintModal(true)} 
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" /> Imprimer
            </button>
            <button 
              onClick={generateSchedule} 
              disabled={optimizing || activities.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-colors"
            >
              <Wand2 className="w-4 h-4" />
              {optimizing ? "Génération en cours..." : "Générer la répartition"}
            </button>
          </div>
        </div>

        {isPrintingRange && (
          <div className="hidden print:block mb-4 text-center">
            <h2 className="text-xl font-bold text-slate-800">
              Répartition des Activités - Semaines internes {printStartWk} à {printEndWk}
            </h2>
          </div>
        )}

        {scheduledActivities.length > 0 ? (
          <div className="overflow-x-auto pb-4 print:overflow-visible">
            <div className="min-w-[800px] print:w-full print:min-w-full">
              <div className="flex border-b border-slate-200 pb-2 mb-2">
                <div className="w-32 print:w-24 shrink-0 font-semibold text-xs text-slate-500 uppercase flex items-center">Classe</div>
                <div className="flex-1 flex relative">
                  {displayedWeekNumbers.map((calendarWeek, i) => {
                    const actualWkIndex = i + 1 + offsetWks;
                    const isHol = isHoliday(actualWkIndex);
                    return (
                      <div key={i} className={`flex-1 text-center text-[10px] ${isHol ? 'text-amber-500 font-bold bg-amber-50 print:bg-transparent' : 'text-slate-400'} border-l border-slate-100 first:border-0`} title={`Semaine Calendaire ${calendarWeek}`}>
                        {calendarWeek}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className={isPrintingRange && (printFit === 'contain' || printFit === 'height') ? "flex flex-col h-[155mm] gap-1" : "space-y-3"}>
                {classes.flatMap(c => {
                  const classCourses = courses.filter(crs => crs.classId === c.id && !crs.isUnavailability && !crs.activityId);
                  if (classCourses.length === 0) return [];
                  
                  return classCourses.map(course => {
                    const mySAs = scheduledActivities.filter(sa => sa.courseId === course.id);
                    if (mySAs.length === 0) return null;
                    
                    return (
                      <div key={course.id} className={`flex items-center ${isPrintingRange && (printFit === 'contain' || printFit === 'height') ? 'flex-1 min-h-0' : 'min-h-[32px]'}`}>
                        <div className="w-32 print:w-24 shrink-0 text-sm font-medium text-slate-800 flex flex-col justify-center">
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                             <span className="print:text-xs truncate flex flex-col leading-tight">
                               <span>{c.name}</span>
                               <span className="text-[9px] text-slate-500 font-normal">{course.dayOfWeek.substring(0,3)} {course.startTime}</span>
                             </span>
                           </div>
                        </div>
                        <div className="flex-1 flex relative h-full min-h-[16px] bg-slate-50 print:bg-white rounded-md border border-slate-100 overflow-hidden">
                          {/* Draw Holidays Background */}
                          {settings?.holidays?.map(h => {
                              const calWeeks = getWeekNumbers(h.startWeek, h.endWeek);
                              const hStartIdx = weekNumbers.indexOf(calWeeks[0]);
                              const hEndIdx = weekNumbers.indexOf(calWeeks[calWeeks.length - 1]);
                              if (hStartIdx === -1 || hEndIdx === -1) return null; // out of scope
                              
                              const renderStart = Math.max(0, hStartIdx - offsetWks);
                              const renderEnd = Math.min(displayedTotalWks - 1, hEndIdx - offsetWks);
                              if (renderStart > displayedTotalWks - 1 || renderEnd < 0) return null;
                              const left = (renderStart / displayedTotalWks) * 100;
                              const width = ((renderEnd - renderStart + 1) / displayedTotalWks) * 100;
                              return <div key={h.id} className="absolute top-0 bottom-0 bg-amber-100/50 print:bg-amber-50 mix-blend-multiply" style={{ left: `${left}%`, width: `${width}%` }} title={h.name} />
                          })}
                          {/* Draw SAs */}
                          {mySAs.map(sa => {
                          const act = activities.find(a => a.id === sa.activityId);
                          const fac = facilities.find(f => f.id === act?.facilityId);
                          // sa.startWeek and sa.endWeek are relative indices 1..totalWks

                          const blocks: {start: number, end: number}[] = [];
                          let currentBlock: {start: number, end: number} | null = null;
                          for(let w = sa.startWeek; w <= sa.endWeek; w++) {
                            const isAbsent = checkIfAbsent(c.id, w, weekNumbers[w - 1]);
                            if (!isHoliday(w) && !isAbsent) {
                              if (!currentBlock) currentBlock = {start: w, end: w};
                              else currentBlock.end = w;
                            } else {
                              if (currentBlock) {
                                blocks.push({...currentBlock});
                                currentBlock = null;
                              }
                            }
                          }
                          if (currentBlock) blocks.push(currentBlock);

                          return (
                            <React.Fragment key={sa.id}>
                              {blocks.map((block, idx) => {
                                const renderStart = block.start - 1 - offsetWks;
                                const renderEnd = block.end - 1 - offsetWks;

                                if (renderEnd < 0 || renderStart >= displayedTotalWks) return null;

                                const clampedStart = Math.max(0, renderStart);
                                const clampedEnd = Math.min(displayedTotalWks - 1, renderEnd);

                                const left = (clampedStart / displayedTotalWks) * 100;
                                const width = ((clampedEnd - clampedStart + 1) / displayedTotalWks) * 100;

                                const calS = weekNumbers[block.start - 1];
                                const calE = weekNumbers[block.end - 1];
                                return (
                                  <div 
                                    key={`${sa.id}-${idx}`} 
                                    onClick={() => setSelectedSA({
                                      id: sa.id,
                                      startWeekIdx: sa.startWeek - 1,
                                      endWeekIdx: sa.endWeek - 1,
                                      isLocked: !!sa.isLocked
                                    })}
                                    className={`absolute top-0 bottom-0 m-0.5 px-2 flex flex-col justify-center overflow-hidden shadow-sm shadow-slate-200 cursor-pointer hover:brightness-95 transition-all ${idx === 0 ? 'rounded-l' : ''} ${idx === blocks.length - 1 ? 'rounded-r' : ''} ${idx > 0 && idx < blocks.length - 1 ? 'rounded-none' : ''}`}
                                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: fac?.color || '#e2e8f0' }}
                                    title={`${act?.name} (${fac?.name}) - Sem. ${calS} à ${calE}`}
                                  >
                                    <div className="text-[10px] print:text-[8px] font-bold text-white truncate drop-shadow-md flex items-center gap-1">
                                      {sa.isLocked && <Lock className="w-2.5 h-2.5 print:w-2 print:h-2 shrink-0" />}
                                      {act?.name}
                                    </div>
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                        
                        {/* Draw Important Dates (simple dot indication) */}
                        {c.importantDates?.map(d => {
                          if (!d.date) return null;
                          try {
                            const dateObj = parseISO(d.date);
                            const wk = getISOWeek(dateObj);
                            const wIdx = weekNumbers.indexOf(wk);
                            if (wIdx === -1) return null;
                            const renderIdx = wIdx - offsetWks;
                            if (renderIdx < 0 || renderIdx >= displayedTotalWks) return null;
                            const left = ((renderIdx + 0.5) / displayedTotalWks) * 100;
                            return (
                              <div 
                                key={d.id} 
                                className="absolute top-0 w-0.5 bg-red-500 h-full z-10 hover:w-1 hover:bg-red-600 transition-all cursor-crosshair group/date"
                                style={{ left: `${left}%` }} 
                                title={`${d.description || 'Date importante'} (${d.date})`}
                              >
                                <div className="hidden group-hover/date:block absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-slate-800 text-white text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap z-20">
                                  {d.description || 'Date importante'}
                                </div>
                              </div>
                            );
                          } catch(e) {
                            return null;
                          }
                        })}
                      </div>
                    </div>
                  );
                  });
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400">
            <CalendarDays className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">Aucune répartition générée</p>
            <p className="text-xs mt-1">Ajoutez des activités puis cliquez sur le bouton Générer.</p>
          </div>
        )}
      </div>

      {selectedSA && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Modifier l'activité</h3>
            </div>
            <form onSubmit={handleSASubmit} className="p-6 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Début (S.X)</label>
                  <input type="number" min="1" max="52" required value={selectedSA.startWeekIdx + 1} onChange={e => setSelectedSA({...selectedSA, startWeekIdx: parseInt(e.target.value) - 1})} className="form-input w-full text-sm rounded-md border-slate-300" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fin (S.X)</label>
                  <input type="number" min="1" max="52" required value={selectedSA.endWeekIdx + 1} onChange={e => setSelectedSA({...selectedSA, endWeekIdx: parseInt(e.target.value) - 1})} className="form-input w-full text-sm rounded-md border-slate-300" />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-slate-700">
                  <input type="checkbox" checked={selectedSA.isLocked} onChange={e => setSelectedSA({...selectedSA, isLocked: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                  Verrouiller l'activité (ne pas regénérer)
                </label>
              </div>
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setSelectedSA(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">Annuler</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 shrink-0">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Impression de la Répartition</h3>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-slate-600">Sélectionnez les options pour l'impression du tableau.</p>
              
              <div className="mb-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Ajustement de l'échelle</label>
                <select value={printFit} onChange={(e) => setPrintFit(e.target.value as any)} className="form-select w-full text-sm rounded-md border-slate-300">
                   <option value="contain">Ajuster à la page (Hauteur et Largeur)</option>
                   <option value="width">Ajuster à la largeur (La hauteur peut dépasser)</option>
                   <option value="height">Ajuster à la hauteur (Fit vertical)</option>
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Semaine de début</label>
                  <input type="number" min="1" max={totalWks} value={printStartWk} onChange={e => setPrintStartWk(parseInt(e.target.value) || 1)} className="form-input w-full text-sm rounded-md border-slate-300" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Semaine de fin</label>
                  <input type="number" min="1" max={totalWks} value={printEndWk} onChange={e => setPrintEndWk(parseInt(e.target.value) || totalWks)} className="form-input w-full text-sm rounded-md border-slate-300" />
                </div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button type="button" onClick={() => setShowPrintModal(false)} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium transition-colors text-sm">Annuler</button>
              <button type="button" onClick={executePrintRange} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors text-sm flex items-center gap-2">
                <Printer className="w-4 h-4" /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 shrink-0">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-blue-600" /> Paramétrage des Lieux & Activités
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors font-bold text-xl leading-none">&times;</button>
            </div>
            
            <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50/50">
              <button onClick={() => setActiveTab('activities')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'activities' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Activités & Cycles</button>
              <button onClick={() => setActiveTab('facilities')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'facilities' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Lieux de pratique</button>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-slate-50/30">
              {activeTab === 'activities' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Activities List */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center gap-2"><ActivityIcon className="w-4 h-4"/> Activités Existantes</h4>
                    <ul className="space-y-2">
                      {activities.map(a => {
                        const fac = facilities.find(f => f.id === a.facilityId);
                        const clsNames = a.classIds.map(id => classes.find(c => c.id === id)?.name).filter(Boolean).join(", ");
                        return (
                          <li key={a.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm group">
                            <div className="pr-4">
                              <span className="text-sm font-bold text-slate-800">{a.name}</span> {a.champ && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded ml-1">CA{a.champ}</span>} <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-1">{a.durationWeeks} sem.</span>
                              <div className="text-[11px] text-slate-500 mt-2 space-y-1">
                                <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-slate-400"/> <span className="font-medium text-slate-600">Lieu:</span> {fac?.name || '?'} (Cap. {a.maxCapacity || fac?.capacity || 1})</div>
                                {a.preferredStartWeek && a.preferredEndWeek && <div className="flex items-center gap-1.5"><CalendarDays className="w-3 h-3 text-slate-400"/> <span className="font-medium text-slate-600">Période:</span> S{a.preferredStartWeek}-S{a.preferredEndWeek} {a.isMandatoryPeriod && <span className="text-red-600 font-bold ml-1 text-[9px] uppercase bg-red-50 px-1 py-0.5 rounded">Imposée</span>}</div>}
                                {a.groupCycles && <div className="text-blue-600 font-semibold text-[9px] uppercase bg-blue-50 px-1.5 py-0.5 rounded inline-block mt-0.5">Mise en place importante (Groupé)</div>}
                                <div className="leading-tight pt-1"><span className="font-medium text-slate-600">Classes:</span> <span className="text-slate-500">{clsNames || 'Aucune'}</span></div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button onClick={() => editActivity(a)} className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors" title="Éditer">
                                <SettingsIcon className="w-4 h-4" />
                              </button>
                              <button onClick={() => deleteActivity(a.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Supprimer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                      {activities.length === 0 && <p className="text-sm text-slate-400 italic bg-white p-4 rounded border border-slate-200 border-dashed text-center">Aucune activité définie.</p>}
                    </ul>
                  </div>

                  {/* Activity Form */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center gap-2"><Plus className="w-4 h-4"/> {editingActivityId ? "Éditer l'activité" : "Nouvelle Activité"}</h4>
                    <form onSubmit={addActivity} className="space-y-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nom de l'activité</label>
                        <input value={newActivityName} onChange={e=>setNewActivityName(e.target.value)} placeholder="ex: Basket, Natation..." className="form-input w-full text-sm rounded-md border-slate-300" required />
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Champ d'apprentissage (CA)</label>
                          <select value={newActivityChamp} onChange={e=>setNewActivityChamp(e.target.value ? parseInt(e.target.value) : '')} className="form-select w-full text-sm rounded-md border-slate-300 bg-white">
                            <option value="">-- Optionnel --</option>
                            <option value="1">Champ 1 (CA1)</option>
                            <option value="2">Champ 2 (CA2)</option>
                            <option value="3">Champ 3 (CA3)</option>
                            <option value="4">Champ 4 (CA4)</option>
                            <option value="5">Champ 5 (CA5)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Durée (sem.)</label>
                          <input type="number" min="1" max="52" value={newActivityDuration} onChange={e=>setNewActivityDuration(parseInt(e.target.value))} className="form-input w-full text-sm rounded-md border-slate-300" required />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-600 mb-1" title="Nombre de classes en simultané pour cette activité">Capacité simul.</label>
                          <input type="number" min="1" value={newActivityMaxCapacity} onChange={e=>setNewActivityMaxCapacity(parseInt(e.target.value))} className="form-input w-full text-sm rounded-md border-slate-300" required />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Lieu de pratique (Installation)</label>
                        <select value={newActivityFacility} onChange={e=>setNewActivityFacility(e.target.value)} className="form-select w-full text-sm rounded-md border-slate-300 bg-white" required>
                          <option value="">-- Choisir --</option>
                          {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>
                      <div className="pt-3 border-t border-slate-100">
                        <label className="block text-xs font-semibold text-slate-600 mb-2">Période souhaitée (Optionnel)</label>
                        <div className="flex items-center gap-3">
                          <input type="number" min="1" max="52" value={newActivityPrefStart} onChange={e=>setNewActivityPrefStart(e.target.value ? parseInt(e.target.value) : '')} placeholder="De S. (ex: 1)" className="form-input flex-1 text-sm rounded-md border-slate-300" />
                          <span className="text-sm text-slate-400 font-medium">à</span>
                          <input type="number" min="1" max="52" value={newActivityPrefEnd} onChange={e=>setNewActivityPrefEnd(e.target.value ? parseInt(e.target.value) : '')} placeholder="À S. (ex: 12)" className="form-input flex-1 text-sm rounded-md border-slate-300" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 pt-2">
                        <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer bg-slate-50 p-2 rounded border border-slate-100">
                          <input type="checkbox" checked={newActivityGroup} onChange={e => setNewActivityGroup(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                          Regrouper idéalement les cycles (mise en place du matériel importante)
                        </label>
                        <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer bg-slate-50 p-2 rounded border border-slate-100">
                          <input type="checkbox" checked={newActivityMandatory} onChange={e => setNewActivityMandatory(e.target.checked)} className="rounded text-red-600 focus:ring-red-500" />
                          <span className="text-red-700">Bloquer OBLIGATOIREMENT sur cette période (ex: Natation)</span>
                        </label>
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        {editingActivityId && (
                          <button type="button" onClick={resetForm} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors">
                            Annuler
                          </button>
                        )}
                        <button type="submit" className="flex-[2] bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-blue-700 flex justify-center items-center gap-2 shadow-sm transition-colors">
                          {editingActivityId ? "Mettre à jour l'activité" : "Créer l'activité"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === 'facilities' && (
                <div className="max-w-2xl mx-auto">
                  <form onSubmit={addFacility} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-end gap-4 mb-8">
                     <div className="flex-1">
                       <label className="block text-xs font-semibold text-slate-600 mb-1">Nom du lieu</label>
                       <input value={newFacilityName} onChange={e=>setNewFacilityName(e.target.value)} placeholder="ex: Gymnase municipal, Forêt..." className="form-input w-full text-sm rounded-md border-slate-300" required />
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-slate-600 mb-1">Couleur</label>
                       <input type="color" value={newFacilityColor} onChange={e=>setNewFacilityColor(e.target.value)} className="h-9 w-12 rounded cursor-pointer border border-slate-300" />
                     </div>
                     <button type="submit" className="bg-slate-800 text-white px-6 py-2 rounded-md font-medium text-sm hover:bg-slate-900 transition-colors h-10">Ajouter</button>
                  </form>

                  <div className="space-y-3">
                     {facilities.map(f => (
                       <div key={f.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                         <div className="flex items-center gap-3">
                           <div className="w-4 h-4 rounded-full shadow-sm border border-black/10" style={{backgroundColor: f.color}}></div>
                           <span className="font-bold text-slate-700">{f.name}</span>
                         </div>
                         <button onClick={() => deleteFacility(f.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors" title="Supprimer">
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     ))}
                     {facilities.length === 0 && <p className="text-sm text-slate-400 italic text-center py-8">Aucun lieu de pratique défini.</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
