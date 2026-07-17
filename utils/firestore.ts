import { auth } from '../src/firebase';

/**
 * Centrally retrieves the logged-in tenant ID.
 */
export const getTenantId = (): string | undefined => {
  return auth.currentUser?.uid;
};

/**
 * Ensures a user is logged in before allowing mutations.
 * Throws an error and shows a browser alert if not logged in.
 */
export const ensureAuthenticated = (): string => {
  const tenantId = getTenantId();
  if (!tenantId) {
    const errorMsg = 'Você precisa estar logado para salvar alterações.';
    alert(errorMsg);
    throw new Error(errorMsg);
  }
  return tenantId;
};

/**
 * Debug log for saving data to Firestore.
 */
export const logSave = (collectionName: string, docId: string, tenantId: string, data: any) => {
  console.log('--- FIRESTORE SAVE ---');
  console.log(`Coleção: ${collectionName}`);
  console.log(`Documento: ${docId}`);
  console.log(`Tenant ID usado: ${tenantId}`);
  console.log('Dados principais salvos:', {
    ...data,
    // Truncate large base64 strings if any for cleaner console output
    logo: data.logo && data.logo.length > 100 ? `${data.logo.slice(0, 50)}...` : data.logo,
    foto: data.foto && data.foto.length > 100 ? `${data.foto.slice(0, 50)}...` : data.foto,
  });
  console.log('----------------------');
};

/**
 * Debug log for loading data from Firestore.
 */
export const logLoad = (collectionName: string, tenantId: string, count: number) => {
  console.log('--- FIRESTORE LOAD ---');
  console.log(`Coleção consultada: ${collectionName}`);
  console.log(`Tenant ID consultado: ${tenantId}`);
  console.log(`Quantidade de documentos retornados: ${count}`);
  console.log('----------------------');
};
