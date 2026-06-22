import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Trash2, Activity as ActivityIcon, CalendarDays, Wand2, Lock, LockOpen, Printer } from "lucide-react";
import { getISOWeek, parseISO } from "date-fns";

export default function Activities() {
  const { activities, absences, classes, facilities, courses, scheduledActivities, settings } = useStore();

  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [newActivityName, setNewActivityName] = useState("");
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

  const executePrintRange = () => {
     setShowPrintModal(false);
     setIsPrintingRange(true);
     setTimeout(() => {
        const style = document.createElement('style');
        style.innerHTML = `@media print { @page { size: landscape; margin: 5mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`;
        document.head.appendChild(style);
        window.print();
        document.head.removeChild(style);
        // Wait a frame before restoring so Safari/Chrome print dialogs don't break layout instantly
        setTimeout(() => setIsPrintingRange(false), 500);
     }, 100);
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

  const toggleClass = (classId: string) => {
    setNewActivityClasses(prev => 
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const addActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityName || !newActivityFacility || newActivityClasses.length === 0) {
      alert("Veuillez remplir tous les champs (nom, installation, et au moins une classe).");
      return;
    }
    const data = {
      name: newActivityName,
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
    if (confirm("Supprimer cette activité ?")) {
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

      const checkOverlap = (c1Id: string, c2Id: string) => {
        const cs1 = courses.filter(c => c.classId === c1Id);
        const cs2 = courses.filter(c => c.classId === c2Id);
        for(const c1 of cs1) {
          for(const c2 of cs2) {
            if (c1.dayOfWeek === c2.dayOfWeek) {
              const start1 = timeToMin(c1.startTime);
              const end1 = timeToMin(c1.endTime);
              const start2 = timeToMin(c2.startTime);
              const end2 = timeToMin(c2.endTime);
              if (start1 < end2 && end1 > start2) return true;
            }
          }
        }
        return false;
      };

      const allocations: Record<string, Record<number, string[]>> = {};
      
      // Initialize allocations with locked SAs
      for (const sa of lockedSAs) {
         const act = activities.find(a => a.id === sa.activityId);
         if (!act) continue;
         const facId = act.facilityId;
         for (let w = sa.startWeek; w <= sa.endWeek; w++) {
            if (!allocations[facId]) allocations[facId] = {};
            if (!allocations[facId][w]) allocations[facId][w] = [];
            allocations[facId][w].push(sa.classId);
         }
      }

      const toPlace = [];
      for (const a of activities) {
        for (const cid of a.classIds) {
          // Check if it's already locked
          const isAlreadyLocked = lockedSAs.some(sa => sa.activityId === a.id && sa.classId === cid);
          if (!isAlreadyLocked) {
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
        const facId = activity.facilityId;
        
        let bestStart = 1;
        let bestEnd = dur;
        let placed = false;

        let prefStartIdx = 0;
        let prefEndIdx = 0;
        if (activity.preferredStartWeek && activity.preferredEndWeek) {
           prefStartIdx = weekNumbers.indexOf(activity.preferredStartWeek) + 1;
           prefEndIdx = weekNumbers.indexOf(activity.preferredEndWeek) + 1;
        }

        for (let w = 1; w <= totalWks; w++) {
          if (isHoliday(w)) continue;

          // Mandatory constraint check
          if (activity.isMandatoryPeriod && prefStartIdx > 0 && prefEndIdx > 0) {
            if (w < prefStartIdx || w > prefEndIdx) continue;
          }

          let canPlace = true;
          let teachingWeeks = 0;
          let currWeek = w;

          while (teachingWeeks < dur && currWeek <= totalWks) {
            const isAbsent = absences.some(a => a.classId === classId && weekNumbers[currWeek - 1] >= a.startWeek && weekNumbers[currWeek - 1] <= a.endWeek);
            if (isHoliday(currWeek) || isAbsent) {
              currWeek++;
              continue;
            }

            const inFac = allocations[facId]?.[currWeek] || [];
            const overlappingClasses = inFac.filter(otherC => checkOverlap(classId, otherC));
            const facility = facilities.find(f => f.id === facId);
            const maxCapacity = activity.maxCapacity || facility?.capacity || 1;

            if (overlappingClasses.length >= maxCapacity) {
               canPlace = false;
               break;
            }
            const isBusyElsewhere = Object.values(allocations).some(facWg => facWg[currWeek]?.includes(classId));
            if (isBusyElsewhere) {
               canPlace = false;
               break;
            }
            
            teachingWeeks++;
            if (teachingWeeks < dur) currWeek++;
          }

          if (canPlace && teachingWeeks === dur) {
            bestStart = w;
            bestEnd = currWeek;
            placed = true;
            break;
          }
        }

        if (placed) {
          let tWk = 0;
          let cw = bestStart;
          while (tWk < dur && cw <= bestEnd) {
             const isAbsent = absences.some(a => a.classId === classId && weekNumbers[cw - 1] >= a.startWeek && weekNumbers[cw - 1] <= a.endWeek);
             if (!isHoliday(cw) && !isAbsent) {
               if (!allocations[facId]) allocations[facId] = {};
               if (!allocations[facId][cw]) allocations[facId][cw] = [];
               allocations[facId][cw].push(classId);
               tWk++;
             }
             cw++;
          }
          toSave.push({ activityId: activity.id, classId, startWeek: bestStart, endWeek: bestEnd });
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
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Activités & Absences</h2>
        <p className="text-slate-500 text-sm mt-1">Définissez les activités, temps de cycle, installations pour la répartition automatique.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Activities */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 inline-flex items-center gap-2">
            <ActivityIcon className="w-4 h-4" /> Activités & Cycles
          </h3>
          <ul className="space-y-2 mb-6 max-h-60 overflow-y-auto">
            {activities.map(a => {
              const fac = facilities.find(f => f.id === a.facilityId);
              const clsNames = a.classIds.map(id => classes.find(c => c.id === id)?.name).filter(Boolean).join(", ");
              return (
                <li key={a.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200 group">
                  <div className="pr-4">
                    <span className="text-sm font-medium">{a.name}</span> <span className="text-xs text-slate-400">({a.durationWeeks} sem.)</span>
                    <div className="text-[10px] text-slate-500 mt-1">
                      <span className="font-semibold text-slate-600">Lieu:</span> {fac?.name || '?'} <br/>
                      <span className="font-semibold text-slate-600">Simultanée:</span> {a.maxCapacity || fac?.capacity || 1} classe(s) <br/>
                      {a.preferredStartWeek && a.preferredEndWeek && <><span className="font-semibold text-slate-600">Période:</span> S{a.preferredStartWeek}-S{a.preferredEndWeek} <br/></>}
                      {a.isMandatoryPeriod && <><span className="text-red-600 font-semibold text-[9px] uppercase">Période imposée</span><br/></>}
                      {a.groupCycles && <><span className="text-blue-600 font-semibold text-[9px] uppercase">Mise en place importante (Groupé)</span><br/></>}
                      <span className="font-semibold text-slate-600">Classes:</span> <span className="text-slate-400">{clsNames || 'Aucune'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => editActivity(a)} className="text-slate-400 hover:text-blue-600">
                      <span className="text-xs font-semibold mr-2 border border-slate-200 px-2 py-1 rounded bg-white">Éditer</span>
                    </button>
                    <button onClick={() => deleteActivity(a.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
            {activities.length === 0 && <p className="text-sm text-slate-400 italic">Aucune activité définie.</p>}
          </ul>

          <form onSubmit={addActivity} className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-600 uppercase">Nouvelle Activité</h4>
            <input value={newActivityName} onChange={e=>setNewActivityName(e.target.value)} placeholder="Nom de l'activité (ex: Basket)" className="form-input w-full text-sm rounded-md border-slate-300" required />
            
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 shrink-0 w-24">Durée (sem.)</label>
              <input type="number" min="1" max="52" value={newActivityDuration} onChange={e=>setNewActivityDuration(parseInt(e.target.value))} className="form-input flex-1 text-sm rounded-md border-slate-300" required />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 shrink-0 w-24" title="Nombre de classes en simultané pour cette activité">Capacité simul.</label>
              <input type="number" min="1" value={newActivityMaxCapacity} onChange={e=>setNewActivityMaxCapacity(parseInt(e.target.value))} className="form-input flex-1 text-sm rounded-md border-slate-300" required />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 shrink-0 w-24">Installation</label>
              <select value={newActivityFacility} onChange={e=>setNewActivityFacility(e.target.value)} className="form-select flex-1 text-sm rounded-md border-slate-300 bg-white" required>
                <option value="">-- Choisir --</option>
                {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <label className="text-xs font-medium text-slate-600 shrink-0 w-24">Période id. S.</label>
              <input type="number" min="1" max="52" value={newActivityPrefStart} onChange={e=>setNewActivityPrefStart(e.target.value ? parseInt(e.target.value) : '')} placeholder="ex: 1" className="form-input flex-1 text-sm rounded-md border-slate-300" />
              <span className="text-sm text-slate-400">à</span>
              <input type="number" min="1" max="52" value={newActivityPrefEnd} onChange={e=>setNewActivityPrefEnd(e.target.value ? parseInt(e.target.value) : '')} placeholder="ex: 12" className="form-input flex-1 text-sm rounded-md border-slate-300" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input type="checkbox" checked={newActivityGroup} onChange={e => setNewActivityGroup(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                Regrouper idéalement les cycles (installation importante)
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input type="checkbox" checked={newActivityMandatory} onChange={e => setNewActivityMandatory(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                Bloquer obligatoirement sur cette période (ex: Piscine)
              </label>
            </div>

            <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
              <label className="text-xs font-medium text-slate-600">Classes concernées</label>
              <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
                {classes.map(c => (
                  <label key={c.id} className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 px-2 py-1 rounded cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={newActivityClasses.includes(c.id)} onChange={() => toggleClass(c.id)} className="rounded text-blue-600 focus:ring-blue-500" />
                    <span>{c.name}</span>
                  </label>
                ))}
                {classes.length === 0 && <span className="text-[10px] text-slate-400">Aucune classe disponible</span>}
              </div>
            </div>

            <div className="flex gap-2">
              {editingActivityId && (
                <button type="button" onClick={resetForm} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium transition-colors">
                  Annuler
                </button>
              )}
              <button type="submit" className="flex-[2] bg-slate-800 text-white font-medium py-2 rounded-md text-sm hover:bg-slate-900 flex justify-center items-center gap-2 shadow-sm">
                <Plus className="w-4 h-4" /> {editingActivityId ? "Enregistrer" : "Ajouter l'activité"}
              </button>
            </div>
          </form>
        </section>

        {/* Absences */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 inline-flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Classes en Stage / Absences
          </h3>
          <ul className="space-y-2 mb-6 max-h-60 overflow-y-auto">
            {absences.map(a => {
              const cls = classes.find(c => c.id === a.classId);
              return (
                <li key={a.id} className="flex items-center justify-between p-2 bg-blue-50/50 rounded border border-blue-100 group">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <div>
                      <span className="text-sm font-medium">{cls?.name || 'Classe inconnue'} <span className="font-normal text-slate-500">— {a.reason}</span></span>
                      <div className="text-[10px] text-slate-400">Sem. {a.startWeek}-{a.endWeek}</div>
                    </div>
                  </div>
                  <button onClick={() => deleteDoc(doc(db, "absences", a.id))} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
            {absences.length === 0 && (
              <div className="flex items-center gap-2 p-2 opacity-50">
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                <span className="text-sm flex-1 italic text-slate-500">Ajouter une classe...</span>
              </div>
            )}
          </ul>

          <form onSubmit={addAbsence} className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-600 uppercase">Nouvelle absence</h4>
            <select value={selClassId} onChange={e=>setSelClassId(e.target.value)} className="form-select w-full text-sm rounded-md border-slate-300 bg-white" required>
              <option value="">Sélectionner une classe</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={absReason} onChange={e=>setAbsReason(e.target.value)} placeholder="Motif (ex: Stage)" className="form-input w-full text-sm rounded-md border-slate-300" required />
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="52" value={absStart} onChange={e=>setAbsStart(parseInt(e.target.value))} className="form-input flex-1 text-sm rounded-md border-slate-300" required />
              <span className="text-sm text-slate-400">à</span>
              <input type="number" min="1" max="52" value={absEnd} onChange={e=>setAbsEnd(parseInt(e.target.value))} className="form-input flex-1 text-sm rounded-md border-slate-300" required />
            </div>
            <button type="submit" className="w-full bg-slate-800 text-white font-medium py-2 rounded-md text-sm hover:bg-slate-900 flex justify-center items-center gap-2 shadow-sm">
              <Plus className="w-4 h-4" /> Planifier
            </button>
          </form>
        </section>
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
              
              <div className="space-y-3">
                {classes.map(c => {
                  const mySAs = scheduledActivities.filter(sa => sa.classId === c.id);
                  if (mySAs.length === 0) return null;
                  
                  return (
                    <div key={c.id} className="flex items-center min-h-[32px] print:min-h-[28px]">
                      <div className="w-32 print:w-24 shrink-0 text-sm font-medium text-slate-800 flex flex-col justify-center">
                         <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                           <span className="print:text-xs">{c.name}</span>
                         </div>
                         {c.level === 'Terminale' && c.catchUpDate && (
                           <div className="text-[9px] text-slate-400 truncate mt-0.5 print:hidden" title={`Rattrapages: ${c.catchUpDate}`}>Rattrapage: {c.catchUpDate}</div>
                         )}
                         {c.level === 'Terminale' && c.ccfDeadline && (
                           <div className="text-[9px] text-slate-400 truncate mt-0.5" title={`Arrêt CCF: ${c.ccfDeadline}`}>CCF: {c.ccfDeadline}</div>
                         )}
                      </div>
                      <div className="flex-1 flex relative h-8 print:h-6 bg-slate-50 print:bg-white rounded-md border border-slate-100 overflow-hidden">
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
                            const isAbsent = absences.some(a => a.classId === c.id && weekNumbers[w - 1] >= a.startWeek && weekNumbers[w - 1] <= a.endWeek);
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
              <p className="text-sm text-slate-600">Sélectionnez la plage de semaines (internes, de 1 à {totalWks}) que vous souhaitez afficher sur la page.</p>
              
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
    </div>
  );
}
