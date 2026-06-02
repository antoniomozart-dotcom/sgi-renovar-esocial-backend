```js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { transmitirS2210 } from "./transmitirS2210.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "sgi-esocial-service",
    ambiente:
      process.env.ESOCIAL_AMBIENTE ||
      "producao_restrita"
  });
});

app.post("/transmitir-s2210", async (req, res) => {
  try {

    const { cat_id, evento_id } = req.body;

    if (!cat_id && !evento_id) {
      return res.status(400).json({
        ok: false,
        error: "Informe cat_id ou evento_id."
      });
    }

    const resultado =
      await transmitirS2210({
        cat_id,
        evento_id
      });

    return res.json(resultado);

  } catch (error) {

    console.error(
      "Erro /transmitir-s2210:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        "Erro interno no serviço eSocial."
    });
  }
});

app.listen(PORT, () => {
  console.log(
   `SGI eSocial Service rodando na porta` 
  );
});
```

