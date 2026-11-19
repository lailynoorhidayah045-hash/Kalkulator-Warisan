import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  isBootstrappedAdminUser,
  OperationType,
} from '../firebase';
import {
  AppState,
  FamilyCounts,
  FinancialInputs,
  FirestoreAdminRecord,
  FirestoreCoachLog,
  FirestoreIdentityRecord,
  FirestoreSimulationLog,
  HEIR_METADATA,
  HeirKey,
  LegalSystem,
  SavedCase,
  UserIdentity,
} from '../types/inheritance';

function clampStr(val: string | undefined | null, maxLen: number): string {
  return (val ?? '').trim().slice(0, maxLen);
}

function makeSafeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function tsToMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function sanitizeIdentity(raw?: UserIdentity): UserIdentity {
  return {
    fullName: clampStr(raw?.fullName, 120),
    role: clampStr(raw?.role, 80) || 'Ahli Waris / Anggota Keluarga',
    deceasedName: clampStr(raw?.deceasedName, 120),
    city: clampStr(raw?.city, 100),
    contact: clampStr(raw?.contact, 120),
    notes: clampStr(raw?.notes, 500),
  };
}

function sanitizeFinancials(fin: FinancialInputs): FinancialInputs {
  const num = (v: number): number => (Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    grossAssets: num(fin.grossAssets),
    debts: num(fin.debts),
    funeralCosts: num(fin.funeralCosts),
    willAmount: num(fin.willAmount),
  };
}

function sanitizeFamily(fam: FamilyCounts): FamilyCounts {
  const out = {} as FamilyCounts;
  for (const key of Object.keys(HEIR_METADATA) as HeirKey[]) {
    const max = HEIR_METADATA[key].max;
    const raw = Math.trunc(Number(fam[key]) || 0);
    out[key] = Math.min(max, Math.max(0, raw));
  }
  return out;
}

export async function checkIsAdminInDb(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (isBootstrappedAdminUser(user)) return true;

  const adminPath = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch (error) {
    // Non-admin user may get permission-denied if rules restrict, or exists() returns false
    console.warn('Admin check fallback:', error);
    return false;
  }
}

export async function syncUserProfile(user: User): Promise<void> {
  if (!user.emailVerified) return;

  const userRef = doc(db, 'users', user.uid);
  const privateRef = doc(db, 'users', user.uid, 'private', 'info');
  const displayName = clampStr(user.displayName || user.email?.split('@')[0], 120) || 'Pengguna';
  const photoURL = clampStr(user.photoURL, 500);
  const email = clampStr(user.email, 150) || `${user.uid}@user.local`;

  try {
    const existingSnap = await getDoc(userRef);
    const batch = writeBatch(db);

    if (!existingSnap.exists()) {
      const profilePayload: Record<string, unknown> = {
        uid: user.uid,
        displayName,
        role: isBootstrappedAdminUser(user) ? 'admin' : 'user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photoURL) {
        profilePayload.photoURL = photoURL;
      }
      batch.set(userRef, profilePayload);
      batch.set(privateRef, {
        uid: user.uid,
        email,
        lastLoginAt: serverTimestamp(),
      });
    } else {
      const updatePayload: Record<string, unknown> = {
        displayName,
        updatedAt: serverTimestamp(),
      };
      if (photoURL) {
        updatePayload.photoURL = photoURL;
      }
      batch.update(userRef, updatePayload);
      batch.set(
        privateRef,
        {
          uid: user.uid,
          email,
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function saveIdentityToFirestore(
  user: User,
  identity: UserIdentity
): Promise<string> {
  const id = makeSafeId('id');
  const path = `identities/${id}`;
  const clean = sanitizeIdentity(identity);

  try {
    await setDoc(doc(db, 'identities', id), {
      ownerId: user.uid,
      ownerEmail: clampStr(user.email, 150),
      fullName: clean.fullName,
      role: clean.role,
      deceasedName: clean.deceasedName,
      city: clean.city,
      contact: clean.contact,
      notes: clean.notes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteIdentityFromFirestore(identityId: string): Promise<void> {
  const path = `identities/${identityId}`;
  try {
    await deleteDoc(doc(db, 'identities', identityId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCaseToFirestore(
  user: User,
  name: string,
  notes: string,
  state: AppState,
  netEstateSnapshot: number
): Promise<string> {
  const id = makeSafeId('case');
  const path = `cases/${id}`;
  const cleanName =
    clampStr(name, 150) || `Kasus Waris ${new Date().toLocaleDateString('id-ID')}`;
  const cleanNotes = clampStr(notes, 500);
  const cleanOwnerName =
    clampStr(user.displayName || user.email?.split('@')[0], 120) || 'Pengguna';

  try {
    await setDoc(doc(db, 'cases', id), {
      ownerId: user.uid,
      ownerName: cleanOwnerName,
      name: cleanName,
      notes: cleanNotes,
      currency: state.currency,
      exchangeRate: state.exchangeRate > 0 ? state.exchangeRate : 15800,
      legalSystem: state.legalSystem,
      deceasedGender: state.deceasedGender,
      netEstateSnapshot: Number.isFinite(netEstateSnapshot) && netEstateSnapshot >= 0 ? netEstateSnapshot : 0,
      financials: sanitizeFinancials(state.financials),
      family: sanitizeFamily(state.family),
      identity: sanitizeIdentity(state.identity),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCaseFromFirestore(caseId: string): Promise<void> {
  const path = `cases/${caseId}`;
  try {
    await deleteDoc(doc(db, 'cases', caseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateIdentityInFirestore(
  identityId: string,
  identity: UserIdentity
): Promise<void> {
  const path = `identities/${identityId}`;
  const clean = sanitizeIdentity(identity);
  try {
    await updateDoc(doc(db, 'identities', identityId), {
      fullName: clean.fullName,
      role: clean.role,
      deceasedName: clean.deceasedName,
      city: clean.city,
      contact: clean.contact,
      notes: clean.notes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCaseInFirestore(
  caseId: string,
  payload: {
    name: string;
    notes: string;
    state: AppState;
    netEstateSnapshot: number;
  }
): Promise<void> {
  const path = `cases/${caseId}`;
  try {
    await updateDoc(doc(db, 'cases', caseId), {
      name: clampStr(payload.name, 150) || 'Kasus Waris',
      notes: clampStr(payload.notes, 500),
      currency: payload.state.currency,
      exchangeRate: payload.state.exchangeRate > 0 ? payload.state.exchangeRate : 15800,
      legalSystem: payload.state.legalSystem,
      deceasedGender: payload.state.deceasedGender,
      netEstateSnapshot:
        Number.isFinite(payload.netEstateSnapshot) && payload.netEstateSnapshot >= 0
          ? payload.netEstateSnapshot
          : 0,
      financials: sanitizeFinancials(payload.state.financials),
      family: sanitizeFamily(payload.state.family),
      identity: sanitizeIdentity(payload.state.identity),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveCoachLogToFirestore(
  user: User,
  question: string,
  answer: string,
  legalSystem: LegalSystem
): Promise<void> {
  const id = makeSafeId('log');
  const path = `coachLogs/${id}`;
  const cleanQ = clampStr(question, 500);
  const cleanA = clampStr(answer, 5000);
  if (!cleanQ || !cleanA) return;

  try {
    await setDoc(doc(db, 'coachLogs', id), {
      ownerId: user.uid,
      ownerName: clampStr(user.displayName || user.email?.split('@')[0], 120) || 'Pengguna',
      question: cleanQ,
      answer: cleanA,
      legalSystem,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCoachLogInFirestore(
  logId: string,
  payload: { question: string; answer: string; legalSystem: LegalSystem }
): Promise<void> {
  const path = `coachLogs/${logId}`;
  try {
    await updateDoc(doc(db, 'coachLogs', logId), {
      question: clampStr(payload.question, 500) || '-',
      answer: clampStr(payload.answer, 5000) || '-',
      legalSystem: payload.legalSystem,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCoachLogFromFirestore(logId: string): Promise<void> {
  const path = `coachLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'coachLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSimulationLogToFirestore(
  user: User,
  action: string,
  title: string,
  state: AppState,
  netEstate: number,
  summaryText: string
): Promise<string> {
  const id = makeSafeId('sim');
  const path = `simulationLogs/${id}`;
  try {
    await setDoc(doc(db, 'simulationLogs', id), {
      ownerId: user.uid,
      ownerName: clampStr(user.displayName || user.email?.split('@')[0], 120) || 'Pengguna',
      ownerEmail: clampStr(user.email, 150),
      action: clampStr(action, 120) || 'Simulasi Waris',
      title: clampStr(title, 150) || 'Simulasi Aktif',
      legalSystem: state.legalSystem,
      deceasedGender: state.deceasedGender,
      currency: state.currency,
      exchangeRate: state.exchangeRate > 0 ? state.exchangeRate : 15800,
      netEstate: Number.isFinite(netEstate) && netEstate >= 0 ? netEstate : 0,
      financials: sanitizeFinancials(state.financials),
      family: sanitizeFamily(state.family),
      identity: sanitizeIdentity(state.identity),
      summaryText: clampStr(summaryText, 600),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSimulationLogInFirestore(
  logId: string,
  payload: {
    title: string;
    action: string;
    legalSystem: LegalSystem;
    deceasedGender: 'male' | 'female';
    currency: 'IDR' | 'USD';
    netEstate: number;
    summaryText: string;
  }
): Promise<void> {
  const path = `simulationLogs/${logId}`;
  try {
    await updateDoc(doc(db, 'simulationLogs', logId), {
      title: clampStr(payload.title, 150) || 'Simulasi Waris',
      action: clampStr(payload.action, 120) || 'Simulasi Waris',
      legalSystem: payload.legalSystem,
      deceasedGender: payload.deceasedGender,
      currency: payload.currency,
      netEstate: Number.isFinite(payload.netEstate) && payload.netEstate >= 0 ? payload.netEstate : 0,
      summaryText: clampStr(payload.summaryText, 600),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSimulationLogFromFirestore(logId: string): Promise<void> {
  const path = `simulationLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'simulationLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToCases(
  user: User,
  isAdmin: boolean,
  onData: (cases: SavedCase[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'cases');
  const q = isAdmin
    ? query(colRef, orderBy('updatedAt', 'desc'), limit(100))
    : query(colRef, where('ownerId', '==', user.uid), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedCase[] = snapshot.docs.map((d) => {
        const data = d.data();
        const updatedMs = tsToMillis(data.updatedAt ?? data.createdAt);
        return {
          id: d.id,
          name: String(data.name ?? 'Kasus Waris'),
          notes: String(data.notes ?? ''),
          savedAt: new Date(updatedMs).toISOString(),
          netEstateSnapshot: Number(data.netEstateSnapshot ?? 0),
          source: 'firestore',
          ownerId: String(data.ownerId ?? ''),
          ownerName: String(data.ownerName ?? ''),
          state: {
            currency: data.currency === 'USD' ? 'USD' : 'IDR',
            exchangeRate: Number(data.exchangeRate ?? 15800),
            legalSystem: data.legalSystem === 'civil' ? 'civil' : 'islam',
            deceasedGender: data.deceasedGender === 'female' ? 'female' : 'male',
            financials: data.financials as FinancialInputs,
            family: data.family as FamilyCounts,
            identity: sanitizeIdentity(data.identity as UserIdentity),
          },
        };
      });
      items.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'cases');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeToIdentities(
  user: User,
  isAdmin: boolean,
  onData: (items: FirestoreIdentityRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'identities');
  const q = isAdmin
    ? query(colRef, orderBy('createdAt', 'desc'), limit(100))
    : query(colRef, where('ownerId', '==', user.uid), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestoreIdentityRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId ?? ''),
          ownerEmail: String(data.ownerEmail ?? ''),
          fullName: String(data.fullName ?? ''),
          role: String(data.role ?? ''),
          deceasedName: String(data.deceasedName ?? ''),
          city: String(data.city ?? ''),
          contact: String(data.contact ?? ''),
          notes: String(data.notes ?? ''),
          createdAtMs: tsToMillis(data.createdAt),
          updatedAtMs: tsToMillis(data.updatedAt),
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'identities');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeToCoachLogs(
  user: User,
  isAdmin: boolean,
  onData: (items: FirestoreCoachLog[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'coachLogs');
  const q = isAdmin
    ? query(colRef, orderBy('createdAt', 'desc'), limit(100))
    : query(colRef, where('ownerId', '==', user.uid), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestoreCoachLog[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId ?? ''),
          ownerName: String(data.ownerName ?? ''),
          question: String(data.question ?? ''),
          answer: String(data.answer ?? ''),
          legalSystem: data.legalSystem === 'civil' ? 'civil' : 'islam',
          createdAtMs: tsToMillis(data.createdAt),
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'coachLogs');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeToSimulationLogs(
  user: User,
  isAdmin: boolean,
  onData: (items: FirestoreSimulationLog[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'simulationLogs');
  const q = isAdmin
    ? query(colRef, orderBy('createdAt', 'desc'), limit(150))
    : query(colRef, where('ownerId', '==', user.uid), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestoreSimulationLog[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId ?? ''),
          ownerName: String(data.ownerName ?? ''),
          ownerEmail: String(data.ownerEmail ?? ''),
          action: String(data.action ?? ''),
          title: String(data.title ?? ''),
          legalSystem: data.legalSystem === 'civil' ? 'civil' : 'islam',
          deceasedGender: data.deceasedGender === 'female' ? 'female' : 'male',
          currency: data.currency === 'USD' ? 'USD' : 'IDR',
          exchangeRate: Number(data.exchangeRate ?? 15800),
          netEstate: Number(data.netEstate ?? 0),
          financials: data.financials as FinancialInputs,
          family: data.family as FamilyCounts,
          identity: sanitizeIdentity(data.identity as UserIdentity),
          summaryText: String(data.summaryText ?? ''),
          createdAtMs: tsToMillis(data.createdAt),
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'simulationLogs');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeToAdmins(
  onData: (items: FirestoreAdminRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'admins'), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestoreAdminRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid ?? d.id),
          email: String(data.email ?? ''),
          label: String(data.label ?? ''),
          addedBy: String(data.addedBy ?? ''),
          createdAtMs: tsToMillis(data.createdAt),
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'admins');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function addAdminRecord(
  currentUser: User,
  uid: string,
  email: string,
  label: string
): Promise<void> {
  const cleanUid = clampStr(uid, 128);
  const cleanEmail = clampStr(email, 150);
  const cleanLabel = clampStr(label, 120);
  const path = `admins/${cleanUid}`;

  try {
    await setDoc(doc(db, 'admins', cleanUid), {
      uid: cleanUid,
      email: cleanEmail,
      ...(cleanLabel ? { label: cleanLabel } : {}),
      addedBy: currentUser.uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeAdminRecord(uid: string): Promise<void> {
  const path = `admins/${uid}`;
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
