import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../firebase';

const LOCAL_STORAGE_KEYS = {
  nome: 'domo_nome',
  cor: 'domo_cor',
  logo: 'domo_logo',
  slogan: 'domo_slogan',
  slug: 'domo_slug',
};

const DEFAULT_VALUES = {
  nome: 'DOMO',
  cor: '#085041',
  logo: '',
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
  const [nome, setNome] = useState(() => localStorage.getItem(LOCAL_STORAGE_KEYS.nome) || DEFAULT_VALUES.nome);
  const [cor, setCor] = useState(() => localStorage.getItem(LOCAL_STORAGE_KEYS.cor) || DEFAULT_VALUES.cor);
  const [logo, setLogo] = useState(() => localStorage.getItem(LOCAL_STORAGE_KEYS.logo) || DEFAULT_VALUES.logo);
  const [slogan, setSlogan] = useState(() => localStorage.getItem(LOCAL_STORAGE_KEYS.slogan) || DEFAULT_VALUES.slogan);
  const [slug, setSlug] = useState(() => localStorage.getItem(LOCAL_STORAGE_KEYS.slug) || DEFAULT_VALUES.slug);
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
        setNome(localStorage.getItem(LOCAL_STORAGE_KEYS.nome) || DEFAULT_VALUES.nome);
        setCor(localStorage.getItem(LOCAL_STORAGE_KEYS.cor) || DEFAULT_VALUES.cor);
        setLogo(localStorage.getItem(LOCAL_STORAGE_KEYS.logo) || DEFAULT_VALUES.logo);
        setSlogan(localStorage.getItem(LOCAL_STORAGE_KEYS.slogan) || DEFAULT_VALUES.slogan);
        setSlug(localStorage.getItem(LOCAL_STORAGE_KEYS.slug) || DEFAULT_VALUES.slug);
        setLoading(false);
        return;
      }

      try {
        const tenantRef = doc(db, 'tenants', user.uid);
        const docSnap = await getDoc(tenantRef);

        if (active) {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const fetchedNome = data.nome || DEFAULT_VALUES.nome;
            const fetchedCor = data.cor || DEFAULT_VALUES.cor;
            const fetchedLogo = data.logo || DEFAULT_VALUES.logo;
            const fetchedSlogan = data.slogan || DEFAULT_VALUES.slogan;
            const fetchedSlug = data.slug || generateSlug(fetchedNome);

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
            const localNome = localStorage.getItem(LOCAL_STORAGE_KEYS.nome) || DEFAULT_VALUES.nome;
            const localCor = localStorage.getItem(LOCAL_STORAGE_KEYS.cor) || DEFAULT_VALUES.cor;
            const localLogo = localStorage.getItem(LOCAL_STORAGE_KEYS.logo) || DEFAULT_VALUES.logo;
            const localSlogan = localStorage.getItem(LOCAL_STORAGE_KEYS.slogan) || DEFAULT_VALUES.slogan;
            const localSlug = localStorage.getItem(LOCAL_STORAGE_KEYS.slug) || DEFAULT_VALUES.slug;

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
    const finalSlug = generateSlug(novosDados.nome);
    const dadosParaSalvar = {
      nome: novosDados.nome,
      cor: novosDados.cor,
      logo: novosDados.logo || '',
      slogan: novosDados.slogan || '',
      slug: finalSlug,
    };

    // 1. Gravar no localStorage
    localStorage.setItem(LOCAL_STORAGE_KEYS.nome, dadosParaSalvar.nome);
    localStorage.setItem(LOCAL_STORAGE_KEYS.cor, dadosParaSalvar.cor);
    localStorage.setItem(LOCAL_STORAGE_KEYS.logo, dadosParaSalvar.logo);
    localStorage.setItem(LOCAL_STORAGE_KEYS.slogan, dadosParaSalvar.slogan);
    localStorage.setItem(LOCAL_STORAGE_KEYS.slug, dadosParaSalvar.slug);

    // 2. Gravar no Firestore se estiver logado e configurado
    if (isFirebaseConfigured && db && auth.currentUser) {
      try {
        const tenantRef = doc(db, 'tenants', auth.currentUser.uid);
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
