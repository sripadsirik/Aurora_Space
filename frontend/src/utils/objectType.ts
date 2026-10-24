import type { Satellite } from "../types/space";
export function objectClassification(satellite: Satellite): { label: string; source: string } {
  const supplied = satellite.objectType?.trim().toUpperCase();
  const labels: Record<string,string> = { DEBRIS:"Debris", "ROCKET BODY":"Rocket body", PAYLOAD:"Payload", UNKNOWN:"Unknown" };
  if (supplied && supplied in labels && supplied !== "UNKNOWN") return {label:labels[supplied],source:satellite.metadataSource ? "CelesTrak SATCAT" : "Catalog object type"};
  if (/\bDEB\b|\bDEBRIS\b/i.test(satellite.name)) return {label:"Debris",source:"Inferred from catalog name"};
  if (/\bR\/B\b|\bROCKET BODY\b/i.test(satellite.name)) return {label:"Rocket body",source:"Inferred from catalog name"};
  return {label:"Unknown",source:"Object type not supplied"};
}
