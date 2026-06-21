import { useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useStore } from "../store/useStore";
import { Teacher, ClassGroup, Facility, Activity, Absence, Course, Settings, ScheduledActivity } from "../types";

export function useFirebaseSync() {
  const { setTeachers, setClasses, setFacilities, setActivities, setScheduledActivities, setAbsences, setCourses, setSettings, setLoading } = useStore();

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
    unsubs.push(subscribe("activities", (d) => setActivities(d as Activity[])));
    unsubs.push(subscribe("scheduledActivities", (d) => setScheduledActivities(d as ScheduledActivity[])));
    unsubs.push(subscribe("absences", (d) => setAbsences(d as Absence[])));
    unsubs.push(subscribe("courses", (d) => setCourses(d as Course[])));

    const settingsQ = query(collection(db, "settings"));
    unsubs.push(onSnapshot(settingsQ, (snap) => {
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();
        
        // Force migration to specific new times if they use the previous default
        if (data.bellTimes && data.bellTimes.length === 7 && data.bellTimes[0] === "08:00") {
          const newData = {
            ...data,
            recessTimes: [
              { id: "def1", start: "10:05", end: "10:20", name: "Matin" },
              { id: "def2", start: "15:15", end: "15:30", name: "Après-midi" }
            ],
            lunchBreak: { start: "12:20", end: "12:45" },
            bellTimes: ["08:15", "09:10", "10:05", "10:20", "11:20", "12:20", "12:45", "13:15", "14:15", "15:15", "15:30", "16:25", "16:50"],
            startWeek: 36,
            endWeek: 27
          };
          setSettings({ id: docSnap.id, ...newData } as Settings);
          import('firebase/firestore').then(({ doc, updateDoc }) => {
            updateDoc(doc(db, "settings", docSnap.id), newData);
          });
        } else {
          setSettings({ id: docSnap.id, ...data } as Settings);
        }
      } else {
        setSettings({
          recessTimes: [
            { id: "def1", start: "10:05", end: "10:20", name: "Matin" },
            { id: "def2", start: "15:15", end: "15:30", name: "Après-midi" }
          ],
          lunchBreak: { start: "12:20", end: "12:45" },
          bellTimes: ["08:15", "09:10", "10:05", "10:20", "11:20", "12:20", "12:45", "13:15", "14:15", "15:15", "15:30", "16:25", "16:50"],
          startWeek: 36,
          endWeek: 27,
          holidays: []
        });
      }
      setLoading(false);
    }));

    return () => {
      unsubs.forEach(u => u());
    };
  }, []);
}
