import { useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useStore } from "../store/useStore";
import { Teacher, ClassGroup, Facility, Cycle, Absence, Course, Settings } from "../types";

export function useFirebaseSync() {
  const { setTeachers, setClasses, setFacilities, setCycles, setAbsences, setCourses, setSettings, setLoading } = useStore();

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const subscribe = (cName: string, setter: (data: any[]) => void) => {
      const q = query(collection(db, cName));
      return onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setter(data);
      });
    };

    unsubs.push(subscribe("teachers", (d) => setTeachers(d as Teacher[])));
    unsubs.push(subscribe("classes", (d) => setClasses(d as ClassGroup[])));
    unsubs.push(subscribe("facilities", (d) => setFacilities(d as Facility[])));
    unsubs.push(subscribe("cycles", (d) => setCycles(d as Cycle[])));
    unsubs.push(subscribe("absences", (d) => setAbsences(d as Absence[])));
    unsubs.push(subscribe("courses", (d) => setCourses(d as Course[])));

    const settingsQ = query(collection(db, "settings"));
    unsubs.push(onSnapshot(settingsQ, (snap) => {
      if (!snap.empty) {
        const doc = snap.docs[0];
        setSettings({ id: doc.id, ...doc.data() } as Settings);
      } else {
        setSettings({
          recessTimes: [{ start: "10:00", end: "10:15" }],
          lunchBreak: { start: "12:00", end: "13:30" },
          bellTimes: ["08:00", "09:00", "10:15", "11:15", "13:30", "14:30", "15:30"]
        });
      }
      setLoading(false);
    }));

    return () => {
      unsubs.forEach(u => u());
    };
  }, []);
}
