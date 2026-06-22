import React from "react";
import { useStore } from "../store/useStore";
import { Printer } from "lucide-react";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

export default function Schedule() {
  const { teachers, classes, facilities, courses } = useStore();

  const printLandscape = () => {
    const style = document.createElement('style');
    style.innerHTML = `@media print { @page { size: landscape; margin: 10mm; } }`;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Emploi du temps global</h1>
          <p className="text-sm text-slate-500">Vue synthétique de la répartition des collègues.</p>
        </div>
        <button onClick={printLandscape} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-colors">
          <Printer className="w-4 h-4" /> Imprimer (Paysage)
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6 print:p-0 print:overflow-visible flex flex-col">
        <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-200 overflow-hidden print:shadow-none print:border-none print:w-full flex-1 md:flex-none">
          <div className="overflow-x-auto min-w-full print:overflow-visible">
            <table className="w-full text-left border-collapse min-w-[800px] print:min-w-full">
              <thead>
                <tr>
                  <th className="bg-slate-800 text-white p-3 border-b-2 border-slate-900 font-bold w-48 sticky left-0 z-10 print:bg-slate-200 print:text-slate-900 print:border-slate-300 print:static">
                    Enseignant
                  </th>
                  {DAYS.map(day => (
                     <th key={day} className="bg-slate-800 text-white p-3 border-b-2 border-slate-900 font-bold border-l border-slate-700/50 print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                       {day}
                     </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 align-top">
                {teachers.map((teacher, idx) => {
                  return (
                    <tr key={teacher.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50 print:bg-white"}>
                      <td className="p-3 font-semibold text-slate-800 border-r border-slate-200 sticky left-0 z-10 bg-inherit print:border-l print:static shadow-[1px_0_0_0_rgba(226,232,240,1)] print:shadow-none break-words">
                        {teacher.name}
                      </td>
                      {DAYS.map(day => {
                        const dayCourses = courses.filter(c => c.dayOfWeek === day && (c.teacherId === teacher.id || c.coTeacherIds?.includes(teacher.id)));
                        
                        // Sort by start time
                        dayCourses.sort((a, b) => {
                          const [aH, aM] = a.startTime.split(':').map(Number);
                          const [bH, bM] = b.startTime.split(':').map(Number);
                          return (aH * 60 + aM) - (bH * 60 + bM);
                        });

                        return (
                          <td key={`${teacher.id}-${day}`} className="p-2 border-r border-slate-200 last:border-r-0 print:border hover:bg-slate-100/50 transition-colors">
                            <div className="flex flex-col gap-1.5">
                              {dayCourses.length === 0 ? (
                                <span className="text-xs text-slate-300 italic px-1 hidden print:inline">-</span>
                              ) : dayCourses.map(course => {
                                const tClass = classes.find(c => c.id === course.classId);
                                const fac = facilities.find(f => f.id === course.facilityId);
                                const isUnavail = course.isUnavailability;
                                
                                if (isUnavail) {
                                  return (
                                    <div key={course.id} className="bg-slate-100 border border-slate-200 border-dashed rounded flex flex-col p-1.5 shrink-0 break-inside-avoid">
                                      <div className="text-[10px] font-mono text-slate-500 font-semibold">{course.startTime} - {course.endTime}</div>
                                      <div className="text-[11px] font-medium text-slate-600 mt-0.5 leading-tight">{course.reason || "Indisponible"}</div>
                                    </div>
                                  );
                                }

                                const bgColor = fac?.color || tClass?.color || '#cbd5e1';

                                return (
                                  <div 
                                    key={course.id} 
                                    className="rounded border shadow-sm flex flex-col p-1.5 shrink-0 break-inside-avoid text-slate-800"
                                    style={{ 
                                      backgroundColor: bgColor,
                                      borderColor: 'rgba(0,0,0,0.05)'
                                    }}
                                  >
                                    <div className="text-[10px] font-mono font-bold opacity-80 flex justify-between items-center">
                                      <span>{course.startTime} - {course.endTime}</span>
                                    </div>
                                    <div className="font-bold text-xs leading-tight mt-0.5">{tClass?.name || 'Class ?'}</div>
                                    {fac && <div className="text-[10px] font-medium opacity-90 mt-0.5 bg-white/40 inline-flex px-1 rounded w-fit">{fac.name}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
