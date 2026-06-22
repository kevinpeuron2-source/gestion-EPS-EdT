import React from "react";
import { useStore } from "../store/useStore";
import { Printer } from "lucide-react";

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

  const printLandscape = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print { 
        @page { size: landscape; margin: 5mm; }
        body { 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Emploi du temps global</h1>
          <p className="text-sm text-slate-500">Vue de l'emploi du temps par jour et par enseignant.</p>
        </div>
        <button onClick={printLandscape} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-colors">
          <Printer className="w-4 h-4" /> Imprimer (Paysage)
        </button>
      </header>

      <div className="flex-1 overflow-auto bg-slate-50 flex items-start print:p-0 print:overflow-visible">
        <div className="flex flex-row w-max min-w-full print:w-max">
          {/* Time Axis */}
          <div className="w-12 shrink-0 bg-slate-50 print:bg-white border-r border-slate-200 sticky left-0 z-30 print:static">
            <div className="border-b border-slate-200" style={{ height: HEADER_HEIGHT }}></div>
            <div className="relative" style={{ height: (TIME_END - TIME_START) * 60 * PX_PER_MINUTE }}>
               {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => (
                 <div key={i} className="absolute w-full px-1 text-right text-[10px] text-slate-400 font-medium transform -translate-y-1/2" style={{ top: i * 60 * PX_PER_MINUTE }}>
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
                <div className="h-8 bg-slate-800 text-white text-sm font-bold flex items-center justify-center print:bg-slate-200 print:text-black print:border-b print:border-slate-300">
                  {day}
                </div>
                {/* Teachers Header */}
                <div className="flex flex-row h-8 border-b border-slate-200 bg-white">
                  {teachers.map(teacher => (
                    <div key={teacher.id} className="w-24 print:w-20 shrink-0 border-r border-slate-100 last:border-r-0 flex items-center justify-center text-[10px] font-bold text-slate-700 truncate px-1" title={teacher.name}>
                      {teacher.name}
                    </div>
                  ))}
                </div>
                {/* Columns for this day */}
                <div className="flex flex-row relative bg-white" style={{ height: (TIME_END - TIME_START) * 60 * PX_PER_MINUTE }}>
                  {/* Hourly grid lines */}
                  {Array.from({ length: TIME_END - TIME_START }).map((_, i) => (
                    <div key={i} className="absolute w-full border-t border-slate-100 pointer-events-none" style={{ top: (i + 1) * 60 * PX_PER_MINUTE }}></div>
                  ))}

                  {teachers.map((teacher, tIdx) => {
                    const dayCourses = courses.filter(c => c.dayOfWeek === day && (c.teacherId === teacher.id || c.coTeacherIds?.includes(teacher.id)));
                    
                    return (
                      <div key={teacher.id} className={`w-24 print:w-20 shrink-0 relative border-r border-slate-100 last:border-r-0 ${tIdx % 2 !== 0 ? 'bg-slate-50/50 print:bg-transparent' : ''}`}>
                        {dayCourses.map(course => {
                            const startMins = timeToMinutes(course.startTime) - TIME_START * 60;
                            const dur = timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
                            const tClass = classes.find(c => c.id === course.classId);
                            const fac = facilities.find(f => f.id === course.facilityId);
                            const isUnavail = course.isUnavailability;
                            const bgColor = isUnavail ? '#f1f5f9' : (fac?.color || tClass?.color || '#e2e8f0');

                            return (
                              <div key={course.id} className="absolute left-0 right-0 rounded border p-1 overflow-hidden print:break-inside-avoid m-0.5"
                                style={{
                                  top: startMins * PX_PER_MINUTE,
                                  height: Math.max(15, dur * PX_PER_MINUTE - 1),
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
    </div>
  );
}
