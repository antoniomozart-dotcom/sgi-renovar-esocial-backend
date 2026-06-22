/**
 * server.js — Backend eSocial SGI Renovar (Node.js / Render)
 * v2.1 — com diagnóstico de erro de importação
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ESOCIAL_AMBIENTE = process.env.ESOCIAL_AMBIENTE || "homologacao";

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// ─── Health check — registrado ANTES de importar transmitir.js ────────────────
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "sgi-esocial-service",
    ambiente: ESOCIAL_AMBIENTE,
    versao: "2.1.0",
    eventos_suportados: ["S-2210", "S-2220", "S-2221"],
  });
});

// ─── Importa transmitirEvento dinamicamente (evita crash no startup) ──────────
let transmitirEvento = null;

async function carregarTransmissor() {
  try {
    const mod = await import("./transmitir.js");
    transmitirEvento = mod.transmitirEvento;
    console.log("[SGI] transmitir.js carregado com sucesso.");
  } catch (err) {
    console.error("[SGI] ERRO ao carregar transmitir.js:", err.message);
    console.error(err.stack);
  }
}

// ─── Handler genérico ─────────────────────────────────────────────────────────
async function handleTransmissao(req, res) {
  if (!transmitirEvento) {
    return res.status(503).json({
      ok: false,
      error: "Módulo de transmissão não disponível — verifique os logs do servidor.",
    });
  }
  try {
    const { evento_id, cat_id } = req.body || {};
    const id = evento_id || cat_id;
    if (!id) return res.status(400).json({ ok: false, error: "evento_id obrigatório." });
    const resultado = await transmitirEvento({ evento_id: id });
    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("[transmissao]", error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

// ─── Rotas ────────────────────────────────────────────────────────────────────
app.post("/transmitir-evento",  handleTransmissao);
app.post("/transmitir-s2210",   handleTransmissao);
app.post("/transmitir-s2220",   handleTransmissao);
app.post("/transmitir-s2221",   handleTransmissao);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`SGI eSocial Service v2.1 — porta ${PORT} — ambiente: ${ESOCIAL_AMBIENTE}`);
  await carregarTransmissor();
});
