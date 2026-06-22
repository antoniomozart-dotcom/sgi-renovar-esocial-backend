import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 10000;
const ESOCIAL_AMBIENTE = process.env.ESOCIAL_AMBIENTE || "homologacao_simulada";
const SERVICE_VERSION = "2.3.0";

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"]
}));

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Log de todas as requisições
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl} — ${new Date().toISOString()}`);
  next();
});

// Resposta padrão para OPTIONS
app.options("*", (req, res) => {
  return res.status(204).send();
});

// Página inicial do backend
app.get("/", (req, res) => {
  return res.json({
    ok: true,
    service: "SGI Renovar eSocial Backend",
    name: "sgi-esocial-service",
    versao: SERVICE_VERSION,
    ambiente: ESOCIAL_AMBIENTE,
    status: "online",
    rotas: {
      health: "GET /health",
      transmitir_principal: "POST /api/esocial/transmitir",
      transmitir_evento: "POST /transmitir-evento",
      transmitir_s2210: "POST /transmitir-s2210",
      transmitir_s2220: "POST /transmitir-s2220",
      transmitir_s2221: "POST /transmitir-s2221"
    }
  });
});

// Health check
app.get("/health", (req, res) => {
  return res.json({
    ok: true,
    service: "sgi-esocial-service",
    versao: SERVICE_VERSION,
    ambiente: ESOCIAL_AMBIENTE,
    porta: PORT,
    status: "online",
    timestamp: new Date().toISOString()
  });
});

// Variável que receberá a função importada de transmitir.js
let transmitirEvento = null;

// Função utilitária para extrair o ID do evento
function extrairEventoId(body = {}) {
  return (
    body.evento_id ||
    body.eventoId ||
    body.id ||
    body.cat_id ||
    body.catId ||
    body.s2210_id ||
    body.s2220_id ||
    body.s2221_id ||
    body.evento?.id ||
    body.evento?.evento_id ||
    null
  );
}

// Handler único de transmissão
async function handleTransmissao(req, res) {
  try {
    if (!transmitirEvento) {
      return res.status(503).json({
        ok: false,
        error: "Módulo de transmissão ainda não carregado.",
        detalhe: "O arquivo transmitir.js ainda não foi importado pelo servidor."
      });
    }

    const body = req.body || {};
    const eventoId = extrairEventoId(body);

    if (!eventoId) {
      return res.status(400).json({
        ok: false,
        error: "evento_id obrigatório.",
        detalhe: "Envie no corpo da requisição um campo evento_id, id, cat_id, s2210_id, s2220_id ou s2221_id.",
        body_recebido: body
      });
    }

    console.log("[SGI] Iniciando transmissão do evento:", eventoId);

    const resultado = await transmitirEvento({
      evento_id: eventoId,
      origem: req.originalUrl,
      body
    });

    console.log("[SGI] Resultado da transmissão:", resultado);

    return res.json({
      ok: true,
      message: "Evento processado pelo backend eSocial.",
      ambiente: ESOCIAL_AMBIENTE,
      evento_id: eventoId,
      timestamp: new Date().toISOString(),
      ...resultado
    });

  } catch (error) {
    console.error("[ERRO transmissão]", error);

    return res.status(500).json({
      ok: false,
      error: "Erro interno ao transmitir evento.",
      detalhe: error?.message || String(error)
    });
  }
}

// Rota principal recomendada
app.post("/api/esocial/transmitir", handleTransmissao);

// Rotas de compatibilidade
app.post("/transmitir-evento", handleTransmissao);
app.post("/api/transmitir-evento", handleTransmissao);
app.post("/api/esocial/transmitir-evento", handleTransmissao);

app.post("/transmitir-s2210", handleTransmissao);
app.post("/transmitir-s2220", handleTransmissao);
app.post("/transmitir-s2221", handleTransmissao);

app.post("/api/esocial/transmitir-s2210", handleTransmissao);
app.post("/api/esocial/transmitir-s2220", handleTransmissao);
app.post("/api/esocial/transmitir-s2221", handleTransmissao);

// Rota simples de teste sem depender do transmitir.js
app.post("/api/esocial/teste", (req, res) => {
  return res.json({
    ok: true,
    message: "Backend recebeu o teste com sucesso.",
    ambiente: ESOCIAL_AMBIENTE,
    recebido_em: new Date().toISOString(),
    body: req.body || {}
  });
});

// 404 sempre em JSON
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`);

  return res.status(404).json({
    ok: false,
    error: "Rota não encontrada.",
    method: req.method,
    path: req.originalUrl,
    rotas_disponiveis: [
      "GET /",
      "GET /health",
      "POST /api/esocial/transmitir",
      "POST /transmitir-evento",
      "POST /transmitir-s2210",
      "POST /transmitir-s2220",
      "POST /transmitir-s2221",
      "POST /api/esocial/teste"
    ]
  });
});

// Tratamento global de erro
app.use((err, req, res, next) => {
  console.error("[ERRO GLOBAL]", err);

  return res.status(500).json({
    ok: false,
    error: "Erro global no servidor.",
    detalhe: err?.message || String(err)
  });
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`SGI eSocial Service v${SERVICE_VERSION} — porta ${PORT} — ambiente: ${ESOCIAL_AMBIENTE}`);

  try {
    const mod = await import("./transmitir.js");

    if (!mod.transmitirEvento) {
      console.error("[SGI] ERRO: transmitir.js não exporta a função transmitirEvento.");
      return;
    }

    transmitirEvento = mod.transmitirEvento;
    console.log("[SGI] transmitir.js carregado com sucesso.");

  } catch (err) {
    console.error("[SGI] ERRO ao carregar transmitir.js:", err?.message || String(err));
  }
});
