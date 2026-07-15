
export type DayStatus = 'Pendente' | 'OK' | 'Atenção' | 'Alerta';

export interface Pet {
  id: string; // ID_PET
  pet_nome: string;
  peso_pet: string;
  dia_semana: string;
  
  // Comportamento Alimentar
  comportamento_alimentar: string;
  precisa_estimulo: string;
  
  // Alimentação Detalhada
  tipo_alimentacao: string;
  quantidade_oferecida: string;
  quantidade_aproximada: string;
  marca_racao: string;
  especificacao_racao: string;
  oferece_extras: string;
  
  // Hidratação
  ingestao_agua: string;
  interesse_agua: string;
  ajuda_beber_agua: string;
  sede_pos_creche: string;
  
  // Saúde e Restrições
  possui_alergia: string;
  alimentos_proibidos: string;
  possui_doenca: string;
  doenca_qual: string;
  escore_corporal: string;
  
  // Notas
  observacoes: string;
  
  // Perfil Comportamental & Rotina (Novos blocos)
  perfil_comportamental?: string[];
  rotina_preferencias?: string;
  rotina_coisas_nao_gosta?: string;
  rotina_pode_petisco?: string;
  rotina_pode_grupo?: string;
  rotina_descansar_separado?: string;
  rotina_restricao_rotina?: string;

  // Alertas Importantes
  alertas_importantes?: string[];

  // Atividades Favoritas
  atividades_favoritas?: string[];

  // Amizades do Pet
  amizades?: PetFriendship[];

  // Controle de Revisão Mensal
  ultimo_responsavel_atualizacao?: string;
  ultimo_mes_atualizacao?: string;
  ultima_data_atualizacao?: string;
  revisoes_mensais?: PetRevision[];

  // Campos legados (manter compatibilidade se necessário)
  raca?: string;
  tutor_nome?: string;
  telefone?: string;
  foto?: string; // Base64 or image URL
  data_aniversario?: string;
  nao_sei_aniversario?: boolean;
  
  // Acesso do Tutor (Link Seguro)
  tutorAccessToken?: string;
  tutorAccessEnabled?: boolean;
  tutorAccessCreatedAt?: string;
  tutorAccessUpdatedAt?: string;
  tenant_id?: string;
}

export interface PetFriendship {
  id: string;
  mesAno: string; // Ex: "Julho/2026"
  petAmigo: string; // Ex: "Thor"
  nivelAmizade: string; // Ex: "Muito amigo"
  observacao: string; // Ex: "Brincaram juntos várias vezes"
}

export interface PetRevision {
  id: string;
  mesAno: string; // Ex: "Julho/2026"
  responsavel: string; // Quem mexeu/salvou
  dataRevisao: string; // Data em formato ISO ou simples "07/07/2026"
  status: string; // Ex: "Atualizado", "Sem alterações"
  observacao: string;
}

export interface ChecklistEntry {
  petId: string;
  date: string;
  status: DayStatus;
  comeu: 'Comeu tudo' | 'Comeu metade' | 'Comeu menos da metade' | 'Não comeu';
  quantoOferecido: string;
  quantoSobrou: string;
  agua: 'Bebeu muita água' | 'Pouca água' | 'Não bebeu nada';
  teveEstimuloHidratacao: 'Sim' | 'Não';
  comportamento: string;
  alertas: string;
  observacoes: string;
  escoreFecal: number;
  updatedAt?: string;
  lastMessageSentAt?: string;
  fotos?: string[];
}

export interface PetGroup {
  id: string;
  name: string;
  petIds: string[];
  color: string;
}

export interface Medication {
  id: string;
  petId: string;
  name: string;
  dosage: string;
  time: string;
  frequency: '6h' | '8h' | '12h' | '24h' | 'outra';
  startDate?: string;
  endDate?: string;
  instructions: string;
  active: boolean;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  petId: string;
  date: string;
  offered: boolean;
  slot?: number; // 0 for 24h, 1-2 for 12h, 1-3 for 8h, 1-4 for 6h
  offeredBy?: string;
  notes?: string;
}

export interface HotelStay {
  id: string;
  tenant_id?: string;
  petId: string;
  tutorNome?: string;
  tutorTelefone?: string;
  checkIn: string; // compatibility
  checkOut: string; // compatibility
  checkInDate?: string;
  expectedCheckOutDate?: string;
  realCheckOutDate?: string | null;
  status?: 'ativa' | 'finalizada';
  feedingTimesPerDay?: number;
  feedingSchedule?: string[];
  feedingNotes?: string;
  medicationEnabled?: boolean;
  medications?: Array<{
    name: string;
    dosage: string;
    time: string;
    instructions: string;
  }>;
  tutorInstructions?: string;
  broughtItems?: Record<string, boolean>;
  broughtItemsPhotos?: string[];
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
  instructions: string; // compatibility
  active: boolean; // compatibility
}

export interface HotelRecord {
  id: string;
  tenant_id: string;
  hotelStayId: string;
  petId: string;
  type: 'feeding' | 'medication' | 'activity' | 'photo' | 'rest' | 'note';
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  responsible: string;
  notes: string;
  visibleToTutor: boolean;
  photoUrl?: string;
  createdAt: string;
}

export interface HotelReport {
  id: string;
  tenant_id: string;
  hotelStayId: string;
  petId: string;
  crecheName: string;
  petName: string;
  reportText: string;
  summary: {
    mealsCount: number;
    medsCount: number;
    activitiesCount: number;
    restsCount: number;
  };
  photos: string[];
  createdAt: string;
}

export const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo', '-'];

export const FECAL_SCORE_LABELS: Record<number, string> = {
  1: '1 - Muito Duro',
  2: '2 - Firme',
  3: '3 - Ideal',
  4: '4 - Pastoso',
  5: '5 - Diarreia'
};
