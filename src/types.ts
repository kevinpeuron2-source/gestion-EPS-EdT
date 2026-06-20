export interface ScheduledActivity {
  id: string;
  activityId: string;
  classId: string;
  startWeek: number;
  endWeek: number;
}

export interface Teacher {
  id: string;
  name: string;
  color: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  color: string;
}

export interface Facility {
  id: string;
  name: string;
  color: string;
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
  classId: string;
  facilityId?: string;
  dayOfWeek: string;
  startTime: string; // e.g. "08:00"
  endTime: string;   // e.g. "09:00"
  cycleId?: string;
  locked?: boolean;
}

export interface Settings {
  id?: string;
  recessTimes: { id: string; start: string; end: string; name: string }[];
  lunchBreak: { start: string; end: string };
  schoolYearWeeks: number;
  holidays: { id: string; startWeek: number; endWeek: number; name: string }[];
  bellTimes: string[];
}
