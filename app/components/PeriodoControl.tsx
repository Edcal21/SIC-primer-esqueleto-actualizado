"use client";
import { currentYear, type Granularidad } from "../shared";

export default function PeriodoControl({label,value,onChange,granularidad}:{label:string;value:string;onChange:(value:string)=>void;granularidad:Granularidad}){
  const common={value,onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>onChange(event.target.value)};
  const years = Array.from({ length: 7 }, (_, index) => currentYear() - index);
  return <label className="periodControl"><span>{label}</span>{granularidad==="dia"?<input type="date" min="2000-01-01" max="2100-12-31" {...common}/>:granularidad==="mes"?<input type="month" min="2000-01" max="2100-12" {...common}/>:granularidad==="trimestre"?<select {...common}>{years.flatMap(year=>[1,2,3,4].map(q=><option key={`${year}-T${q}`} value={`${year}-T${q}`}>Trimestre {q} · {year}</option>))}</select>:<select {...common}>{years.map(year=><option key={year} value={String(year)}>Año {year}</option>)}</select>}<small>{value}</small></label>;
}
