import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../firebase';
import { ensureAuthenticated, logSave, logLoad } from '../../utils/firestore';

const LOCAL_STORAGE_KEYS = {
  nome: 'domo_nome',
  cor: 'domo_cor',
  logo: 'domo_logo',
  slogan: 'domo_slogan',
  slug: 'domo_slug',
};

const DEFAULT_VALUES = {
  nome: 'Domo',
  cor: '#2d512e',
  logo: '/logo.svg',
  slogan: 'Gestão canina de ponta a ponta',
  slug: 'domo',
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
  const [loading, setLoading] = useState(true);

  // Sync state when branding gets updated from outside
  useEffect(() => {
    const handleBrandingChanged = () => {
      setNome(localStorage.getItem(LOCAL_STORAGE_KEYS.nome) || DEFAULT_VALUES.nome);
      setCor(localStorage.getItem(LOCAL_STORAGE_KEYS.cor) || DEFAULT_VALUES.cor);
      setLogo(localStorage.getItem(LOCAL_STORAGE_KEYS.logo) || DEFAULT_VALUES.logo);
      setSlogan(localStorage.getItem(LOCAL_STORAGE_KEYS.slogan) || DEFAULT_VALUES.slogan);
      setSlug(localStorage.getItem(LOCAL_STORAGE_KEYS.slug) || DEFAULT_VALUES.slug);
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

        if (localNome === 'Bichinhos peludos' || !localLogo || localLogo === '' || localLogo.includes('logo-bichinhos')) {
          localNome = 'Domo';
          localCor = '#2d512e';
          localLogo = '/logo.svg';
          localSlogan = 'Gestão canina de ponta a ponta';
          localSlug = 'domo';

          localStorage.setItem(LOCAL_STORAGE_KEYS.nome, localNome);
          localStorage.setItem(LOCAL_STORAGE_KEYS.cor, localCor);
          localStorage.setItem(LOCAL_STORAGE_KEYS.logo, localLogo);
          localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, localSlogan);
          localStorage.setItem(LOCAL_STORAGE_KEYS.slug, localSlug);
        }

        setNome(localNome);
        setCor(localCor);
        setLogo(localLogo);
        setSlogan(localSlogan);
        setSlug(localSlug);
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
            let fetchedCor = data.cor || data.corPrincipal || DEFAULT_VALUES.cor;
            let fetchedLogo = data.logo || data.logoUrl || DEFAULT_VALUES.logo;
            let fetchedSlogan = data.slogan || DEFAULT_VALUES.slogan;
            let fetchedSlug = data.slug || generateSlug(fetchedNome);

            if (fetchedNome === 'Bichinhos peludos' || !fetchedLogo || fetchedLogo === '' || fetchedLogo.includes('logo-bichinhos')) {
              fetchedNome = 'Domo';
              fetchedCor = '#2d512e';
              fetchedLogo = '/logo.svg';
              fetchedSlogan = 'Gestão canina de ponta a ponta';
              fetchedSlug = 'domo';

              const initTenantData = {
                nome: fetchedNome,
                cor: fetchedCor,
                logo: fetchedLogo,
                slogan: fetchedSlogan,
                slug: fetchedSlug,
                tenant_id: user.uid,
                nomeCreche: fetchedNome,
                logoUrl: fetchedLogo,
                corPrincipal: fetchedCor,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };

              logSave('tenants', user.uid, user.uid, initTenantData);
              setDoc(tenantRef, initTenantData).catch(err => console.error("Erro ao migrar tenant:", err));
            }

            setNome(fetchedNome);
            setCor(fetchedCor);
            setLogo(fetchedLogo);
            setSlogan(fetchedSlogan);
            setSlug(fetchedSlug);

            // Also keep localStorage updated in sync with cloud
            localStorage.setItem(LOCAL_STORAGE_KEYS.nome, fetchedNome);
            localStorage.setItem(LOCAL_STORAGE_KEYS.cor, fetchedCor);
            localStorage.setItem(LOCAL_STORAGE_KEYS.logo, fetchedLogo);
            localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, fetchedSlogan);
            localStorage.setItem(LOCAL_STORAGE_KEYS.slug, fetchedSlug);
          } else {
            // Document doesn't exist yet, load local storage settings
            let localNome = localStorage.getItem(LOCAL_STORAGE_KEYS.nome) || DEFAULT_VALUES.nome;
            let localCor = localStorage.getItem(LOCAL_STORAGE_KEYS.cor) || DEFAULT_VALUES.cor;
            let localLogo = localStorage.getItem(LOCAL_STORAGE_KEYS.logo) || DEFAULT_VALUES.logo;
            let localSlogan = localStorage.getItem(LOCAL_STORAGE_KEYS.slogan) || DEFAULT_VALUES.slogan;
            let localSlug = localStorage.getItem(LOCAL_STORAGE_KEYS.slug) || DEFAULT_VALUES.slug;

            if (localNome === 'Bichinhos peludos' || !localLogo || localLogo === '' || localLogo.includes('logo-bichinhos')) {
              localNome = 'Domo';
              localCor = '#2d512e';
              localLogo = '/logo.svg';
              localSlogan = 'Gestão canina de ponta a ponta';
              localSlug = 'domo';

              localStorage.setItem(LOCAL_STORAGE_KEYS.nome, localNome);
              localStorage.setItem(LOCAL_STORAGE_KEYS.cor, localCor);
              localStorage.setItem(LOCAL_STORAGE_KEYS.logo, localLogo);
              localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, localSlogan);
              localStorage.setItem(LOCAL_STORAGE_KEYS.slug, localSlug);
            }

            setNome(localNome);
            setCor(localCor);
            setLogo(localLogo);
            setSlogan(localSlogan);
            setSlug(localSlug);
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

  const salvar = async (novosDados: { nome: string; cor: string; logo?: string; slogan?: string }) => {
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

    const dadosParaSalvar = {
      nome: novosDados.nome,
      cor: novosDados.cor,
      logo: novosDados.logo || '',
      slogan: novosDados.slogan || '',
      slug: finalSlug,
      // Naming conventions requested by the user
      tenant_id: tenantId,
      nomeCreche: novosDados.nome,
      logoUrl: novosDados.logo || '',
      corPrincipal: novosDados.cor,
      createdAt,
      updatedAt: new Date().toISOString()
    };

    // 1. Gravar no localStorage
    localStorage.setItem(LOCAL_STORAGE_KEYS.nome, dadosParaSalvar.nome);
    localStorage.setItem(LOCAL_STORAGE_KEYS.cor, dadosParaSalvar.cor);
    localStorage.setItem(LOCAL_STORAGE_KEYS.logo, dadosParaSalvar.logo);
    localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, dadosParaSalvar.slogan);
    localStorage.setItem(LOCAL_STORAGE_KEYS.slug, dadosParaSalvar.slug);

    // 2. Gravar no Firestore se estiver logado e configurado
    if (isFirebaseConfigured && db) {
      try {
        const tenantRef = doc(db, 'tenants', tenantId);
        logSave('tenants', tenantId, tenantId, dadosParaSalvar);
        await setDoc(tenantRef, dadosParaSalvar);
      } catch (error) {
        console.error("Erro ao salvar configurações do Tenant:", error);
      }
    }

    // 3. Atualizar estados locais
    setNome(dadosParaSalvar.nome);
    setCor(dadosParaSalvar.cor);
    setLogo(dadosParaSalvar.logo);
    setSlogan(dadosParaSalvar.slogan);
    setSlug(dadosParaSalvar.slug);

    // 4. Disparar evento para componentes ativos se atualizarem
    window.dispatchEvent(new Event('domoBrandingChanged'));
  };

  return { nome, cor, logo, slogan, slug, loading, salvar };
}
