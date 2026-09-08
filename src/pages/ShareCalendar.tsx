import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useFirebaseSync } from '../hooks/useFirebaseSync';
import { useStore } from '../store/useStore';
import { Calendar, ChevronLeft, ChevronRight, User, Printer, LayoutGrid, List } from 'lucide-react';
import { startOfWeek, addDays, getISOWeek, format, subWeeks, addWeeks, addMonths, subMonths, isSameMonth, startOfMonth, endOfMonth, endOfWeek, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Course } from '../types';

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

export default function ShareCalendar() {
  useFirebaseSync();
  const { teachers, classes, facilities, courses, activities, scheduledActivities, absences, settings, loading } = useStore();
  
  const [view, setView] = useState<'weekly' | 'monthly' | 'yearly'>('yearly');
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [groupBy, setGroupBy] = useState<'class' | 'slot'>('class');
  
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTeacherDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const startW = settings?.startWeek || 36;
  const endW = settings?.endWeek || 27;
  const allWeekNumbers = useMemo(() => getWeekNumbers(startW, endW), [startW, endW]);

  
  const allWeekIndices = useMemo(() => allWeekNumbers.map((_, i) => i + 1), [allWeekNumbers]);

  const displayedWeeks = useMemo(() => {
    if (view === 'yearly') return allWeekIndices;
    if (view === 'weekly') {
      const currentCalWk = getISOWeek(currentDate);
      const idx = allWeekNumbers.indexOf(currentCalWk);
      return idx >= 0 ? [idx + 1] : [];
    }
    if (view === 'monthly') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(monthStart);
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const weeksInMonth = Array.from(new Set(daysInMonth.map(d => getISOWeek(d))));
      return allWeekIndices.filter(idx => weeksInMonth.includes(allWeekNumbers[idx - 1]));
    }
    return allWeekIndices;
  }, [view, currentDate, allWeekNumbers, allWeekIndices]);

  const isHoliday = (wkIdx: number) => {
    const calendarWeek = allWeekNumbers[wkIdx - 1];
    return settings?.holidays?.some(h => {
        const hStart = getWeekNumbers(h.startWeek, h.endWeek);
        return hStart.includes(calendarWeek);
    }) || false;
  };

  const checkIfAbsent = (cId: string, wkIdx: number) => {
    const calendarWeek = allWeekNumbers[wkIdx - 1];
    return absences.some(a => {
      if (a.classId !== cId) return false;
      const aStart = getWeekNumbers(a.startWeek, a.endWeek);
      return aStart.includes(calendarWeek);
    });
  };


  const dayOrder: Record<string, number> = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 7 };

  const groupedRows = useMemo(() => {
    let allRows = classes.flatMap(c => {
      const classCourses = courses.filter(crs => crs.classId === c.id && !crs.isUnavailability && (selectedTeachers.length === 0 || selectedTeachers.includes(crs.teacherId)));
      return classCourses.map(course => ({ c, course }));
    });
    
    if (groupBy === 'class') {
      allRows.sort((a, b) => {
        if (a.c.name !== b.c.name) return a.c.name.localeCompare(b.c.name);
        const dayA = dayOrder[a.course.dayOfWeek] || 99;
        const dayB = dayOrder[b.course.dayOfWeek] || 99;
        if (dayA !== dayB) return dayA - dayB;
        return a.course.startTime.localeCompare(b.course.startTime);
      });
    } else {
      allRows.sort((a, b) => {
        const dayA = dayOrder[a.course.dayOfWeek] || 99;
        const dayB = dayOrder[b.course.dayOfWeek] || 99;
        if (dayA !== dayB) return dayA - dayB;
        if (a.course.startTime !== b.course.startTime) return a.course.startTime.localeCompare(b.course.startTime);
        return a.c.name.localeCompare(b.c.name);
      });
    }
    return allRows;
  }, [classes, courses, selectedTeachers, groupBy]);

  
  const executePrint = () => {
     setTimeout(() => {
        const style = document.createElement('style');
        style.innerHTML = `@media print { @page { size: A4 landscape; margin: 5mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`;
        document.head.appendChild(style);
        
        const afterPrint = () => {
           if (document.head.contains(style)) document.head.removeChild(style);
           window.removeEventListener('afterprint', afterPrint);
        };
        window.addEventListener('afterprint', afterPrint);
        
        window.print();
     }, 100);
  };


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Chargement du calendrier...</div>;
  }

  const toggleTeacher = (tId: string) => {
    if (selectedTeachers.includes(tId)) {
      setSelectedTeachers(selectedTeachers.filter(id => id !== tId));
    } else {
      setSelectedTeachers([...selectedTeachers, tId]);
    }
  };

  const currentWkNum = getISOWeek(currentDate);

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-50 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-600" />
          <div>
             <h1 className="text-xl font-bold text-slate-800">Planning Annuel Partagé</h1>
             <p className="text-xs text-slate-500">Lecture seule</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Teacher Multi-Select */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowTeacherDropdown(!showTeacherDropdown)}
              className="flex items-center bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <User className="w-4 h-4 mr-2 text-slate-500" />
              {selectedTeachers.length === 0 ? "Tous les enseignants" : `${selectedTeachers.length} enseignant(s)`}
            </button>
            {showTeacherDropdown && (
               <div className="absolute top-full mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-50 max-h-96 overflow-auto">
                 <div className="p-2 hover:bg-slate-50 rounded cursor-pointer border-b border-slate-100 mb-1" onClick={() => setSelectedTeachers([])}>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-slate-700">
                       <input type="checkbox" checked={selectedTeachers.length === 0} onChange={() => setSelectedTeachers([])} className="rounded text-blue-600" />
                       Tous les enseignants
                    </label>
                 </div>
                 {teachers.map(t => (
                    <div key={t.id} className="p-2 hover:bg-slate-50 rounded cursor-pointer" onClick={() => toggleTeacher(t.id)}>
                       <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                          <input type="checkbox" checked={selectedTeachers.includes(t.id)} readOnly className="rounded text-blue-600" />
                          {t.name}
                       </label>
                    </div>
                 ))}
               </div>
            )}
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(['weekly', 'monthly', 'yearly'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
              >
                {v === 'weekly' ? 'Semaine' : v === 'monthly' ? 'Mois' : 'Année'}
              </button>
            ))}
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setGroupBy('class')}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors ${groupBy === 'class' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <List className="w-4 h-4" /> Par Classe
            </button>
            <button
              onClick={() => setGroupBy('slot')}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors ${groupBy === 'slot' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Par Créneau
            </button>
          </div>

          <button onClick={executePrint} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
            <Printer className="w-4 h-4" /> Imprimer
          </button>

        </div>
      </header>

      {/* Date Navigation for Weekly/Monthly Views */}
      {view !== 'yearly' && (
        <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(view === 'weekly' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1))} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft className="w-5 h-5"/></button>
            <button onClick={() => setCurrentDate(view === 'weekly' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1))} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight className="w-5 h-5"/></button>
            <span className="font-bold text-slate-800 ml-2 capitalize">
              {view === 'weekly' 
                 ? `Semaine ${currentWkNum} (du ${format(startOfWeek(currentDate, {weekStartsOn:1}), 'd MMM')} au ${format(endOfWeek(currentDate, {weekStartsOn:1}), 'd MMM')})`
                 : format(currentDate, 'MMMM yyyy', { locale: fr })}
            </span>
          </div>
          <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">Aujourd'hui</button>
        </div>
      )}

      <main className="flex-1 overflow-hidden p-4 bg-slate-50 print:p-0 print:overflow-visible flex flex-col">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-0 flex-1 animate-in fade-in duration-300 print:shadow-none print:border-none print:rounded-none">
          <div className="overflow-auto flex-1 min-w-full pb-10 print:pb-0 relative">
            {groupedRows.length === 0 ? (
              <div className="flex items-center justify-center p-12 text-slate-400">Aucun cours trouvé pour ces critères.</div>
            ) : displayedWeeks.length === 0 ? (
               <div className="flex items-center justify-center p-12 text-slate-400">Cette période ne contient pas de semaines scolaires planifiées.</div>
            ) : (
              <>
                <div className="flex sticky top-0 z-30 bg-white print:static">
                  <div className="w-48 md:w-56 shrink-0 border-b-2 border-r-2 border-slate-800 bg-white z-40 shadow-sm flex items-end p-2 pb-3 print:border-slate-400 print:shadow-none">
                    <span className="font-bold text-slate-700 text-xs md:text-sm">{groupBy === 'class' ? 'Classe / Créneau' : 'Créneau / Classe'}</span>
                  </div>
                  <div className="flex">
                    {displayedWeeks.map((w, i) => (
                      <div key={i} className="w-10 shrink-0 border-b-2 border-r border-slate-800 flex flex-col items-center justify-end pb-2 print:border-slate-400 bg-white">
                        <span className={`text-[9px] md:text-[10px] font-bold rotate-180 ${isHoliday(w) ? 'text-slate-400' : 'text-slate-800'}`} style={{ writingMode: 'vertical-rl' }}>Sem {allWeekNumbers[w - 1]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {groupedRows.map((row, idx) => {
                  const rowSAs = scheduledActivities.filter(sa => sa.courseId ? sa.courseId === row.course.id : sa.classId === row.c.id);
                  const teacherName = teachers.find(t => t.id === row.course.teacherId)?.name || 'Inconnu';

                  return (
                    <div key={idx} className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors print:break-inside-avoid">
                      <div className="w-48 md:w-56 shrink-0 border-r-2 border-slate-800 p-2 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] flex flex-col justify-center print:border-slate-400 print:shadow-none print:static">
                        <div className="font-bold text-slate-800 text-xs md:text-sm leading-tight">{groupBy === 'class' ? row.c.name : `${row.course.dayOfWeek.substring(0,3)} ${row.course.startTime}`}</div>
                        <div className="text-[9px] md:text-[10px] text-slate-500 font-medium leading-tight">
                          {groupBy === 'class' 
                             ? `${row.course.dayOfWeek} ${row.course.startTime}-${row.course.endTime} ${teacherName}`
                             : `${row.c.name} ${teacherName}`}
                        </div>
                      </div>
                      
                      <div className="flex relative items-center py-1">
                        {displayedWeeks.map((w, i) => (
                          <div key={i} className={`w-10 shrink-0 h-full border-r border-slate-100 print:border-slate-200 relative flex items-center justify-center overflow-hidden ${isHoliday(w) ? 'bg-white z-20' : ''}`}>
    {isHoliday(w) && (
      <span className="text-[9px] text-slate-300 font-medium absolute rotate-180 select-none" style={{ writingMode: 'vertical-rl' }}>vacances</span>
    )}
  </div>
                        ))}
                        
                        {/* Render SAs */}
                        {rowSAs.map(sa => {
                          const act = activities.find(a => a.id === sa.activityId);
                          const fac = facilities.find(f => f.id === act?.facilityId);

                          const blocks = [];
                          let currentBlock = null;
                          for(let w = sa.startWeek; w <= sa.endWeek; w++) {
                            const isAbsent = checkIfAbsent(row.c.id, w);
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
                                const displayStartIdx = displayedWeeks.indexOf(block.start);
                                const displayEndIdx = displayedWeeks.indexOf(block.end);
                                
                                if (displayEndIdx < 0 && block.end < displayedWeeks[0]) return null;
                                if (displayStartIdx < 0 && block.start > displayedWeeks[displayedWeeks.length - 1]) return null;

                                const firstVisibleWk = Math.max(block.start, displayedWeeks[0]);
                                const lastVisibleWk = Math.min(block.end, displayedWeeks[displayedWeeks.length - 1]);
                                
                                const leftIdx = displayedWeeks.indexOf(firstVisibleWk);
                                const rightIdx = displayedWeeks.indexOf(lastVisibleWk);

                                if (leftIdx < 0 || rightIdx < 0) return null;

                                const leftPos = leftIdx * 40;
                                const width = ((rightIdx - leftIdx) + 1) * 40;

                                if (width <= 0) return null;

                                return (
                                  <div key={`${sa.id}-${idx}`} className={`absolute h-[80%] shadow-sm border overflow-hidden p-0.5 flex flex-col justify-center print:border-slate-300 print:shadow-none ${idx === 0 ? 'rounded-l' : ''} ${idx === blocks.length - 1 ? 'rounded-r' : ''} ${idx > 0 && idx < blocks.length - 1 ? 'rounded-none border-x-0' : ''}`} style={{ left: leftPos + 2, width: width - 4, backgroundColor: fac?.color || '#e2e8f0', borderColor: 'rgba(0,0,0,0.1)' }}>
                                    <span className="text-[8px] md:text-[9px] font-bold text-slate-900 leading-tight truncate px-0.5">{act?.name}</span>
                                    <span className="text-[7px] md:text-[8px] text-slate-700 truncate px-0.5 hidden md:block">{fac?.name}</span>
                                  </div>
                                )
                              })}
                            </React.Fragment>
                          )
                        })}
                        {/* Render Absences */}
                        {displayedWeeks.map((w, i) => {
                          if (checkIfAbsent(row.c.id, w)) {
                            return (
                              <div key={`abs-${i}`} className="absolute h-[80%] w-10 flex items-center justify-center border-y border-slate-300 print:border-slate-400" style={{ left: i * 40, zIndex: 10, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.9) 4px, rgba(0,0,0,0.9) 8px)' }}>
                              </div>
                            )
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
