import React, { useState, useMemo } from 'react';
import { X, Search, Calendar, MapPin, Plus, Check } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../store/useStore';

export function EmptyPeriodsModal({ onClose, weekNumbers, isHoliday, checkIfAbsent, totalWks, groupedRows }) {
  const { activities, facilities, scheduledActivities, courses } = useStore();
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [selectedFacility, setSelectedFacility] = useState<string>("");
  const [selectedActivity, setSelectedActivity] = useState<string>("");

  const emptyBlocks = useMemo(() => {
    const blocks: any[] = [];
    groupedRows.forEach((row: any) => {
      let currentBlock: any = null;
      const courseSAs = scheduledActivities.filter(sa => sa.courseId === row.course.id);
      
      for (let w = 1; w <= totalWks; w++) {
        const calWk = weekNumbers[w - 1];
        if (isHoliday(w) || checkIfAbsent(row.c.id, w, calWk)) {
          if (currentBlock) {
            blocks.push(currentBlock);
            currentBlock = null;
          }
          continue;
        }
        
        const hasActivity = courseSAs.some(sa => w >= sa.startWeek && w <= sa.endWeek);
        if (!hasActivity) {
          if (!currentBlock) {
            currentBlock = { row, startWeek: w, endWeek: w };
          } else {
            currentBlock.endWeek = w;
          }
        } else {
          if (currentBlock) {
            blocks.push(currentBlock);
            currentBlock = null;
          }
        }
      }
      if (currentBlock) blocks.push(currentBlock);
    });
    return blocks;
  }, [groupedRows, scheduledActivities, totalWks, weekNumbers, isHoliday, checkIfAbsent]);

  const handleProgram = async () => {
    if (!selectedBlock || !selectedActivity) return;
    try {
      await addDoc(collection(db, "scheduledActivities"), {
        activityId: selectedActivity,
        classId: selectedBlock.row.c.id,
        courseId: selectedBlock.row.course.id,
        startWeek: selectedBlock.startWeek,
        endWeek: selectedBlock.endWeek,
        isLocked: true
      });
      setSelectedBlock(null);
      setSelectedFacility("");
      setSelectedActivity("");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la programmation.");
    }
  };

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

  const getAvailableFacilities = (block: any) => {
    return facilities.map(fac => {
      let maxOverlaps = 0;
      for (let w = block.startWeek; w <= block.endWeek; w++) {
        if (isHoliday(w) || checkIfAbsent(block.row.c.id, w, weekNumbers[w-1])) continue;
        
        const overlappingSAs = scheduledActivities.filter(sa => {
          if (w < sa.startWeek || w > sa.endWeek) return false;
          const saAct = activities.find(a => a.id === sa.activityId);
          if (saAct?.facilityId !== fac.id) return false;
          
          const saCourse = courses.find(c => c.id === sa.courseId);
          if (!saCourse) return false;
          
          return checkCourseOverlap(block.row.course, saCourse);
        });
        
        if (overlappingSAs.length > maxOverlaps) {
          maxOverlaps = overlappingSAs.length;
        }
      }
      return { facility: fac, overlaps: maxOverlaps };
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-end z-50">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-slate-800 text-lg">Périodes sans activités</h2>
          <button onClick={onClose} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full transition-colors"><X className="w-5 h-5"/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {!selectedBlock ? (
            emptyBlocks.length === 0 ? (
              <p className="text-sm text-slate-500 text-center mt-10">Aucune période vide ! Tout est planifié.</p>
            ) : (
              emptyBlocks.map((block, idx) => (
                <div key={idx} onClick={() => setSelectedBlock(block)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800">{block.row.c.name}</h3>
                    <span className="text-xs font-semibold px-2 py-1 bg-amber-100 text-amber-700 rounded-md">Sem {weekNumbers[block.startWeek-1]} à {weekNumbers[block.endWeek-1]}</span>
                  </div>
                  <p className="text-sm text-slate-600 flex items-center gap-2">
                    <Calendar className="w-4 h-4"/> {block.row.course.dayOfWeek} {block.row.course.startTime}-{block.row.course.endTime}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">Durée : {block.endWeek - block.startWeek + 1} semaines</p>
                </div>
              ))
            )
          ) : (
            <div className="space-y-6">
              <button onClick={() => { setSelectedBlock(null); setSelectedFacility(""); setSelectedActivity(""); }} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1">
                &larr; Retour aux périodes
              </button>
              
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800">{selectedBlock.row.c.name}</h3>
                <p className="text-sm text-slate-600">{selectedBlock.row.course.dayOfWeek} {selectedBlock.row.course.startTime}-{selectedBlock.row.course.endTime}</p>
                <p className="text-xs font-semibold mt-1 text-amber-600">Semaines {weekNumbers[selectedBlock.startWeek-1]} à {weekNumbers[selectedBlock.endWeek-1]}</p>
              </div>

              {!selectedFacility ? (
                <div>
                  <h4 className="font-bold text-slate-700 mb-3 text-sm">Choisir un lieu disponible</h4>
                  <div className="space-y-2">
                    {getAvailableFacilities(selectedBlock).map(item => (
                      <button 
                        key={item.facility.id} 
                        onClick={() => setSelectedFacility(item.facility.id)}
                        className={`w-full text-left p-3 rounded-lg border flex items-center justify-between transition-colors ${item.overlaps > 0 ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-300 hover:border-blue-400'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full" style={{backgroundColor: item.facility.color}}></div>
                          <span className="font-medium text-slate-700">{item.facility.name}</span>
                        </div>
                        {item.overlaps > 0 ? (
                          <span className="text-xs font-semibold text-red-500">Occupé ({item.overlaps})</span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-600">Libre</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="font-bold text-slate-700 mb-3 text-sm">Choisir l'activité</h4>
                  <div className="space-y-2">
                    {activities.filter(a => a.facilityId === selectedFacility && (a.classIds.includes(selectedBlock.row.c.id) || a.classIds.length === 0)).map(act => (
                      <button
                        key={act.id}
                        onClick={() => setSelectedActivity(act.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedActivity === act.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                      >
                        <span className="font-medium text-slate-800">{act.name}</span>
                        <span className="block text-xs text-slate-500 mt-1">Durée type: {act.durationWeeks} sem.</span>
                      </button>
                    ))}
                    {activities.filter(a => a.facilityId === selectedFacility && (a.classIds.includes(selectedBlock.row.c.id) || a.classIds.length === 0)).length === 0 && (
                      <p className="text-sm text-slate-500 italic">Aucune activité configurée pour ce lieu (et cette classe).</p>
                    )}
                  </div>
                  
                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setSelectedFacility("")} className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                      Changer de lieu
                    </button>
                    <button 
                      onClick={handleProgram}
                      disabled={!selectedActivity}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Programmer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
