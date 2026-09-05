import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, firebaseEnabled } from "../firebase";

export const whatsappStatus = {
  notSent: "not_sent",
  sending: "sending",
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed"
};

export function normalizeWhatsAppNumber(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function enqueueAppointmentConfirmation(clinicId, appointment) {
  if (!firebaseEnabled || !db || !clinicId || !appointment?.phone) {
    return { queued: false, reason: "whatsapp_unavailable" };
  }

  const phone = normalizeWhatsAppNumber(appointment.phone);
  if (!phone) return { queued: false, reason: "missing_phone" };

  const ref = await addDoc(collection(db, "clinics", clinicId, "whatsappOutbox"), {
    type: "appointment_confirmation",
    clinicId,
    appointmentId: appointment.id || null,
    patientId: appointment.patientId || null,
    phone,
    status: "queued",
    createdAt: serverTimestamp()
  });

  return { queued: true, id: ref.id };
}

export function formatAppointmentConfirmation({ patient, clinic, date, time, professional, type }) {
  return `Olá, ${patient}!\n\nAqui é da ${clinic}.\n\nGostaríamos de confirmar sua consulta:\n\nData: ${date}\nHorário: ${time}\nProfissional: ${professional || "Não informado"}\nProcedimento: ${type || "Consulta"}\n\nResponda CONFIRMAR ou CANCELAR.`;
}
