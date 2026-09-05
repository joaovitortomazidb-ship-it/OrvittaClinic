const crypto = require("node:crypto");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = defineSecret("WHATSAPP_PHONE_NUMBER_ID");
const WEBHOOK_VERIFY_TOKEN = defineSecret("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

function confirmationTokens() {
  return {
    confirm: crypto.randomBytes(32).toString("hex"),
    cancel: crypto.randomBytes(32).toString("hex")
  };
}

function messageFor(appointment, clinicName, confirmUrl, cancelUrl) {
  return `Olá, ${appointment.patient}!\n\nAqui é da ${clinicName}.\n\nConfirme sua consulta:\nData: ${appointment.date}\nHorário: ${appointment.startTime || appointment.time}\nProfissional: ${appointment.professional || "Não informado"}\nProcedimento: ${appointment.type || "Consulta"}\n\nConfirmar: ${confirmUrl}\nCancelar: ${cancelUrl}`;
}

async function sendWhatsApp(to, text) {
  const response = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN.value()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } })
  });
  if (!response.ok) throw new Error(`WhatsApp API returned ${response.status}`);
  return response.json();
}

exports.processWhatsAppOutbox = onDocumentCreated(
  { document: "clinics/{clinicId}/whatsappOutbox/{outboxId}", secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID] },
  async event => {
    const outbox = event.data.data();
    if (outbox.status !== "queued" || !outbox.appointmentId || !outbox.phone) return;
    const appointmentRef = db.doc(`clinics/${event.params.clinicId}/appointments/${outbox.appointmentId}`);
    const appointmentSnap = await appointmentRef.get();
    if (!appointmentSnap.exists) return;
    const appointment = appointmentSnap.data();
    const token = confirmationTokens();
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await appointmentRef.update({ confirmationToken: token.confirm, cancellationToken: token.cancel, confirmationTokenExpiresAt: expiresAt, whatsappStatus: "sending" });
    try {
      const clinicSnap = await db.doc(`clinics/${event.params.clinicId}`).get();
      const clinicName = clinicSnap.data()?.name || "sua clínica";
      const baseUrl = process.env.PUBLIC_APP_URL || "https://odontoflow-40200.web.app";
      const sent = await sendWhatsApp(outbox.phone, messageFor(appointment, clinicName, `${baseUrl}/confirmar/${token.confirm}`, `${baseUrl}/cancelar/${token.cancel}`));
      await outbox.ref.update({ status: "sent", providerMessageId: sent.messages?.[0]?.id || null, sentAt: admin.firestore.FieldValue.serverTimestamp() });
      await appointmentRef.update({ whatsappStatus: "sent", confirmationSentAt: admin.firestore.FieldValue.serverTimestamp() });
      await db.collection(`clinics/${event.params.clinicId}/appointment_events`).add({ appointmentId: outbox.appointmentId, type: "WHATSAPP_ENVIADO", source: "whatsapp", createdAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (error) {
      await outbox.ref.update({ status: "failed", error: String(error.message || error), failedAt: admin.firestore.FieldValue.serverTimestamp() });
      await appointmentRef.update({ whatsappStatus: "failed" });
    }
  }
);

exports.whatsappWebhook = onRequest({ secrets: [WEBHOOK_VERIFY_TOKEN] }, async (req, res) => {
  if (req.method === "GET") {
    if (req.query["hub.verify_token"] !== WEBHOOK_VERIFY_TOKEN.value()) return res.sendStatus(403);
    return res.status(200).send(req.query["hub.challenge"]);
  }
  if (req.method !== "POST") return res.sendStatus(405);
  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const text = String(message?.text?.body || "").trim().toLowerCase();
  if (!message || !text) return res.sendStatus(200);
  const accepted = text === "confirmar" || text === "confirmo" || text === "sim" ? "confirmed" : text === "cancelar" || text === "cancelo" || text === "nao" || text === "não" ? "cancelled" : null;
  if (!accepted) return res.sendStatus(200);
  const snapshot = await db.collectionGroup("appointments").where("phone", "==", message.from).limit(20).get();
  const appointmentDoc = snapshot.docs.find(doc => (doc.data().confirmationStatus || "pending") === "pending");
  if (!appointmentDoc) return res.sendStatus(200);
  const appointmentRef = appointmentDoc.ref;
  await appointmentRef.update({ status: accepted === "confirmed" ? "Confirmada" : "Cancelada", confirmationStatus: accepted, confirmationResponse: accepted, confirmationSource: "whatsapp", confirmationRespondedAt: admin.firestore.FieldValue.serverTimestamp(), whatsappStatus: "read" });
  return res.sendStatus(200);
});
