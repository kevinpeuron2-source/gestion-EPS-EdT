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

export interface Cycle {
  id: string;
  name: string;
  startWeek: number;
  endWeek: number;
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
  recessTimes: { start: string; end: string }[];
  lunchBreak: { start: string; end: string };
  bellTimes: string[];
}
