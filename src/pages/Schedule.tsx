import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Printer, Users, User } from "lucide-react";

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
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState<'global' | 'teachers' | null>(null);
  const [selectingTeachers, setSelectingTeachers] = useState(false);
  const [selectedTeachersForPrint, setSelectedTeachersForPrint] = useState<string[]>([]);
  const [printFit, setPrintFit] = useState<'contain' | 'width' | 'height'>('contain');
  const [printType, setPrintType] = useState<'neutral' | 'planned'>('neutral');

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

  const periods = React.useMemo(() => {
    if (printType === 'neutral') return [{ id: 'neutral', name: 'Neutre', filter: () => true, getFacility: (course: any) => facilities.find(f => f.id === course.facilityId), isAbsent: () => false }];

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
         if (!absent) {
            const sa = scheduledActivities.find(sa => sa.classId === c.classId && w >= sa.startWeek && w <= sa.endWeek);
            if (sa) {
               const act = activities.find(a => a.id === sa.activityId);
               if (act && act.facilityId) facId = act.facilityId;
            }
         }
         sigObj[c.id] = absent ? "ABS" : facId;
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
          const facId = p.sigObj[course.id];
          if (facId && facId !== "ABS") return facilities.find(f => f.id === facId);
          return facilities.find(f => f.id === course.facilityId);
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
      window.print();
      document.head.removeChild(style);
      setPrintMode(null);
    }, 200);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header (Hidden when printing usually, but we also use screen-only classes) */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Emploi du temps global</h1>
          <p className="text-sm text-slate-500">Vue de l'emploi du temps par jour et par enseignant.</p>
        </div>
        <button onClick={handleOpenPrintModal} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-colors">
          <Printer className="w-4 h-4" /> Imprimer (Paysage)
        </button>
      </header>

      {/* Main scrolling view for screen (hidden when we want to print ONLY teachers) */}
      <div className={`flex-1 overflow-auto bg-slate-50 flex items-start flex-col ${printMode === 'teachers' ? 'print:hidden' : 'print:p-0 print:overflow-visible'}`}>
        {periods.map(period => (
          <div key={period.id} className={`w-full flex-1 flex items-start ${printMode && periods.length > 1 ? 'print:page-break-after-always pb-8' : ''}`}>
            <div className={`flex flex-row w-max min-w-full relative ${printMode === 'teachers' ? '' : 'print:w-max'}`}>
              
              {/* Optional Title for Planification Mode Print */}
              {printMode && periods.length > 1 && (
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
                {DAYS.map(day => (
                  <div key={day} className="flex flex-col border-r-2 border-slate-300 last:border-r-0 flex-1 min-w-0">
                    {/* Day Header */}
                    <div className={`h-8 bg-slate-800 text-white text-sm font-bold flex items-center justify-center ${printMode === 'teachers' ? '' : 'print:bg-slate-200 print:text-black print:border-b print:border-slate-300'}`}>
                      {day}
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
                          <div key={teacher.id} className={`w-24 ${printMode === 'teachers' ? '' : 'print:w-20'} shrink-0 relative border-r border-slate-100 last:border-r-0 ${tIdx % 2 !== 0 ? 'bg-slate-50/50 ' + (printMode === 'teachers' ? '' : 'print:bg-transparent') : ''}`}>
                            {dayCourses.filter(printMode ? period.filter : () => true).map(course => {
                                const startMins = timeToMinutes(course.startTime) - TIME_START * 60;
                                const dur = timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
                                const tClass = classes.find(c => c.id === course.classId);
                                const fac = printMode ? period.getFacility(course) : facilities.find(f => f.id === course.facilityId);
                                const isAbsent = printMode ? period.isAbsent(course) : false;
                                const isUnavail = course.isUnavailability;
                                const bgColor = isUnavail ? '#f1f5f9' : (fac?.color || tClass?.color || '#e2e8f0');
    
                                return (
                                  <div key={course.id} className={`absolute left-0 right-0 rounded border p-1 overflow-hidden m-0.5 ${printMode === 'teachers' ? '' : 'print:break-inside-avoid'}`}
                                    style={{
                                      top: `${(startMins / totalMins) * 100}%`,
                                      height: `calc(${(dur / totalMins) * 100}% - 4px)`,
                                      backgroundColor: bgColor,
                                      borderColor: isUnavail ? '#cbd5e1' : 'rgba(0,0,0,0.1)',
                                      borderStyle: isUnavail ? 'dashed' : 'solid'
                                    }}
                                  >
                                    <div className="flex flex-col h-full pointer-events-none">
                                      <div className="text-[8px] font-mono leading-none text-slate-700/90 mb-0.5">{course.startTime}-{course.endTime}</div>
                                      {isUnavail ? (
                                        <div className="text-[9px] font-bold uppercase text-slate-600 truncate">{course.reason || 'Indispo'}</div>
                                      ) : (
                                        <>
                                          <div className="font-bold text-[10px] leading-tight text-slate-800 truncate">{tClass?.name || '?'}</div>
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
                                 const isUnavail = period.isAbsent(course) || course.isUnavailability;
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
                                     <div className="text-[10px] font-mono font-bold text-slate-700/90 leading-none mb-1">{course.startTime}-{course.endTime}</div>
                                     {isUnavail ? (
                                       <div className="text-xs font-bold uppercase text-slate-800">{course.reason || 'Indisponible'}</div>
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
    </div>
  );
}
