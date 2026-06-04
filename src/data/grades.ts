// Grade levels and developmental bands used across the worksheet tools.
export interface Band { color: string; light: string; emoji: string; label: string; }
export interface Grade { id: string; name: string; short: string; band: string; fontSize: number; lineH: number; }

export const BANDS: Record<string, Band> = {
  early:      { color:"#6D28D9", light:"#F5F3FF", emoji:"🌱", label:"Early Childhood" },
  elementary: { color:"#B45309", light:"#FFFBEB", emoji:"⭐", label:"Elementary"       },
  middle:     { color:"#0369A1", light:"#F0F9FF", emoji:"🏫", label:"Middle School"    },
  high:       { color:"#1E3A5F", light:"#EFF6FF", emoji:"🎓", label:"High School"      },
};

export const GRADES: Grade[] = [
  { id:"pk", name:"Pre-K",    short:"PK", band:"early",      fontSize:14, lineH:32 },
  { id:"k",  name:"Kinder.",  short:"K",  band:"early",      fontSize:14, lineH:32 },
  { id:"1",  name:"Grade 1",  short:"1",  band:"early",      fontSize:14, lineH:32 },
  { id:"2",  name:"Grade 2",  short:"2",  band:"early",      fontSize:14, lineH:32 },
  { id:"3",  name:"Grade 3",  short:"3",  band:"elementary", fontSize:14, lineH:32 },
  { id:"4",  name:"Grade 4",  short:"4",  band:"elementary", fontSize:14, lineH:32 },
  { id:"5",  name:"Grade 5",  short:"5",  band:"elementary", fontSize:14, lineH:32 },
  { id:"6",  name:"Grade 6",  short:"6",  band:"middle",     fontSize:14, lineH:32 },
  { id:"7",  name:"Grade 7",  short:"7",  band:"middle",     fontSize:14, lineH:32 },
  { id:"8",  name:"Grade 8",  short:"8",  band:"middle",     fontSize:14, lineH:32 },
  { id:"9",  name:"Grade 9",  short:"9",  band:"high",       fontSize:14, lineH:32 },
  { id:"10", name:"Grade 10", short:"10", band:"high",       fontSize:14, lineH:32 },
  { id:"11", name:"Grade 11", short:"11", band:"high",       fontSize:14, lineH:32 },
  { id:"12", name:"Grade 12", short:"12", band:"high",       fontSize:14, lineH:32 },
];

export const gInfo = (id: string) => {
  const g = GRADES.find(x => x.id === id) || GRADES[1];
  return { ...g, ...BANDS[g.band] };
};
