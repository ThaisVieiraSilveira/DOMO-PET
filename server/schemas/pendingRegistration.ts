import { z } from "zod";

export const pendingRegistrationSchema = z.object({
  crecheId: z.string().min(1).max(64),
  tenant_id: z.string().min(1).max(64),
  pet_nome: z.string().min(1).max(100),
  tutor_nome: z.string().min(1).max(100),
  telefone: z.string().regex(/^\+?[\d\s\-()]{8,20}$/, "Telefone inválido"),
  dia_semana: z.string().max(200).optional(),
  observacoes: z.string().max(1000).optional(),
  status: z.literal("pending").default("pending"),
}).strict();
