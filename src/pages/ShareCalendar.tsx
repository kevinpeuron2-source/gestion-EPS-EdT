import React, { useState, useMemo } from 'react';
import { useFirebaseSync } from '../hooks/useFirebaseSync';
import { useStore } from '../store/useStore';
import { Calendar, ChevronLeft, ChevronRight, User, Users } from 'lucide-react';
import { startOfWeek, addDays, getISOWeek, format, subWeeks, addWeeks, addMonths, subMonths, isSameMonth, startOfMonth, endOfMonth, endOfWeek, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Course } from '../types';

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const TIME_START = 8;
const TIME_END = 19;
const PX_PER_MINUTE = 1.3;

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

export default function ShareCalendar() {
  useFirebaseSync();
  const { teachers, loading } = useStore();
  const [view, setView] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [currentDate, setCurrentDate] = useState(new Date());

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Chargement du calendrier...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Calendrier EPS Partagé</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <User className="w-4 h-4 text-slate-500 ml-2" />
            <select 
              value={selectedTeacher} 
              onChange={e => setSelectedTeacher(e.target.value)}
              className="bg-transparent border-none text-sm font-medium focus:ring-0 text-slate-700 py-1.5"
            >
              <option value="all">Tous les enseignants</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(['weekly', 'monthly', 'yearly'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
              >
                {v === 'weekly' ? 'Hebdomadaire' : v === 'monthly' ? 'Mensuel' : 'Annuel'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 bg-slate-50">
        <div className="max-w-7xl mx-auto h-full">
          {view === 'weekly' && <WeeklyView selectedTeacher={selectedTeacher} currentDate={currentDate} setCurrentDate={setCurrentDate} />}
          {view === 'monthly' && <MonthlyView selectedTeacher={selectedTeacher} currentDate={currentDate} setCurrentDate={setCurrentDate} />}
          {view === 'yearly' && <YearlyView selectedTeacher={selectedTeacher} />}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------
// WEEKLY VIEW
// ---------------------------------------------------------
function WeeklyView({ selectedTeacher, currentDate, setCurrentDate }: any) {
  const { teachers, classes, facilities, courses, activities, scheduledActivities, absences, settings } = useStore();
  
  const currentWeek = getISOWeek(currentDate);
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  
  const startW = settings?.startWeek || 36;
  const endW = settings?.endWeek || 27;
  const weekNumbers = useMemo(() => getWeekNumbers(startW, endW), [startW, endW]);

  const isHoliday = (day: Date) => {
    const calWk = getISOWeek(day);
    return settings?.holidays?.some(h => {
        const hStart = getWeekNumbers(h.startWeek, h.endWeek);
        return hStart.includes(calWk);
    }) || false;
  };

  const filteredCourses = useMemo(() => {
    return courses.filter(c => selectedTeacher === 'all' || c.teacherId === selectedTeacher);
  }, [courses, selectedTeacher]);

  const teacherIds = useMemo(() => {
    if (selectedTeacher !== 'all') return [selectedTeacher];
    const ids = new Set(filteredCourses.map(c => c.teacherId));
    return teachers.filter(t => ids.has(t.id)).map(t => t.id);
  }, [filteredCourses, selectedTeacher, teachers]);

  const isWeekA = currentWeek % 2 === 0; 
  const weekType = isWeekA ? 'A' : 'B';

  const isCourseActiveThisWeek = (course: Course) => {
    if (!course.weekType || course.weekType === 'ALL') return true;
    return course.weekType === weekType;
  };

  const getActiveActivity = (course: Course, calWk: number) => {
    const wks = getWeekNumbers(settings?.startWeek || 36, settings?.endWeek || 27);
    const internalWeek = wks.indexOf(calWk) + 1;
    
    let resolvedActId = course.activityId;
    
    if (internalWeek > 0) {
      const sa = scheduledActivities.find(sa => 
        (sa.classId === course.classId || sa.courseId === course.id) && 
        internalWeek >= sa.startWeek && internalWeek <= sa.endWeek
      );
      if (sa && !resolvedActId) resolvedActId = sa.activityId;
    }
    
    if (!resolvedActId) return null;
    return activities.find(a => a.id === resolvedActId);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ChevronLeft className="w-5 h-5"/></button>
          <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ChevronRight className="w-5 h-5"/></button>
          <span className="font-bold text-lg text-slate-800 ml-2">Sem. du {format(startDate, 'd MMM', { locale: fr })} (Sem. {isWeekA ? 'A' : 'B'})</span>
        </div>
        <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">Aujourd'hui</button>
      </div>
      <div className="flex-1 overflow-auto bg-slate-50 flex items-start">
         <div className="w-full flex-1 flex items-start">
            <div className="flex flex-row w-max min-w-full relative">
               <div className="w-12 shrink-0 bg-white border-r border-slate-200 sticky left-0 z-30">
                 <div className="border-b border-slate-200" style={{ height: 48 }}></div>
                 <div className="relative" style={{ height: (TIME_END - TIME_START + 1) * 60 * PX_PER_MINUTE }}>
                   {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => (
                      <div key={i} className="absolute w-full flex items-start justify-end pr-2 text-xs font-medium text-slate-400" style={{ top: i * 60 * PX_PER_MINUTE - 8 }}>
                         {TIME_START + i}h
                      </div>
                   ))}
                 </div>
               </div>
               <div className="flex flex-1">
                 {teacherIds.map(tId => {
                    const teacher = teachers.find(t => t.id === tId);
                    return (
                       <div key={tId} className="flex-1 min-w-[200px] border-r border-slate-200">
                          <div className="h-12 border-b border-slate-200 bg-slate-50 flex items-center justify-center font-bold text-sm text-slate-700 sticky top-0 z-20">
                            {teacher?.name}
                          </div>
                          <div className="flex relative">
                             {DAYS.map(d => {
                                const dayDate = addDays(startDate, DAYS.indexOf(d));
                                const holi = isHoliday(dayDate);
                                return (
                                   <div key={d} className={`flex-1 border-r border-slate-100 relative min-w-[120px] ${holi ? 'bg-slate-200' : 'bg-white'}`} style={{ height: (TIME_END - TIME_START + 1) * 60 * PX_PER_MINUTE }}>
                                      <div className="text-center py-2 border-b border-slate-100 sticky top-12 z-10 bg-inherit shadow-sm">
                                         <div className="text-[10px] uppercase font-bold text-slate-400">{d}</div>
                                         <div className="text-sm font-semibold text-slate-700">{format(dayDate, 'd')}</div>
                                      </div>
                                      {filteredCourses.filter(c => c.teacherId === tId && c.dayOfWeek === d && isCourseActiveThisWeek(c)).map(course => {
                                         const tClass = classes.find(c => c.id === course.classId);
                                         const act = getActiveActivity(course, currentWeek);
                                         const fac = facilities.find(f => f.id === (act ? act.facilityId : course.facilityId));
                                         
                                         // check if absent for week
                                         const isAbs = absences.some(a => {
                                           if (a.classId !== tClass?.id) return false;
                                           const aStart = getWeekNumbers(a.startWeek, a.endWeek);
                                           return aStart.includes(currentWeek);
                                         });
                                         
                                         const top = (timeToMinutes(course.startTime) - TIME_START * 60) * PX_PER_MINUTE;
                                         const height = (timeToMinutes(course.endTime) - timeToMinutes(course.startTime)) * PX_PER_MINUTE;
                                         
                                         if (course.isUnavailability) {
                                            return (
                                               <div key={course.id} className="absolute left-1 right-1 rounded-md border p-2 bg-slate-100 border-slate-300 z-10 flex flex-col justify-center items-center shadow-sm" style={{ top, height }}>
                                                  <span className="font-bold text-slate-500 text-xs text-center">{course.reason || "Indisponible"}</span>
                                               </div>
                                            );
                                         }
                                         return (
                                            <div key={course.id} className="absolute left-1 right-1 rounded-md border p-2 z-10 shadow-sm overflow-hidden" style={{ top, height, backgroundColor: fac?.color || tClass?.color || '#e2e8f0', borderColor: 'rgba(0,0,0,0.1)' }}>
                                               {isAbs && <div className="absolute inset-0 z-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.9) 4px, rgba(0,0,0,0.9) 8px)' }}></div>}
                                               <div className={`relative z-20 flex flex-col h-full ${isAbs ? 'opacity-0' : ''}`}>
                                                  <div className="font-bold text-slate-900 text-sm">{tClass?.name}</div>
                                                  <div className="text-xs text-slate-800 font-medium">{course.startTime} - {course.endTime}</div>
                                                  {act && <div className="mt-auto text-[10px] font-bold text-slate-900 bg-white/40 px-1 rounded truncate">{act.name}</div>}
                                                  {fac && <div className="text-[9px] text-slate-800 truncate">{fac.name}</div>}
                                               </div>
                                            </div>
                                         );
                                      })}
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// MONTHLY VIEW
// ---------------------------------------------------------
function MonthlyView({ selectedTeacher, currentDate, setCurrentDate }: any) {
  const { classes, facilities, courses, activities, scheduledActivities, absences, settings } = useStore();
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const startW = settings?.startWeek || 36;
  const endW = settings?.endWeek || 27;
  const weekNumbers = useMemo(() => getWeekNumbers(startW, endW), [startW, endW]);

  const isHoliday = (day: Date) => {
    const calWk = getISOWeek(day);
    return settings?.holidays?.some(h => {
        const hStart = getWeekNumbers(h.startWeek, h.endWeek);
        return hStart.includes(calWk);
    }) || false;
  };

  const checkIfAbsent = (cId: string, calWk: number) => {
    return absences.some(a => {
      if (a.classId !== cId) return false;
      const aStart = getWeekNumbers(a.startWeek, a.endWeek);
      return aStart.includes(calWk);
    });
  };

  const filteredCourses = useMemo(() => {
    return courses.filter(c => (selectedTeacher === 'all' || c.teacherId === selectedTeacher) && !c.isUnavailability);
  }, [courses, selectedTeacher]);

  const getActiveActivity = (course: Course, calWk: number) => {
    const wks = getWeekNumbers(settings?.startWeek || 36, settings?.endWeek || 27);
    const internalWeek = wks.indexOf(calWk) + 1;
    
    let resolvedActId = course.activityId;
    
    if (internalWeek > 0) {
      const sa = scheduledActivities.find(sa => 
        (sa.classId === course.classId || sa.courseId === course.id) && 
        internalWeek >= sa.startWeek && internalWeek <= sa.endWeek
      );
      if (sa && !resolvedActId) resolvedActId = sa.activityId;
    }
    
    if (!resolvedActId) return null;
    return activities.find(a => a.id === resolvedActId);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ChevronLeft className="w-5 h-5"/></button>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ChevronRight className="w-5 h-5"/></button>
          <span className="font-bold text-lg text-slate-800 ml-2 capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </span>
        </div>
        <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">Ce mois</button>
      </div>
      <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-px bg-slate-200">
        {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(d => (
          <div key={d} className="bg-slate-100 py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{d}</div>
        ))}
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const dayName = format(day, 'EEEE', { locale: fr });
          const capitalizedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
          const calWk = getISOWeek(day);
          
          const dayCourses = filteredCourses.filter(c => c.dayOfWeek === capitalizedDayName);
          const isHol = isHoliday(day);

          return (
            <div key={idx} className={`p-2 flex flex-col h-full min-h-[120px] ${isHol ? 'bg-slate-200' : 'bg-white'} ${!isCurrentMonth ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-blue-600 text-white' : 'text-slate-700'}`}>
                  {format(day, 'd')}
                </span>
                {idx % 7 === 0 && <span className="text-[10px] font-bold text-slate-400">Sem {calWk}</span>}
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {dayCourses.map(course => {
                  const tClass = classes.find(c => c.id === course.classId);
                  const act = getActiveActivity(course, calWk);
                  const fac = facilities.find(f => f.id === (act ? act.facilityId : course.facilityId));
                  
                  const isAbs = checkIfAbsent(tClass?.id || '', calWk);
                  
                  return (
                    <div key={course.id} className="text-[10px] p-1 rounded border leading-tight shadow-sm relative overflow-hidden" style={{ backgroundColor: fac?.color || tClass?.color || '#e2e8f0', borderColor: 'rgba(0,0,0,0.1)' }}>
                      {isAbs && <div className="absolute inset-0 z-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.9) 4px, rgba(0,0,0,0.9) 8px)' }}></div>}
                      <div className={`relative z-20 ${isAbs ? 'opacity-0' : ''}`}>
                        <span className="font-bold text-slate-800">{course.startTime}</span> <span className="font-semibold text-slate-900">{tClass?.name}</span>
                        {act && <div className="text-[9px] truncate text-slate-800 font-bold">{act.name}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// YEARLY VIEW
// ---------------------------------------------------------
function YearlyView({ selectedTeacher }: any) {
  const { teachers, classes, facilities, courses, activities, scheduledActivities, absences, settings } = useStore();

  const startW = settings?.startWeek || 36;
  const endW = settings?.endWeek || 27;
  const weekNumbers = useMemo(() => getWeekNumbers(startW, endW), [startW, endW]);
  const totalWks = weekNumbers.length;

  const groupedRows = useMemo(() => {
    let allRows = classes.flatMap(c => {
      const classCourses = courses.filter(crs => crs.classId === c.id && !crs.isUnavailability && (selectedTeacher === 'all' || crs.teacherId === selectedTeacher));
      return classCourses.map(course => ({ c, course }));
    });
    
    // Sort by class then day
    const dayOrder: Record<string, number> = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 7 };
    allRows.sort((a, b) => {
      if (a.c.name !== b.c.name) return a.c.name.localeCompare(b.c.name);
      const dayA = dayOrder[a.course.dayOfWeek] || 99;
      const dayB = dayOrder?.[b.course.dayOfWeek] || 99;
      if (dayA !== dayB) return dayA - dayB;
      return a.course.startTime.localeCompare(b.course.startTime);
    });
    return allRows;
  }, [classes, courses, selectedTeacher]);

  const isHoliday = (wk: number) => {
    const calendarWeek = weekNumbers[wk - 1];
    return settings?.holidays?.some(h => {
        const hStart = getWeekNumbers(h.startWeek, h.endWeek);
        return hStart.includes(calendarWeek);
    }) || false;
  };

  const checkIfAbsent = (cId: string, calWk: number) => {
    return absences.some(a => {
      if (a.classId !== cId) return false;
      const aStart = getWeekNumbers(a.startWeek, a.endWeek);
      return aStart.includes(calWk);
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <h2 className="font-bold text-lg text-slate-800">Planification Annuelle</h2>
      </div>
      <div className="flex-1 overflow-auto bg-white p-4">
        {groupedRows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">Aucun cours trouvé pour cet enseignant.</div>
        ) : (
          <div className="inline-block min-w-full pb-10">
            <div className="flex sticky top-0 z-20 bg-white">
              <div className="w-56 shrink-0 border-b-2 border-r-2 border-slate-800 bg-white z-30 shadow-sm flex items-end p-2 pb-3">
                <span className="font-bold text-slate-700 text-sm">Classe / Créneau</span>
              </div>
              <div className="flex">
                {weekNumbers.map((w, i) => (
                  <div key={i} className={`w-10 shrink-0 border-b-2 border-r border-slate-800 flex flex-col items-center justify-end pb-2 ${isHoliday(i + 1) ? 'bg-slate-300' : 'bg-white'}`}>
                    <span className="text-[10px] font-bold rotate-180" style={{ writingMode: 'vertical-rl' }}>Sem {w}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {groupedRows.map((row, idx) => {
              const rowSAs = scheduledActivities.filter(sa => sa.classId === row.c.id || sa.courseId === row.course.id);

              return (
                <div key={idx} className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors">
                  <div className="w-56 shrink-0 border-r-2 border-slate-800 p-2 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] flex flex-col justify-center">
                    <div className="font-bold text-slate-800 text-sm">{row.c.name}</div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {row.course.dayOfWeek} {row.course.startTime}-{row.course.endTime}
                    </div>
                  </div>
                  
                  <div className="flex relative items-center py-1">
                    {weekNumbers.map((w, i) => (
                      <div key={i} className={`w-10 shrink-0 h-full border-r border-slate-100 ${isHoliday(i + 1) ? 'bg-slate-100/80' : ''}`} />
                    ))}
                    
                    {rowSAs.map(sa => {
                      const act = activities.find(a => a.id === sa.activityId);
                      const fac = facilities.find(f => f.id === act?.facilityId);
                      const leftPos = (sa.startWeek - 1) * 40;
                      const width = ((sa.endWeek - sa.startWeek) + 1) * 40;
                      return (
                        <div key={sa.id} className="absolute h-[80%] rounded shadow-sm border overflow-hidden p-1 flex flex-col justify-center" style={{ left: leftPos + 2, width: width - 4, backgroundColor: fac?.color || '#e2e8f0', borderColor: 'rgba(0,0,0,0.1)' }}>
                          <span className="text-[9px] font-bold text-slate-900 leading-tight truncate">{act?.name}</span>
                          <span className="text-[8px] text-slate-700 truncate">{fac?.name}</span>
                        </div>
                      )
                    })}

                    {weekNumbers.map((w, i) => {
                      if (checkIfAbsent(row.c.id, w)) {
                        return (
                          <div key={`abs-${i}`} className="absolute h-[80%] w-10 flex items-center justify-center border-y border-slate-300" style={{ left: i * 40, zIndex: 10, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.9) 4px, rgba(0,0,0,0.9) 8px)' }}>
                          </div>
                        )
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getWeekNumbers(start: number, end: number) {
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
}
