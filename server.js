import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const ESOCIAL_AMBIENTE = process.env.ESOCIAL_AMBIENTE || "homologacao";

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// Log TODAS as requisições que chegarem
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.path} — ${new Date().toISOString()}`);
  next();
});

app.get("/", (req, res) => {
  res.json({ ok: true, service: "sgi-esocial-service", versao: "2.3.0" });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "sgi-esocial-service",
    ambiente: ESOCIAL_AMBIENTE,
    versao: "2.3.0",
    porta: PORT,
  });
});

let transmitirEvento = null;

async function handleTransmissao(req, res) {
  if (!transmitirEvento) {
    return res.status(503).json({ ok: false, error: "Módulo de transmissão ainda carregando." });
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

app.post("/transmitir-evento", handleTransmissao);
app.post("/transmitir-s2210",  handleTransmissao);
app.post("/transmitir-s2220",  handleTransmissao);
app.post("/transmitir-s2221",  handleTransmissao);

// Catch-all — qualquer rota não encontrada retorna JSON (não HTML)
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.path}`);
  res.status(404).json({ ok: false, error: "Rota não encontrada: " + req.path });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SGI eSocial Service v2.3 — porta ${PORT} — ambiente: ${ESOCIAL_AMBIENTE}`);
  import("./transmitir.js").then(mod => {
    transmitirEvento = mod.transmitirEvento;
    console.log("[SGI] transmitir.js carregado.");
  }).catch(err => {
    console.error("[SGI] ERRO transmitir.js:", err.message);
  });
});
