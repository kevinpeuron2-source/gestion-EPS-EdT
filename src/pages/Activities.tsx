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

  const [selectedSA, setSelectedSA] = useState<{ id?: string, activityId?: string, classId?: string, courseId?: string, startWeekIdx: number, endWeekIdx: number, isLocked: boolean } | null>(null);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printStartWk, setPrintStartWk] = useState<number>(1);
  const [printEndWk, setPrintEndWk] = useState<number>(52);
  const [isPrintingRange, setIsPrintingRange] = useState(false);
  const [printFit, setPrintFit] = useState<'contain' | 'width' | 'height'>('contain');
  const [groupBy, setGroupBy] = useState<'class' | 'slot'>('class');

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
      if (selectedSA.id) {
        await updateDoc(doc(db, "scheduledActivities", selectedSA.id), {
          startWeek: selectedSA.startWeekIdx + 1,
          endWeek: selectedSA.endWeekIdx + 1,
          isLocked: selectedSA.isLocked
        });
      } else {
        if (!selectedSA.activityId) return alert("Veuillez sélectionner une activité.");
        await addDoc(collection(db, "scheduledActivities"), {
          activityId: selectedSA.activityId,
          classId: selectedSA.classId,
          courseId: selectedSA.courseId,
          startWeek: selectedSA.startWeekIdx + 1,
          endWeek: selectedSA.endWeekIdx + 1,
          isLocked: selectedSA.isLocked
        });
      }
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

  
  const groupedRows = React.useMemo(() => {
    const allRows = classes.flatMap(c => {
      const classCourses = courses.filter(crs => crs.classId === c.id && !crs.isUnavailability && !crs.activityId);
      return classCourses.map(course => ({ c, course }));
    }).filter(row => {
      return scheduledActivities.some(sa => sa.courseId === row.course.id);
    });

    if (groupBy === 'slot') {
      const dayOrder: Record<string, number> = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 7 };
      allRows.sort((a, b) => {
        const dayA = dayOrder[a.course.dayOfWeek] || 99;
        const dayB = dayOrder[b.course.dayOfWeek] || 99;
        if (dayA !== dayB) return dayA - dayB;
        if (a.course.startTime !== b.course.startTime) return a.course.startTime.localeCompare(b.course.startTime);
        return a.c.name.localeCompare(b.c.name);
      });
    } else {
      const dayOrder: Record<string, number> = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 7 };
      allRows.sort((a, b) => {
        if (a.c.name !== b.c.name) return a.c.name.localeCompare(b.c.name);
        const dayA = dayOrder[a.course.dayOfWeek] || 99;
        const dayB = dayOrder?.[b.course.dayOfWeek] || 99;
        if (dayA !== dayB) return dayA - dayB;
        return a.course.startTime.localeCompare(b.course.startTime);
      });
    }
    return allRows;
  }, [classes, courses, scheduledActivities, groupBy]);

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
    if (absences.some(a => {
      if (a.classId !== cId) return false;
      const aStart = getWeekNumbers(a.startWeek, a.endWeek);
      return aStart.includes(calWk);
    })) return true;
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
          </div>
  );
}
