
import { Pet } from '../types';

export const DAYS_ORDER = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

export const normalize = (s: string) => 
  s.normalize("NFD")
   .replace(/[\u0300-\u036f]/g, "")
   .toLowerCase()
   .trim();

export const isPetOnDay = (pet: Pet, targetDay: string) => {
  if (targetDay === 'Todos') return true;
  
  const petDayRaw = normalize(pet.dia_semana || '');
  const target = normalize(targetDay);

  if (petDayRaw === '' || petDayRaw === '-') return false;
  if (petDayRaw.includes('todos') || petDayRaw.includes('diaria') || petDayRaw.includes('semana')) return true;
  
  // Suporte para strings como "Segunda, Quarta" ou "Segunda a Sexta"
  const segments = petDayRaw.split(/[,/;]|\s+e\s+/).map(s => s.trim()).filter(Boolean);

  for (const seg of segments) {
    if (seg === target) return true;

    if (seg.includes(' a ')) {
      const parts = seg.split(/\s+a\s+/);
      if (parts.length === 2) {
        const start = normalize(parts[0]);
        const end = normalize(parts[1]);
        const startIndex = DAYS_ORDER.indexOf(start);
        const endIndex = DAYS_ORDER.indexOf(end);
        const targetIndex = DAYS_ORDER.indexOf(target);
        if (startIndex !== -1 && endIndex !== -1 && targetIndex !== -1) {
          if (targetIndex >= startIndex && targetIndex <= endIndex) return true;
        }
      }
    }
  }
  return false;
};
