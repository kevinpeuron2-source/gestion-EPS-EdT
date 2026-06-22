import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { db } from "../lib/firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Trash2, Edit } from "lucide-react";
import { Course } from "../types";

export default function SlotManager() {
  const { classes, facilities, teachers, courses } = useStore();

  const [form, setForm] = useState<{
    id?: string;
    dayOfWeek: string;
    teacherId: string;
    startTime: string;
    endTime: string;
    classId: string;
    facilityId: string;
    isUnavailability?: boolean;
    reason?: string;
  }>({
    dayOfWeek: "Lundi",
    teacherId: "",
    startTime: "08:00",
    endTime: "09:00",
    classId: "",
    facilityId: ""
  });

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (form.id) {
        const { id, ...data } = form;
        await updateDoc(doc(db, "courses", id), data);
      } else {
        await addDoc(collection(db, "courses"), form);
      }
      setForm({
        dayOfWeek: "Lundi",
        teacherId: "",
        startTime: "08:00",
        endTime: "09:00",
        classId: "",
        facilityId: ""
      });
    } catch (err) {}
  };

  const deleteCourse = async (id: string) => {
    try {
      await deleteDoc(doc(db, "courses", id));
    } catch (err) {}
  };

  const editCourse = (course: Course) => {
    setForm(course);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Créneaux (Ligne)</h1>
        <p className="text-sm text-slate-500">Ajout et vue tabulaire des créneaux de l'emploi du temps.</p>
      </header>

      <div className="flex-1 overflow-auto bg-slate-50 p-6 flex flex-col gap-6">
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">{form.id ? "Modifier le créneau" : "Ajouter un créneau"}</h2>
          <form onSubmit={saveCourse} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Enseignant</label>
              <select required value={form.teacherId} onChange={e => setForm({...form, teacherId: e.target.value})} className="form-select w-full text-sm rounded-md border-slate-300">
                <option value="">-- Choisir --</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jour</label>
              <select required value={form.dayOfWeek} onChange={e => setForm({...form, dayOfWeek: e.target.value})} className="form-select w-full text-sm rounded-md border-slate-300">
                {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Début</label>
              <input type="time" required value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} className="form-input w-full text-sm rounded-md border-slate-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fin</label>
              <input type="time" required value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} className="form-input w-full text-sm rounded-md border-slate-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Classe</label>
              <select required value={form.classId} onChange={e => setForm({...form, classId: e.target.value})} className="form-select w-full text-sm rounded-md border-slate-300">
                <option value="">-- Choisir --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 items-end">
               {form.id && <button type="button" onClick={() => setForm({dayOfWeek: "Lundi", teacherId: "", startTime: "08:00", endTime: "09:00", classId: "", facilityId: ""})} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">Annuler</button>}
               <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                 <Plus className="w-4 h-4" /> {form.id ? "Valider" : "Ajouter"}
               </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-700">Enseignant</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Jour</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Horaire</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Classe</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Salle</th>
                <th className="px-6 py-3 font-semibold text-slate-700 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map(course => {
                 const t = teachers.find(t => t.id === course.teacherId);
                 const c = classes.find(c => c.id === course.classId);
                 const f = facilities.find(f => f.id === course.facilityId);
                 return (
                   <tr key={course.id} className="hover:bg-slate-50">
                     <td className="px-6 py-3">{t?.name || "???"}</td>
                     <td className="px-6 py-3 font-medium">{course.dayOfWeek}</td>
                     <td className="px-6 py-3">{course.startTime} - {course.endTime}</td>
                     <td className="px-6 py-3">{c?.name || "???"}</td>
                     <td className="px-6 py-3">{f?.name || "-"}</td>
                     <td className="px-6 py-3 flex gap-2">
                       <button onClick={() => editCourse(course)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                       <button onClick={() => deleteCourse(course.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                     </td>
                   </tr>
                 )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
