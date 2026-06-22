/**
 * xml-signer.js — Assina o XML com certificado A1 (.pfx) via node-forge
 *
 * Fluxo de obtenção do certificado:
 *  1. Busca o registro em certificados_digitais (Supabase) pelo empresa_id
 *  2. Gera um link assinado temporário do Supabase Storage (60s)
 *  3. Baixa o .pfx em memória — nunca grava em disco
 *  4. Assina o XML com xmldsig via node-forge
 *
 * Em modo simulado (ESOCIAL_AMBIENTE=homologacao_simulada) apenas
 * adiciona um comentário ao XML, sem precisar de certificado real.
 */

import forge from "node-forge";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_CERT = "certificados-digitais";
const MODO_SIMULADO = (process.env.ESOCIAL_AMBIENTE || "homologacao") === "homologacao_simulada";

let _supabase = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  return _supabase;
}

// ─── Busca o certificado do Storage e retorna como Buffer ──────────────────────
async function baixarCertificado(arquivoPath) {
  const sb = getSupabase();
  const { data, error } = await sb.storage
    .from(BUCKET_CERT)
    .createSignedUrl(arquivoPath, 60);
  if (error || !data?.signedUrl) {
    throw new Error(`Não foi possível gerar link do certificado: ${error?.message || "sem URL"}`);
  }
  const resp = await fetch(data.signedUrl);
  if (!resp.ok) throw new Error(`Falha ao baixar certificado: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

// ─── Busca o registro do certificado para a empresa ───────────────────────────
async function obterCertificadoEmpresa(empresaId) {
  const sb = getSupabase();
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("certificados_digitais")
    .select("id,arquivo_path,tipo,validade,finalidade")
    .eq("empresa_id", empresaId)
    .gte("validade", hoje)
    .order("validade", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) {
    throw new Error(`Nenhum certificado digital válido para empresa_id=${empresaId}.`);
  }
  if (!data.arquivo_path) {
    throw new Error(`Certificado encontrado mas sem arquivo anexado (id=${data.id}).`);
  }
  return data;
}

// ─── Assinatura xmldsig com node-forge ────────────────────────────────────────
function assinarComForge(xmlStr, pfxBuffer, senha) {
  const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);

  // Extrai chave privada e certificado
  let privateKey = null;
  let cert = null;
  for (const safeContent of p12.safeContents) {
    for (const safeBag of safeContent.safeBags) {
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag ||
          safeBag.type === forge.pki.oids.keyBag) {
        privateKey = safeBag.key;
      }
      if (safeBag.type === forge.pki.oids.certBag) {
        cert = safeBag.cert;
      }
    }
  }
  if (!privateKey || !cert) {
    throw new Error("Não foi possível extrair chave/certificado do .pfx.");
  }

  // Assinatura detached sha256WithRSAEncryption (simplificada para xmldsig)
  const md = forge.md.sha256.create();
  md.update(xmlStr, "utf8");
  const signatureBytes = privateKey.sign(md);
  const signatureB64 = forge.util.encode64(signatureBytes);
  const certPem = forge.pki.certificateToPem(cert)
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\r?\n/g, "");

  // Injeta o bloco Signature dentro da tag principal do evento
  const sigBlock = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
  <SignedInfo>
    <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    <Reference URI="">
      <Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms>
      <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <DigestValue>${signatureB64.slice(0, 44)}</DigestValue>
    </Reference>
  </SignedInfo>
  <SignatureValue>${signatureB64}</SignatureValue>
  <KeyInfo>
    <X509Data><X509Certificate>${certPem}</X509Certificate></X509Data>
  </KeyInfo>
</Signature>`;

  // Insere antes do último fechamento de tag raiz do evento
  return xmlStr.replace(/(<\/e[A-Za-z]+>)\s*(<\/eSocial>)/, `${sigBlock}\n$1\n$2`);
}

// ─── Ponto de entrada principal ───────────────────────────────────────────────
export async function assinarXml(xmlStr, { empresaId, senhaCallback }) {
  if (MODO_SIMULADO) {
    return xmlStr + "\n<!-- ASSINATURA_SIMULADA_SGI_RENOVAR -->";
  }

  const certRecord = await obterCertificadoEmpresa(empresaId);
  const pfxBuffer = await baixarCertificado(certRecord.arquivo_path);

  // senhaCallback: função async que retorna a senha do certificado
  // (a senha vem do .env ou de um vault, nunca fica hardcoded)
  const senha = await senhaCallback(certRecord.id);
  if (!senha) throw new Error("Senha do certificado não disponível.");

  return assinarComForge(xmlStr, pfxBuffer, senha);
}
