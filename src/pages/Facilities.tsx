import { useState } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Wand2, AlertTriangle, ShieldCheck } from "lucide-react";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const TIME_START = 8;
const TIME_END = 18;
const PX_PER_MINUTE = 1;

export default function Facilities() {
  const { facilities, courses, classes, teachers } = useStore();
  const [optimizing, setOptimizing] = useState(false);

  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const checkOverlap = (c1: any, c2: any) => {
    if (c1.dayOfWeek !== c2.dayOfWeek) return false;
    const s1 = timeToMinutes(c1.startTime);
    const e1 = timeToMinutes(c1.endTime);
    const s2 = timeToMinutes(c2.startTime);
    const e2 = timeToMinutes(c2.endTime);
    return Math.max(s1, s2) < Math.min(e1, e2);
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      // Very basic algorithm:
      // Group courses by day.
      // Sort by start time.
      // Assign the first available facility to each course, skipping those already locked/assigned manually if we want (we will overwrite all for simplicity).
      
      const newAssignments: { id: string, fId: string }[] = [];
      const facilityIds = facilities.map(f => f.id);

      if (facilityIds.length === 0) {
        alert("Veuillez d'abord créer des installations dans les paramètres.");
        setOptimizing(false);
        return;
      }

      for (const day of DAYS) {
        const dayCourses = courses.filter(c => c.dayOfWeek === day).sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        
        for (const course of dayCourses) {
          // Find overlapping courses that are already assigned a facility in this loop
          const overlappingAssigned = dayCourses.filter(other => 
            other.id !== course.id && 
            checkOverlap(course, other) &&
            newAssignments.find(na => na.id === other.id)
          );
          
          const usedFacilityIds = overlappingAssigned.map(other => newAssignments.find(na => na.id === other.id)!.fId);
          
          // Pick a facility that is NOT used
          const availableFacs = facilityIds.filter(fid => !usedFacilityIds.includes(fid));
          let chosenFac = availableFacs[0];
          
          // If no facility is free, pick the first one (fallback collision)
          if (!chosenFac) chosenFac = facilityIds[0];
          
          newAssignments.push({ id: course.id, fId: chosenFac });
        }
      }

      // Commit to Firestore
      for (const assignment of newAssignments) {
        await updateDoc(doc(db, "courses", assignment.id), { facilityId: assignment.fId });
      }

    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'optimisation.");
    }
    setOptimizing(false);
  };

  const emptyFacilities = Object.values(courses).filter(c => !c.facilityId).length;
  const overlapsFound = false; // Note: We could compute overlapping facility usage here for the warning

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="p-6 bg-white border-b border-slate-200 shrink-0 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Répartition des Installations</h2>
          <p className="text-slate-500 text-sm mt-1">
            Visualisez et optimisez l'occupation des gymnases, terrains, salles.
          </p>
        </div>
        <button 
          onClick={handleOptimize}
          disabled={optimizing}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-colors"
        >
          <Wand2 className="w-4 h-4" />
          {optimizing ? "Optimisation..." : "Mouliner & Optimiser"}
        </button>
      </header>

      {emptyFacilities > 0 && (
        <div className="bg-amber-50 border-b border-amber-100 p-3 flex items-center justify-center gap-2 text-amber-800 text-sm font-medium shrink-0">
          <AlertTriangle className="w-4 h-4" />
          Il y a {emptyFacilities} cours sans installation. Lancez l'optimisation.
        </div>
      )}

      <div className="flex-1 overflow-auto bg-slate-100 p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          
          {facilities.map(facility => (
            <div key={facility.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: facility.color }} />
                <h3 className="font-bold text-slate-800">{facility.name}</h3>
              </div>
              
              <div className="p-4 flex gap-4 overflow-x-auto">
                <div className="w-12 shrink-0 relative mt-6">
                  {Array.from({ length: TIME_END - TIME_START + 1 }).map((_, i) => (
                    <div key={i} className="absolute w-full text-right pr-2 text-[10px] text-slate-400 font-medium font-mono" style={{ top: i * 60 * PX_PER_MINUTE - 6 }}>
                      {TIME_START + i}h
                    </div>
                  ))}
                </div>
                
                <div className="flex flex-1 gap-2 min-w-[500px] mt-6">
                  {DAYS.map(day => (
                    <div key={day} className="flex-1 relative border-l border-slate-100/70" style={{ minHeight: (TIME_END - TIME_START) * 60 * PX_PER_MINUTE }}>
                      <div className="absolute -top-6 left-0 right-0 text-center text-xs font-semibold text-slate-500 uppercase tracking-widest">{day.slice(0,3)}</div>
                      
                      {courses.filter(c => c.facilityId === facility.id && c.dayOfWeek === day).map(course => {
                        const startMin = timeToMinutes(course.startTime) - TIME_START * 60;
                        const durMin = timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
                        const tClass = classes.find(c => c.id === course.classId);
                        
                        return (
                          <div
                            key={course.id}
                            className="absolute left-1 right-1 rounded p-1 border shadow-sm flex flex-col justify-center items-center text-center overflow-hidden"
                            style={{
                              top: startMin * PX_PER_MINUTE,
                              height: durMin * PX_PER_MINUTE,
                              backgroundColor: tClass?.color ? `${tClass.color}20` : '#f1f5f9',
                              borderColor: tClass?.color ? `${tClass.color}40` : '#cbd5e1',
                              color: tClass?.color ? tClass.color : '#475569'
                            }}
                          >
                            <span className="text-xs font-bold leading-tight">{tClass?.name}</span>
                            <span className="text-[9px] font-mono font-medium opacity-80 mt-0.5">{course.startTime}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {facilities.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400">
              <ShieldCheck className="w-12 h-12 mb-4 opacity-50" />
              <p>Aucune installation enregistrée. Rendez-vous dans Paramètres.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
