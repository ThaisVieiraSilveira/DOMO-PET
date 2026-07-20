import { db } from "../firebase/admin";
import { getApps } from "firebase-admin/app";

async function runBootstrap() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const projectIdx = args.indexOf("--project");
  
  if (projectIdx === -1 || !args[projectIdx + 1]) {
    console.error("Erro: Parâmetro --project <id-do-projeto> é obrigatório.");
    process.exit(1);
  }
  
  const projectId = args[projectIdx + 1];
  const isDemo = projectId.startsWith("demo-");
  
  if (!isDemo) {
    const confirmed = args.includes("--confirm-production");
    if (!confirmed) {
      console.error(`AVISO CRÍTICO: O projeto '${projectId}' parece ser de PRODUÇÃO (não inicia com 'demo-').`);
      console.error("Para executar em produção, você deve passar explicitamente a flag '--confirm-production'.");
      process.exit(1);
    }
    console.log("AVISO: Executando script de bootstrap em ambiente de produção conforme solicitado.");
  } else {
    console.log(`Executando script de bootstrap no projeto seguro do emulador: ${projectId}`);
  }

  if (dryRun) {
    console.log("[DRY-RUN] Modo de simulação ativado. Nenhuma alteração real será gravada.");
  }

  try {
    const tenantsSnap = await db.collection("tenants").get();
    console.log(`Encontrados ${tenantsSnap.size} tenants no Firestore.`);
    
    let count = 0;
    for (const doc of tenantsSnap.docs) {
      const tenantId = doc.id;
      // In compliance with "Sem dados sensíveis nos logs", we do not output names or sensitive strings
      console.log(`Verificando tenant ID ofuscado: ${tenantId.substring(0, 8)}...`);
      
      const memberRef = db.collection("tenants").doc(tenantId).collection("members").doc(tenantId);
      const memberDoc = await memberRef.get();
      
      if (!memberDoc.exists) {
        if (!dryRun) {
          await memberRef.set({
            uid: tenantId,
            tenantId,
            active: true,
            role: "owner",
            permissions: ["*"],
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        console.log(`[BOOTSTRAP] Proprietário registrado para o tenant ${tenantId.substring(0, 8)}...`);
        count++;
      } else {
        console.log(`[BOOTSTRAP] Proprietário já existe para o tenant ${tenantId.substring(0, 8)}...`);
      }
    }

    console.log(`\nBootstrap concluído. Total de novos proprietários registrados: ${count} ${dryRun ? '(simulado)' : ''}`);
    process.exit(0);
  } catch (error) {
    console.error("Erro durante a execução do bootstrap:", error);
    process.exit(1);
  }
}

if (require.main === module || !module.parent) {
  runBootstrap().catch(err => {
    console.error("Falha fatal no script de bootstrap:", err);
    process.exit(1);
  });
}
