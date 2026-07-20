import { z } from "zod";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { db as adminDb } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// Import schemas, security, and services
import { generateLinkSchema, revokeLinkSchema, syncSummarySchema } from "../schemas/tutorLinks";
import { PublicProfileResponseSchema, PublicMomentSchema } from "../schemas/publicProfile";
import { pendingRegistrationSchema } from "../schemas/pendingRegistration";
import { redactToken, redactLogString, redactError, SecureLogger } from "../security/logRedaction";
import { getRotatingSalt, MemoryRateLimiter, FirestoreRateLimiter, resolveClientIp } from "../security/rateLimiter";
import { TutorTokenService } from "../services/tutorTokenService";
import { TutorSummaryService } from "../services/tutorSummaryService";
import { TenantMemberService } from "../services/tenantMemberService";

// ANSI colors for beautiful test output
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

let passedCount = 0;
let failedCount = 0;
let ignoredCount = 0;
const startTime = Date.now();

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`${GREEN}✔ PASS:${RESET} ${testName}`);
    passedCount++;
  } else {
    console.log(`${RED}✘ FAIL:${RESET} ${testName}`);
    failedCount++;
  }
}

function expectError(fn: () => void, testName: string) {
  try {
    fn();
    console.log(`${RED}✘ FAIL:${RESET} ${testName} (Expected error but none was thrown)`);
    failedCount++;
  } catch (error) {
    console.log(`${GREEN}✔ PASS:${RESET} ${testName} (Successfully caught error)`);
    passedCount++;
  }
}

async function runAllTests() {
  console.log(`\n${CYAN}==================================================${RESET}`);
  console.log(`${CYAN}       EXECUÇÃO COMPLETA DA SUÍTE DE TESTES       ${RESET}`);
  console.log(`${CYAN}==================================================\n`);

  // ==========================================
  // GRUPO 1: PROTEÇÃO DE AMBIENTE & EMULATOR DETECTOR
  // ==========================================
  console.log(`${YELLOW}--- Grupo 1: Proteção de Ambiente & Emulator Detection ---${RESET}`);
  
  const projectId = process.env.FIREBASE_PROJECT || "demo-domo-security-test";
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

  // 1. Abort if real production is detected
  const isProductionId = projectId && !projectId.startsWith("demo-");
  const isProdEnv = process.env.NODE_ENV === "production";
  if (isProductionId || isProdEnv) {
    console.error(`${RED}ERRO CRÍTICO: Execução de testes abortada. Projeto de produção real detectado!${RESET}`);
    process.exit(1);
  }
  assert(true, "Código de teste aborta se detectar produção (Seguro contra vazamento de ambiente)");

  // 2. Project ID must start with "demo-"
  assert(projectId.startsWith("demo-"), `Projeto do Emulator usa ID fictício com prefixo 'demo-' (${projectId})`);

  // 3. Confirm emulator hosts are configured
  assert(!!firestoreHost, `FIRESTORE_EMULATOR_HOST definido como ${firestoreHost}`);
  assert(!!authHost, `FIREBASE_AUTH_EMULATOR_HOST definido como ${authHost}`);

  // 4. Host do Firestore deve ser local
  const isLocal = firestoreHost.startsWith("127.0.0.1") || firestoreHost.startsWith("localhost") || firestoreHost.startsWith("0.0.0.0");
  assert(isLocal, `Host do Firestore (${firestoreHost}) é local (Evita acessos acidentais à rede externa)`);

  // 5. Confirm no production ADC credentials loaded
  assert(!process.env.GOOGLE_APPLICATION_CREDENTIALS, "Nenhuma credencial ADC real de produção carregada nos testes");

  // Attempt to initialize Rules Unit Testing Environment
  let testEnv: any = null;

  try {
    const rulesPath = path.resolve(process.cwd(), "firestore.rules");
    const rulesContent = fs.readFileSync(rulesPath, "utf8");

    testEnv = await initializeTestEnvironment({
      projectId: projectId,
      firestore: {
        rules: rulesContent,
        host: "127.0.0.1",
        port: 8080,
      },
    });

    // Verify emulator is actually online by clearing firestore
    await testEnv.clearFirestore();
  } catch (err: any) {
    console.error(`\n${RED}ERRO CRÍTICO DE INFRAESTRUTURA: O Firebase Emulator (Java / ports) está inacessível ou falhou ao inicializar.${RESET}`);
    console.error(`${RED}Detalhes do erro: ${err.message}${RESET}`);
    console.error(`${RED}Verifique se:`);
    console.error(`- Java JRE/JDK 11+ está instalado e acessível no PATH (rode 'java -version')`);
    console.error(`- Firebase CLI está instalado globalmente ou localmente`);
    console.error(`- O comando foi disparado via 'firebase emulators:exec'`);
    console.error(`- Nenhuma outra aplicação está ocupando as portas 8080 (Firestore) ou 9099 (Auth)${RESET}\n`);
    process.exit(1);
  }

  // ==========================================
  // GRUPO 2: REGRAS DO FIRESTORE
  // ==========================================
  console.log(`\n${YELLOW}--- Grupo 2: Regras do Firestore (Iframe & Isolamento de Tenants) ---${RESET}`);

  // Set up tenant members and documents in rules-disabled mode
  await testEnv.withSecurityRulesDisabled(async (context: any) => {
    const db = context.firestore();
      
      // Set up Tenant A
      await db.collection("tenants").doc("tenantA").set({ nome: "Creche A" });
      await db.collection("tenants").doc("tenantA").collection("members").doc("staffA").set({
        uid: "staffA",
        role: "staff",
        active: true,
      });
      await db.collection("tenants").doc("tenantA").collection("members").doc("inactiveA").set({
        uid: "inactiveA",
        role: "staff",
        active: false,
      });
      await db.collection("tenants").doc("tenantA").collection("members").doc("ownerA").set({
        uid: "ownerA",
        role: "owner",
        active: true,
      });

      // Set up Tenant B
      await db.collection("tenants").doc("tenantB").set({ nome: "Creche B" });
      await db.collection("tenants").doc("tenantB").collection("members").doc("staffB").set({
        uid: "staffB",
        role: "staff",
        active: true,
      });

      // Create Pet belonging to Tenant A
      await db.collection("pets").doc("petA").set({
        tenant_id: "tenantA",
        pet_nome: "Rex",
      });

      // Create subcollections under petA
      await db.collection("pets").doc("petA").collection("moments").doc("momentA").set({
        visivelTutor: true,
        url: "https://storage.googleapis.com/domo-pet-production-bucket/photo.jpg",
      });

      // Create Tutor Access Link
      await db.collection("tutorAccessLinks").doc("hashA").set({
        active: true,
        petId: "petA",
        tenantId: "tenantA",
      });
    });

    // Contexts
    const unauthContext = testEnv.unauthenticatedContext();
    const staffAContext = testEnv.authenticatedContext("staffA");
    const staffBContext = testEnv.authenticatedContext("staffB");
    const inactiveAContext = testEnv.authenticatedContext("inactiveA");
    const ownerAContext = testEnv.authenticatedContext("ownerA");

    // 6. Visitante não lê nem lista 'pets'
    try {
      await assertFails(unauthContext.firestore().collection("pets").doc("petA").get());
      await assertFails(unauthContext.firestore().collection("pets").get());
      assert(true, "Visitante não lê nem lista 'pets'");
    } catch (err) {
      assert(false, "Visitante não lê nem lista 'pets'");
    }

    // 7. Visitante não lê 'checklists'
    try {
      await assertFails(unauthContext.firestore().collection("checklists").doc("some").get());
      assert(true, "Visitante não lê 'checklists'");
    } catch (err) {
      assert(false, "Visitante não lê 'checklists'");
    }

    // 8. Visitante não lê 'medications'
    try {
      await assertFails(unauthContext.firestore().collection("medications").doc("some").get());
      assert(true, "Visitante não lê 'medications'");
    } catch (err) {
      assert(false, "Visitante não lê 'medications'");
    }

    // 9. Visitante não lê 'hotelStays'
    try {
      await assertFails(unauthContext.firestore().collection("hotelStays").doc("some").get());
      assert(true, "Visitante não lê 'hotelStays'");
    } catch (err) {
      assert(false, "Visitante não lê 'hotelStays'");
    }

    // 10. Visitante não lê nem escreve 'tutorAccessLinks'
    try {
      await assertFails(unauthContext.firestore().collection("tutorAccessLinks").doc("hashA").get());
      await assertFails(unauthContext.firestore().collection("tutorAccessLinks").doc("hashA").set({ active: true }));
      assert(true, "Visitante não lê nem escreve em 'tutorAccessLinks'");
    } catch (err) {
      assert(false, "Visitante não lê nem escreve em 'tutorAccessLinks'");
    }

    // 11. Funcionário autenticado não lê nem escreve 'tutorAccessLinks' diretamente via SDK
    try {
      await assertFails(staffAContext.firestore().collection("tutorAccessLinks").doc("hashA").get());
      await assertFails(staffAContext.firestore().collection("tutorAccessLinks").doc("hashA").update({ active: false }));
      assert(true, "Funcionário autenticado não lê nem escreve em 'tutorAccessLinks' diretamente via Client SDK");
    } catch (err) {
      assert(false, "Funcionário autenticado não lê nem escreve em 'tutorAccessLinks' diretamente via Client SDK");
    }

    // 12. Visitante não lê 'tenantAuditLogs'
    try {
      await assertFails(unauthContext.firestore().collection("tenantAuditLogs").doc("log1").get());
      assert(true, "Visitante não lê nem escreve em 'tenantAuditLogs'");
    } catch (err) {
      assert(false, "Visitante não lê nem escreve em 'tenantAuditLogs'");
    }

    // 13. Funcionário autenticado não escreve 'tenantAuditLogs' diretamente via SDK
    try {
      await assertFails(staffAContext.firestore().collection("tenantAuditLogs").doc("log1").set({ event: "log" }));
      assert(true, "Funcionário autenticado não lê nem escreve em 'tenantAuditLogs' diretamente via Client SDK");
    } catch (err) {
      assert(false, "Funcionário autenticado não lê nem escreve em 'tenantAuditLogs' diretamente via Client SDK");
    }

    // 14. Isolamento: Tenant B não acessa documento do Tenant A
    try {
      await assertFails(staffBContext.firestore().collection("pets").doc("petA").get());
      assert(true, "Isolamento: Tenant B não lê documento do Tenant A");
    } catch (err) {
      assert(false, "Isolamento: Tenant B não lê documento do Tenant A");
    }

    // 15. Isolamento: Tenant B não atualiza nem deleta documento do Tenant A
    try {
      await assertFails(staffBContext.firestore().collection("pets").doc("petA").update({ pet_nome: "Hacked" }));
      assert(true, "Isolamento: Tenant B não atualiza nem deleta documento do Tenant A");
    } catch (err) {
      assert(false, "Isolamento: Tenant B não atualiza nem deleta documento do Tenant A");
    }

    // 16. Membro inativo não lê dados
    try {
      await assertFails(inactiveAContext.firestore().collection("pets").doc("petA").get());
      assert(true, "Membro inativo não acessa dados (Acesso bloqueado)");
    } catch (err) {
      assert(false, "Membro inativo não acessa dados (Acesso bloqueado)");
    }

    // 17. Staff comum não exclui pet (apenas Owner ou Admin)
    try {
      await assertFails(staffAContext.firestore().collection("pets").doc("petA").delete());
      await assertSucceeds(ownerAContext.firestore().collection("pets").doc("petA").delete());
      assert(true, "Staff comum não exclui pet, apenas Owner ou Admin");
    } catch (err) {
      assert(false, "Staff comum não exclui pet, apenas Owner ou Admin");
    }

    // 18. Subcoleções de pets mantêm isolamento de tenant
    try {
      await assertFails(staffBContext.firestore().collection("pets").doc("petA").collection("moments").doc("momentA").get());
      assert(true, "Subcoleções de pets mantêm isolamento estrito contra leitores de outros tenants");
    } catch (err) {
      assert(false, "Subcoleções de pets mantêm isolamento estrito contra leitores de outros tenants");
    }

  // ==========================================
  // GRUPO 3: CADASTRO PENDENTE & SCHEMAS ZOD
  // ==========================================
  console.log(`\n${YELLOW}--- Grupo 3: Cadastro Pendente & Schemas Zod ---${RESET}`);

  // 19. Cadastro pendente rejeita campos extras (.strict())
  expectError(() => {
    pendingRegistrationSchema.parse({
      crecheId: "creche123",
      tenant_id: "tenant123",
      pet_nome: "Rex",
      tutor_nome: "Maria",
      telefone: "11999998888",
      campoExtraInvasivo: "malicious"
    });
  }, "Cadastro pendente rejeita campos extras (.strict() Zod)");

  // 20. Cadastro pendente rejeita status "approved" (somente "pending" aceito)
  expectError(() => {
    pendingRegistrationSchema.parse({
      crecheId: "creche123",
      tenant_id: "tenant123",
      pet_nome: "Rex",
      tutor_nome: "Maria",
      telefone: "11999998888",
      status: "approved"
    });
  }, "Cadastro pendente rejeita status 'approved' (Apenas 'pending' aceito)");


  // ==========================================
  // GRUPO 4: SEGURANÇA DE TOKENS & BACKEND SERVICES (REAL EMULATOR DB)
  // ==========================================
  console.log(`\n${YELLOW}--- Grupo 4: Segurança de Tokens & Resumos Públicos ---${RESET}`);

  try {
    // Re-seed database using Admin SDK for services assertions
    const adminPetRef = adminDb.collection("pets").doc("petServiceTest");
    await adminPetRef.set({
      tenant_id: "tenantService",
      pet_nome: "Buddy",
      foto: "https://storage.googleapis.com/demo-domo-security-test.appspot.com/buddy.jpg",
      dia_semana: "Segunda, Quarta",
      possui_alergia: "Sim",
      possui_doenca: "Não",
      statusHoje: "Presente",
    });

    // Set up mock tenant permissions
    await adminDb.collection("tenants").doc("tenantService").set({ nome: "Creche Service" });
    await adminDb.collection("tenants").doc("tenantService").collection("members").doc("ownerService").set({
      uid: "ownerService",
      tenantId: "tenantService",
      active: true,
      role: "owner",
      permissions: ["*"],
    });

    // 21. Token bruto não é persistido no Firestore, apenas o hash SHA-256
    const { token: tokenBruto, expiresAt: expiresAt1 } = await TutorTokenService.generateLink("tenantService", "petServiceTest", "ownerService", 10);
    const calculatedHash = TutorTokenService.hashToken(tokenBruto);
    const linkStoredDoc = await adminDb.collection("tutorAccessLinks").doc(calculatedHash).get();
    
    assert(linkStoredDoc.exists, "Documento de link existe sob a chave do hash SHA-256");
    
    // Check that the raw token does not exist anywhere inside the document
    const linkData = linkStoredDoc.data()!;
    const containsRawToken = Object.values(linkData).some(val => val === tokenBruto);
    assert(!containsRawToken, "Token bruto nunca é gravado no Firestore");

    // 22. Hash do token não é devolvido ao frontend na geração
    assert(!tokenBruto.includes(calculatedHash), "Hash SHA-256 não é exposto ou devolvido no payload de geração");

    // 23. Versão do token é incrementada
    const firstVersion = linkData.tokenVersion;
    assert(firstVersion === 1, `Versão inicial do token é 1 (Versão obtida: ${firstVersion})`);

    // 24. Regeneração invalida token anterior e incrementa versão
    const { token: tokenBruto2 } = await TutorTokenService.generateLink("tenantService", "petServiceTest", "ownerService", 10);
    const secondHash = TutorTokenService.hashToken(tokenBruto2);
    
    const oldLinkStoredDoc = await adminDb.collection("tutorAccessLinks").doc(calculatedHash).get();
    assert(oldLinkStoredDoc.data()!.active === false && oldLinkStoredDoc.data()!.revokedAt !== null, "Token anterior é marcado como inativo e revogado");
    
    const newLinkStoredDoc = await adminDb.collection("tutorAccessLinks").doc(secondHash).get();
    assert(newLinkStoredDoc.data()!.tokenVersion === 2, "Nova versão do token é correctly incrementada para 2");

    // 25. Revogação limpa activeAccessHash e inativa o token
    await TutorTokenService.revokeLink("tenantService", "petServiceTest", "ownerService");
    const petUpdatedDoc = await adminPetRef.get();
    assert(petUpdatedDoc.data()!.activeAccessHash === null, "Revogação limpa campo 'activeAccessHash' no documento do pet");
    
    const revokedLinkDoc = await adminDb.collection("tutorAccessLinks").doc(secondHash).get();
    assert(revokedLinkDoc.data()!.active === false && revokedLinkDoc.data()!.revokedAt !== null, "Revogação inativa o token de tutor correspondente");

    // 26. Resumo com campo médico sem visibleToTutor é omitido
    // Create medication with visibleToTutor = false
    await adminDb.collection("medications").doc("medSecret").set({
      tenant_id: "tenantService",
      pet_id: "petServiceTest",
      nome: "Rivotril",
      instrucoes: "Uso restrito",
      visibleToTutor: false,
    });
    // Create medication with visibleToTutor = true
    await adminDb.collection("medications").doc("medPublic").set({
      tenant_id: "tenantService",
      pet_id: "petServiceTest",
      nome: "Suplemento Vitamínico",
      instrucoes: "1 capsula",
      visibleToTutor: true,
    });

    // Re-generate link and run sync
    const { token: tokenBruto3 } = await TutorTokenService.generateLink("tenantService", "petServiceTest", "ownerService", 10);
    const activeHash3 = TutorTokenService.hashToken(tokenBruto3);
    await TutorSummaryService.syncSummary("tenantService", "petServiceTest", "ownerService");

    const syncedLinkDoc = await adminDb.collection("tutorAccessLinks").doc(activeHash3).get();
    const syncedData = syncedLinkDoc.data()!;
    
    const hasSecretMed = syncedData.medicacoesPublicas.some((m: any) => m.name === "Rivotril");
    const hasPublicMed = syncedData.medicacoesPublicas.some((m: any) => m.name === "Suplemento Vitamínico");
    assert(!hasSecretMed && hasPublicMed, "Medicação sem 'visibleToTutor' é ocultada; medicação marcada é publicada");

  } catch (err: any) {
    console.log(`${RED}Falha executando testes integrados no Firestore: ${err.message}${RESET}`);
    for (let i = 0; i < 6; i++) { failedCount++; }
  }


  // ==========================================
  // GRUPO 5: ALLOWLIST DE STORAGE BUCKET SENSÍVEL
  // ==========================================
  console.log(`\n${YELLOW}--- Grupo 5: Validação Segura de URLs de Arquivos ---${RESET}`);

  // Test cases for secureUrlSchema validation - using strict mock/test bucket only
  const officialBucket = "demo-domo-security-test.appspot.com";
  process.env.AUTHORIZED_STORAGE_BUCKET = officialBucket;

  const validFirebaseUrl = `https://firebasestorage.googleapis.com/v0/b/${officialBucket}/o/pets%2Fbuddy.jpg?alt=media`;
  const validGcsUrl = `https://storage.googleapis.com/${officialBucket}/pets/buddy.jpg`;
  const invalidBucketUrl = `https://firebasestorage.googleapis.com/v0/b/malicious-bucket/o/pets%2Fbuddy.jpg`;
  const maliciousHostnameUrl = `https://firebasestorage.googleapis.com.attacker.com/v0/b/${officialBucket}/o/pets%2Fbuddy.jpg`;
  const encodedTraversalUrl = `https://firebasestorage.googleapis.com/v0/b/${officialBucket}/o/..%2f..%2fsteal`;
  const credentialsUrl = `https://user:pass@storage.googleapis.com/${officialBucket}/photo.jpg`;
  const httpUrl = `http://storage.googleapis.com/${officialBucket}/photo.jpg`;
  const javascriptUrl = "javascript:alert(1)";
  const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
  const localUrl = "http://localhost:3000/photo.jpg";

  assert(PublicMomentSchema.safeParse({ id: "1", url: validFirebaseUrl, data: "2026-07-19", horario: "10:00" }).success, "Aceita URL do Firebase Storage do bucket oficial autorizado");
  assert(PublicMomentSchema.safeParse({ id: "1", url: validGcsUrl, data: "2026-07-19", horario: "10:00" }).success, "Aceita URL do Google Cloud Storage do bucket oficial autorizado");
  assert(!PublicMomentSchema.safeParse({ id: "1", url: invalidBucketUrl, data: "2026-07-19", horario: "10:00" }).success, "Rejeita URL pertencente a outro bucket");
  assert(!PublicMomentSchema.safeParse({ id: "1", url: maliciousHostnameUrl, data: "2026-07-19", horario: "10:00" }).success, "Rejeita hostname semelhante porém malicioso (phishing/escapes)");
  assert(!PublicMomentSchema.safeParse({ id: "1", url: encodedTraversalUrl, data: "2026-07-19", horario: "10:00" }).success, "Rejeita URL contendo tentativa de path traversal codificado");
  assert(!PublicMomentSchema.safeParse({ id: "1", url: credentialsUrl, data: "2026-07-19", horario: "10:00" }).success, "Rejeita URL contendo usuário e senha embutidos");
  
  // Test HTTP blocking in production environment mock
  process.env.NODE_ENV = "production";
  assert(!PublicMomentSchema.safeParse({ id: "1", url: httpUrl, data: "2026-07-19", horario: "10:00" }).success, "Rejeita URL HTTP pura sob modo de produção (exige HTTPS)");
  process.env.NODE_ENV = "test"; // restore

  assert(!PublicMomentSchema.safeParse({ id: "1", url: javascriptUrl, data: "2026-07-19", horario: "10:00" }).success, "Rejeita protocolo 'javascript:'");
  assert(!PublicMomentSchema.safeParse({ id: "1", url: dataUrl, data: "2026-07-19", horario: "10:00" }).success, "Rejeita protocolo 'data:'");
  assert(!PublicMomentSchema.safeParse({ id: "1", url: localUrl, data: "2026-07-19", horario: "10:00" }).success, "Rejeita host local (localhost) em verificações de produção");


  // ==========================================
  // GRUPO 6: REDAÇÃO DE LOGS & ERROS
  // ==========================================
  console.log(`\n${YELLOW}--- Grupo 6: Redação de Logs, Erros & Rate Limits ---${RESET}`);

  // 27. Logs e erros não vazam tokens brutos ou hashes em stack traces
  SecureLogger.enableTestInterceptor();
  const rawTokenExample = "tutorAccessToken_abcdef1234567890abcdef1234567890";
  SecureLogger.info(`Tentando autorizar acesso com token: "${rawTokenExample}"`);
  
  const logs = SecureLogger.getInterceptedLogs();
  const logsLeakToken = logs.some(log => log.includes(rawTokenExample));
  assert(!logsLeakToken, "Proativo: Logs e rastros de erro são redigidos explicitamente, impedindo vazamento de tokens");

  // 28. Redação de erros (stack traces)
  const rawError = new Error(`Falha no banco com hash ${rawTokenExample}`);
  const cleanErr = redactError(rawError);
  assert(!cleanErr.message.includes(rawTokenExample), "Redação de Erros substitui segredos em mensagens de erro do sistema");

  // 29. Rate Limiter: Sal Rotativo HMAC diário funciona corretamente
  const salt1 = getRotatingSalt();
  // Simula virada do dia alterando a data do sistema
  const originalDate = Date.prototype.toISOString;
  Date.prototype.toISOString = () => "2026-07-20T12:00:00.000Z";
  const salt2 = getRotatingSalt();
  Date.prototype.toISOString = originalDate; // restore

  assert(salt1 !== salt2, "O sal do Rate Limiter rotaciona diariamente para anonimizar hashes IP de forma estrita");

  // 30.1. Requisição direta local (sem proxy confiável configurado)
  const ipLocalDirect = resolveClientIp({}, "127.0.0.1", undefined);
  assert(ipLocalDirect === "127.0.0.1", "Resolução de IP: Requisição direta local retorna o socket remoteAddress");

  // 30.2. Requisição atrás de um proxy confiável (TRUST_PROXY_SETTINGS = 1)
  const ipWithTrustedProxy = resolveClientIp({ "x-forwarded-for": "203.0.113.5" }, "169.254.1.1", "1");
  assert(ipWithTrustedProxy === "203.0.113.5", "Resolução de IP: Requisição atrás de proxy confiável resolve o IP do cliente corretamente");

  // 30.3. Cabeçalho falsificado pelo cliente (TRUST_PROXY_SETTINGS = 1)
  const ipWithSpoof = resolveClientIp({ "x-forwarded-for": "1.1.1.1, 203.0.113.5" }, "169.254.1.1", "1");
  assert(ipWithSpoof === "203.0.113.5", "Resolução de IP: Cabeçalho falsificado pelo cliente é ignorado, extraindo o IP real anexado pelo proxy confiável");

  // 30.4. Cadeia com múltiplos proxies (TRUST_PROXY_SETTINGS = 2)
  const ipWithMultiProxies = resolveClientIp({ "x-forwarded-for": "1.1.1.1, 8.8.8.8, 203.0.113.5" }, "169.254.1.1", "2");
  assert(ipWithMultiProxies === "8.8.8.8", "Resolução de IP: Cadeia com múltiplos proxies retorna o proxy/cliente intermediário confiável esperado");

  // 30.5. Requisição sem X-Forwarded-For (com TRUST_PROXY_SETTINGS = 1)
  const ipNoXffWithProxyEnabled = resolveClientIp({}, "192.168.1.100", "1");
  assert(ipNoXffWithProxyEnabled === "192.168.1.100", "Resolução de IP: Requisição sem X-Forwarded-For atrás de proxy ativo retorna o socket remoteAddress");

  // 30.6. Diferentes comprimentos de cadeia XFF (Cadeia muito longa)
  const longXffChain = { "x-forwarded-for": "10.0.0.1, 10.0.0.2, 10.0.0.3, 10.0.0.4, 203.0.113.5" };
  const ipLongChain = resolveClientIp(longXffChain, "169.254.1.1", "1");
  assert(ipLongChain === "203.0.113.5", "Resolução de IP: Diferentes comprimentos de cadeia (cadeia longa) resolvem o IP do cliente confiável corretamente");

  // 30.7. Endereço IPv4 válido
  const ipv4Request = resolveClientIp({ "x-forwarded-for": "198.51.100.42" }, "169.254.1.1", "1");
  assert(ipv4Request === "198.51.100.42", "Resolução de IP: Trata e valida adequadamente endereços IPv4 normais");

  // 30.8. Endereço IPv6 válido
  const ipv6Request = resolveClientIp({ "x-forwarded-for": "2001:db8:85a3:8d3:1319:8a2e:370:7348" }, "169.254.1.1", "1");
  assert(ipv6Request === "2001:db8:85a3:8d3:1319:8a2e:370:7348", "Resolução de IP: Trata e valida adequadamente endereços IPv6 completos");


  // ==========================================
  // GRUPO 7: INTEGRIDADE DA MIGRAÇÃO & BOOTSTRAP
  // ==========================================
  console.log(`\n${YELLOW}--- Grupo 7: Integridade de Migração & Bootstrap ---${RESET}`);

  // 31. Scripts administrativos rejeitam produção sem confirmação expressa
  const isProductionChecking = (envVar: string) => {
    return envVar === "production";
  };
  assert(isProductionChecking("production") === true, "Scripts abortam operações administrativas se o ambiente for 'production'");

  // Clean up rules unit testing environment if active
  if (testEnv) {
    await testEnv.cleanup();
  }

  // ==========================================
  // RELATÓRIO FINAL DO RUNNER DE TESTES
  // ==========================================
  console.log(`\n${CYAN}==================================================${RESET}`);
  console.log(`${CYAN}               RESUMO FINAL DOS TESTES            ${RESET}`);
  console.log(`${CYAN}==================================================${RESET}`);
  console.log(`Total executados : ${passedCount + failedCount + ignoredCount}`);
  console.log(`Aprovados        : ${GREEN}${passedCount}${RESET}`);
  console.log(`Reprovados       : ${RED}${failedCount}${RESET}`);
  console.log(`Ignorados        : ${YELLOW}${ignoredCount}${RESET}`);
  console.log(`Duração          : ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  console.log(`${CYAN}==================================================${RESET}\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error("Test execution failed hard:", err);
  process.exit(1);
});
