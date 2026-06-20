import { create } from "zustand";
import { Teacher, ClassGroup, Facility, Activity, Absence, Course, Settings, ScheduledActivity } from "../types";

interface AppState {
  teachers: Teacher[];
  classes: ClassGroup[];
  facilities: Facility[];
  activities: Activity[];
  scheduledActivities: ScheduledActivity[];
  absences: Absence[];
  courses: Course[];
  settings: Settings | null;
  loading: boolean;
  setTeachers: (teachers: Teacher[]) => void;
  setClasses: (classes: ClassGroup[]) => void;
  setFacilities: (facilities: Facility[]) => void;
  setActivities: (activities: Activity[]) => void;
  setScheduledActivities: (scheduledActivities: ScheduledActivity[]) => void;
  setAbsences: (absences: Absence[]) => void;
  setCourses: (courses: Course[]) => void;
  setSettings: (settings: Settings) => void;
  setLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  teachers: [],
  classes: [],
  facilities: [],
  activities: [],
  scheduledActivities: [],
  absences: [],
  courses: [],
  settings: null,
  loading: true,
  setTeachers: (teachers) => set({ teachers }),
  setClasses: (classes) => set({ classes }),
  setFacilities: (facilities) => set({ facilities }),
  setActivities: (activities) => set({ activities }),
  setScheduledActivities: (scheduledActivities) => set({ scheduledActivities }),
  setAbsences: (absences) => set({ absences }),
  setCourses: (courses) => set({ courses }),
  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ loading }),
}));
