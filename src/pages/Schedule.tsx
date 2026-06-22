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
  const { teachers, classes, facilities, courses } = useStore();
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState<'global' | 'teachers' | null>(null);

  const pxPerMinute = printMode ? 1.0 : PX_PER_MINUTE; // Scale down vertically for print to fit A4 Landscape

  const executePrint = (mode: 'global' | 'teachers') => {
    setPrintMode(mode);
    setShowPrintModal(false);
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
        <button onClick={() => setShowPrintModal(true)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-colors">
          <Printer className="w-4 h-4" /> Imprimer (Paysage)
        </button>
      </header>

      {/* Main scrolling view for screen (hidden when we want to print ONLY teachers) */}
      <div className={`flex-1 overflow-auto bg-slate-50 flex items-start ${printMode === 'teachers' ? 'print:hidden' : 'print:p-0 print:overflow-visible'}`}>
        <div className={`flex flex-row w-max min-w-full ${printMode === 'teachers' ? '' : 'print:w-max'}`}>
          {/* Time Axis */}
          <div className={`w-12 shrink-0 bg-slate-50 ${printMode === 'teachers' ? '' : 'print:bg-white border-r border-slate-200 sticky left-0 z-30 print:static'}`}>
            <div className="border-b border-slate-200" style={{ height: HEADER_HEIGHT }}></div>
            <div className="relative" style={{ height: (TIME_END - TIME_START) * 60 * pxPerMinute }}>
               {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => (
                 <div key={i} className="absolute w-full px-1 text-right text-[10px] text-slate-400 font-medium transform -translate-y-1/2" style={{ top: i * 60 * pxPerMinute }}>
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
                <div className="flex flex-row relative bg-white" style={{ height: (TIME_END - TIME_START) * 60 * pxPerMinute }}>
                  {/* Hourly grid lines */}
                  {Array.from({ length: TIME_END - TIME_START }).map((_, i) => (
                    <div key={i} className="absolute w-full border-t border-slate-100 pointer-events-none" style={{ top: (i + 1) * 60 * pxPerMinute }}></div>
                  ))}

                  {teachers.map((teacher, tIdx) => {
                    const dayCourses = courses.filter(c => c.dayOfWeek === day && (c.teacherId === teacher.id || c.coTeacherIds?.includes(teacher.id)));
                    
                    return (
                      <div key={teacher.id} className={`w-24 ${printMode === 'teachers' ? '' : 'print:w-20'} shrink-0 relative border-r border-slate-100 last:border-r-0 ${tIdx % 2 !== 0 ? 'bg-slate-50/50 ' + (printMode === 'teachers' ? '' : 'print:bg-transparent') : ''}`}>
                        {dayCourses.map(course => {
                            const startMins = timeToMinutes(course.startTime) - TIME_START * 60;
                            const dur = timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
                            const tClass = classes.find(c => c.id === course.classId);
                            const fac = facilities.find(f => f.id === course.facilityId);
                            const isUnavail = course.isUnavailability;
                            const bgColor = isUnavail ? '#f1f5f9' : (fac?.color || tClass?.color || '#e2e8f0');

                            return (
                              <div key={course.id} className={`absolute left-0 right-0 rounded border p-1 overflow-hidden m-0.5 ${printMode === 'teachers' ? '' : 'print:break-inside-avoid'}`}
                                style={{
                                  top: startMins * pxPerMinute,
                                  height: Math.max(15, dur * pxPerMinute - 1),
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

      {/* Print Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 shrink-0">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Options d'impression</h3>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <button onClick={() => executePrint('global')} className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left group">
                <div className="bg-slate-100 p-2 rounded-md group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors text-slate-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">Emploi du temps global</div>
                  <div className="text-xs text-slate-500">Imprimer tous les enseignants sur la même grille (vue actuelle)</div>
                </div>
              </button>
              
              <button onClick={() => executePrint('teachers')} className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left group">
                <div className="bg-slate-100 p-2 rounded-md group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors text-slate-600">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">Par enseignant</div>
                  <div className="text-xs text-slate-500">Imprimer un emploi du temps individuel (1 page par enseignant)</div>
                </div>
              </button>
            </div>
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button type="button" onClick={() => setShowPrintModal(false)} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium transition-colors text-sm">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print-only view for 'teachers' mode */}
      {printMode === 'teachers' && (
        <div className="hidden print:block w-full text-slate-900 bg-white">
          {teachers.map(teacher => (
            <div key={teacher.id} className="print:page-break-after-always pb-8">
              <h2 className="text-2xl font-bold mb-4">{teacher.name} - Emploi du temps</h2>
              <div className="flex border border-slate-300">
                {/* Time Axis for Teacher */}
                <div className="w-16 shrink-0 bg-slate-100 border-r border-slate-300">
                  <div className="h-10 border-b border-slate-300"></div>
                  <div className="relative" style={{ height: (TIME_END - TIME_START) * 60 * pxPerMinute }}>
                    {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => (
                      <div key={i} className="absolute w-full px-2 text-right text-xs text-slate-600 font-medium transform -translate-y-1/2" style={{ top: i * 60 * pxPerMinute }}>
                        {TIME_START + i}h
                      </div>
                    ))}
                  </div>
                </div>

                {/* Days for Teacher */}
                <div className="flex flex-row flex-1">
                  {DAYS.map((day, dIdx) => {
                    const dayCourses = courses.filter(c => c.dayOfWeek === day && (c.teacherId === teacher.id || c.coTeacherIds?.includes(teacher.id)));
                    return (
                      <div key={day} className={`flex flex-col flex-1 ${dIdx < DAYS.length - 1 ? 'border-r border-slate-300' : ''}`}>
                        <div className="h-10 bg-slate-200 text-slate-800 font-bold flex items-center justify-center border-b border-slate-300">
                          {day}
                        </div>
                        <div className="relative bg-white" style={{ height: (TIME_END - TIME_START) * 60 * pxPerMinute }}>
                          {/* Hourly horizontal lines */}
                          {Array.from({ length: TIME_END - TIME_START }).map((_, i) => (
                            <div key={i} className="absolute w-full border-t border-slate-200 pointer-events-none" style={{ top: (i + 1) * 60 * pxPerMinute }}></div>
                          ))}

                          {/* Courses */}
                          {dayCourses.map(course => {
                            const startMins = timeToMinutes(course.startTime) - TIME_START * 60;
                            const dur = timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
                            const tClass = classes.find(c => c.id === course.classId);
                            const fac = facilities.find(f => f.id === course.facilityId);
                            const isUnavail = course.isUnavailability;
                            const bgColor = isUnavail ? '#f1f5f9' : (fac?.color || tClass?.color || '#e2e8f0');

                            return (
                              <div key={course.id} className="absolute left-1 right-1 rounded-md border p-1.5 overflow-hidden break-inside-avoid shadow-sm"
                                style={{
                                  top: startMins * pxPerMinute,
                                  height: Math.max(15, dur * pxPerMinute - 1),
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
        </div>
      )}
    </div>
  );
}
