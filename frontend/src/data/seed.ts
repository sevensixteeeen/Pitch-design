// Seed content for a new account, so Home and the editor have something real
// to show. Written fresh for this app.
import { makeShape, makeText, newId, type DesignContent } from "../lib/document";

export function seedContent(w: number, h: number): DesignContent {
  const band = { ...makeShape(w, h, "rect"), x: 0, y: Math.round(h * 0.62), width: w, height: Math.round(h * 0.38), fill: "#1d2127" };
  const dot = { ...makeShape(w, h, "ellipse"), x: Math.round(w * 0.62), y: Math.round(h * 0.1), width: Math.round(w * 0.3), height: Math.round(w * 0.3), fill: "#f2b705" };
  const title = { ...makeText(w, h, "heading"), text: "Opening night", y: Math.round(h * 0.68), color: "#ffffff" };
  const sub = { ...makeText(w, h, "body"), text: "Friday · 7 pm · Studio 4", y: Math.round(h * 0.8), color: "#d0d4da" };
  return {
    schema_version: 1,
    pages: [{ id: newId(), background: { color: "#f4efe6" }, elements: [band, dot, title, sub] }],
  };
}
