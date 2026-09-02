import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Course } from '../types';
import { db } from '../lib/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { getISOWeek } from 'date-fns';

export default function Import() {
  const { teachers, classes, facilities, courses, absences, scheduledActivities, activities } = useStore();
  const [deleteTarget, setDeleteTarget] = useState<string>('');
  const [deleteStep, setDeleteStep] = useState<number>(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'loading'; message: string }>({ type: 'idle', message: '' });

  const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  
  const handleDelete = async () => {
    if (deleteStep !== 2) return;
    setIsDeleting(true);
    setStatus({ type: 'loading', message: 'Suppression en cours...' });

    try {
      const batch = writeBatch(db);
      let coursesToDelete = [];

      if (deleteTarget === 'all') {
        coursesToDelete = courses;
      } else if (deleteTarget) {
        coursesToDelete = courses.filter(c => c.teacherId === deleteTarget);
      }

      // Delete the courses
      coursesToDelete.forEach(c => {
        batch.delete(doc(db, "courses", c.id));
      });

      // Cleanup orphan classes
      const remainingCourses = courses.filter(c => !coursesToDelete.some(d => d.id === c.id));
      const classIdsInUse = new Set(remainingCourses.map(c => c.classId));
      
      const orphanClasses = classes.filter(c => !classIdsInUse.has(c.id));
      orphanClasses.forEach(c => {
        batch.delete(doc(db, "classes", c.id));
        
        // Also cleanup associated absences and scheduledActivities
        absences.filter(a => a.classId === c.id).forEach(a => {
           batch.delete(doc(db, "absences", a.id));
        });
        scheduledActivities.filter(sa => sa.classId === c.id).forEach(sa => {
           batch.delete(doc(db, "scheduledActivities", sa.id));
        });
        
        // Cleanup activities classIds
        activities.forEach(act => {
           if (act.classIds?.includes(c.id)) {
              const newIds = act.classIds.filter((id) => id !== c.id);
              batch.update(doc(db, "activities", act.id), { classIds: newIds });
           }
        });
      });

      await batch.commit();
      
      setStatus({ type: 'success', message: `Suppression réussie ! ${coursesToDelete.length} créneaux et ${orphanClasses.length} classes orphelines supprimés.` });
    } catch(err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Erreur lors de la suppression.' });
    } finally {
      setIsDeleting(false);
      setDeleteStep(0);
      setDeleteTarget('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file);
  };

  const parseICSDate = (dateStr: string) => {
    if (!dateStr) return null;
    const match = dateStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/);
    if (!match) return null;

    try {
      const [_, year, month, day, hour, min, sec, isUTC] = match;
      if (isUTC) {
        return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec)));
      } else {
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec));
      }
    } catch {
      return null;
    }
  };

  const handleImport = async () => {
    if (!selectedTeacherId) {
      setStatus({ type: 'error', message: 'Veuillez sélectionner un enseignant.' });
      return;
    }
    if (!fileContent) {
      setStatus({ type: 'error', message: 'Veuillez sélectionner un fichier .ics' });
      return;
    }

    try {
      const lines = fileContent.split(/\r?\n/);
      const events: any[] = [];
      let currentEvent: any = null;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
          i++;
          line += lines[i].substring(1);
        }

        if (line.startsWith('BEGIN:VEVENT')) {
          currentEvent = {};
        } else if (line.startsWith('END:VEVENT')) {
          if (currentEvent) events.push(currentEvent);
          currentEvent = null;
        } else if (currentEvent) {
          const splitIdx = line.indexOf(':');
          if (splitIdx > -1) {
            const keyRaw = line.substring(0, splitIdx);
            const value = line.substring(splitIdx + 1);
            const key = keyRaw.split(';')[0];
            currentEvent[key] = value;
          }
        }
      }

      const newCourses: Course[] = [...courses];
      let newClasses = [...classes];
      let importedCount = 0;

      // Group slots by time and class to detect week parity
      const groupedSlots = new Map<string, { weeks: Set<number>, dayOfWeek: string, startTime: string, endTime: string, className: string, facilityId: string }>();

      events.forEach(ev => {
        const start = parseICSDate(ev.DTSTART);
        const end = parseICSDate(ev.DTEND);
        
        if (!start || !end) return;

        const dayOfWeek = DAYS[start.getDay()];
        const startTimeStr = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
        const endTimeStr = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
        const weekNum = getISOWeek(start);

        const rawSummary = (ev.SUMMARY || '').replace(/\\n/g, ' ').replace(/\\,/g, ',');
        const location = (ev.LOCATION || '').replace(/\\n/g, ' ').replace(/\\,/g, ',').trim();
        
        // Skip unavailabilities
        if (rawSummary.toLowerCase().includes('indisponible') || rawSummary.toLowerCase().includes('ferié') || rawSummary.toLowerCase().includes('vacances')) {
          return;
        }

        const rawDescParts = (ev.DESCRIPTION || '').split(/\\n/);
        let className = "";
        
        for (const part of rawDescParts) {
           const cleanPart = part.replace(/\\,/g, ',');
           if (cleanPart.toLowerCase().startsWith('classe') || cleanPart.toLowerCase().startsWith('classes')) {
              className = cleanPart.split(':')[1]?.trim() || '';
              break;
           }
           if (cleanPart.toLowerCase().startsWith('groupe') || cleanPart.toLowerCase().startsWith('groupes')) {
              className = cleanPart.split(':')[1]?.trim() || '';
              break;
           }
        }
        
        if (!className) {
            const parts = rawSummary.split('-').map(p => p.trim());
            const maybeClass = parts.find(p => /[0-9]/.test(p) || p.toLowerCase().includes('eme') || p.toLowerCase().includes('nde')) || parts.pop() || rawSummary.trim();
            className = maybeClass;
            
            if (className.length > 20) {
                className = className.substring(0, 20).trim();
            }
        }
        
        if (!className) className = "Classe Inconnue";

        let facilityId = "";
        if (location) {
           const fac = facilities.find(f => f.name.toLowerCase() === location.toLowerCase());
           if (fac) facilityId = fac.id;
        }

        const slotKey = `${dayOfWeek}-${startTimeStr}-${endTimeStr}-${className}`;
        if (!groupedSlots.has(slotKey)) {
           groupedSlots.set(slotKey, { weeks: new Set(), dayOfWeek, startTime: startTimeStr, endTime: endTimeStr, className, facilityId });
        }
        groupedSlots.get(slotKey)!.weeks.add(weekNum);
      });

      groupedSlots.forEach((slotData) => {
        // Determine week type
        let weekType: 'ALL' | 'A' | 'B' = 'ALL';
        const weeksArray = Array.from(slotData.weeks);
        
        // Check if there are weeks specified and we have a small sample size that makes it look like A or B
        if (weeksArray.length > 0) {
           const allEven = weeksArray.every(w => w % 2 === 0);
           const allOdd = weeksArray.every(w => w % 2 !== 0);
           if (allEven) weekType = 'A';
           else if (allOdd) weekType = 'B';
        }

        // Find or create class
        let classObj = newClasses.find(c => c.name.toLowerCase() === slotData.className.toLowerCase());
        if (!classObj) {
          classObj = {
            id: `class-${Date.now()}-${Math.random().toString(36).substring(2,9)}`,
            name: slotData.className,
            color: '#e2e8f0', // default gray
            level: '',
          };
          newClasses.push(classObj);
        }

        newCourses.push({
          id: `course-${Date.now()}-${Math.random().toString(36).substring(2,9)}`,
          teacherId: selectedTeacherId,
          classId: classObj.id,
          facilityId: slotData.facilityId,
          dayOfWeek: slotData.dayOfWeek,
          startTime: slotData.startTime,
          endTime: slotData.endTime,
          isUnavailability: false,
          weekType: weekType
        });

        importedCount++;
      });

      setStatus({ type: 'loading', message: `Sauvegarde de ${importedCount} créneaux en cours...` });

      const batch = writeBatch(db);

      // Add new classes
      const newCreatedClasses = newClasses.filter(c => !classes.some(existing => existing.id === c.id));
      newCreatedClasses.forEach(c => {
        const docRef = doc(collection(db, "classes"));
        c.id = docRef.id; // Assign real firestore ID
        batch.set(docRef, c);
      });

      // We need to update the courses array with the new class IDs if they were just created
      const coursesToSave = newCourses.filter(c => !courses.some(existing => existing.id === c.id));
      coursesToSave.forEach(course => {
        // Find if this course's classId matches one of the new classes (using the old temporary ID)
        const matchedNewClass = newCreatedClasses.find(c => c.name === newClasses.find(nc => nc.id === course.classId)?.name);
        if (matchedNewClass) {
          course.classId = matchedNewClass.id;
        }

        const docRef = doc(collection(db, "courses"));
        course.id = docRef.id;
        batch.set(docRef, course);
      });

      await batch.commit();

      setStatus({ type: 'success', message: `${importedCount} créneaux importés et sauvegardés avec succès !` });
      setFileContent('');

    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Erreur lors du traitement du fichier. Assurez-vous qu\'il s\'agit d\'un fichier .ics valide.' });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Importation des emplois du temps</h1>
        <p className="text-sm text-slate-500 mt-1">Importez vos fichiers .ical / .ics exportés depuis Pronote ou autre logiciel.</p>
      </header>

      <div className="p-6 flex-1 overflow-auto">
        <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          
          {status.type !== 'idle' && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <p className="text-sm font-medium">{status.message}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">1. Sélectionnez l'enseignant</label>
            <select 
              value={selectedTeacherId} 
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full form-select rounded-md border-slate-300 shadow-sm"
            >
              <option value="">-- Choisir un enseignant --</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">2. Fichier d'emploi du temps (.ics / .ical)</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors relative">
              <input 
                type="file" 
                accept=".ics,.ical,text/calendar" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">
                {fileContent ? 'Fichier chargé. Prêt à importer.' : 'Cliquez ou glissez-déposez un fichier ici'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Format iCalendar (.ics)</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button 
              onClick={handleImport}
              disabled={!fileContent || !selectedTeacherId}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium shadow-sm transition-colors"
            >
              Lancer l'importation
            </button>
          </div>
        </div>

        
        <div className="mt-8 max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center gap-2">
             <AlertTriangle className="w-5 h-5 text-red-600" />
             <h2 className="text-base font-bold text-red-800">Zone de danger (Suppression)</h2>
          </div>
          <div className="p-6 space-y-4">
             <p className="text-sm text-slate-600">
               Vous pouvez supprimer les emplois du temps importés. Cela nettoiera automatiquement les classes qui ne sont plus associées à aucun créneau.
             </p>
             
             <div className="flex gap-4 items-end">
               <div className="flex-1">
                 <label className="block text-xs font-semibold text-slate-700 mb-2">Cible de la suppression</label>
                 <select 
                   value={deleteTarget} 
                   onChange={(e) => {
                     setDeleteTarget(e.target.value);
                     setDeleteStep(0);
                   }}
                   className="w-full form-select rounded-md border-slate-300 text-sm shadow-sm"
                   disabled={isDeleting || deleteStep > 0}
                 >
                   <option value="">-- Choisir --</option>
                   <option value="all" className="font-bold text-red-600">🚨 TOUS LES EMPLOIS DU TEMPS</option>
                   {teachers.map(t => (
                     <option key={t.id} value={t.id}>Emploi du temps de : {t.name}</option>
                   ))}
                 </select>
               </div>
               
               {deleteTarget && (
                 <div className="shrink-0">
                   {deleteStep === 0 && (
                     <button onClick={() => setDeleteStep(1)} className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium text-sm transition-colors">
                        Supprimer...
                     </button>
                   )}
                   {deleteStep === 1 && (
                     <div className="flex gap-2">
                       <button onClick={() => setDeleteStep(0)} className="px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium text-sm transition-colors">
                          Annuler
                       </button>
                       <button onClick={() => setDeleteStep(2)} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold text-sm transition-colors shadow-sm animate-pulse">
                          Confirmer définitivement
                       </button>
                     </div>
                   )}
                   {deleteStep === 2 && (
                     <button onClick={handleDelete} disabled={isDeleting} className="px-6 py-2 bg-red-700 text-white rounded-lg font-bold text-sm shadow-sm opacity-90">
                        {isDeleting ? 'Suppression...' : 'Cliquer pour exécuter'}
                     </button>
                   )}
                 </div>
               )}
             </div>
          </div>
        </div>

        <div className="mt-8 max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-bold text-slate-800 mb-2">Note concernant les PDF</h2>
            <p className="text-sm text-slate-600">
              L'importation de fichiers PDF n'est pas recommandée car leur structure visuelle est complexe à interpréter automatiquement. 
              Privilégiez l'export au format <strong>iCal / .ics</strong> depuis votre logiciel de vie scolaire (Pronote, Index Éducation, etc.) 
              pour garantir une intégration parfaite des créneaux. Une fois importé, vous pourrez cliquer sur n'importe quel créneau dans la vue <strong className="text-slate-800">Emploi du temps</strong> pour corriger manuellement les erreurs.
            </p>
        </div>
      </div>
    </div>
  );
}
