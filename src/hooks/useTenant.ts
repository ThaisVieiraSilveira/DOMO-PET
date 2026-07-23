import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage, isFirebaseConfigured } from '../firebase';
import { ensureAuthenticated, logSave, logLoad } from '../../utils/firestore';
import { resolveTenantIdForUser } from '../utils/tenantResolver';

const LOCAL_STORAGE_KEYS = {
  nome: 'domo_nome',
  cor: 'domo_cor',
  corSecundaria: 'domo_cor_secundaria',
  logo: 'domo_logo',
  slogan: 'domo_slogan',
  slug: 'domo_slug',
  email: 'domo_email',
};

const DEFAULT_VALUES = {
  nome: 'Domo',
  cor: '#2d512e',
  corSecundaria: '#0ea5e9',
  logo: '/logo.svg',
  slogan: 'Gestão canina de ponta a ponta',
  slug: 'domo',
  email: '',
};

function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s\-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/\-+/g, '-')
    .trim();
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',');
  const byteString = atob(parts[1]);
  const mimeString = parts[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

export function useTenant() {
  const [nome, setNome] = useState(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.nome);
    if (stored === 'Bichinhos peludos') return 'Domo';
    return stored || DEFAULT_VALUES.nome;
  });
  const [cor, setCor] = useState(() => {
    const storedNome = localStorage.getItem(LOCAL_STORAGE_KEYS.nome);
    const storedCor = localStorage.getItem(LOCAL_STORAGE_KEYS.cor);
    if (storedNome === 'Bichinhos peludos') return '#2d512e';
    return storedCor || DEFAULT_VALUES.cor;
  });
  const [corSecundaria, setCorSecundaria] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.corSecundaria) || DEFAULT_VALUES.corSecundaria;
  });
  const [logo, setLogo] = useState(() => {
    const storedNome = localStorage.getItem(LOCAL_STORAGE_KEYS.nome);
    const storedLogo = localStorage.getItem(LOCAL_STORAGE_KEYS.logo);
    if (storedNome === 'Bichinhos peludos' || !storedLogo) return '/logo.svg';
    return storedLogo || DEFAULT_VALUES.logo;
  });
  const [slogan, setSlogan] = useState(() => {
    const storedNome = localStorage.getItem(LOCAL_STORAGE_KEYS.nome);
    const storedSlogan = localStorage.getItem(LOCAL_STORAGE_KEYS.slogan);
    if (storedNome === 'Bichinhos peludos') return 'Gestão canina de ponta a ponta';
    return storedSlogan || DEFAULT_VALUES.slogan;
  });
  const [slug, setSlug] = useState(() => {
    const storedNome = localStorage.getItem(LOCAL_STORAGE_KEYS.nome);
    const storedSlug = localStorage.getItem(LOCAL_STORAGE_KEYS.slug);
    if (storedNome === 'Bichinhos peludos') return 'domo';
    return storedSlug || DEFAULT_VALUES.slug;
  });
  const [email, setEmail] = useState(() => {
    const storedNome = localStorage.getItem(LOCAL_STORAGE_KEYS.nome);
    const storedEmail = localStorage.getItem(LOCAL_STORAGE_KEYS.email);
    if (storedNome === 'Bichinhos peludos') return '';
    return storedEmail || DEFAULT_VALUES.email;
  });
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'uploading' | 'saving' | 'success' | 'error'>('idle');
  const [savingProgress, setSavingProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when branding gets updated from outside
  useEffect(() => {
    const handleBrandingChanged = () => {
      setNome(localStorage.getItem(LOCAL_STORAGE_KEYS.nome) || DEFAULT_VALUES.nome);
      setCor(localStorage.getItem(LOCAL_STORAGE_KEYS.cor) || DEFAULT_VALUES.cor);
      setCorSecundaria(localStorage.getItem(LOCAL_STORAGE_KEYS.corSecundaria) || DEFAULT_VALUES.corSecundaria);
      setLogo(localStorage.getItem(LOCAL_STORAGE_KEYS.logo) || DEFAULT_VALUES.logo);
      setSlogan(localStorage.getItem(LOCAL_STORAGE_KEYS.slogan) || DEFAULT_VALUES.slogan);
      setSlug(localStorage.getItem(LOCAL_STORAGE_KEYS.slug) || DEFAULT_VALUES.slug);
      setEmail(localStorage.getItem(LOCAL_STORAGE_KEYS.email) || DEFAULT_VALUES.email);
    };

    window.addEventListener('domoBrandingChanged', handleBrandingChanged);
    return () => {
      window.removeEventListener('domoBrandingChanged', handleBrandingChanged);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;

      if (!user || !isFirebaseConfigured || !db) {
        // Fallback to localStorage (or defaults)
        let localNome = localStorage.getItem(LOCAL_STORAGE_KEYS.nome) || DEFAULT_VALUES.nome;
        let localCor = localStorage.getItem(LOCAL_STORAGE_KEYS.cor) || DEFAULT_VALUES.cor;
        let localCorSec = localStorage.getItem(LOCAL_STORAGE_KEYS.corSecundaria) || DEFAULT_VALUES.corSecundaria;
        let localLogo = localStorage.getItem(LOCAL_STORAGE_KEYS.logo) || DEFAULT_VALUES.logo;
        let localSlogan = localStorage.getItem(LOCAL_STORAGE_KEYS.slogan) || DEFAULT_VALUES.slogan;
        let localSlug = localStorage.getItem(LOCAL_STORAGE_KEYS.slug) || DEFAULT_VALUES.slug;
        let localEmail = localStorage.getItem(LOCAL_STORAGE_KEYS.email) || DEFAULT_VALUES.email;

        if (localNome === 'Bichinhos peludos') {
          localNome = 'Domo';
          localCor = '#2d512e';
          localCorSec = '#0ea5e9';
          localLogo = '/logo.svg';
          localSlogan = 'Gestão canina de ponta a ponta';
          localSlug = 'domo';
          localEmail = '';

          localStorage.setItem(LOCAL_STORAGE_KEYS.nome, localNome);
          localStorage.setItem(LOCAL_STORAGE_KEYS.cor, localCor);
          localStorage.setItem(LOCAL_STORAGE_KEYS.corSecundaria, localCorSec);
          localStorage.setItem(LOCAL_STORAGE_KEYS.logo, localLogo);
          localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, localSlogan);
          localStorage.setItem(LOCAL_STORAGE_KEYS.slug, localSlug);
          localStorage.setItem(LOCAL_STORAGE_KEYS.email, localEmail);
        }

        setNome(localNome);
        setCor(localCor);
        setCorSecundaria(localCorSec);
        setLogo(localLogo);
        setSlogan(localSlogan);
        setSlug(localSlug);
        setEmail(localEmail);
        setLoading(false);
        return;
      }

      try {
        const tenantId = await resolveTenantIdForUser(user.uid);
        const tenantRef = doc(db, 'tenants', tenantId);
        const docSnap = await getDoc(tenantRef);

        if (active) {
          logLoad('tenants', tenantId, docSnap.exists() ? 1 : 0);
          if (docSnap.exists()) {
            const data = docSnap.data();
            let fetchedNome = data.nome || data.nomeCreche || DEFAULT_VALUES.nome;
            let fetchedCor = data.cor_primaria || data.corPrincipal || data.cor || DEFAULT_VALUES.cor;
            let fetchedCorSec = data.cor_secundaria || data.corSecundaria || DEFAULT_VALUES.corSecundaria;
            let fetchedLogo = data.logo_url || data.logoUrl || data.logo || DEFAULT_VALUES.logo;
            let fetchedSlogan = data.slogan || DEFAULT_VALUES.slogan;
            let fetchedSlug = data.slug || generateSlug(fetchedNome);
            let fetchedEmail = data.email || data.emailCreche || data.email_creche || DEFAULT_VALUES.email;

            setNome(fetchedNome);
            setCor(fetchedCor);
            setCorSecundaria(fetchedCorSec);
            setLogo(fetchedLogo);
            setSlogan(fetchedSlogan);
            setSlug(fetchedSlug);
            setEmail(fetchedEmail);

            // Also keep localStorage updated in sync with cloud
            localStorage.setItem(LOCAL_STORAGE_KEYS.nome, fetchedNome);
            localStorage.setItem(LOCAL_STORAGE_KEYS.cor, fetchedCor);
            localStorage.setItem(LOCAL_STORAGE_KEYS.corSecundaria, fetchedCorSec);
            localStorage.setItem(LOCAL_STORAGE_KEYS.logo, fetchedLogo);
            localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, fetchedSlogan);
            localStorage.setItem(LOCAL_STORAGE_KEYS.slug, fetchedSlug);
            localStorage.setItem(LOCAL_STORAGE_KEYS.email, fetchedEmail);
          } else {
            // Document doesn't exist yet, load local storage settings
            let localNome = localStorage.getItem(LOCAL_STORAGE_KEYS.nome) || DEFAULT_VALUES.nome;
            let localCor = localStorage.getItem(LOCAL_STORAGE_KEYS.cor) || DEFAULT_VALUES.cor;
            let localCorSec = localStorage.getItem(LOCAL_STORAGE_KEYS.corSecundaria) || DEFAULT_VALUES.corSecundaria;
            let localLogo = localStorage.getItem(LOCAL_STORAGE_KEYS.logo) || DEFAULT_VALUES.logo;
            let localSlogan = localStorage.getItem(LOCAL_STORAGE_KEYS.slogan) || DEFAULT_VALUES.slogan;
            let localSlug = localStorage.getItem(LOCAL_STORAGE_KEYS.slug) || DEFAULT_VALUES.slug;
            let localEmail = localStorage.getItem(LOCAL_STORAGE_KEYS.email) || DEFAULT_VALUES.email;

            setNome(localNome);
            setCor(localCor);
            setCorSecundaria(localCorSec);
            setLogo(localLogo);
            setSlogan(localSlogan);
            setSlug(localSlug);
            setEmail(localEmail);
          }
        }
      } catch (error: any) {
        if (error?.message?.includes('offline') || error?.code === 'unavailable') {
          console.log("Firestore tenant load: offline fallback active.");
        } else {
          console.warn("Erro ao carregar Tenant do Firestore:", error);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const salvar = async (novosDados: {
    nome: string;
    cor: string;
    corSecundaria?: string;
    logo?: string;
    logoFile?: File | null;
    slogan?: string;
    email?: string;
  }) => {
    setSavingStatus('uploading');
    setSavingProgress(10);
    setErrorMessage(null);

    const userUid = ensureAuthenticated();
    const tenantId = await resolveTenantIdForUser(userUid);
    const finalSlug = generateSlug(novosDados.nome);

    let finalLogoUrl = novosDados.logo || logo || '';

    // If a raw File object was passed for logo upload
    if (novosDados.logoFile) {
      const file = novosDados.logoFile;
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setSavingStatus('error');
        const err = 'Formato de imagem inválido. Aceitos apenas PNG, JPG ou WebP.';
        setErrorMessage(err);
        alert(err);
        throw new Error(err);
      }

      if (file.size > 2 * 1024 * 1024) {
        setSavingStatus('error');
        const err = 'O logotipo excede o tamanho máximo permitido de 2 MB.';
        setErrorMessage(err);
        alert(err);
        throw new Error(err);
      }

      if (isFirebaseConfigured && db && storage) {
        try {
          setSavingProgress(30);
          const ext = file.name.split('.').pop() || 'png';
          const storageRef = ref(storage, `logos/${tenantId}/logo.${ext}`);
          await uploadBytes(storageRef, file);
          setSavingProgress(60);
          finalLogoUrl = await getDownloadURL(storageRef);
        } catch (storageErr: any) {
          console.error("Erro ao fazer upload do logo para o Firebase Storage:", storageErr);
          setSavingStatus('error');
          const err = `Falha ao salvar logo no Storage: ${storageErr.message || storageErr}`;
          setErrorMessage(err);
          alert(err);
          throw new Error(err);
        }
      }
    } else if (finalLogoUrl.startsWith('data:')) {
      // Base64 upload to storage if passed as base64 string
      if (isFirebaseConfigured && db && storage) {
        try {
          setSavingProgress(30);
          const blob = base64ToBlob(finalLogoUrl);
          if (blob.size > 2 * 1024 * 1024) {
            const err = 'A imagem excede o tamanho máximo de 2 MB.';
            setSavingStatus('error');
            setErrorMessage(err);
            alert(err);
            throw new Error(err);
          }
          const storageRef = ref(storage, `logos/${tenantId}/logo.png`);
          await uploadBytes(storageRef, blob);
          setSavingProgress(60);
          finalLogoUrl = await getDownloadURL(storageRef);
        } catch (storageErr: any) {
          console.error("Erro ao converter e enviar logo em Base64:", storageErr);
        }
      }
    }

    setSavingStatus('saving');
    setSavingProgress(80);

    const corSec = novosDados.corSecundaria || corSecundaria || DEFAULT_VALUES.corSecundaria;

    const dadosParaSalvar = {
      tenant_id: tenantId,
      nome: novosDados.nome.trim(),
      cor_primaria: novosDados.cor,
      cor_secundaria: corSec,
      logo_url: finalLogoUrl,
      slogan: novosDados.slogan ? novosDados.slogan.trim() : '',
      slug: finalSlug,
      email: novosDados.email ? novosDados.email.trim() : '',

      // Backwards/compatibility properties
      cor: novosDados.cor,
      corPrincipal: novosDados.cor,
      corSecundaria: corSec,
      logo: finalLogoUrl,
      logoUrl: finalLogoUrl,
      nomeCreche: novosDados.nome.trim(),
      emailCreche: novosDados.email ? novosDados.email.trim() : '',
      email_creche: novosDados.email ? novosDados.email.trim() : '',
      updatedAt: new Date().toISOString()
    };

    console.log("TENTANDO SALVAR", {
      collectionName: "tenants",
      documentId: tenantId,
      userUid: tenantId,
      payload: dadosParaSalvar
    });

    if (isFirebaseConfigured && db) {
      try {
        const tenantRef = doc(db, 'tenants', tenantId);
        logSave('tenants', tenantId, tenantId, dadosParaSalvar);
        await setDoc(tenantRef, dadosParaSalvar, { merge: true });
      } catch (error: any) {
        console.error("ERRO COMPLETO FIRESTORE", error);
        setSavingStatus('error');
        setErrorMessage(error?.message || 'Erro ao salvar no Firestore');
        alert((error?.code || "Erro") + " - " + (error?.message || "Erro desconhecido"));
        throw error;
      }
    }

    // Save locally
    localStorage.setItem(LOCAL_STORAGE_KEYS.nome, dadosParaSalvar.nome);
    localStorage.setItem(LOCAL_STORAGE_KEYS.cor, dadosParaSalvar.cor_primaria);
    localStorage.setItem(LOCAL_STORAGE_KEYS.corSecundaria, dadosParaSalvar.cor_secundaria);
    localStorage.setItem(LOCAL_STORAGE_KEYS.logo, dadosParaSalvar.logo_url);
    localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, dadosParaSalvar.slogan);
    localStorage.setItem(LOCAL_STORAGE_KEYS.slug, dadosParaSalvar.slug);
    localStorage.setItem(LOCAL_STORAGE_KEYS.email, dadosParaSalvar.email);

    // Update React states
    setNome(dadosParaSalvar.nome);
    setCor(dadosParaSalvar.cor_primaria);
    setCorSecundaria(dadosParaSalvar.cor_secundaria);
    setLogo(dadosParaSalvar.logo_url);
    setSlogan(dadosParaSalvar.slogan);
    setSlug(dadosParaSalvar.slug);
    setEmail(dadosParaSalvar.email);

    setSavingProgress(100);
    setSavingStatus('success');

    // Notify app components
    window.dispatchEvent(new Event('domoBrandingChanged'));

    setTimeout(() => {
      setSavingStatus('idle');
      setSavingProgress(0);
    }, 4000);
  };

  return {
    nome,
    cor,
    corSecundaria,
    logo,
    slogan,
    slug,
    email,
    loading,
    savingStatus,
    savingProgress,
    errorMessage,
    salvar
  };
}

