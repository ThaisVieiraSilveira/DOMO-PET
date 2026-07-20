import express from "express";
import { google } from "googleapis";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Import secure modular dependencies
import tutorLinksRouter from "./server/routes/tutorLinks";
import publicTutorProfileRouter from "./server/routes/publicTutorProfile";
import pendingRegistrationRouter from "./server/routes/pendingRegistration";
import { stagingIpTelemetryMiddleware } from "./server/security/stagingTelemetry";

dotenv.config();

// Critical environment validation for production
if (process.env.NODE_ENV === "production") {
  if (!process.env.AUTHORIZED_STORAGE_BUCKET) {
    console.error("ERRO CRÍTICO DE CONFIGURAÇÃO: A variável de ambiente AUTHORIZED_STORAGE_BUCKET é obrigatória em produção!");
    process.exit(1);
  }
  if (!process.env.RATE_LIMIT_SALT_SECRET) {
    console.error("ERRO CRÍTICO DE CONFIGURAÇÃO: A variável de ambiente RATE_LIMIT_SALT_SECRET é obrigatória em produção!");
    process.exit(1);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure Express to trust the upstream proxy (Cloud Run / GFE) securely based on environment
  const trustProxySetting = process.env.TRUST_PROXY_SETTINGS;
  if (trustProxySetting === "true") {
    app.set("trust proxy", true);
  } else if (trustProxySetting === "false") {
    app.set("trust proxy", false);
  } else if (trustProxySetting && !isNaN(Number(trustProxySetting))) {
    app.set("trust proxy", Number(trustProxySetting));
  } else if (trustProxySetting) {
    app.set("trust proxy", trustProxySetting);
  } else {
    // Safe non-trusting default
    app.set("trust proxy", false);
  }

  app.use(cors());
  app.use(express.json({ limit: "50kb" }));

  // Protected Staging IP Telemetry (Only active if ENABLE_STAGING_IP_TELEMETRY === "true" and NOT prod)
  app.use(stagingIpTelemetryMiddleware);

  // Feature Flag gating for new secure tutor links architecture
  const ENABLE_SECURE_TUTOR_LINKS = process.env.ENABLE_SECURE_TUTOR_LINKS === "true";

  // Public pending pre-registrations (always open)
  app.use("/api/public/pending-registration", pendingRegistrationRouter);

  // Gated secure new endpoints
  if (ENABLE_SECURE_TUTOR_LINKS) {
    app.use("/api/tutor-link", tutorLinksRouter);
    app.use("/api/public", publicTutorProfileRouter);
  } else {
    // Graceful fallback showing controlled maintenance/gated responses
    const gatedResponse = (req: express.Request, res: express.Response) => {
      res.status(503).json({
        error: "Feature Gated",
        message: "O novo mecanismo seguro de perfis públicos está temporariamente desativado por flag de infraestrutura.",
      });
    };
    app.use("/api/tutor-link", gatedResponse);
    app.use("/api/public/tutor-profile", gatedResponse);
  }

  // API Route to save to Google Sheets (legacy / looker report appending)
  app.post("/api/save-pet", async (req, res) => {
    try {
      const pet = req.body;
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/^"|"$/g, "").replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      const range = `${process.env.GOOGLE_SHEET_NAME || 'cadastro_looker'}!A:Z`;

      const values = [
        [
          pet.id,
          pet.pet_nome,
          pet.raca || '',
          pet.tutor_nome || '',
          pet.telefone || '',
          pet.dia_semana || '',
          pet.peso_pet || '',
          pet.tipo_alimentacao || '',
          pet.marca_racao || '',
          pet.especificacao_racao || '',
          pet.quantidade_oferecida || '',
          pet.quantidade_aproximada || '',
          pet.oferece_extras || '',
          pet.comportamento_alimentar || '',
          pet.precisa_estimulo || '',
          pet.ingestao_agua || '',
          pet.interesse_agua || '',
          pet.ajuda_beber_agua || '',
          pet.sede_pos_creche || '',
          pet.possui_alergia || '',
          pet.alimentos_proibidos || '',
          pet.possui_doenca || '',
          pet.doenca_qual || '',
          pet.escore_corporal || '',
          pet.observacoes || '',
          new Date().toISOString()
        ]
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving to Google Sheets:", error);
      res.status(500).json({ error: error.message || "Failed to save to Google Sheets" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
