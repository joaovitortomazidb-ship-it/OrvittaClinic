import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";

import { db } from "./firebase";


// ============================================================
// CLÍNICA
// ============================================================

export async function bootstrapClinic(
  user,
  clinicName = "Minha Clínica Odontológica",
  profile = {}
) {
  if (!user?.uid) return null;

  const clinicId = user.uid;

  const clinicRef = doc(
    db,
    "clinics",
    clinicId
  );

  const memberRef = doc(
    db,
    "clinics",
    clinicId,
    "members",
    user.uid
  );

  const clinicSnap = await getDoc(clinicRef);

  // Cria a clínica se ainda não existir
  if (!clinicSnap.exists()) {
    await setDoc(clinicRef, {
      name: clinicName,
      ownerUid: user.uid,
      ownerEmail: user.email || "",
      ownerName: profile.name || user.displayName || "Administrador",
      phone: profile.phone || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Garante que o proprietário também exista como membro
  const memberSnap = await getDoc(memberRef);

  if (!memberSnap.exists()) {
    await setDoc(memberRef, {
      uid: user.uid,
      email: user.email || "",
      name:
        profile.name ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "Administrador",
      role: "owner",
      clinicId,
      status: "Ativo",
      permissions: [
        "patients.view", "patients.create", "patients.edit", "patients.delete",
        "appointments.view", "appointments.create", "appointments.edit", "appointments.confirm", "appointments.cancel", "appointments.delete",
        "records.view", "records.create", "records.edit", "records.delete",
        "finances.view", "finances.create", "finances.edit", "finances.payments",
        "stock.view", "stock.create", "stock.edit", "stock.delete", "stock.in", "stock.out",
        "professionals.view", "professionals.create", "professionals.edit", "professionals.block", "professionals.delete",
        "reports.view", "settings.view", "settings.edit"
      ],
      phone: profile.phone || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  return clinicId;
}


export async function getClinic(clinicId) {
  if (!clinicId) return null;

  const snap = await getDoc(
    doc(db, "clinics", clinicId)
  );

  return snap.exists()
    ? {
      id: snap.id,
      ...snap.data()
    }
    : null;
}


export async function saveClinic(clinicId, data) {
  if (!clinicId) return null;

  const clinicRef = doc(
    db,
    "clinics",
    clinicId
  );

  await setDoc(
    clinicRef,
    {
      ...data,
      updatedAt: serverTimestamp()
    },
    {
      merge: true
    }
  );

  return clinicId;
}


// ============================================================
// MEMBROS DA CLÍNICA
// ============================================================

export async function addClinicMember(
  clinicId,
  user,
  role = "secretary",
  memberData = {}
) {
  if (!clinicId || !user?.uid) return null;

  const memberRef = doc(
    db,
    "clinics",
    clinicId,
    "members",
    user.uid
  );

  await setDoc(memberRef, {
    uid: user.uid,
    email: user.email || "",
    name:
      user.displayName ||
      user.email?.split("@")[0] ||
      "Usuário",
    role,
    clinicId,
    status: memberData.status || "Ativo",
    phone: memberData.phone || "",
    permissions: memberData.permissions || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return memberRef.id;
}


export async function getClinicMember(
  clinicId,
  uid
) {
  if (!clinicId || !uid) return null;

  const snap = await getDoc(
    doc(
      db,
      "clinics",
      clinicId,
      "members",
      uid
    )
  );

  return snap.exists()
    ? {
      id: snap.id,
      ...snap.data()
    }
    : null;
}


export async function getClinicMembers(
  clinicId
) {
  if (!clinicId) return [];

  const snap = await getDocs(
    collection(
      db,
      "clinics",
      clinicId,
      "members"
    )
  );

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

export async function updateClinicMember(clinicId, uid, data) {
  if (!clinicId || !uid) throw new Error("Clínica ou usuário não informado.");
  await updateDoc(
    doc(db, "clinics", clinicId, "members", uid),
    { ...data, clinicId, updatedAt: serverTimestamp() }
  );
  return uid;
}


// ============================================================
// COLEÇÕES DA CLÍNICA
// ============================================================

export function subscribeCollection(
  clinicId,
  collectionName,
  callback,
  onError
) {
  if (!clinicId || !collectionName) {
    return () => { };
  }

  const collectionRef = collection(
    db,
    "clinics",
    clinicId,
    collectionName
  );

  return onSnapshot(
    collectionRef,
    snapshot => {
      const items = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      callback(items);
    },
    error => {
      if (onError) {
        onError(error);
      }
    }
  );
}


// ============================================================
// ADICIONAR ITEM
// ============================================================

export async function addItem(
  clinicId,
  collectionName,
  data
) {
  if (!clinicId || !collectionName) {
    throw new Error(
      "Clínica ou coleção não informada."
    );
  }

  const collectionRef = collection(
    db,
    "clinics",
    clinicId,
    collectionName
  );

  const docRef = await addDoc(
    collectionRef,
    {
      ...data,
      clinicId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );

  return docRef.id;
}


// ============================================================
// ATUALIZAR ITEM
// ============================================================

export async function updateItem(
  clinicId,
  collectionName,
  id,
  data
) {
  if (
    !clinicId ||
    !collectionName ||
    !id
  ) {
    throw new Error(
      "Dados insuficientes para atualizar."
    );
  }

  const itemRef = doc(
    db,
    "clinics",
    clinicId,
    collectionName,
    id
  );

  await updateDoc(
    itemRef,
    {
      ...data,
      updatedAt: serverTimestamp()
    }
  );

  return id;
}


// ============================================================
// REMOVER ITEM
// ============================================================

export async function removeItem(
  clinicId,
  collectionName,
  id
) {
  if (
    !clinicId ||
    !collectionName ||
    !id
  ) {
    throw new Error(
      "Dados insuficientes para remover."
    );
  }

  const itemRef = doc(
    db,
    "clinics",
    clinicId,
    collectionName,
    id
  );

  await deleteDoc(itemRef);

  return id;
}