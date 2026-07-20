import { db } from "../firebase/admin";
import { TutorTokenService } from "../services/tutorTokenService";
import { Timestamp } from "firebase-admin/firestore";

async function runMigration() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  
  const projectIdx = args.indexOf("--project");
  if (projectIdx === -1 || !args[projectIdx + 1]) {
    console.error("Erro: Parâmetro --project <id-do-projeto> é obrigatório.");
    process.exit(1);
  }
  const projectId = args[projectIdx + 1];

  const batchSizeIdx = args.indexOf("--batch-size");
  const batchSize = batchSizeIdx !== -1 && args[batchSizeIdx + 1] ? parseInt(args[batchSizeIdx + 1], 10) : 100;

  const resumeFromIdx = args.indexOf("--resume-from");
  const resumeFromId = resumeFromIdx !== -1 ? args[resumeFromIdx + 1] : null;

  const expPolicyIdx = args.indexOf("--expiration-policy");
  // Default is 30 days unless specified as 'none' or another number of days
  const expirationPolicy = expPolicyIdx !== -1 && args[expPolicyIdx + 1] ? args[expPolicyIdx + 1] : "30";

  const isDemo = projectId.startsWith("demo-");
  if (!isDemo) {
    const confirmed = args.includes("--confirm-production");
    if (!confirmed) {
      console.error(`AVISO CRÍTICO: O projeto '${projectId}' parece ser de PRODUÇÃO (não inicia com 'demo-').`);
      console.error("Para executar em produção, você deve passar explicitamente a flag '--confirm-production'.");
      process.exit(1);
    }
  }

  console.log(`\n==================================================`);
  console.log(`   INICIANDO MIGRACAO DE TOKENS SEGUROS (FASE A)`);
  console.log(`==================================================`);
  console.log(`Projeto: ${projectId}`);
  console.log(`Modo Simulação (Dry Run): ${dryRun ? "ATIVADO" : "DESATIVADO"}`);
  console.log(`Batch Size: ${batchSize}`);
  console.log(`Resume From ID: ${resumeFromId || "Início"}`);
  console.log(`Política de Expiração: ${expirationPolicy === "none" ? "Sem Expiração" : `${expirationPolicy} dias`}\n`);

  try {
    const petsSnap = await db.collection("pets").get();
    
    let totalPets = 0;
    let migratable = 0;
    let noToken = 0;
    let conflict = 0;
    let alreadyMigrated = 0;
    
    const migrationQueue: Array<{ petId: string; legacyToken: string; data: any }> = [];

    for (const doc of petsSnap.docs) {
      totalPets++;
      const petId = doc.id;
      const data = doc.data();
      const legacyToken = data.tutorAccessToken;

      // Filter by resumeFromId if supplied
      if (resumeFromId && petId < resumeFromId) {
        continue;
      }

      if (!legacyToken) {
        noToken++;
        continue;
      }

      const hash = TutorTokenService.hashToken(legacyToken);

      // Check if already migrated
      if (data.activeAccessHash === hash) {
        alreadyMigrated++;
        continue;
      }

      // Check for conflicts: if activeAccessHash exists but differs from the hash of the current legacyToken
      if (data.activeAccessHash && data.activeAccessHash !== hash) {
        conflict++;
        continue;
      }

      migratable++;
      migrationQueue.push({ petId, legacyToken, data });
    }

    console.log(`--- RELATÓRIO DO MOCK/REAL DRY-RUN DE PETS ---`);
    console.log(`Total de pets analisados: ${totalPets}`);
    console.log(`Quantidade migrável: ${migratable}`);
    console.log(`Quantidade sem token legado: ${noToken}`);
    console.log(`Quantidade com conflito de hash: ${conflict}`);
    console.log(`Quantidade já migrada: ${alreadyMigrated}`);
    console.log(`-----------------------------------------------`);
    console.log(`AVISO: Nenhum token bruto foi exposto nos logs.\n`);

    if (dryRun) {
      console.log("[DRY-RUN] Script encerrado com sucesso. Nenhuma gravação foi realizada.");
      process.exit(0);
    }

    if (migrationQueue.length === 0) {
      console.log("Nenhum pet pendente de migração.");
      process.exit(0);
    }

    // Process queue in batches up to batchSize
    const toProcess = migrationQueue.slice(0, batchSize);
    console.log(`Processando lote de ${toProcess.length} pets...`);

    let migratedSuccessfully = 0;

    for (const item of toProcess) {
      const { petId, legacyToken, data } = item;
      const hash = TutorTokenService.hashToken(legacyToken);

      try {
        await db.runTransaction(async (transaction) => {
          const petRef = db.collection("pets").doc(petId);
          const freshPetDoc = await transaction.get(petRef);
          if (!freshPetDoc.exists) return;

          const freshData = freshPetDoc.data()!;
          const tokenVersion = (freshData.tokenVersion || 0) + 1;

          // Determine expiration based on expiration policy
          let expiresTimestamp: Timestamp | null = null;
          if (expirationPolicy !== "none") {
            const days = parseInt(expirationPolicy, 10) || 30;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + days);
            expiresTimestamp = Timestamp.fromDate(expiresAt);
          }

          const linkRef = db.collection("tutorAccessLinks").doc(hash);

          // Seed/migrate into tutorAccessLinks doc
          transaction.set(linkRef, {
            active: freshData.tutorAccessEnabled !== false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            expiresAt: expiresTimestamp,
            revokedAt: null,
            tenantId: freshData.tenant_id || "system",
            petId,
            tokenVersion,
            createdBy: "migration-system",
            
            crecheNome: "",
            petNome: freshData.pet_nome || "",
            petFotoUrl: freshData.foto || null,
            diasFrequenta: freshData.dia_semana || null,
            statusHoje: freshData.statusHoje || "Ausente",
            timelinePublica: [],
            momentosPublicos: [],
            boletinsPublicos: [],
            hasPublicAllergyNotice: freshData.possui_alergia === "Sim",
            hasPublicCareNotice: freshData.possui_doenca === "Sim",
          });

          // Update pet doc reference
          transaction.update(petRef, {
            activeAccessHash: hash,
            tokenVersion,
            accessExpiresAt: expiresTimestamp,
            tutorAccessEnabled: freshData.tutorAccessEnabled !== false
          });
        });

        migratedSuccessfully++;
        console.log(`[SUCESSO] Pet ID ${petId.substring(0, 8)}... migrado para o hash ${hash.substring(0, 8)}...`);
      } catch (err) {
        console.error(`[ERRO] Falha ao migrar Pet ID ${petId.substring(0, 8)}...:`, err);
      }
    }

    console.log(`\nMigração do lote concluída. Sucessos: ${migratedSuccessfully}/${toProcess.length}`);
    process.exit(0);

  } catch (err) {
    console.error("Erro crítico na migração:", err);
    process.exit(1);
  }
}

runMigration().catch(err => {
  console.error("Falha fatal na migração:", err);
  process.exit(1);
});
