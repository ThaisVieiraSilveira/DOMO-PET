
import { Pet, ChecklistEntry } from '../types';
import { calculateStatus } from './status';

export const getGeneratedMessage = (pet: Pet, entry: Partial<ChecklistEntry>) => {
  if (!pet) return '';
  const petName = pet.pet_nome || 'amigão';
  const tutorName = pet.tutor_nome ? `${pet.tutor_nome}, ` : '';
  const foodStatus = entry.comeu;
  
  let foodInfo = '';

  if (foodStatus === 'Comeu tudo') {
    foodInfo = `Sobre a alimentação: ele comeu super bem e limpou o potinho! 😋 Está tendo um dia maravilhoso e está muito feliz aqui com a gente.`;
  } else if (foodStatus) {
    const isLowAppetite = foodStatus === 'Não comeu' || foodStatus === 'Comeu metade' || foodStatus === 'Comeu menos da metade';
    const nutritionNote = isLowAppetite 
      ? "\n\nComo ele(a) não comeu tudo hoje, vale a pena ficar atento(a) de como será a alimentação dele(a) no restante do dia. Com paciência, amor e carinho, logo o apetite volta ao normal! ❤️"
      : "";
    
    const statusText = (foodStatus as string).toLowerCase();
    foodInfo = `Sobre a alimentação: ele ${statusText}.${nutritionNote}`;
  }

  // 1. Perfil Comportamental
  let behaviorInfo = '';
  if (pet.perfil_comportamental && pet.perfil_comportamental.length > 0) {
    const traits = pet.perfil_comportamental.join(', ');
    behaviorInfo = `Como você sabe, o ${petName} tem aquele jeitinho único: ele é muito ${traits.toLowerCase()}!`;
  }

  // 2. Amigos do Mês
  let friendInfo = '';
  if (pet.amizades && pet.amizades.length > 0) {
    const date = new Date();
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const currentMesAno = `${months[date.getMonth()]}/${date.getFullYear()}`;
    
    // Procura amigo deste mês específico, ou pega o último cadastrado se não houver
    const activeFriends = pet.amizades.filter(f => f.mesAno.toLowerCase() === currentMesAno.toLowerCase());
    const friendToMention = activeFriends.length > 0 ? activeFriends[0] : pet.amizades[pet.amizades.length - 1];
    
    if (friendToMention) {
      friendInfo = `🐾 Amigo do Mês: O parceiro oficial de aventuras dele tem sido o *${friendToMention.petAmigo}* (${friendToMention.nivelAmizade})! ${friendToMention.observacao}`;
    }
  }

  // 3. Alertas e Cuidados
  let alertInfo = '';
  if (pet.alertas_importantes && pet.alertas_importantes.length > 0) {
    alertInfo = `⚠️ Cuidados especiais ativos: ${pet.alertas_importantes.join(', ')}`;
  }

  const message = [
    `Olá ${tutorName}! Passando para dar notícias do ${petName} hoje.`,
    behaviorInfo,
    foodInfo,
    friendInfo,
    entry.observacoes ? `Observação do dia: ${entry.observacoes}` : '',
    alertInfo
  ].filter(Boolean).join('\n\n');

  return message;
};
