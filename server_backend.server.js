/**
 * server.js — Backend eSocial SGI Renovar (Node.js / Render)
 *
 * Rotas:
 *  GET  /health              — health check
 *  POST /transmitir-evento   — rota genérica (recomendada) — roteia por evento_codigo
 *  POST /transmitir-s2210    — compat. retroativa — CAT
 *  POST /transmitir-s2220    — Exames Ocupacionais / ASO
 *  POST /transmitir-s2221    — Exame Toxicológico do Motorista
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { transmitirEvento } from "./transmitir.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ESOCIAL_AMBIENTE = process.env.ESOCIAL_AMBIENTE || "homologacao";

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// ─── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "sgi-esocial-service",
    ambiente: ESOCIAL_AMBIENTE,
    versao: "2.0.0",
    eventos_suportados: ["S-2210", "S-2220", "S-2221"],
  });
});

// ─── Rota genérica (recomendada para novas integrações) ──────────────────────
app.post("/transmitir-evento", async (req, res) => {
  try {
    const { evento_id } = req.body || {};
    if (!evento_id) return res.status(400).json({ ok: false, error: "evento_id obrigatório." });

    const resultado = await transmitirEvento({ evento_id });
    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("[/transmitir-evento]", error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ─── Rota S-2210 — CAT (retrocompatível) ────────────────────────────────────
app.post("/transmitir-s2210", async (req, res) => {
  try {
    const { cat_id, evento_id } = req.body || {};
    const id = evento_id || cat_id;
    if (!id) return res.status(400).json({ ok: false, error: "Informe evento_id ou cat_id." });

    const resultado = await transmitirEvento({ evento_id: id });
    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("[/transmitir-s2210]", error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ─── Rota S-2220 — Exames Ocupacionais / ASO ────────────────────────────────
app.post("/transmitir-s2220", async (req, res) => {
  try {
    const { evento_id } = req.body || {};
    if (!evento_id) return res.status(400).json({ ok: false, error: "evento_id obrigatório." });

    const resultado = await transmitirEvento({ evento_id });
    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("[/transmitir-s2220]", error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ─── Rota S-2221 — Exame Toxicológico do Motorista ───────────────────────────
app.post("/transmitir-s2221", async (req, res) => {
  try {
    const { evento_id } = req.body || {};
    if (!evento_id) return res.status(400).json({ ok: false, error: "evento_id obrigatório." });

    const resultado = await transmitirEvento({ evento_id });
    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("[/transmitir-s2221]", error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`SGI eSocial Service v2.0 — porta ${PORT} — ambiente: ${ESOCIAL_AMBIENTE}`);
});
