import { createClient } from "@supabase/supabase-js";
import { auth } from "../firebase";



export const BUCKET_NAME = "patient-attachments";
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export const ATTACHMENT_CATEGORIES = [
  "Radiografia",
  "Foto clínica",
  "Atestado",
  "Contrato",
  "Termo de consentimento",
  "Documento",
  "Exame",
  "Outros"
];

export const ALLOWED_FILE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".tif",
  ".tiff",
  ".bmp",
  ".svg",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt"
];

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "image/bmp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain"
];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Verifica se o Supabase está devidamente configurado com URL e chave anônima/publicável.
 */
export function isSupabaseConfigured() {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.trim() !== "" &&
    supabaseAnonKey.trim() !== ""
  );
}

/**
 * Obtém dinamicamente o ID Token atual do Firebase Authentication.
 * Permite que o Supabase valide o usuário e aplique policies com 'authenticated'.
 */
export async function getFirebaseIdToken(forceRefresh = false) {
  try {
    if (!auth || !auth.currentUser) return null;
    // Force refresh = true forces token refresh to include latest custom claims
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch (err) {
    console.warn("Não foi possível obter o Firebase ID Token:", err);
    return null;
  }
}

/**
 * Cliente Supabase configurado exclusivamente com a chave pública/anônima
 * e injeção dinâmica do Firebase ID Token como accessToken para requisições autenticadas.
 * NUNCA utiliza service_role no frontend.
 */
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      accessToken: async () => {
        if (!auth || !auth.currentUser) return null;
        const token = await getFirebaseIdToken(true);
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(window.atob(base64));
          console.log('Firebase ID token payload:', payload);
          if (!payload.role) {
            console.warn(
              "Firebase ID token missing 'role' claim. Add it via Firebase Admin SDK/Cloud Function."
            );
          }
        } catch (e) {
          console.warn('Failed to decode Firebase token', e);
        }
        return token;
      }
    })
  : null;

/**
 * Sanitiza o nome do arquivo para prevenir caracteres maliciosos ou incompatíveis com URLs.
 */
export function sanitizeFileName(fileName = "arquivo") {
  const lastDot = fileName.lastIndexOf(".");
  const baseName = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
  const extension = lastDot > 0 ? fileName.substring(lastDot) : "";

  const safeBase = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, "_") // substitui caracteres especiais
    .replace(/_+/g, "_")
    .substring(0, 80);

  const safeExt = extension.toLowerCase().replace(/[^a-z0-9.]/g, "");

  return `${safeBase || "anexo"}${safeExt}`;
}

/**
 * Gera um UUID seguro para identificar unicamente o arquivo no Storage.
 */
export function generateUniqueId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
}

/**
 * Monta o caminho obrigatório padronizado:
 * clinics/{clinicId}/patients/{patientId}/attachments/{uuid}-{safeFileName}
 */
export function generateStoragePath(clinicId, patientId, originalFileName) {
  if (!clinicId || !patientId) {
    throw new Error("Clínica e paciente são obrigatórios para gerar o caminho do arquivo.");
  }
  const uuid = generateUniqueId();
  const safeName = sanitizeFileName(originalFileName);
  return `clinics/${clinicId}/patients/${patientId}/attachments/${uuid}-${safeName}`;
}

/**
 * Formata o tamanho do arquivo em B, KB ou MB.
 */
export function formatFileSize(bytes = 0) {
  if (typeof bytes !== "number" || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Validação rigorosa de tamanho (máximo 15 MB) e tipo de arquivo permitido.
 */
export function validateAttachmentFile(file) {
  if (!file) {
    return { valid: false, error: "Nenhum arquivo foi selecionado." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `O arquivo deve ter no máximo 15 MB (tamanho atual: ${formatFileSize(file.size)}).`
    };
  }

  const fileNameLower = (file.name || "").toLowerCase();
  const hasAllowedExt = ALLOWED_FILE_EXTENSIONS.some(ext =>
    fileNameLower.endsWith(ext)
  );

  const mime = file.type ? file.type.toLowerCase() : "";
  const hasAllowedMime =
    ALLOWED_MIME_TYPES.includes(mime) ||
    mime.startsWith("image/") ||
    mime === "application/pdf";

  if (!hasAllowedExt && !hasAllowedMime) {
    return {
      valid: false,
      error:
        "Formato de arquivo não suportado. Envie imagens, radiografias, fotos, PDFs ou documentos (DOC, DOCX, XLS, XLSX, TXT)."
    };
  }

  return { valid: true, error: null };
}

/**
 * Sugere categoria clínica automaticamente pelo nome do arquivo.
 */
export function suggestCategoryFromFileName(fileName = "") {
  const lower = fileName.toLowerCase();
  if (
    lower.includes("rx") ||
    lower.includes("panor") ||
    lower.includes("periapical") ||
    lower.includes("telerad") ||
    lower.includes("tomograf") ||
    lower.includes("radiograf") ||
    lower.includes("interproximal")
  ) {
    return "Radiografia";
  }
  if (
    lower.includes("foto") ||
    lower.includes("facial") ||
    lower.includes("intraoral") ||
    lower.includes("extraoral") ||
    lower.includes("sorriso") ||
    lower.includes("oclusal")
  ) {
    return "Foto clínica";
  }
  if (lower.includes("atestado")) return "Atestado";
  if (lower.includes("contrato")) return "Contrato";
  if (lower.includes("termo") || lower.includes("consentimento"))
    return "Termo de consentimento";
  if (lower.includes("laudo") || lower.includes("exame")) return "Exame";
  return "Outros";
}

/**
 * Traduz erros do Supabase Storage para mensagens claras em português.
 */
export function mapStorageErrorMessage(err) {
  const message = (err?.message || "").toLowerCase();
  const code = (err?.statusCode || err?.code || "").toString();

  if (code === "403" || message.includes("unauthorized") || message.includes("policy")) {
    return "Você não tem permissão para realizar esta operação no armazenamento. Verifique se seu login está ativo.";
  }
  if (code === "404" || message.includes("not found")) {
    return "O arquivo solicitado não foi encontrado no armazenamento.";
  }
  if (message.includes("payload too large") || message.includes("entity too large")) {
    return "O arquivo excede o limite máximo permitido pelo servidor de 15 MB.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Erro de conexão com o Supabase Storage. Verifique sua conexão com a internet.";
  }
  return err?.message || "Ocorreu um erro no armazenamento de arquivos.";
}

/**
 * Realiza o upload de um arquivo para o Supabase Storage no bucket privado patient-attachments.
 */
export async function uploadAttachmentFile({
  clinicId,
  patientId,
  file,
  onProgress
}) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error(
      "Supabase Storage não configurado. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env."
    );
  }



  const validation = validateAttachmentFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const storagePath = generateStoragePath(clinicId, patientId, file.name);

  if (onProgress) onProgress(15);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream"
    });

  if (error) {
    console.error("Supabase upload error (raw):", error);
    throw new Error(mapStorageErrorMessage(error));
  }

  if (onProgress) onProgress(75);

  // Gera uma signed URL temporária (1 hora) para visualização imediata segura
  let signedUrl = "";
  try {
    signedUrl = await getSignedAttachmentUrl(storagePath, 3600);
  } catch (signErr) {
    console.warn("Não foi possível gerar a signed URL inicial:", signErr);
  }

  if (onProgress) onProgress(100);

  return {
    storagePath,
    fileName: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    url: signedUrl || ""
  };
}

/**
 * Gera uma Signed URL temporária (com expiração em segundos) para acesso seguro ao bucket privado.
 */
export async function getSignedAttachmentUrl(storagePath, expiresIn = 3600) {
  if (!isSupabaseConfigured() || !supabase || !storagePath) return "";

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn("Erro ao gerar URL assinada para", storagePath, error);
    return "";
  }

  return data.signedUrl;
}

/**
 * Baixa o arquivo do Supabase Storage e aciona o download no navegador mantendo o nome do arquivo.
 */
export async function downloadAttachmentFile(storagePath, originalFileName) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error("Supabase Storage não está configurado.");
  }

  if (!storagePath) {
    throw new Error("Caminho do arquivo não fornecido para download.");
  }

  const { data: blob, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error || !blob) {
    console.error("Supabase download error (raw):", error);
    throw new Error(mapStorageErrorMessage(error || { message: "Falha ao baixar arquivo." }));
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = originalFileName || "anexo";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Remove fisicamente o arquivo do bucket privado no Supabase Storage.
 */
export async function deleteAttachmentFile(storagePath) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error("Supabase Storage não está configurado.");
  }

  if (!storagePath) return;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error("Supabase delete error (raw):", error);
    throw new Error(mapStorageErrorMessage(error));
  }
}
