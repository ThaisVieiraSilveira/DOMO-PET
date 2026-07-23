import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

/**
 * Resolves the active creche tenantId for an authenticated user.
 * For Owners, this returns user.uid (since tenant ID === user.uid).
 * For Staff/Employees, it queries their association in the tenant's members subcollection or user profile.
 */
export async function resolveTenantIdForUser(uid?: string): Promise<string> {
  const targetUid = uid || auth.currentUser?.uid;
  if (!targetUid) throw new Error('Usuário não autenticado.');
  if (!db) return targetUid;

  try {
    // 1. Direct tenant check (Owner/Admin)
    const tenantDoc = await getDoc(doc(db, 'tenants', targetUid));
    if (tenantDoc.exists()) {
      return targetUid;
    }

    // 2. User profile check
    const userDocRef = doc(db, 'users', targetUid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData?.tenant_id || userData?.tenantId) {
        return userData.tenant_id || userData.tenantId;
      }
    }

    // 3. Member association check across tenants
    const membersQuery = query(
      collection(db, 'members'),
      where('uid', '==', targetUid),
      where('active', '==', true)
    );
    const membersSnap = await getDocs(membersQuery);
    if (!membersSnap.empty) {
      const memberData = membersSnap.docs[0].data();
      if (memberData.tenantId || memberData.tenant_id) {
        return memberData.tenantId || memberData.tenant_id;
      }
    }
  } catch (err) {
    console.warn("Aviso ao resolver tenant ID do usuário:", err);
  }

  return targetUid;
}
