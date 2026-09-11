import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, writeBatch
} from "firebase/firestore";
import { db } from "./firebase";

const path = (clinicId, collectionName) => collection(db, "clinics", clinicId, collectionName);
const ref = (clinicId, collectionName, id) => doc(db, "clinics", clinicId, collectionName, id);

export async function bootstrapClinic(user, clinicName="Minha Clínica Odontológica", metadata={}) {
  const clinicId = user.uid;
  const clinicRef = doc(db, "clinics", clinicId);
  const snap = await getDoc(clinicRef);
  if (snap.exists()) return { clinicId, ...snap.data() };

  const batch = writeBatch(db);
  batch.set(clinicRef, {
    name: clinicName,
    ownerUid: user.uid,
    phone: metadata.phone || "",
    address: metadata.address || "",
    organizationType: metadata.organizationType || "clinic",
    institutionName: metadata.institutionName || "",
    course: metadata.course || "",
    isClinicSchool: metadata.isClinicSchool === true,
    schoolSettings: metadata.isClinicSchool === true ? {enabled:true,groups:[]} : {enabled:false,groups:[]},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  batch.set(doc(db, "clinics", clinicId, "members", user.uid), {
    uid: user.uid,
    email: user.email || "",
    role: "owner",
    name: user.displayName || user.email?.split("@")[0] || "Administrador",
    createdAt: serverTimestamp()
  });
  await batch.commit();
  return { clinicId, name: clinicName, ownerUid: user.uid, ...metadata };
}

export async function getClinic(clinicId) {
  const snap = await getDoc(doc(db, "clinics", clinicId));
  return snap.exists() ? {id:snap.id,...snap.data()} : null;
}

export async function saveClinic(clinicId, data) {
  await updateDoc(doc(db, "clinics", clinicId), {...data, updatedAt:serverTimestamp()});
}

export function subscribeCollection(clinicId, collectionName, onData, onError) {
  const q = query(path(clinicId, collectionName), orderBy("createdAt","desc"));
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({id:d.id,...d.data()})));
  }, onError);
}

export async function addItem(clinicId, collectionName, data) {
  const r = await addDoc(path(clinicId, collectionName), {...data, createdAt:serverTimestamp(), updatedAt:serverTimestamp()});
  return r.id;
}

export async function updateItem(clinicId, collectionName, id, data) {
  await updateDoc(ref(clinicId, collectionName, id), {...data, updatedAt:serverTimestamp()});
}

export async function removeItem(clinicId, collectionName, id) {
  await deleteDoc(ref(clinicId, collectionName, id));
}


export async function addClinicMember(clinicId, account, role='secretary', extra={}) {
  if (!account?.uid) throw new Error('Conta do funcionário inválida.');
  const memberRef = doc(db, 'clinics', clinicId, 'members', account.uid);
  await setDoc(memberRef, {
    uid: account.uid,
    email: account.email || extra.email || '',
    role,
    name: extra.name || account.displayName || account.email?.split('@')[0] || 'Funcionário',
    status: extra.status || 'Ativo',
    permissions: Array.isArray(extra.permissions) ? extra.permissions : [],
    phone: extra.phone || '',
    clinicId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return account.uid;
}

export async function getClinicMembers(clinicId) {
  const snap = await getDocs(collection(db, 'clinics', clinicId, 'members'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateClinicMember(clinicId, uid, data) {
  if (!uid) throw new Error('Identificador do membro não informado.');
  const memberRef = doc(db, 'clinics', clinicId, 'members', uid);
  await updateDoc(memberRef, { ...data, updatedAt: serverTimestamp() });
}
