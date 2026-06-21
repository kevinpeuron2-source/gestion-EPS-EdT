export interface ScheduledActivity {
  id: string;
  activityId: string;
  classId: string;
  startWeek: number;
  endWeek: number;
}

export interface ClassRequirement {
  id: string;
  durationMinutes: number;
  count: number;
  weekType: 'ALL' | 'A' | 'B';
}

export interface Teacher {
  id: string;
  name: string;
  color: string;
  targetHours?: number;
  unavailabilities?: { id: string; dayOfWeek: string; startTime: string; endTime: string; reason?: string }[];
}

export interface ClassGroup {
  id: string;
  name: string;
  color: string;
  defaultTeacherId?: string;
  preferredFacilityId?: string;
  requirements?: ClassRequirement[];
  level?: "2nde" | "1ère" | "Terminale" | "";
  catchUpDate?: string;
  ccfDeadline?: string;
  importantDates?: { id: string; date: string; description: string }[];
}

export interface Facility {
  id: string;
  name: string;
  color: string;
  capacity?: number;
}

export interface Activity {
  id: string;
  name: string;
  durationWeeks: number;
  facilityId: string;
  classIds: string[];
}

export interface Absence {
  id: string;
  classId: string;
  startWeek: number;
  endWeek: number;
  reason: string;
}

export interface Course {
  id: string;
  teacherId: string;
  coTeacherIds?: string[];
  classId: string; // Will be empty or "UNAVAILABLE" if it's an unavailability
  facilityId?: string;
  dayOfWeek: string;
  startTime: string; // e.g. "08:00"
  endTime: string;   // e.g. "09:00"
  weekType?: 'ALL' | 'A' | 'B';
  cycleId?: string;
  locked?: boolean;
  isUnavailability?: boolean;
  reason?: string;
}

export interface Settings {
  id?: string;
  recessTimes: { id: string; start: string; end: string; name: string }[];
  lunchBreak: { start: string; end: string };
  schoolYearWeeks?: number;
  startWeek?: number;
  endWeek?: number;
  holidays: { id: string; startWeek: number; endWeek: number; name: string }[];
  bellTimes: string[];
}
