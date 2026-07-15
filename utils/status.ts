
import { ChecklistEntry, DayStatus } from '../types';

export const calculateStatus = (data: Partial<ChecklistEntry>): DayStatus => {
  const { comeu } = data;

  if (!comeu) return 'Pendente';

  if (comeu === 'Não comeu') {
    return 'Alerta';
  }

  if (comeu === 'Comeu tudo') {
    return 'OK';
  }

  // Comeu metade ou Comeu menos da metade
  return 'Atenção';
};

export const getStatusColor = (status: DayStatus) => {
  switch (status) {
    case 'OK': return 'bg-emerald-500';
    case 'Atenção': return 'bg-amber-400';
    case 'Alerta': return 'bg-rose-500';
    default: return 'bg-slate-300';
  }
};

export const getStatusEmoji = (status: DayStatus) => {
  switch (status) {
    case 'OK': return '🟢';
    case 'Atenção': return '🟡';
    case 'Alerta': return '🔴';
    default: return '⚪';
  }
};
