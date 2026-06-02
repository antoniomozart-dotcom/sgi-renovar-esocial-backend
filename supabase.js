import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env");
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

export async function baixarArquivoPrivado(bucket, path) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);

  if (error) {
    throw new Error(`Erro ao baixar arquivo ${bucket}/${path}: ${error.message}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function salvarArquivoPrivado(bucket, path, buffer, contentType = "application/xml") {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType,
      upsert: true
    });

  if (error) {
    throw new Error(`Erro ao salvar arquivo ${bucket}/${path}: ${error.message}`);
  }

  return path;
}

export async function registrarLog(evento_id, tipo, descricao, payload = {}) {
  await supabase.from("esocial_logs").insert([{
    evento_id,
    tipo,
    descricao,
    payload
  }]);
}
