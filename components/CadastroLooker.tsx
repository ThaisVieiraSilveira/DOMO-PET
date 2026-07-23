
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pet } from '../types';
import { useTenant } from '../src/hooks/useTenant';
import { Copy, Check, Share2, ShieldCheck, Trash2, Link as LinkIcon, Info, Users, Smartphone, BookOpen, Upload, FileSpreadsheet, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured, firebaseConfig, missingKeys } from '../src/firebase';
import * as XLSX from 'xlsx';

interface CadastroLookerProps {
  pets: Pet[];
  onDeletePet: (id: string) => void;
  onSavePet?: (pet: Pet) => void;
  loadPetsFromFirestore?: () => Promise<Pet[]>;
}

const MAPPED_FIELDS: Record<string, keyof Pet> = {
  idpet: 'id',
  id: 'id',
  nomedopet: 'pet_nome',
  nome: 'pet_nome',
  pet: 'pet_nome',
  nomedotutor: 'tutor_nome',
  tutor: 'tutor_nome',
  telefone: 'telefone',
  celular: 'telefone',
  whatsapp: 'telefone',
  telefonedotutor: 'telefone',
  raca: 'raca',
  peso: 'peso_pet',
  pesodopet: 'peso_pet',
  pesokg: 'peso_pet',
  diasemana: 'dia_semana',
  diasnacreche: 'dia_semana',
  frequencia: 'dia_semana',
  observacoes: 'observacoes',
  observacao: 'observacoes',
  dataaniversario: 'data_aniversario',
  aniversario: 'data_aniversario',
  datanascimento: 'data_aniversario',
  nascimento: 'data_aniversario',
  tipoalimentacao: 'tipo_alimentacao',
  comportamentoalimentar: 'comportamento_alimentar',
  precisaestimulo: 'precisa_estimulo',
  quantidadeoferecida: 'quantidade_oferecida',
  quantidadeaproximada: 'quantidade_aproximada',
  marcaracao: 'marca_racao',
  especificacaoracao: 'especificacao_racao',
  ofereceextras: 'oferece_extras',
  ingestaoagua: 'ingestao_agua',
  interesseagua: 'interesse_agua',
  ajudabeberagua: 'ajuda_beber_agua',
  sedeposcreche: 'sede_pos_creche',
  possuialergia: 'possui_alergia',
  alimentosproibidos: 'alimentos_proibidos',
  possuidoenca: 'possui_doenca',
  doencaqual: 'doenca_qual',
  escorecorporal: 'escore_corporal',
  rotinapreferencias: 'rotina_preferencias',
  rotinacoisasnaogosta: 'rotina_coisas_nao_gosta',
  rotinapodepetisco: 'rotina_pode_petisco',
  rotinapodegrupo: 'rotina_pode_grupo',
  rotinadescansarseparado: 'rotina_descansar_separado',
  rotinarestricaorotina: 'rotina_restricao_rotina',
};

function normalizeHeader(header: any): string {
  return String(header || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

const headerAliases: Record<string, string[]> = {
  id: ['id_pet', 'id_pet_', 'id', 'codigo_pet', 'codigo_do_pet', 'id_do_pet', 'pet_id'],
  pet_nome: ['nome_do_pet', 'nome_pet', 'pet_nome', 'pet', 'nome'],
  raca: ['raca', 'raça'],
  tutor_nome: ['nome_do_tutor', 'nome_tutor', 'tutor', 'tutor_nome'],
  telefone: ['telefone', 'whatsapp', 'celular', 'telefonedotutor', 'telefone_do_tutor'],
  dia_semana: ['dia_semanal', 'dia_semana', 'dias_da_semana', 'dias_que_frequenta']
};

const normalizedAliases: Record<string, string[]> = {};
Object.entries(headerAliases).forEach(([field, aliases]) => {
  normalizedAliases[field] = aliases.map(alias => normalizeHeader(alias));
});

const CadastroLooker: React.FC<CadastroLookerProps> = ({ pets, onDeletePet, onSavePet, loadPetsFromFirestore }) => {
  const navigate = useNavigate();
  const { nome: domoNome, cor: domoCor, corSecundaria: domoCorSec } = useTenant();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'alergia' | 'doenca'>('all');
  const [petToDelete, setPetToDelete] = useState<Pet | null>(null);

  // Multi-view white label and pending integration
  const [showGenerator, setShowGenerator] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [editingPending, setEditingPending] = useState<any | null>(null);
  const [editingPendingIndex, setEditingPendingIndex] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleExportPetsExcel = () => {
    if (!pets || pets.length === 0) {
      alert('Nenhum pet cadastrado para baixar.');
      return;
    }
    try {
      const dataToExport = pets.map(pet => ({
        'ID': pet.id || '',
        'Nome do Pet': pet.pet_nome || '',
        'Tutor': pet.tutor_nome || '',
        'Telefone / WhatsApp': pet.telefone || '',
        'Raça': pet.raca || '',
        'Peso (kg)': pet.peso_pet || '',
        'Escala / Dias': pet.dia_semana || '',
        'Alimentação': pet.tipo_alimentacao || '',
        'Comportamento Alimentar': pet.comportamento_alimentar || '',
        'Alergias / Restrições': pet.alimentos_proibidos || '',
        'Doenças / Cuidados': pet.doencas_cuidados || '',
        'Medicamentos': pet.uso_medicamentos || '',
        'Observações': pet.observacoes || '',
        'Data de Aniversário': pet.data_aniversario || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Pets');

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DOMO_Pets_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Erro ao baixar em Excel, tentando CSV:", err);
      handleExportPetsCSV();
    }
  };

  const handleExportPetsCSV = () => {
    if (!pets || pets.length === 0) {
      alert('Nenhum pet cadastrado para baixar.');
      return;
    }
    const headers = ['ID', 'Nome do Pet', 'Tutor', 'Telefone', 'Raça', 'Peso (kg)', 'Escala / Dias', 'Alimentação', 'Alergias', 'Doenças', 'Medicamentos', 'Observações'];
    const rows = pets.map(pet => [
      pet.id || '',
      pet.pet_nome || '',
      pet.tutor_nome || '',
      pet.telefone || '',
      pet.raca || '',
      pet.peso_pet || '',
      pet.dia_semana || '',
      pet.tipo_alimentacao || '',
      pet.alimentos_proibidos || '',
      pet.doencas_cuidados || '',
      pet.uso_medicamentos || '',
      pet.observacoes || ''
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DOMO_Pets_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRefreshPets = async () => {
    if (loadPetsFromFirestore) {
      setIsRefreshing(true);
      try {
        const loaded = await loadPetsFromFirestore();
        alert(`Sincronização concluída! ${loaded.length} pets carregados da nuvem.`);
      } catch (err: any) {
        alert('Erro ao sincronizar pets do Firestore: ' + (err.message || String(err)));
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  // Import spreadsheet states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<'idle' | 'arquivoSelecionado' | 'lendoArquivo' | 'previewGerado' | 'importando' | 'importacaoConcluida' | 'erroImportacao'>('idle');
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDragActive, setImportDragActive] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    totalRows: number;
    validCount: number;
    errorCount: number;
    recognizedColumns: string[];
    rows: any[];
    errorDetails: string[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    errorCount: number;
    details: string[];
  } | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; currentName: string }>({ current: 0, total: 0, currentName: '' });
  const [importCancelled, setImportCancelled] = useState(false);
  const cancelRef = useRef(false);
  const [importedRowsCount, setImportedRowsCount] = useState(0);
  const [importedEmptyRowsCount, setImportedEmptyRowsCount] = useState(0);
  const [importedValidPets, setImportedValidPets] = useState<any[]>([]);

  const [tutorLinkMessage, setTutorLinkMessage] = useState<string | null>(null);
  const [tutorLinkError, setTutorLinkError] = useState<string | null>(null);

  const [firebaseTestMessage, setFirebaseTestMessage] = useState<string | null>(null);
  const [firebaseTestError, setFirebaseTestError] = useState<string | null>(null);
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);

  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [diagnosticStatus, setDiagnosticStatus] = useState<{
    projectId: string;
    isFirebaseConfigured: boolean;
    dbExists: boolean;
    authExists: boolean;
    userEmail: string | null;
    userUid: string | null;
    testStatus: 'idle' | 'running' | 'success' | 'error';
    errorMessage?: string;
  } | null>(null);

  const handleImportDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setImportDragActive(true);
    } else if (e.type === "dragleave") {
      setImportDragActive(false);
    }
  };

  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImportDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
        handleFileImport(file);
      } else {
        alert("Apenas arquivos .csv ou .xlsx são permitidos.");
      }
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
        handleFileImport(file);
      } else {
        alert("Apenas arquivos .csv ou .xlsx são permitidos.");
      }
    }
  };

  const handleFileImport = (file: File) => {
    console.log('[Importador] Arquivo selecionado:', file.name, 'Tamanho:', file.size, 'bytes');
    setImportFile(file);
    setImportResult(null);
    setImportErrorMessage(null);
    setImportStep('arquivoSelecionado');
    setImportCancelled(false);
    cancelRef.current = false;

    // Transição imediata para lendoArquivo para mostrar o feedback de processamento
    setImportStep('lendoArquivo');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        console.log('[Importador] Iniciando leitura binária do arquivo...');
        const data = e.target?.result;
        let workbook;
        if (file.name.endsWith('.csv')) {
          workbook = XLSX.read(data, { type: 'binary', codepage: 65001 });
        } else {
          workbook = XLSX.read(data, { type: 'binary' });
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        console.log('[Importador] Linhas brutas encontradas:', rawRows.length);
        
        if (rawRows.length === 0) {
          console.warn('[Importador] Planilha vazia!');
          setImportPreview({
            totalRows: 0,
            validCount: 0,
            errorCount: 0,
            recognizedColumns: [],
            rows: [],
            errorDetails: ['O arquivo está vazio.']
          });
          setImportStep('erroImportacao');
          setImportErrorMessage('O arquivo de planilha enviado está vazio.');
          return;
        }

        const headers = rawRows[0].map(h => String(h || '').trim());
        const normalizedHeaders = headers.map(h => normalizeHeader(h));
        console.log('Headers originais:', headers);
        console.log('Headers normalizados:', normalizedHeaders);

        const mappedIndices: { field: keyof Pet; index: number; label: string }[] = [];
        const recognizedLabels: string[] = [];

        headers.forEach((header, index) => {
          if (!header) return;
          const norm = normalizedHeaders[index];
          let matchedField: keyof Pet | null = null;

          // Check aliases first
          for (const [field, aliases] of Object.entries(normalizedAliases)) {
            if (aliases.includes(norm)) {
              matchedField = field as keyof Pet;
              break;
            }
          }

          // Fallback to MAPPED_FIELDS
          if (!matchedField) {
            const simplifiedNorm = norm.replace(/[^a-z0-9]/g, '');
            const internalField = MAPPED_FIELDS[simplifiedNorm] || MAPPED_FIELDS[norm.replace(/_/g, '')];
            if (internalField) {
              matchedField = internalField;
            }
          }

          if (matchedField) {
            mappedIndices.push({ field: matchedField, index, label: header });
            recognizedLabels.push(`${header} ➔ ${String(matchedField)}`);
          }
        });

        console.log('[Importador] Colunas mapeadas:', recognizedLabels);

        const hasName = mappedIndices.some(m => m.field === 'pet_nome');

        const missingRequired: string[] = [];
        if (!hasName) missingRequired.push('Nome do Pet');

        const errorDetails: string[] = [];
        if (missingRequired.length > 0) {
          const errMsg = `Coluna obrigatória ausente na planilha: ${missingRequired.join(', ')}`;
          console.error('[Importador] Erro de validação de colunas:', errMsg);
          errorDetails.push(errMsg);
        }

        // 1. Ignorar linhas totalmente vazias antes de validar
        const rows = rawRows.slice(1);
        const emptyRows = rows.filter(row => !row || row.every(val => val === undefined || val === null || String(val).trim() === ''));
        const nonEmptyRows = rows.filter(row => row && !row.every(val => val === undefined || val === null || String(val).trim() === ''));

        console.log('[Importador] Total de linhas de dados:', rows.length);
        console.log('[Importador] Linhas vazias ignoradas:', emptyRows.length);
        console.log('[Importador] Linhas com conteúdo para validar:', nonEmptyRows.length);

        // Guardar métricas nos estados para o relatório final e logs
        setImportedRowsCount(rows.length);
        setImportedEmptyRowsCount(emptyRows.length);

        // 2. Separar linhas válidas e inválidas
        const validPets: any[] = [];
        const invalidRows: any[] = [];

        nonEmptyRows.forEach((row, idx) => {
          // O número real da linha no arquivo excel/csv é: idx + 2 (já que cortamos o cabeçalho e idx começa em 0)
          const rowNum = idx + 2;
          const tempPet: any = {};

          mappedIndices.forEach(({ field, index }) => {
            const val = row[index];
            if (val !== undefined && val !== null) {
              tempPet[field] = String(val).trim();
            }
          });

          // Determinar ID com fallback robusto
          let petId = tempPet.id;
          if (!petId) {
            const rawIdIndex = headers.findIndex(h => h === 'ID_PET' || normalizeHeader(h) === 'id_pet');
            if (rawIdIndex !== -1 && row[rawIdIndex] !== undefined && row[rawIdIndex] !== null && String(row[rawIdIndex]).trim() !== '') {
              petId = String(row[rawIdIndex]).trim();
            }
          }
          if (!petId && typeof row === 'object' && row !== null) {
            petId = (row as any)['ID_PET'] || (row as any)['id_pet'] || (row as any)['id'] || (row as any)['ID'] || (row as any)['idpet'] || (row as any)['Id_Pet'];
            if (petId) petId = String(petId).trim();
          }
          if (!petId) {
            petId = 'pet_' + Math.random().toString(36).substring(2, 11);
          }
          tempPet.id = petId;

          const rowErrors: string[] = [];
          if (!tempPet.pet_nome) {
            rowErrors.push(`Linha ${rowNum}: Nome do Pet em branco.`);
          } else {
            // Garantir valores padrão para importar até 200+ pets sem rejeitar registros parciais
            if (!tempPet.tutor_nome) tempPet.tutor_nome = 'Tutor Não Informado';
            if (!tempPet.telefone) tempPet.telefone = '-';
            if (!tempPet.raca) tempPet.raca = 'SRD';
          }

          if (rowErrors.length > 0 || missingRequired.length > 0) {
            invalidRows.push(tempPet);
            errorDetails.push(...rowErrors);
          } else {
            validPets.push(tempPet);
          }
        });

        console.log('[Importador] Triagem concluída. Válidos:', validPets.length, 'Inválidos:', invalidRows.length);
        setImportedValidPets(validPets);

        // 3. Se não houver pets válidos, parar e mostrar erro
        if (validPets.length === 0) {
          console.warn('[Importador] Parando importação: nenhum pet válido encontrado.');
          setImportStep('erroImportacao');
          setImportErrorMessage(
            missingRequired.length > 0
              ? `Estrutura incompatível: faltam colunas essenciais na planilha (${missingRequired.join(', ')}).`
              : 'A planilha não contém nenhum pet com dados obrigatórios preenchidos corretamente (Nome do Pet, Nome do tutor e Telefone são necessários).'
          );
          return;
        }

        setImportPreview({
          totalRows: rows.length,
          validCount: validPets.length,
          errorCount: invalidRows.length + emptyRows.length,
          recognizedColumns: recognizedLabels,
          rows: validPets,
          errorDetails
        });

        setImportStep('previewGerado');

      } catch (err) {
        console.error("[Importador] Erro crítico ao processar planilha:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setImportStep('erroImportacao');
        setImportErrorMessage(errMsg);
        setImportPreview({
          totalRows: 0,
          validCount: 0,
          errorCount: 0,
          recognizedColumns: [],
          rows: [],
          errorDetails: [`Falha ao processar arquivo: ${errMsg}`]
        });
      }
    };

    reader.onerror = (errEvent) => {
      console.error("[Importador] Erro do FileReader:", errEvent);
      setImportStep('erroImportacao');
      setImportErrorMessage('Falha na leitura física do arquivo selecionado.');
    };

    reader.readAsBinaryString(file);
  };

  const confirmImport = async () => {
    if (!importPreview || importPreview.rows.length === 0) {
      console.warn('[Importador] Nenhum registro válido encontrado para importação.');
      return;
    }

    if (!isFirebaseConfigured || !db) {
      setImportStep('erroImportacao');
      setImportErrorMessage('Firebase não configurado. Os dados não serão persistidos.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setImportStep('erroImportacao');
      setImportErrorMessage('Usuário não autenticado. Faça login novamente.');
      return;
    }

    const tenantId = user.uid;
    console.log("Usuário logado:", user.uid);

    // Definir variáveis locais exatamente para os logs requisitados pelo usuário
    const rows = { length: importedRowsCount };
    const emptyRows = { length: importedEmptyRowsCount };
    const validPets = importedValidPets;

    console.log('Início da importação');
    console.log('Total linhas:', rows.length);
    console.log('Linhas vazias ignoradas:', emptyRows.length);
    console.log('Pets válidos:', validPets.length);

    setIsImporting(true);
    setImportStep('importando');
    setImportResult(null);
    setImportCancelled(false);
    cancelRef.current = false;

    let successCount = 0;
    let errCount = 0;
    const details: string[] = [];

    const petsToImport = importPreview.rows;
    const CHUNK_SIZE = 25;

    for (let i = 0; i < petsToImport.length; i += CHUNK_SIZE) {
      // Verificação em tempo real de cancelamento pelo usuário antes de processar o lote
      const chunk = petsToImport.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (pet) => {
          if (cancelRef.current) return;

          // Robust lookups by ID or Name (ignoring case/spaces) to prevent duplicates and preserve tokens
          const existingPet = pets.find(p => p.id === pet.id) || 
                              pets.find(p => p.pet_nome?.toLowerCase().trim() === pet.pet_nome?.toLowerCase().trim());
          
          if (existingPet) {
            pet.id = existingPet.id;
          }
          console.log("Salvando pet:", pet.id, pet.pet_nome);
          console.log("tenant_id usado:", user.uid);

          try {
            let token = existingPet?.tutorAccessToken;
            let createdAt = existingPet?.tutorAccessCreatedAt || new Date().toISOString();

            try {
              const petDocRef = doc(db, 'pets', pet.id);
              const petSnap = await getDoc(petDocRef);
              if (petSnap.exists()) {
                const petDb = petSnap.data();
                token = petDb.tutorAccessToken || token;
                createdAt = petDb.tutorAccessCreatedAt || createdAt;
              }
            } catch (dbErr) {
              console.warn(`[Importador] Erro ao consultar pet ${pet.id} no Firestore (continuando...):`, dbErr);
            }

            if (!token) {
              token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            }

            const defaultPet = {
              raca: 'SRD',
              peso_pet: '0',
              dia_semana: '',
              comportamento_alimentar: '-',
              precisa_estimulo: '-',
              tipo_alimentacao: 'Ração',
              quantidade_oferecida: '-',
              quantidade_aproximada: '-',
              marca_racao: '-',
              especificacao_racao: '-',
              oferece_extras: '-',
              ingestao_agua: '-',
              interesse_agua: '-',
              ajuda_beber_agua: '-',
              sede_pos_creche: 'Não',
              possui_alergia: 'Não',
              alimentos_proibidos: '-',
              possui_doenca: 'Não',
              doenca_qual: '-',
              escore_corporal: 'Ideal',
              observacoes: '',
              perfil_comportamental: [],
              rotina_preferencias: '',
              rotina_coisas_nao_gosta: '',
              rotina_pode_petisco: 'Sim',
              rotina_pode_grupo: 'Sim',
              rotina_descansar_separado: 'Não',
              rotina_restricao_rotina: '',
              alertas_importantes: [],
              atividades_favoritas: [],
              amizades: [],
              revisoes_mensais: [],
            };

            const petData: Pet = {
              ...defaultPet,
              ...existingPet,
              ...pet,
              id: pet.id,
              tutorAccessToken: token,
              tutorAccessEnabled: true,
              tutorAccessCreatedAt: createdAt,
              tutorAccessUpdatedAt: new Date().toISOString(),
              tenant_id: tenantId
            };

            console.log("Pet importado tenant_id:", petData.tenant_id);

            console.log("TENTANDO SALVAR", {
              collectionName: "pets",
              documentId: pet.id,
              userUid: tenantId,
              payload: petData
            });

            // Salvar definitivamente no Firebase Firestore com merge
            const petDocRef = doc(db, 'pets', pet.id);
            await setDoc(petDocRef, petData, { merge: true });

            const linkPayload = {
              petId: pet.id,
              crecheId: user.uid,
              ativo: true,
              atualizadoEm: serverTimestamp()
            };

            console.log("TENTANDO SALVAR", {
              collectionName: "tutorAccessLinks",
              documentId: token,
              userUid: tenantId,
              payload: linkPayload
            });

            // Salvar tutorAccessLinks com todos os metadados necessários
            const linkRef = doc(db, 'tutorAccessLinks', token);
            await setDoc(linkRef, linkPayload, { merge: true });

            // Atualizar também o fallback em local storage
            try {
              const linksStr = localStorage.getItem('domo_tutor_links') || '{}';
              const links = JSON.parse(linksStr);
              links[token] = {
                crecheId: user.uid,
                petId: pet.id,
                petNome: petData.pet_nome,
                tutorNome: petData.tutor_nome || '',
                tutorWhatsapp: petData.telefone || '',
                ativo: true,
                criadoEm: createdAt,
                atualizadoEm: new Date().toISOString()
              };
              localStorage.setItem('domo_tutor_links', JSON.stringify(links));
            } catch (localErr) {
              console.error("Erro ao salvar fallback de tutorAccessLinks no localStorage:", localErr);
            }

            successCount++;
            details.push(`Pet ${pet.pet_nome} (${pet.id}) importado/atualizado com sucesso!`);
          } catch (error: any) {
            console.error("ERRO COMPLETO FIRESTORE", error);
            alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
            console.log('Erro ao salvar pet:', pet.id, error);
            errCount++;
            details.push(`Erro ao importar pet ${pet.pet_nome || pet.id}: ${error instanceof Error ? error.message : String(error)}`);
            
            // Mostrar erro se o Firestore negar permissão
            if (error.code === 'permission-denied' || String(error).toLowerCase().includes('permission')) {
              setImportStep('erroImportacao');
              setImportErrorMessage("Erro de permissão no Firebase. Verifique se tenant_id é igual ao UID do usuário logado.");
            }
          } finally {
            // Atualizar progresso na tela
            setImportProgress({
              current: successCount + errCount,
              total: petsToImport.length,
              currentName: pet.pet_nome || pet.id
            });
          }
        })
      );
    }

    console.log('Fim da importação');

    const importedCount = successCount;
    console.log("Importação finalizada:", importedCount);

    if (importedCount === 0) {
      console.error("[Importador] Erro: Nenhum pet foi salvo no Firestore.");
      setImportStep('erroImportacao');
      setImportErrorMessage("Erro na importação: Nenhum pet foi salvo no Firestore. Verifique as permissões de acesso do Firestore ou se o arquivo contém registros válidos.");
      setIsImporting(false);
      return;
    }

    const totalProcessed = successCount + errCount;
    if (cancelRef.current) {
      details.unshift(`Importação interrompida pelo usuário. Processados ${totalProcessed} de ${petsToImport.length} pets.`);
    }

    // Depois de salvar, recarregar a lista de pets buscando do Firestore, não apenas do estado local.
    // Após importar, chamar função loadPetsFromFirestore() ou equivalente.
    if (loadPetsFromFirestore) {
      try {
        await loadPetsFromFirestore();
      } catch (err) {
        console.error("Erro ao recarregar a lista de pets através do loadPetsFromFirestore:", err);
      }
    }

    const reportTitle = "Importação concluída e salva no Firebase.";

    setImportResult({
      successCount,
      errorCount: errCount,
      details: [reportTitle, ...details]
    });
    setImportStep('importacaoConcluida');
    setIsImporting(false);
  };

  useEffect(() => {
    let active = true;
    let unsubscribeSnapshot: (() => void) | null = null;

    const loadPendings = () => {
      const stored = localStorage.getItem('domo_cadastros_pendentes');
      if (stored && !unsubscribeSnapshot) {
        try {
          setPendentes(JSON.parse(stored));
        } catch (e) {
          console.error("Erro ao converter cadastros públicos pendentes:", e);
        }
      } else if (!unsubscribeSnapshot) {
        setPendentes([]);
      }
    };

    // If Firebase is configured and user is logged in, subscribe to live pending registrations
    const setupFirebaseSubscription = () => {
      if (isFirebaseConfigured && db && auth.currentUser) {
        const pendentesRef = collection(db, 'cadastros_pendentes');
        const q = query(pendentesRef, where('tenant_id', '==', auth.currentUser.uid));

        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          if (!active) return;
          const fetchedPendings: any[] = [];
          snapshot.forEach((docSnap) => {
            fetchedPendings.push({
              ...docSnap.data(),
              id: docSnap.id,
            });
          });
          setPendentes(fetchedPendings);
          // Also sync to local storage for consistency/offline
          localStorage.setItem('domo_cadastros_pendentes', JSON.stringify(fetchedPendings));
          window.dispatchEvent(new Event('domoPendingRegistrationsChanged'));
        }, (error) => {
          console.error("Erro ao escutar cadastros pendentes:", error);
          loadPendings();
        });
      } else {
        loadPendings();
      }
    };

    setupFirebaseSubscription();

    window.addEventListener('domoPendingRegistrationsChanged', loadPendings);

    return () => {
      active = false;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      window.removeEventListener('domoPendingRegistrationsChanged', loadPendings);
    };
  }, []);

  const customSlug = useMemo(() => {
    return domoNome
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }, [domoNome]);

  const publicLink = useMemo(() => {
    return `${window.location.origin}/#/cadastro-publico?creche=${customSlug || 'patinhas'}`;
  }, [customSlug]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsapp = () => {
    const textMsg = `Olá! Preencha o cadastro do seu pet pelo link: ${publicLink}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;
    window.open(url, '_blank');
  };

  const generateTutorToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleCopyTutorLink = async (pet: Pet) => {
    setTutorLinkMessage(null);
    setTutorLinkError(null);
    try {
      // 1. Verificar usuário logado
      const user = auth.currentUser;
      if (!user) {
        setTutorLinkError("Usuário não autenticado. Faça login novamente.");
        return;
      }

      // 2. Gerar ou reutilizar token
      let token = pet.tutorAccessToken;
      const isTokenValid = !!token && pet.tutorAccessEnabled !== false;
      if (!isTokenValid) {
        token = generateTutorToken();
      }

      const petPayload = {
        tutorAccessToken: token,
        tutorAccessEnabled: true,
        tenant_id: user.uid,
        tutorAccessUpdatedAt: serverTimestamp()
      };

      console.log("TENTANDO SALVAR", {
        collectionName: "pets",
        documentId: pet.id,
        userUid: user.uid,
        payload: petPayload
      });

      // 3. Atualizar o documento do pet no Firestore
      const petDocRef = doc(db, 'pets', pet.id);
      await setDoc(petDocRef, petPayload, { merge: true });

      const linkPayload = {
        petId: pet.id,
        crecheId: user.uid,
        ativo: true,
        criadoEm: pet.tutorAccessCreatedAt || serverTimestamp(),
        atualizadoEm: serverTimestamp()
      };

      console.log("TENTANDO SALVAR", {
        collectionName: "tutorAccessLinks",
        documentId: token,
        userUid: user.uid,
        payload: linkPayload
      });

      // 4. Criar/atualizar tutorAccessLinks no Firestore
      const linkRef = doc(db, 'tutorAccessLinks', token);
      await setDoc(linkRef, linkPayload, { merge: true });

      // Fallback para localStorage
      try {
        const linksStr = localStorage.getItem('domo_tutor_links') || '{}';
        const links = JSON.parse(linksStr);
        links[token] = {
          crecheId: user.uid,
          petId: pet.id,
          petNome: pet.pet_nome,
          tutorNome: pet.tutor_nome || '',
          tutorWhatsapp: pet.telefone || '',
          ativo: true,
          criadoEm: pet.tutorAccessCreatedAt || new Date().toISOString(),
          atualizadoEm: new Date().toISOString()
        };
        localStorage.setItem('domo_tutor_links', JSON.stringify(links));
      } catch (localErr) {
        console.error("Erro ao salvar fallback de tutorAccessLinks no localStorage:", localErr);
      }

      // Atualizar no React state
      const updatedPet: Pet = {
        ...pet,
        tutorAccessToken: token,
        tutorAccessEnabled: true,
        tenant_id: user.uid,
        tutorAccessUpdatedAt: new Date().toISOString()
      };
      if (onSavePet) {
        await onSavePet(updatedPet);
      }

      // 5. Só depois gerar/copiar o link
      const publicUrl = `${window.location.origin}/#/perfil-pet/${token}`;
      await navigator.clipboard.writeText(publicUrl);

      // 6. Mostrar sucesso
      setTutorLinkMessage('Link criado e salvo com sucesso. 📋✨');
      setTimeout(() => setTutorLinkMessage(null), 5000);
    } catch (err: any) {
      // 7. Se der erro, mostrar erro real na tela e no console
      console.error("ERRO COMPLETO FIRESTORE", err);
      alert((err.code || "Erro") + " - " + (err.message || String(err)));
      setTutorLinkError(`Erro ao salvar link do tutor: ${err.message || String(err)}`);
    }
  };

  const handleRunDiagnostics = async () => {
    const logs: string[] = [];
    const addLog = (msg: string) => {
      console.log(msg);
      logs.push(msg);
      setDiagnosticLogs([...logs]);
    };

    setDiagnosticLogs([]);
    addLog("=== Iniciando Diagnóstico do Firebase ===");

    // 1. Mostrar e logar variáveis de configuração e estado
    addLog(`firebaseConfig.projectId: ${firebaseConfig.projectId}`);
    addLog(`isFirebaseConfigured: ${isFirebaseConfigured}`);
    addLog(`db existe?: ${!!db}`);
    addLog(`auth existe?: ${!!auth}`);

    const currentUser = auth.currentUser;
    addLog(`auth.currentUser: ${currentUser ? 'Sim, está logado' : 'Não está logado (null)'}`);
    if (currentUser) {
      addLog(`auth.currentUser.uid: ${currentUser.uid}`);
      addLog(`auth.currentUser.email: ${currentUser.email || 'N/A'}`);
    }

    setDiagnosticStatus({
      projectId: firebaseConfig.projectId || 'N/A',
      isFirebaseConfigured,
      dbExists: !!db,
      authExists: !!auth,
      userEmail: currentUser ? currentUser.email : null,
      userUid: currentUser ? currentUser.uid : null,
      testStatus: 'running'
    });

    // 2. Se isFirebaseConfigured for false, mostrar erro e campos ausentes
    if (!isFirebaseConfigured) {
      addLog("❌ ERRO: Firebase não configurado!");
      addLog(`Campos ausentes: ${missingKeys.join(', ')}`);
      setDiagnosticStatus(prev => prev ? {
        ...prev,
        testStatus: 'error',
        errorMessage: `Firebase não configurado. Campos ausentes: ${missingKeys.join(', ')}`
      } : null);
      return;
    }

    // 3. Se auth.currentUser for null: mostrar erro
    if (!currentUser) {
      addLog("❌ ERRO: Usuário não autenticado. Faça login novamente.");
      setDiagnosticStatus(prev => prev ? {
        ...prev,
        testStatus: 'error',
        errorMessage: "Usuário não autenticado. Faça login novamente."
      } : null);
      return;
    }

    try {
      addLog("Passo 1/2: Tentando gravar documento 'pets/TESTE001'...");
      const petDocRef = doc(db, 'pets', 'TESTE001');
      const petPayload = {
        id: "TESTE001",
        pet_nome: "Pet Teste",
        tutor_nome: "Tutor Teste",
        telefone: "11999999999",
        tenant_id: currentUser.uid,
        tutorAccessToken: "teste-token",
        tutorAccessEnabled: true,
        criadoEm: serverTimestamp()
      };
      console.log("TENTANDO SALVAR", {
        collectionName: "pets",
        documentId: "TESTE001",
        userUid: currentUser.uid,
        payload: petPayload
      });
      await setDoc(petDocRef, petPayload);
      addLog("✅ Documento 'pets/TESTE001' criado com sucesso!");

      addLog("Passo 2/2: Tentando gravar documento 'tutorAccessLinks/teste-token'...");
      const linkRef = doc(db, 'tutorAccessLinks', 'teste-token');
      const linkPayload = {
        petId: "TESTE001",
        crecheId: currentUser.uid,
        ativo: true,
        criadoEm: serverTimestamp()
      };
      console.log("TENTANDO SALVAR", {
        collectionName: "tutorAccessLinks",
        documentId: "teste-token",
        userUid: currentUser.uid,
        payload: linkPayload
      });
      await setDoc(linkRef, linkPayload);
      addLog("✅ Documento 'tutorAccessLinks/teste-token' criado com sucesso!");

      addLog("🎉 Teste salvo com sucesso no Firestore.");
      setDiagnosticStatus(prev => prev ? {
        ...prev,
        testStatus: 'success',
        errorMessage: undefined
      } : null);
    } catch (err: any) {
      console.error("ERRO COMPLETO FIRESTORE", err);
      alert((err?.code || "Erro") + " - " + (err?.message || String(err)));
      const code = err.code || 'Desconhecido';
      const message = err.message || String(err);
      addLog(`❌ FALHA AO GRAVAR NO FIRESTORE!`);
      addLog(`Código de erro: ${code}`);
      addLog(`Mensagem de erro: ${message}`);
      setDiagnosticStatus(prev => prev ? {
        ...prev,
        testStatus: 'error',
        errorMessage: `Erro ao gravar no Firestore [${code}]: ${message}`
      } : null);
    }
  };

  const handleApprove = async (index: number) => {
    const target = pendentes[index];
    if (!target) return;

    const newPet: Pet = {
      id: target.id || `PET_${Date.now()}`,
      pet_nome: target.pet_nome,
      raca: target.raca || 'Mestiço',
      tutor_nome: target.tutor_nome,
      telefone: target.telefone,
      dia_semana: target.dia_semana || 'Segunda',
      possui_alergia: target.possui_alergia || 'Não',
      alimentos_proibidos: target.alimentos_proibidos || '',
      possui_doenca: 'Não',
      doenca_qual: '',
      comportamento_alimentar: 'Focado',
      precisa_estimulo: 'Não',
      tipo_alimentacao: target.tipo_alimentacao || 'Padrão',
      quantidade_oferecida: target.quantidade_oferecida || '',
      quantidade_aproximada: '',
      marca_racao: '',
      especificacao_racao: '',
      oferece_extras: 'Sim',
      ingestao_agua: 'Ideal',
      interesse_agua: 'Médio',
      ajuda_beber_agua: 'Não',
      sede_pos_creche: 'Não',
      escore_corporal: 'Ideal',
      observacoes: target.observacoes || 'Importado de cadastro público.',
      peso_pet: '10kg',
      foto: target.foto || ''
    };

    if (onSavePet) {
      onSavePet(newPet);
    }

    const updatedPendings = [...pendentes];
    updatedPendings.splice(index, 1);
    setPendentes(updatedPendings);
    localStorage.setItem('domo_cadastros_pendentes', JSON.stringify(updatedPendings));
    window.dispatchEvent(new Event('domoPendingRegistrationsChanged'));

    if (isFirebaseConfigured && db && target.id) {
      try {
        const pendDocRef = doc(db, 'cadastros_pendentes', target.id);
        console.log("TENTANDO SALVAR (DELETAR)", {
          collectionName: "cadastros_pendentes",
          documentId: target.id,
          userUid: auth.currentUser?.uid,
          payload: null
        });
        await deleteDoc(pendDocRef);
      } catch (error: any) {
        console.error("ERRO COMPLETO FIRESTORE", error);
        alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
      }
    }

    alert(`Sucesso! O prontuário de ${target.pet_nome} foi adicionado à matilha principal de ${domoNome}!`);
  };

  const handleReject = async (index: number) => {
    const target = pendentes[index];
    if (!target) return;

    if (window.confirm(`Tem certeza que deseja recusar e apagar o formulário de ${target.pet_nome}?`)) {
      const updatedPendings = [...pendentes];
      updatedPendings.splice(index, 1);
      setPendentes(updatedPendings);
      localStorage.setItem('domo_cadastros_pendentes', JSON.stringify(updatedPendings));
      window.dispatchEvent(new Event('domoPendingRegistrationsChanged'));

      if (isFirebaseConfigured && db && target.id) {
        try {
          const pendDocRef = doc(db, 'cadastros_pendentes', target.id);
          console.log("TENTANDO SALVAR (DELETAR)", {
            collectionName: "cadastros_pendentes",
            documentId: target.id,
            userUid: auth.currentUser?.uid,
            payload: null
          });
          await deleteDoc(pendDocRef);
        } catch (error: any) {
          console.error("ERRO COMPLETO FIRESTORE", error);
          alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
        }
      }
    }
  };

  const handleSavePendingEdit = async (updatedData: any) => {
    if (editingPendingIndex === null || !editingPending) return;
    
    const updatedPendings = [...pendentes];
    updatedPendings[editingPendingIndex] = updatedData;
    
    setPendentes(updatedPendings);
    localStorage.setItem('domo_cadastros_pendentes', JSON.stringify(updatedPendings));
    window.dispatchEvent(new Event('domoPendingRegistrationsChanged'));
    
    if (isFirebaseConfigured && db && updatedData.id) {
      try {
        const pendDocRef = doc(db, 'cadastros_pendentes', updatedData.id);
        console.log("TENTANDO SALVAR", {
          collectionName: "cadastros_pendentes",
          documentId: updatedData.id,
          userUid: auth.currentUser?.uid,
          payload: updatedData
        });
        await setDoc(pendDocRef, updatedData);
      } catch (error: any) {
        console.error("ERRO COMPLETO FIRESTORE", error);
        alert((error?.code || "Erro") + " - " + (error?.message || String(error)));
      }
    }
    
    setEditingPending(null);
    setEditingPendingIndex(null);
  };

  const filteredPets = useMemo(() => {
    return pets.filter(pet => {
      const matchesSearch = 
        pet.pet_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pet.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pet.tutor_nome || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        filterType === 'all' ||
        (filterType === 'alergia' && (pet.possui_alergia || '').toLowerCase() === 'sim') ||
        (filterType === 'doenca' && (pet.possui_doenca || '').toLowerCase() === 'sim');

      return matchesSearch && matchesFilter;
    }).sort((a, b) => a.pet_nome.localeCompare(b.pet_nome));
  }, [pets, searchTerm, filterType]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 text-left">
      {/* Toast Notification for Tutor Link actions */}
      {(tutorLinkMessage || tutorLinkError) && (
        <div className="fixed top-6 right-6 z-[120] max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{tutorLinkError ? '⚠️' : '✅'}</span>
            <div className="flex-grow">
              <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">{tutorLinkError ? 'Erro' : 'Sucesso'}</h4>
              <p className="text-xs text-slate-600 font-semibold mt-1 leading-relaxed border-t border-slate-50 pt-1">
                {tutorLinkError || tutorLinkMessage}
              </p>
            </div>
            <button 
              onClick={() => { setTutorLinkMessage(null); setTutorLinkError(null); }}
              className="text-slate-400 hover:text-slate-600 text-xs font-black p-1 hover:bg-slate-50 rounded-full transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification for Firebase Test actions */}
      {(firebaseTestMessage || firebaseTestError) && (
        <div className="fixed top-6 right-6 z-[120] max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{firebaseTestError ? '⚠️' : '✅'}</span>
            <div className="flex-grow">
              <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">{firebaseTestError ? 'Erro Firebase' : 'Sucesso Firebase'}</h4>
              <p className="text-xs text-slate-600 font-semibold mt-1 leading-relaxed border-t border-slate-50 pt-1">
                {firebaseTestError || firebaseTestMessage}
              </p>
            </div>
            <button 
              onClick={() => { setFirebaseTestMessage(null); setFirebaseTestError(null); }}
              className="text-slate-400 hover:text-slate-600 text-xs font-black p-1 hover:bg-slate-50 rounded-full transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showDiagnosticModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] max-w-2xl w-full shadow-2xl border border-slate-100 p-8 flex flex-col gap-6 relative animate-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="text-xl font-black text-slate-800 leading-none">Diagnóstico Firebase</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Status de Conectividade e Gravação Real do Firestore</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDiagnosticModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Config & State Overview Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Variáveis de Ambiente</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">projectId:</span>
                    <span className="font-bold text-slate-800">{firebaseConfig.projectId || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Configurado?:</span>
                    <span className={`font-black ${isFirebaseConfigured ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isFirebaseConfigured ? 'SIM' : 'NÃO'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">db existe?:</span>
                    <span className={`font-black ${db ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {db ? 'SIM' : 'NÃO'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">auth existe?:</span>
                    <span className={`font-black ${auth ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {auth ? 'SIM' : 'NÃO'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sessão do Usuário</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Usuário Logado?:</span>
                    <span className={`font-black ${auth?.currentUser ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {auth?.currentUser ? 'SIM' : 'NÃO'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">E-mail:</span>
                    <span className="font-bold text-slate-800 truncate max-w-[150px]">{auth?.currentUser?.email || 'null'}</span>
                  </div>
                  <div className="flex justify-between flex-wrap gap-1">
                    <span className="text-slate-500">UID:</span>
                    <span className="font-mono text-[10px] bg-slate-200/60 px-1.5 py-0.5 rounded text-slate-700 truncate max-w-[180px]">
                      {auth?.currentUser?.uid || 'null'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Error notifications or tips */}
            {!isFirebaseConfigured && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl p-4 text-xs font-semibold space-y-1">
                <p className="font-bold">⚠️ Firebase não configurado!</p>
                <p>O aplicativo não conseguirá ler ou persistir dados no Firestore.</p>
                <p className="text-[10px] text-rose-600 mt-1 uppercase font-black">Campos ausentes: {missingKeys.join(', ') || 'Nenhum'}</p>
              </div>
            )}

            {isFirebaseConfigured && !auth?.currentUser && (
              <div className="bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl p-4 text-xs font-semibold space-y-1">
                <p className="font-bold">⚠️ Usuário não autenticado!</p>
                <p>Por favor, faça login com sua conta na tela de login para ter permissão de gravação no Firestore.</p>
              </div>
            )}

            {/* Diagnostic Logs / Interactive terminal */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Console de Execução em Tempo Real</h4>
                {diagnosticStatus?.testStatus === 'running' && (
                  <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 font-extrabold px-2 py-0.5 rounded-full uppercase animate-pulse">Testando...</span>
                )}
                {diagnosticStatus?.testStatus === 'success' && (
                  <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-extrabold px-2 py-0.5 rounded-full uppercase">Sucesso</span>
                )}
                {diagnosticStatus?.testStatus === 'error' && (
                  <span className="text-[9px] bg-rose-50 text-rose-600 border border-rose-100 font-extrabold px-2 py-0.5 rounded-full uppercase">Falhou</span>
                )}
              </div>
              <div className="bg-slate-950 text-slate-200 rounded-2xl p-5 font-mono text-[11px] leading-relaxed max-h-[180px] overflow-y-auto space-y-1 shadow-inner border border-slate-800">
                {diagnosticLogs.length === 0 ? (
                  <p className="text-slate-500 italic">Nenhum teste executado ainda. Clique no botão abaixo para rodar o diagnóstico completo.</p>
                ) : (
                  diagnosticLogs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap">{log}</div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleRunDiagnostics}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-600/15 transition-all cursor-pointer active:scale-95 flex items-center gap-2"
              >
                <span>⚡ Executar Diagnóstico</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER ADMINISTRATIVE */}
      <div className="bg-white rounded-[32px] p-8 border border-slate-150 shadow-sm space-y-6">
        {/* Linha 1: Título e Contador */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-4xl font-extrabold tracking-tight text-[#085041] leading-none">Cadastro</h2>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-150 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                {pets.length} ativos
              </span>
              {pendentes.length > 0 && (
                <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                  {pendentes.length} {pendentes.length === 1 ? 'cadastro pendente' : 'cadastros pendentes'}
                </span>
              )}
            </div>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1.5">Gestão central de prontuários</p>
          </div>
        </div>

        {/* Linha 2: Ações Principais lado a lado */}
        <div className="flex flex-wrap items-center gap-4">
          <button 
            type="button"
            onClick={() => navigate('/cadastro/novo')}
            className="px-5 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-700/10 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            style={{ backgroundColor: domoCor }}
          >
            <span>+ Adicionar Pet</span>
          </button>

          <button 
            type="button"
            onClick={() => setShowGenerator(prev => !prev)}
            className={`px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border-2 active:scale-95 ${
              showGenerator 
                ? 'bg-slate-50 border-emerald-600 text-emerald-700' 
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span>🔗 Gerar link para tutor</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setImportFile(null);
              setImportPreview(null);
              setImportResult(null);
              setImportStep('idle');
              setShowImportModal(true);
            }}
            className="px-5 py-3.5 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>Importar planilha</span>
          </button>

          <button 
            type="button"
            onClick={handleExportPetsExcel}
            className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/10 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>📥 Baixar Pets (Excel)</span>
          </button>

          <button 
            type="button"
            onClick={handleExportPetsCSV}
            className="px-4 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>📄 Baixar Pets (CSV)</span>
          </button>

          {loadPetsFromFirestore && (
            <button 
              type="button"
              onClick={handleRefreshPets}
              disabled={isRefreshing}
              className="px-5 py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-sky-600/10 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <span>{isRefreshing ? '🔄 Atualizando...' : '🔄 Sincronizar da Nuvem'}</span>
            </button>
          )}


        </div>

        {/* Separator Line */}
        <div className="h-px bg-slate-100"></div>

        {/* Linha 3: Filtros como pills clicáveis */}
        <div className="flex flex-wrap items-center gap-2.5 select-none">
          <button 
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-4.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
              filterType === 'all' 
                ? 'bg-[#085041] text-white shadow-lg shadow-[#085041]/15' 
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-500'
            }`}
            style={filterType === 'all' ? { backgroundColor: domoCor } : undefined}
          >
            Todos
          </button>

          <button 
            type="button"
            onClick={() => setFilterType('alergia')}
            className={`px-4.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${
              filterType === 'alergia' 
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/15' 
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-500'
            }`}
          >
            <span>⚠️ Alergias</span>
          </button>

          <button 
            type="button"
            onClick={() => setFilterType('doenca')}
            className={`px-4.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${
              filterType === 'doenca' 
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/15' 
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-500'
            }`}
          >
            <span>🏥 Doenças</span>
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE PUBLIC LINK GENERATOR CARD */}
      {showGenerator && (
        <div className="bg-gradient-to-r from-emerald-50 to-[#E6F6F0] rounded-[32px] p-6 border-2 border-emerald-100 shadow-xl space-y-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🔗</span>
              <div>
                <h4 className="font-black text-sm text-slate-800 leading-none">Link de Pré-Cadastro para Tutores</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Este link público permite que tutores cadastrem seus cães sem precisar de login</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full bg-white px-4 py-3.5 rounded-2xl border border-emerald-200/60 font-mono text-xs text-slate-600 truncate shadow-inner">
              {publicLink}
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
              <button
                onClick={handleCopyLink}
                className="flex-grow sm:flex-grow-0 px-5 py-3.5 bg-white text-slate-700 hover:bg-slate-50 rounded-2xl font-black text-xs uppercase tracking-wider border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} /> : <Copy className="w-4 h-4 text-slate-400" />}
                {copied ? 'Copiado!' : 'Copiar Link'}
              </button>
              
              <button
                onClick={handleShareWhatsapp}
                className="flex-grow sm:flex-grow-0 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/10 transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PENDING APPROVAL QUEUE CARD */}
      {pendentes.length > 0 && (
        <div className="bg-[#FFFBF2] rounded-[40px] p-8 border-2 border-amber-100 shadow-xl space-y-6 animate-in slide-in-from-top duration-500">
          <div className="flex items-center justify-between border-b border-amber-100/50 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-bounce">🐾</span>
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-800">Pré-Cadastros de Tutores</h3>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">({pendentes.length}) Fichas enviadas aguardando aprovação</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendentes.map((ped, idx) => (
              <div key={ped.id || idx} className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between relative group">
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl shadow-inner text-amber-600 group-hover:scale-105 transition-transform overflow-hidden border border-amber-100">
                      {ped.foto ? (
                        <img src={ped.foto} alt={ped.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        "🐶"
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-base text-slate-800 leading-none mb-1">{ped.pet_nome}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{ped.raca}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 font-medium pt-1">
                    <p>👤 <strong>Tutor:</strong> {ped.tutor_nome}</p>
                    <p>📞 <strong>WhatsApp:</strong> {ped.telefone}</p>
                    <p>📅 <strong>Escala:</strong> <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-extrabold uppercase text-[10px] border border-emerald-100">{ped.dia_semana}</span></p>
                    
                    {ped.possui_alergia === 'Sim' && (
                      <div className="p-2 border border-rose-100 bg-rose-50/50 rounded-lg text-[11px] text-rose-700 mt-2">
                        ⚠️ <strong>Restrições/Alergias:</strong> {ped.alimentos_proibidos}
                      </div>
                    )}

                    {ped.tipo_alimentacao === 'Especial' && (
                      <div className="p-2 border border-amber-100 bg-amber-100/30 rounded-lg text-[11px] text-amber-800 mt-2">
                        🥩 <strong>Alimentação/Dieta:</strong> {ped.quantidade_oferecida}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pt-4 border-t border-slate-50">
                  <button
                    onClick={() => handleApprove(idx)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-600/10 transition-all text-center flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" /> Aprovar
                  </button>
                  <button
                    onClick={() => {
                      setEditingPending(ped);
                      setEditingPendingIndex(idx);
                    }}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl px-3 py-2.5 font-black text-[10px] uppercase tracking-wider shadow-sm transition-all text-center flex items-center justify-center gap-1"
                  >
                    📝 Editar
                  </button>
                  <button
                    onClick={() => handleReject(idx)}
                    className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl px-3 py-2.5 font-black text-[10px] uppercase tracking-wider border border-rose-100 transition-all shadow-sm text-center flex items-center justify-center gap-1"
                    title="Recusar"
                  >
                    🗑️ Recusar/Arquivar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* SEARCH BAR */}
      <div className="relative group">
        <div className="absolute inset-0 bg-sky-500/5 blur-xl rounded-full group-focus-within:bg-sky-500/10 transition-all"></div>
        <input
          type="text"
          placeholder="Pesquise por Nome, ID ou Tutor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="relative w-full pl-14 pr-8 py-5 bg-white rounded-[32px] border-2 border-slate-50 focus:border-sky-300 outline-none transition-all font-black text-slate-700 placeholder:text-slate-300 shadow-xl shadow-slate-200/50 text-base"
        />
        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl opacity-20">🔎</span>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">PET / ID</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">RAÇA / TUTOR</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">ESCALA</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">DIETA</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">STATUS SAÚDE</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">REVISÃO MENSAL</th>
                <th className="p-6 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400 text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPets.map((pet) => (
                <tr key={pet.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform overflow-hidden border border-slate-200">
                        {pet.foto ? (
                          <img src={pet.foto} alt={pet.pet_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          "🐶"
                        )}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 leading-none mb-1 group-hover:text-sky-600 transition-colors">{pet.pet_nome}</p>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{pet.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <p className="text-xs font-black text-slate-700 leading-none mb-1">{pet.raca}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{pet.tutor_nome}</p>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-wrap gap-1">
                      {(pet.dia_semana || '-').split(',').map(d => (
                         <span key={d} className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/50">{d.trim()}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="text-sky-600 bg-sky-50 px-3 py-1 rounded-xl border border-sky-100 font-black text-[9px] uppercase">{pet.tipo_alimentacao}</span>
                  </td>
                  <td className="p-6">
                    <div className="flex gap-2">
                      {(pet.possui_alergia || '').toLowerCase() === 'sim' && (
                        <span className="bg-rose-50 text-rose-500 px-2 py-1 rounded-lg border border-rose-100 text-[8px] font-black uppercase tracking-widest">ALERGIA</span>
                      )}
                      {(pet.possui_doenca || '').toLowerCase() === 'sim' && (
                        <span className="bg-amber-50 text-amber-500 px-2 py-1 rounded-lg border border-amber-100 text-[8px] font-black uppercase tracking-widest">DOENÇA</span>
                      )}
                      {(pet.possui_alergia || '').toLowerCase() !== 'sim' && (pet.possui_doenca || '').toLowerCase() !== 'sim' && (
                        <span className="text-slate-300 text-[8px] font-black uppercase italic tracking-widest">SAUDÁVEL</span>
                      )}
                    </div>
                  </td>
                  <td className="p-6">
                    {pet.ultimo_responsavel_atualizacao ? (
                      <div>
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-lg font-black text-[8px] uppercase tracking-wider block w-max">
                          📋 {pet.ultimo_mes_atualizacao}
                        </span>
                        <p className="text-[8px] font-extrabold text-slate-400 mt-0.5 uppercase tracking-wide">Por {pet.ultimo_responsavel_atualizacao}</p>
                      </div>
                    ) : (
                      <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-lg font-black text-[8px] uppercase tracking-wider block w-max animate-pulse">
                        ⚠️ Pendente
                      </span>
                    )}
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => navigate(`/cadastro/${pet.id}`)}
                        className="flex-grow bg-sky-500 hover:bg-sky-600 text-white py-2 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-sky-500/20 transition-all"
                      >
                        ABRIR FICHA
                      </button>
                      <button 
                        onClick={() => handleCopyTutorLink(pet)}
                        className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-1"
                        title={pet.tutorAccessToken && pet.tutorAccessEnabled ? 'Copiar link de acompanhamento do tutor' : 'Gerar e copiar link de acompanhamento do tutor'}
                      >
                        <span>🔗</span> {pet.tutorAccessToken && pet.tutorAccessEnabled ? 'Copiar Link' : 'Gerar Link'}
                      </button>
                      <button 
                        onClick={() => setPetToDelete(pet)}
                        className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white rounded-xl border border-slate-100 transition-all shadow-sm group/del"
                        title="Excluir Pet"
                      >
                        <span className="group-hover/del:scale-110 transition-transform">🗑️</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPets.length === 0 && (
            <div className="p-32 text-center flex flex-col items-center justify-center opacity-20">
              <span className="text-7xl mb-4">🔦</span>
              <p className="font-black text-slate-800 uppercase tracking-[0.3em] text-sm">Nenhum pet encontrado na busca Looker.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center px-8 text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] py-4">
        <span>DOMO Database Management</span>
        <span>Filtered: {filteredPets.length} of {pets.length} pets</span>
      </div>

      {/* PENDING EDIT MODAL */}
      {editingPending && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[36px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center text-left">
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-none">Editar Pré-Cadastro</h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Ajuste os dados de {editingPending.pet_nome} antes de aprovar</p>
              </div>
              <button 
                type="button"
                onClick={() => { setEditingPending(null); setEditingPendingIndex(null); }}
                className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-sm hover:text-rose-500 font-bold hover:bg-rose-50 transition-all text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4 text-left">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Nome do Pet</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                  value={editingPending.pet_nome}
                  onChange={(e) => setEditingPending({ ...editingPending, pet_nome: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Raça</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    value={editingPending.raca}
                    onChange={(e) => setEditingPending({ ...editingPending, raca: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Aniversário / Idade</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    value={editingPending.data_aniversario || ''}
                    onChange={(e) => setEditingPending({ ...editingPending, data_aniversario: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Nome do Tutor</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    value={editingPending.tutor_nome}
                    onChange={(e) => setEditingPending({ ...editingPending, tutor_nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    value={editingPending.telefone}
                    onChange={(e) => setEditingPending({ ...editingPending, telefone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Escala de Dias da Semana</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                  value={editingPending.dia_semana}
                  onChange={(e) => setEditingPending({ ...editingPending, dia_semana: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Possui Alergia?</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none bg-white"
                    value={editingPending.possui_alergia}
                    onChange={(e) => setEditingPending({ ...editingPending, possui_alergia: e.target.value })}
                  >
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Tipo de Alimentação</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none bg-white"
                    value={editingPending.tipo_alimentacao}
                    onChange={(e) => setEditingPending({ ...editingPending, tipo_alimentacao: e.target.value })}
                  >
                    <option value="Padrão">Padrão</option>
                    <option value="Especial">Especial</option>
                  </select>
                </div>
              </div>

              {editingPending.possui_alergia === 'Sim' && (
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Detalhes da Alergia / Restrições</label>
                  <textarea
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none h-20"
                    value={editingPending.alimentos_proibidos || ''}
                    onChange={(e) => setEditingPending({ ...editingPending, alimentos_proibidos: e.target.value })}
                  />
                </div>
              )}

              {editingPending.tipo_alimentacao === 'Especial' && (
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Instruções de Alimentação Especial</label>
                  <textarea
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none h-20"
                    value={editingPending.quantidade_oferecida || ''}
                    onChange={(e) => setEditingPending({ ...editingPending, quantidade_oferecida: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setEditingPending(null); setEditingPendingIndex(null); }}
                className="px-5 py-3 bg-white text-slate-700 font-bold border border-slate-200 hover:bg-slate-55 rounded-xl text-xs uppercase tracking-wider transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSavePendingEdit(editingPending)}
                className="px-6 py-3 bg-emerald-600 text-white font-black hover:bg-emerald-700 rounded-xl text-xs uppercase tracking-wider transition shadow-md"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO DE PLANILHA */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 my-8">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 leading-tight">Importar Planilha de Pets</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Mapeamento e sincronização automatizada</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview(null);
                  setImportResult(null);
                  setImportStep('idle');
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              
              {/* INDICADOR DE ETAPAS DO IMPORTADOR */}
              <div className="grid grid-cols-5 gap-1.5 pb-2">
                {[
                  { step: 'lendoArquivo', label: '1. Leitura' },
                  { step: 'previewGerado', label: '2. Prévia' },
                  { step: 'importando', label: '3. Salvando' },
                  { step: 'importacaoConcluida', label: '4. Concluído' },
                  { step: 'erroImportacao', label: 'Erro' }
                ].map((item) => {
                  let bg = 'bg-slate-50 text-slate-400 border-slate-150';
                  
                  if (item.step === 'erroImportacao') {
                    if (importStep === 'erroImportacao') {
                      bg = 'bg-rose-100 text-rose-800 border-rose-300 font-black';
                    } else {
                      return null; // Oculta etapa de erro se não estiver nela
                    }
                  } else if (importStep === item.step) {
                    bg = 'bg-emerald-600 text-white border-emerald-700 font-black scale-102 shadow-sm';
                  } else if (
                    (item.step === 'lendoArquivo' && ['previewGerado', 'importando', 'importacaoConcluida'].includes(importStep)) ||
                    (item.step === 'previewGerado' && ['importando', 'importacaoConcluida'].includes(importStep)) ||
                    (item.step === 'importando' && importStep === 'importacaoConcluida')
                  ) {
                    bg = 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold';
                  }

                  return (
                    <div 
                      key={item.step} 
                      className={`text-center border py-2 px-1 rounded-xl text-[9px] uppercase tracking-wider transition-all duration-300 ${bg}`}
                    >
                      {item.label}
                    </div>
                  );
                })}
              </div>

              {/* RENDERIZADO COM BASE NO PASSO ATUAL */}
              {importStep === 'idle' && (
                <div className="space-y-6">
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-emerald-800 text-xs font-semibold leading-relaxed">
                    “Envie um arquivo exportado do Google Sheets em CSV ou XLSX. O sistema suporta a importação de 200 ou mais pets e os cadastra/atualiza no banco de dados automaticamente.”
                  </div>

                  <div
                    onDragEnter={handleImportDrag}
                    onDragOver={handleImportDrag}
                    onDragLeave={handleImportDrag}
                    onDrop={handleImportDrop}
                    className={`border-3 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                      importDragActive
                        ? 'border-emerald-500 bg-emerald-50/30 scale-98'
                        : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50/50'
                    }`}
                    onClick={() => document.getElementById('import-file-input')?.click()}
                  >
                    <Upload size={40} className="text-slate-400 mb-4 animate-bounce" />
                    <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Arraste a planilha aqui</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">ou clique para selecionar do computador</p>
                    <p className="text-[9px] text-slate-400 mt-3 font-semibold">Suporta arquivos .CSV ou .XLSX (Aceita 200+ pets em lotes)</p>
                    <input
                      type="file"
                      id="import-file-input"
                      accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleImportFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {(importStep === 'arquivoSelecionado' || importStep === 'lendoArquivo') && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin flex items-center justify-center">
                    <FileSpreadsheet size={24} className="text-emerald-600 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">Lendo Planilha</h4>
                    <p className="text-xs text-slate-400 mt-1">Carregando dados, mapeando colunas e analisando registros...</p>
                  </div>
                  {importFile && (
                    <div className="bg-slate-50 border border-slate-150 px-4 py-2 rounded-xl text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              )}

              {importStep === 'previewGerado' && (
                <div className="space-y-6">
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet size={24} className="text-emerald-600" />
                      <div>
                        <p className="text-xs font-black text-slate-700">{importFile?.name}</p>
                        <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                          {importFile ? (importFile.size / 1024).toFixed(1) : '0'} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setImportFile(null);
                        setImportPreview(null);
                        setImportStep('idle');
                      }}
                      className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest transition"
                    >
                      Remover arquivo
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Prévia da Importação</h4>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total de Linhas</p>
                        <p className="text-2xl font-black text-slate-800 mt-1">{importPreview?.totalRows || 0}</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center">
                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Pets Válidos</p>
                        <p className="text-2xl font-black text-emerald-700 mt-1">{importPreview?.validCount || 0}</p>
                      </div>
                      <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-center">
                        <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest">Incompletos / Ignorados</p>
                        <p className="text-2xl font-black text-rose-700 mt-1">{importPreview?.errorCount || 0}</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Colunas Mapeadas ({importPreview?.recognizedColumns.length || 0})</p>
                      {importPreview && importPreview.recognizedColumns.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {importPreview.recognizedColumns.map((col, idx) => (
                            <span key={idx} className="bg-emerald-100/60 border border-emerald-200 text-emerald-800 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                              {col}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Nenhuma coluna mapeada correspondente encontrada!</p>
                      )}
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider pt-1">
                        Requisitos mínimos: Nome do Pet, Nome do tutor, Telefone
                      </p>
                    </div>

                    {importPreview && importPreview.errorDetails.length > 0 && (
                      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 space-y-2 max-h-[200px] overflow-y-auto">
                        <div className="flex items-center gap-1.5 text-rose-700 text-xs font-black">
                          <AlertTriangle size={14} />
                          <span>ALERTAS DE LINHAS COM CAMPOS VAZIOS ({importPreview.errorDetails.length})</span>
                        </div>
                        <ul className="space-y-1 text-[10px] text-rose-600 font-semibold list-disc list-inside">
                          {importPreview.errorDetails.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {importStep === 'importando' && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-5">
                  <div className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin flex items-center justify-center">
                    <FileSpreadsheet size={32} className="text-emerald-600 animate-pulse" />
                  </div>
                  <div className="w-full max-w-sm">
                    <h4 className="text-base font-black text-slate-800 uppercase tracking-wider">Sincronizando Pets</h4>
                    <p className="text-xs text-slate-400 mt-1">Sincronizando em lotes de 20 com o banco de dados...</p>
                    
                    {/* Barra de Progresso Real */}
                    <div className="mt-6">
                      <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        <span>Progresso Geral</span>
                        <span>{importProgress.current} / {importProgress.total}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                        <div 
                          className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                          style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-2 animate-pulse truncate max-w-full">
                        {importProgress.currentName ? `Enviando: ${importProgress.currentName}` : 'Preparando...'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                    Por favor, não feche esta janela
                  </div>
                </div>
              )}

              {importStep === 'importacaoConcluida' && (
                <div className="space-y-6 py-4 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl">
                    <CheckCircle size={36} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-800">Importação Concluída</h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Resumo final do processamento</p>
                  </div>

                  {importResult && (
                    <>
                      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                        <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl">
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Sucesso</p>
                          <p className="text-3xl font-black text-emerald-700 mt-1">{importResult.successCount}</p>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl">
                          <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Falhas</p>
                          <p className="text-3xl font-black text-rose-700 mt-1">{importResult.errorCount}</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-left space-y-2 max-h-[200px] overflow-y-auto">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Relatório de Processamento</p>
                        <ul className="space-y-1 text-[10px] font-semibold text-slate-600">
                          {importResult.details.map((detail, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-emerald-500 font-bold">•</span>
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}

              {importStep === 'erroImportacao' && (
                <div className="space-y-6 py-4 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-3xl">
                    <AlertTriangle size={36} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-800">Erro na Importação</h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Falha no mapeamento ou na estrutura do arquivo</p>
                  </div>

                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 text-left space-y-3">
                    <p className="text-[10px] font-black text-rose-700 uppercase tracking-wider">Mensagem de Erro:</p>
                    <p className="bg-white p-3 rounded-xl border border-rose-150 text-xs font-bold text-rose-900 font-mono break-words leading-relaxed">
                      {importErrorMessage || 'Ocorreu um erro desconhecido ao processar sua planilha.'}
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 text-left text-xs font-semibold text-slate-600 space-y-2 leading-relaxed">
                    <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Como corrigir?</p>
                    <p>• Certifique-se de que o arquivo contém as colunas necessárias de identificação: <span className="font-bold">Nome do Pet</span>, <span className="font-bold">Nome do tutor</span>, e <span className="font-bold">Telefone</span>.</p>
                    <p>• O cabeçalho deve estar na primeira linha do arquivo.</p>
                    <p>• O formato deve ser exclusivamente <span className="font-bold">.CSV</span> ou <span className="font-bold">.XLSX</span>.</p>
                  </div>
                </div>
              )}

            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
              {/* BOTÕES DINÂMICOS CONFORME O PASSO ATUAL */}
              {importStep === 'idle' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportPreview(null);
                    setImportResult(null);
                    setImportStep('idle');
                  }}
                  className="px-5 py-3 bg-white text-slate-700 font-bold border border-slate-200 hover:bg-slate-100 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Cancelar
                </button>
              )}

              {['arquivoSelecionado', 'lendoArquivo'].includes(importStep) && (
                <button
                  type="button"
                  disabled
                  className="px-6 py-3 bg-slate-200 text-slate-400 font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 cursor-not-allowed"
                >
                  Carregando...
                </button>
              )}

              {importStep === 'importando' && (
                <button
                  type="button"
                  onClick={() => {
                    cancelRef.current = true;
                    setImportCancelled(true);
                  }}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer"
                >
                  Cancelar importação
                </button>
              )}

              {importStep === 'previewGerado' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setImportFile(null);
                      setImportPreview(null);
                      setImportStep('idle');
                    }}
                    className="px-5 py-3 bg-white text-slate-700 font-bold border border-slate-200 hover:bg-slate-100 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                  >
                    Selecionar Outro
                  </button>
                  <button
                    type="button"
                    disabled={!importPreview || importPreview.validCount === 0 || isImporting}
                    onClick={confirmImport}
                    className={`px-6 py-3 text-white font-black rounded-xl text-xs uppercase tracking-wider transition shadow-md flex items-center gap-2 cursor-pointer ${
                      !importPreview || importPreview.validCount === 0 || isImporting
                        ? 'bg-slate-300 cursor-not-allowed shadow-none'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    Confirmar Importação ({importPreview?.validCount || 0})
                  </button>
                </>
              )}

              {importStep === 'erroImportacao' && (
                <button
                  type="button"
                  onClick={() => {
                    setImportFile(null);
                    setImportPreview(null);
                    setImportResult(null);
                    setImportStep('idle');
                    setImportErrorMessage(null);
                  }}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer"
                >
                  Selecionar outro arquivo
                </button>
              )}

              {importStep === 'importacaoConcluida' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportPreview(null);
                    setImportResult(null);
                    setImportStep('idle');
                  }}
                  className="px-6 py-3 bg-emerald-600 text-white font-black hover:bg-emerald-700 rounded-xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer"
                >
                  Fechar Relatório
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE PET */}
      {petToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-[35px] border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="text-left">
              <h4 className="text-xl font-black text-slate-800 leading-none">
                Excluir cadastro do pet?
              </h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Essa ação é permanente e não poderá ser desfeita. Todos os dados, histórico de saúde, relatórios e registros de <strong>{petToDelete.pet_nome}</strong> serão removidos permanentemente do sistema.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPetToDelete(null)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onDeletePet && petToDelete.id) {
                    await onDeletePet(petToDelete.id);
                    setPetToDelete(null);
                  }
                }}
                className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                Excluir Pet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroLooker;
