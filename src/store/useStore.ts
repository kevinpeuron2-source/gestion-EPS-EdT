import { create } from "zustand";
import { Teacher, ClassGroup, Facility, Cycle, Absence, Course, Settings } from "../types";

interface AppState {
  teachers: Teacher[];
  classes: ClassGroup[];
  facilities: Facility[];
  cycles: Cycle[];
  absences: Absence[];
  courses: Course[];
  settings: Settings | null;
  loading: boolean;
  setTeachers: (teachers: Teacher[]) => void;
  setClasses: (classes: ClassGroup[]) => void;
  setFacilities: (facilities: Facility[]) => void;
  setCycles: (cycles: Cycle[]) => void;
  setAbsences: (absences: Absence[]) => void;
  setCourses: (courses: Course[]) => void;
  setSettings: (settings: Settings) => void;
  setLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  teachers: [],
  classes: [],
  facilities: [],
  cycles: [],
  absences: [],
  courses: [],
  settings: null,
  loading: true,
  setTeachers: (teachers) => set({ teachers }),
  setClasses: (classes) => set({ classes }),
  setFacilities: (facilities) => set({ facilities }),
  setCycles: (cycles) => set({ cycles }),
  setAbsences: (absences) => set({ absences }),
  setCourses: (courses) => set({ courses }),
  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ loading }),
}));
