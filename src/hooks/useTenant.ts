import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage, isFirebaseConfigured } from '../firebase';
import { ensureAuthenticated, logSave, logLoad } from '../../utils/firestore';

const LOCAL_STORAGE_KEYS = {
  nome: 'domo_nome',
  cor: 'domo_cor',
  logo: 'domo_logo',
  slogan: 'domo_slogan',
  slug: 'domo_slug',
  email: 'domo_email',
};

const DEFAULT_VALUES = {
  nome: 'Domo',
  cor: '#2d512e',
  logo: '/logo.svg',
  slogan: 'Gestão canina de ponta a ponta',
  slug: 'domo',
  email: '',
};

function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .replace(/[^\w\s\-]+/g, '') // remove other special chars
    .replace(/\s+/g, '-') // spaces to dashes
    .replace(/\-+/g, '-') // multiple dashes to single
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

  // Sync state when branding gets updated from outside
  useEffect(() => {
    const handleBrandingChanged = () => {
      setNome(localStorage.getItem(LOCAL_STORAGE_KEYS.nome) || DEFAULT_VALUES.nome);
      setCor(localStorage.getItem(LOCAL_STORAGE_KEYS.cor) || DEFAULT_VALUES.cor);
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
        let localLogo = localStorage.getItem(LOCAL_STORAGE_KEYS.logo) || DEFAULT_VALUES.logo;
        let localSlogan = localStorage.getItem(LOCAL_STORAGE_KEYS.slogan) || DEFAULT_VALUES.slogan;
        let localSlug = localStorage.getItem(LOCAL_STORAGE_KEYS.slug) || DEFAULT_VALUES.slug;
        let localEmail = localStorage.getItem(LOCAL_STORAGE_KEYS.email) || DEFAULT_VALUES.email;

        if (localNome === 'Bichinhos peludos') {
          localNome = 'Domo';
          localCor = '#2d512e';
          localLogo = '/logo.svg';
          localSlogan = 'Gestão canina de ponta a ponta';
          localSlug = 'domo';
          localEmail = '';

          localStorage.setItem(LOCAL_STORAGE_KEYS.nome, localNome);
          localStorage.setItem(LOCAL_STORAGE_KEYS.cor, localCor);
          localStorage.setItem(LOCAL_STORAGE_KEYS.logo, localLogo);
          localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, localSlogan);
          localStorage.setItem(LOCAL_STORAGE_KEYS.slug, localSlug);
          localStorage.setItem(LOCAL_STORAGE_KEYS.email, localEmail);
        }

        setNome(localNome);
        setCor(localCor);
        setLogo(localLogo);
        setSlogan(localSlogan);
        setSlug(localSlug);
        setEmail(localEmail);
        setLoading(false);
        return;
      }

      try {
        const tenantRef = doc(db, 'tenants', user.uid);
        const docSnap = await getDoc(tenantRef);

        if (active) {
          logLoad('tenants', user.uid, docSnap.exists() ? 1 : 0);
          if (docSnap.exists()) {
            const data = docSnap.data();
            let fetchedNome = data.nome || data.nomeCreche || DEFAULT_VALUES.nome;
            let fetchedCor = data.cor || data.corPrincipal || data.cor_primaria || DEFAULT_VALUES.cor;
            let fetchedLogo = data.logo || data.logoUrl || data.logo_url || DEFAULT_VALUES.logo;
            let fetchedSlogan = data.slogan || DEFAULT_VALUES.slogan;
            let fetchedSlug = data.slug || generateSlug(fetchedNome);
            let fetchedEmail = data.email || data.emailCreche || data.email_creche || DEFAULT_VALUES.email;

            if (fetchedNome === 'Bichinhos peludos') {
              fetchedNome = 'Domo';
              fetchedCor = '#2d512e';
              fetchedLogo = '/logo.svg';
              fetchedSlogan = 'Gestão canina de ponta a ponta';
              fetchedSlug = 'domo';
              fetchedEmail = '';

              const initTenantData = {
                nome: fetchedNome,
                cor: fetchedCor,
                logo: fetchedLogo,
                slogan: fetchedSlogan,
                slug: fetchedSlug,
                email: fetchedEmail,
                tenant_id: user.uid,
                nomeCreche: fetchedNome,
                logoUrl: fetchedLogo,
                logo_url: fetchedLogo,
                corPrincipal: fetchedCor,
                cor_primaria: fetchedCor,
                emailCreche: fetchedEmail,
                email_creche: fetchedEmail,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };

              console.log("TENTANDO SALVAR", {
                collectionName: "tenants",
                documentId: user.uid,
                userUid: user.uid,
                payload: initTenantData
              });
              logSave('tenants', user.uid, user.uid, initTenantData);
              setDoc(tenantRef, initTenantData).catch(error => {
                console.error("ERRO COMPLETO FIRESTORE", error);
                alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
              });
            }

            setNome(fetchedNome);
            setCor(fetchedCor);
            setLogo(fetchedLogo);
            setSlogan(fetchedSlogan);
            setSlug(fetchedSlug);
            setEmail(fetchedEmail);

            // Also keep localStorage updated in sync with cloud
            localStorage.setItem(LOCAL_STORAGE_KEYS.nome, fetchedNome);
            localStorage.setItem(LOCAL_STORAGE_KEYS.cor, fetchedCor);
            localStorage.setItem(LOCAL_STORAGE_KEYS.logo, fetchedLogo);
            localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, fetchedSlogan);
            localStorage.setItem(LOCAL_STORAGE_KEYS.slug, fetchedSlug);
            localStorage.setItem(LOCAL_STORAGE_KEYS.email, fetchedEmail);
          } else {
            // Document doesn't exist yet, load local storage settings
            let localNome = localStorage.getItem(LOCAL_STORAGE_KEYS.nome) || DEFAULT_VALUES.nome;
            let localCor = localStorage.getItem(LOCAL_STORAGE_KEYS.cor) || DEFAULT_VALUES.cor;
            let localLogo = localStorage.getItem(LOCAL_STORAGE_KEYS.logo) || DEFAULT_VALUES.logo;
            let localSlogan = localStorage.getItem(LOCAL_STORAGE_KEYS.slogan) || DEFAULT_VALUES.slogan;
            let localSlug = localStorage.getItem(LOCAL_STORAGE_KEYS.slug) || DEFAULT_VALUES.slug;
            let localEmail = localStorage.getItem(LOCAL_STORAGE_KEYS.email) || DEFAULT_VALUES.email;

            if (localNome === 'Bichinhos peludos') {
              localNome = 'Domo';
              localCor = '#2d512e';
              localLogo = '/logo.svg';
              localSlogan = 'Gestão canina de ponta a ponta';
              localSlug = 'domo';
              localEmail = '';

              localStorage.setItem(LOCAL_STORAGE_KEYS.nome, localNome);
              localStorage.setItem(LOCAL_STORAGE_KEYS.cor, localCor);
              localStorage.setItem(LOCAL_STORAGE_KEYS.logo, localLogo);
              localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, localSlogan);
              localStorage.setItem(LOCAL_STORAGE_KEYS.slug, localSlug);
              localStorage.setItem(LOCAL_STORAGE_KEYS.email, localEmail);
            }

            setNome(localNome);
            setCor(localCor);
            setLogo(localLogo);
            setSlogan(localSlogan);
            setSlug(localSlug);
            setEmail(localEmail);
          }
        }
      } catch (error: any) {
        // Handle offline / connection errors silently/gracefully as they are expected
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

  const salvar = async (novosDados: { nome: string; cor: string; logo?: string; slogan?: string; email?: string }) => {
    // Block saving if not logged in
    const tenantId = ensureAuthenticated();
    const finalSlug = generateSlug(novosDados.nome);

    // Fetch existing doc to preserve createdAt
    let createdAt = new Date().toISOString();
    if (isFirebaseConfigured && db) {
      try {
        const tenantRef = doc(db, 'tenants', tenantId);
        const docSnap = await getDoc(tenantRef);
        if (docSnap.exists()) {
          const currentData = docSnap.data();
          if (currentData.createdAt) {
            createdAt = currentData.createdAt;
          }
        }
      } catch (err) {
        console.warn("Could not fetch existing tenant data for createdAt:", err);
      }
    }

    // Handle robust PNG logo upload to Firebase Storage if configured and it's a Base64 string
    let finalLogoUrl = novosDados.logo || '';
    if (finalLogoUrl.startsWith('data:')) {
      if (isFirebaseConfigured && db) {
        try {
          const blob = base64ToBlob(finalLogoUrl);
          const storageRef = ref(storage, `logos/${tenantId}/logo.png`);
          await uploadBytes(storageRef, blob);
          finalLogoUrl = await getDownloadURL(storageRef);
        } catch (storageErr) {
          console.error("Erro ao fazer upload do logo para o Firebase Storage:", storageErr);
        }
      }
    }

    const dadosParaSalvar = {
      nome: novosDados.nome,
      cor: novosDados.cor,
      logo: finalLogoUrl,
      slogan: novosDados.slogan || '',
      slug: finalSlug,
      email: novosDados.email || '',
      // Naming conventions and fallback compatibility requested by the user
      tenant_id: tenantId,
      nomeCreche: novosDados.nome,
      logoUrl: finalLogoUrl,
      logo_url: finalLogoUrl,
      corPrincipal: novosDados.cor,
      cor_primaria: novosDados.cor,
      emailCreche: novosDados.email || '',
      email_creche: novosDados.email || '',
      createdAt,
      updatedAt: new Date().toISOString()
    };

    console.log("TENTANDO SALVAR", {
      collectionName: "tenants",
      documentId: tenantId,
      userUid: tenantId,
      payload: dadosParaSalvar
    });

    // 1. Gravar no Firestore se estiver logado e configurado FIRST (Pessimistic UI)
    if (isFirebaseConfigured && db) {
      try {
        const tenantRef = doc(db, 'tenants', tenantId);
        logSave('tenants', tenantId, tenantId, dadosParaSalvar);
        await setDoc(tenantRef, dadosParaSalvar, { merge: true });
      } catch (error: any) {
        console.error("ERRO COMPLETO FIRESTORE", error);
        alert((error?.code || "Erro") + " - " + (error?.message || "Erro desconhecido"));
        throw error;
      }
    }

    // 2. Only upon success, save in localStorage
    localStorage.setItem(LOCAL_STORAGE_KEYS.nome, dadosParaSalvar.nome);
    localStorage.setItem(LOCAL_STORAGE_KEYS.cor, dadosParaSalvar.cor);
    localStorage.setItem(LOCAL_STORAGE_KEYS.logo, dadosParaSalvar.logo);
    localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, dadosParaSalvar.slogan);
    localStorage.setItem(LOCAL_STORAGE_KEYS.slug, dadosParaSalvar.slug);
    localStorage.setItem(LOCAL_STORAGE_KEYS.email, dadosParaSalvar.email);

    // 3. Atualizar estados locais
    setNome(dadosParaSalvar.nome);
    setCor(dadosParaSalvar.cor);
    setLogo(dadosParaSalvar.logo);
    setSlogan(dadosParaSalvar.slogan);
    setSlug(dadosParaSalvar.slug);
    setEmail(dadosParaSalvar.email);

    // 4. Disparar evento para componentes ativos se atualizarem
    window.dispatchEvent(new Event('domoBrandingChanged'));

    // Mostrar feedback explícito ao usuário de que as alterações foram salvas
    alert("Configurações e marca salvas com sucesso!");
  };

  return { nome, cor, logo, slogan, slug, email, loading, salvar };
}
