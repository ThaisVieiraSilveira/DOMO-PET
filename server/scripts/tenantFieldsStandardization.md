# Inventário de Campos de Tenant e Estratégia de Unificação

Este documento detalha o inventário atual dos campos utilizados para identificação de Tenants (Multi-tenancy) no ecossistema DOMO e define a estratégia de padronização futura.

## 1. Inventário de Campos Atuais

### `tenant_id` (Campo Canônico Interno)
- **Coleções do Firestore**: `pets`, `registros`, `checklists`, `groups`, `medications`, `medication_logs`, `hotelStays`, `hotelRecords`, `hotelReports`, `boletins`, `cadastros_pendentes`.
- **Regras do Firestore**: Todas as regras de segurança dependem de `resource.data.tenant_id` ou `request.resource.data.tenant_id` para isolar os dados de cada creche de forma estrita.

### `tenantId` (Camada de Integração e Resumos)
- **Coleções do Firestore**: `tutorAccessLinks` (campo `tenantId`).
- **APIs Express**: Utilizado no corpo de payloads das requisições para geração de links (`/api/tutor-link/generate`).

### `crecheId` (Legado / Integração Frontend)
- **Frontend / Cadastros**: Usado em formulários públicos e cadastros pendentes legados, onde se refere ao identificador do tenant correspondente.

---

## 2. Estratégia de Mapeamento Futura (Unificação)

Para evitar quebras no sistema e garantir máxima segurança, o campo **`tenant_id`** (com underscore) é definido como o **Campo Canônico Oficial**.

### Plano de Migração Segura:

1. **Camada de Rotas (Tradução Temporária)**:
   - Manter conversores bidirecionais nas rotas e schemas Zod para aceitar ambos os campos (`tenantId` ou `tenant_id`), traduzindo-os sempre para `tenant_id` antes de interagir com o Firestore:
     ```ts
     const canonicalTenantId = payload.tenant_id || payload.tenantId || payload.crecheId;
     ```

2. **Migração Física de Dados (Assíncrona e Idempotente)**:
   - Criar uma Cloud Function ou script administrativo rodando em lote no Firestore que:
     - Percorra todos os documentos da coleção `tutorAccessLinks`.
     - Adicione `tenant_id` igual ao valor existente de `tenantId`.
     - Adicione `crecheId` para retrocompatibilidade onde necessário.

3. **Atualização do Frontend**:
   - Refatorar gradualmente as referências a `tenantId` e `crecheId` nas chamadas de API do frontend React para usar exclusivamente `tenant_id`.

4. **Descontinuação (Deprecation)**:
   - Após a validação de que 100% das leituras e escritas usam exclusivamente `tenant_id`, os campos legados `tenantId` e `crecheId` poderão ser removidos com segurança.
