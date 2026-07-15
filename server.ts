import express from "express";
import { google } from "googleapis";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Route to save to Google Sheets
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
