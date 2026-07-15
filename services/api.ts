
import { Pet } from '../types';

/**
 * BASE MESTRE INTEGRADA - 161 PETS
 * Estrutura mapeada do CSV: ID|Nome|Raca|Tutor|Telefone|DiaSemana|Ansioso|Comportamento|Estimulo|TipoAlim|QtdOferecida|QtdAprox|Marca|Especif|ExtrasSN|ExtrasLista|ExtrasMomento|IngAgua|InteresseSN|InteresseTipo|AjudaAgua|SedePos|Alergia|Proibidos|Doenca|DoencaQual|Escore|ObsExtra
 */
const MASTER_RAW = `PET001|Amélia|SRD|Isabela Franco|11 96939-3354|Quarta|Sim|Come devagar, Deixa no pote|Não|Ração|Copo medidor|350g|N&D Abóbora|Filhote médio|Sim|Frutas, Legumes|Recompensa|Moderada|Fácil|Pote específico|Nunca|Não|Sim|Frango|Sim|Doença do carrapato|Ideal|-
PET002|Aysha|SRD|Natália Tocchini|11 99634-2017|Quinta|Um pouco|Tranquilo, come tudo|Sachê|Ração|Copo medidor|4 copos|Premier Golden|Adulto|Sim|Sachê, Frutas|Recompensa|Moderada|Fácil|Trocar água|Frequente|Sim|Não|-|Sim|Doença do carrapato|Acima do peso|-
PET003|Chico (CARAMELO)|SRD|Thiago Alves|11 93362-8334|Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET004|Guga|SRD|Marcela Caetano|11 97035-7601|Quarta|Um pouco|Só acompanhado|Perto|Ração|Copo medidor|100g|Premier|Obesidade|As vezes|Legumes|Não padrão|Bastante|-|-|-|Sim|Frango|Sim|Dmvm|Ideal|-
PET005|June|SRD|Tamires Fernandes|84 98182-8190|-|Um pouco|Devagar, deitada|Perto|Ração|Copo medidor|200g|Golden|Adulto Light|Sim|Petiscos|Recompensa|Bastante|-|-|-|Não|-|Não|-|Acima do peso|-
PET006|Lucy|SRD|Bruna Ferreira|11 99584-6886|Quarta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET007|Mulan Cristina|SRD|Amanda Aparecida|19 99819-1995|-|Um pouco|Só acompanhado, Seletivo|Sachê/Perto|Mista|Copo medidor|1 copo|Biofresh|Adulto médio|Sim|Sachê, Frutas|Brincadeiras|Bastante|-|-|-|Não|-|Não|-|Ideal|-
PET008|Pétit|Spitz|Camila Caldas|11 96799-3975|Quarta|Muito|Muito rápido|Separado|Mista|No olho|-|Premiere|Light Interno|Sim|Petiscos, Iogurte|Não padrão|Moderada|Fácil|Pote específico|Nunca|Não|Não|-|Não|-|Ideal|-
PET009|Agnes|Bulldog|Beatriz Felix|11 97644-5135|Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET010|Dory|Bulldog|Beatriz Felix|11 97644-5135|Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET011|SANDY|SRD|Thatiane Colombo|11 98628-1507|Terça, Quinta|Não|Muito rápido|Não|Ração|Peso exato|77g|Hills|RD Obesidade|As vezes|Petiscos, Frutas|Recompensa|Moderada|Fácil|Trocar água|Nunca|Não|Não|-|Não|-|Acima do peso|-
PET012|Amora (PELO CURTO)|SRD|Marluce Viviane|11 98494-5594|Terça, Quinta|Um pouco|Pouco em pouco|Não come fora|Ração|No olho|1 copo|Golden|Salmão|Sim|Sachê, Petiscos|Recompensa|Pouca|Estímulo|Trocar água|Nunca|Não|Não|-|Não|-|Um pouco magro|-
PET013|Amora (TIGRADA)|SRD|Eliana Freitas|11 98045-5812|Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET014|Bart|Cocker|Gabriel Carraro|19 99794-4441|Segunda, Quinta|Um pouco|Normal|Não|Ração|Copo medidor|3 scoops|Golden|Natural|As vezes|Petiscos, Frutas|Recompensa|Bastante|-|-|-|Não|-|Não|-|Ideal|-
PET015|Berenice|Bulldog|André Mendonça|11 98299-2182|Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET016|Bilbo|SRD|Renan Stradioto|11 98326-8805|Terça, Quinta|Um pouco|Muito rápido, Seletivo|Sachê|Ração|Peso exato|80g|Royal Canin|Medium Adult|Sim|Sachê, Frutas|Brincadeiras|Moderada|Fácil|Trocar água|Frequente|Sim|Não|-|Não|-|Ideal|-
PET017|Cacau|SRD|Juliana Risonho|11 99447-4946|Terça, Quinta|Muito|Devagar, Tranquilo|Não come fora|Mista|Pesa tudo|110g+35g|N&D|Raça média|Não|-|-|-|Moderada|Fácil|Fonte|Não|Sim|Vários|Sim|Intolerância|Ideal|Sem petiscos
PET018|Chicó|SRD|Camila Cechinel|11 98471-2892|Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET019|Chico (FIAPO)|SRD|Daniel Oliveira|11 98907-1798|Segunda, Quinta|Não|Devagar|Sachê|Ração|Copo medidor|1 copo|Royal Canin|Médio|Sim|Sachê|Estímulo|Bastante|-|-|-|Não|-|Não|-|Ideal|-
PET020|Eevee|SRD|Andre Moreira|11 98213-8397|Segunda, Quarta|Um pouco|Muito rápido|-|Mista|Copo medidor|400g|Guabi|Light Grande|As vezes|Frutas, Ovo|Não padrão|Bastante|-|-|-|Não|-|Não|-|Acima do peso|-
PET021|Emília|SRD|Daniela Brandão|11 97953-0469|Segunda, Terça|Não|Só tranquilo|Sachê/Perto|Ração|Copo medidor|1 copo|Golden|Adulto|As vezes|Sachê, Legumes|Não padrão|Bastante|-|-|-|Não|-|Não|-|Ideal|-
PET022|Filomena|SRD|Francisco Venicius|11 98720-8165|Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET023|Fiona|SRD|Mateus Silveira|16 99763-9495|Terça, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET024|Gaia|Lhasa|Felipe Vieira|11 98757-5155|Segunda, Terça|Um pouco|Muito rápido, Seletivo|Sachê/Proteína|Mista|No olho|Scoop+Sassami|Guabi|Pequeno|As vezes|Petiscos, Pão|Recompensa|Moderada|Fácil|Pote específico|Frequente|Não|Não|-|Não|-|Acima do peso|-
PET025|Guimarães|Bulldog|Aline Périgo|11 99655-2495|Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET026|Hannah Cocoa|SRD|Flavio Fenólio|11 99426-8487|Terça, Quinta|Não|Devagar|Não|Natural|Peso exato|250g (2x)|N/A|N/A|As vezes|Legumes|Recompensa|Moderada|Fácil|Fonte|Não|Sim|Frango|Não|-|Acima do peso|-
PET027|Jeremias|SRD|Carla Mendes|11 99959-0674|Segunda, Terça|Muito|Só tranquilo, Deixa pote|-|Ração|Copo medidor|280g (3x)|Golden|Adulto|Sim|Frutas, Ossinhos|Recompensa|Moderada|Fácil|Trocar água|Frequente|Não|Não|-|Não|-|Ideal|-
PET028|Jorge Amado|Poodle|Beatriz Meirelles|61 98175-4211|Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET029|José Ravi|SRD|Izabella Moreton|11 97401-1968|Segunda, Quarta|Um pouco|Só se acompanhado, Seletivo|Companhia/Sachê|Mista|Copo medidor|Vários|Golden|Salmão|Sim|Frutas, Biscoito|Não padrão|Pouca|Específica|Nunca|Sim|Sim|Vários|Não|-|Ideal|-
PET030|Julieta|SRD|Mariana Izaac|11 97668-1340|Segunda, Quinta|Muito|Deixa pote|Não|Ração|Copo medidor|1 copo|Royal Canin|Médio Adulto|Não|-|-|-|Moderada|Fácil|Pote específico|Nunca|Sim|Não|-|Não|-|Ideal|-
PET031|Kaya|Chihuahua|Thiago Barbosa|51 99288-7259|Segunda, Quarta|Não|Devagar|-|Ração|Copo medidor|70g|Guabi Natural|Mini|Sim|Frutas, Ossinhos|Recompensa|Moderada|Fácil|Trocar água|Sim|Não|-|Não|-|Ideal|-
PET032|Leminski|SRD|Ana Paula Hey|11 99902-1245|Terça, Sexta|Um pouco|Só tranquilo, Seletivo|Não|Mista|No olho|350g|N&D Prime|Sem Frango|Sim|Legumes, Petiscos|Não padrão|Bastante|-|-|-|Sim|Frango|Sim|Atópica|Ideal|Sensível
PET033|Lobinho|SRD|Renata|11 99541-8021|Terça, Quinta|Não|Engasga, Deixa de manhã|Focinheira/Separar|Ração|Peso exato|79g (3x)|Premier|Hipoalergênica|Sim|Abobrinha, Inhame|Recompensa|Moderada|Específica|Nunca|Não|Sim|Vários|Sim|Coluna/Gastro|Acima do peso|Sensível
PET034|Luke|SRD|Gustavo Nascimento|11 95828-7207|Terça, Quarta|Não|Devagar|NA|Ração|Peso exato|240g|Formula Natural|Médio Adulto|Sim|Sachê, Frutas|Recompensa|Pouca|Específica|Trocar água|Nunca|Não|Não|-|Não|-|Ideal|-
PET035|Madalena Tutu|SRD|Lais Barison|19 98745-0048|Terça, Quinta|Muito|Muito rápido|EA|Ração|Copo medidor|1/2 copo|Premiere|Internos|Sim|Frutas, Legumes|Brincadeiras|Moderada|Estímulo|Trocar água|Frequente|Sim|Não|-|Não|-|Ideal|-
PET036|Magnolia|SRD|Gabriela Soares|11 97312-6373|Terça, Quinta|Muito|Não observada, Deixa|Não|Ração|Copo medidor|1/2 copo (2x)|Premier|Salmão Pequeno|Não|-|-|-|Moderada|Específica|Nunca|Não|Não|-|Não|-|Ideal|-
PET037|Maitê|Goldendoodle|Anna Carolina Pires|32 99129-1048|Terça, Quarta|Um pouco|Companhia, Seletivo|Companhia|Ração|Peso exato|240g (3x)|Fórmula Natural|Filhote Médio|Sim|Frutas, Legumes|Estímulo|Bastante|-|-|-|-|Não|-|Não|-|Ideal|-
PET038|Maylo|Jack|Wellington Luiz|11 98981-1829|Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET039|MICHELE CAMPONESA|SRD|Auxiliadora|11 95139-6501|Terça, Quinta|Um pouco|Muito rápido|Companhia|Ração|Peso exato|120g|Select|Sênior Pequeno|Sim|Legumes|Recompensa|Moderada|Fácil|Pote específico|Nunca|Sim|Não|-|Não|-|Acima do peso|-
PET040|Mila Di Milanesa|SRD|Arthur De Martin|11 97610-8475|Terça, Quinta|Um pouco|Tranquilo|Não|Ração|Copo medidor|1 copo|Grand Plus|Médio/Grande|Sim|Sachê, Frango|Recompensa|Bastante|-|-|-|Sim|Maçã|Não|-|Ideal|-
PET041|Moka|SRD|Yago Ananias|35 99838-8976|Segunda, Quarta|Um pouco|Muito rápido|Não|Ração|Peso exato|200g|Biofresh|Médio Adulto|Sim|Sachê, Ossinhos|Recompensa|Moderada|Fácil|Trocar água|Frequente|Sim|Não|-|Não|-|Ideal|-
PET042|NENA|SRD|Denise Vieira|24 99272-9495|Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET043|Nica|SRD|Ligia Zilbersztejn|11 99162-6678|Terça, Quinta|Muito|Só tranquilo/Companhia|Companhia|Ração|Copo medidor|1 xícara|Premier Nattu|Abóbora Adulto|As vezes|Petiscos, Frutas|Brincadeiras|Bastante|-|-|-|-|Não|-|Não|-|Ideal|-
PET044|Noah|Braco|Patricia Mancini|11 98551-2221|Segunda, Quinta|Um pouco|Deixa pote|Não come fora|Ração|Copo medidor|360g|Royal Canin Hipo|Médio Hipo|As vezes|Hipoalergenicos|Recompensa|Bastante|-|-|-|Sim|Frango|Não|-|Ideal|-
PET045|Paçoca Joaquina|SRD|Denise Calazans|51 99409-7788|Segunda, Sexta|Muito|Deixa comida, normal|Não|Natural|Copo medidor|150g (3x)|N/A|N/A|Não|-|-|-|Pouca|Estímulo|Pote específico|Nunca|Sim|Sim|Frango|Não|-|Ideal|-
PET046|Pipoca (CARAMELO)|SRD|Andrea Arantes|11 99109-9804|Segunda, Sexta|Muito|Muito rápido|Sachê|Ração|Copo medidor|150g|Fit Furry|Médio|Sim|Petiscos, Frutas|Brincadeiras|Moderada|Fácil|Pote específico|Nunca|Sim|Não|-|Não|-|Um pouco magro|-
PET047|Pituca|Cattle Dog|Beni Kanarek|11 99974-6672|Terça, Quinta|Não|Devagar, Deixa pote|Companhia|Ração|No olho|2 copos|Golden Seleção|Adulto|As vezes|Petiscos, Frutas|Quando pede|Bastante|-|-|-|Não|-|Não|-|Ideal|-
PET048|Polenta|SRD|Bruno Osmo|11 99626-2222|Segunda, Quarta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET049|Amora (IRMÃ DA SANDY)|SRD|Thatiane Colombo|11 98628-1507|Terça, Quinta|Muito|Deixa comida|Companhia|Ração|No olho|1 medidor|Premier Nattu|Pequeno Adulto|Não|-|-|-|Moderada|Fácil|Trocar água|Nunca|Não|Sim|Doença do carrapato|Não|-|Ideal|-
PET050|SKADI|SRD|Scarlet Cunningham|11 99421-9359|Terça, Quinta|Muito|Seletivo, Devagar|Sachê/Perto|Mista|Balança|Vários|Premier Hill|Weight Loss|Sim|Frutas, Ossinhos|Quando pede|Moderada|Fácil|Trocar água|Nunca|Sim|Não|-|Não|-|Acima do peso|-
PET051|SNOOP DOGG|SRD|Paola Maluceli|11 97114-8022|Terça, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET052|Theo (FIAPO)|SRD|Julya Zancoper|11 96610-2349|Terça, Quarta|Muito|Só acompanhado|Companhia|Ração|No olho|1 xícara|Golden Formula|Pequeno Adulto|Sim|Legumes|Não padrão|Moderada|Fácil|Pote específico|Nunca|Não|Não|-|Não|-|Ideal|-
PET053|Tico|SRD|Denise Carvalho|11 97665-7410|Terça, Quinta|Não|Só tranquilo/Companhia|Companhia/Perto|Ração|Copo medidor|3 copos|Royal Canin|Mini Indoor|Sim|Sachê, Ossinhos|Quando pede|Moderada|Fácil|Pote específico|Nunca|Não|Não|-|Não|-|Ideal|-
PET054|Tigresa|SRD|Marcelli Romanos|11 97438-4564|Segunda, Quarta|Muito|Seletivo, Deixa pote|Sachê/Perto|Ração|Copo medidor|1.5 medidor|Formula Natural|Renal Pequeno|As vezes|Legumes, AN|Estímulo|Bastante|-|-|-|Sim|Proteína|Sim|Renal/Sopro|Ideal|-
PET055|Zaya|Golden|Gabriela Vale|11 94022-6412|Segunda, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET056|Zoe|Chihuahua|João Carlos Paiva|31 99826-0411|Segunda, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET057|Bardot|SRD|Carolina Suzuki|11 96905-1427|Terça, Quinta|Não|Muito rápido, Seletivo|Sachê|Ração|Peso exato|80g+Sachê (3x)|Royal Canin|Médio Adulto|Sim|Petiscos, Sachê|Estímulo|Moderada|Fácil|Fonte|Frequente|Sim|Não|-|Não|-|Acima do peso|-
PET058|Bete|SRD|Daniel Mason|11 98515-8725|Terça, Quinta|Muito|Aos poucos|Não|Ração|1 xícara|90g|True|Natural Digestão|As vezes|Restos|Quando pede|Moderada|Fácil|Trocar água|Frequente|Não|Não|-|Não|-|Acima do peso|Sensível
PET059|Lemmy|SRD|Isis Antonucci|11 99506-2643|Terça, Quinta|Um pouco|Muito rápido|Não precisa|Ração|Copo medidor|Vários (3x)|Gran Plus|Ovelha Grande|Sim|Frutas|Recompensa|Pouca|Estímulo|-|Nunca|Sim|Não|-|Não|-|Acima do peso|-
PET060|Malu|SRD|Cintia Takayama|11 99172-6083|Segunda, Quarta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET061|Manoel Psy|SRD|Simone Kondo|11 99895-7913|Segunda, Terça|Um pouco|Só com estímulo|Estímulo forte|Mista|Copo medidor|1.5 copo|Quatree|Médio Adulto|As vezes|Petiscos|Recompensa|Bastante|-|-|-|Sim|Tomate|Não|-|Acima do peso|-
PET062|Telê|Basset|Letícia Arrais|11 99348-2201|Segunda, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET063|Abel|SRD|Rafael Fiuza|19 95085-9333|Segunda, Quarta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET064|Alex|SRD|Priscila Santos|21 97231-5684|Segunda, Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET065|Bidu|Maltês|Gisele Pacheco|11 99770-2874|Segunda, Quarta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET066|Freya|Husky|Karen Chohfi|11 99973-1832|Segunda, Quarta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET067|Wotan|Boston|Wagner Pinheiro|11 99960-9696|Segunda, Quarta, Sexta|Muito|Muito rápido|-|Ração|Peso exato|180g|Biofresh|Mix Carnes Mini|Sim|Frutas, Sachê|Não padrão|Bastante|-|-|-|Não|-|Não|-|Acima do peso|-
PET068|Zeca (TIGRADO)|SRD|Leandro Silva|11 94238-4568|Segunda, Quarta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET069|Catarina|SRD|Carlos Canuto|11 99195-0067|Segunda, Quarta, Sexta|Um pouco|Muito rápido, Deixa|Sachê/Proteína|Ração|Peso exato|350g|Gran Plus|Médio Ovelha|Sim|Orelha, Sachê|Estímulo|Bastante|-|-|-|Não|-|Não|-|Ideal|-
PET070|Dudu|Shih tzu|Livia Coradello|11 98133-5953|Segunda, Quarta, Quinta|Um pouco|Só tranquilo|Não|Mista|Copo medidor|.|Natural Taste|Cordeiro Livre|Sim|Peito frango, AN|Estímulo|Bastante|-|-|-|Sim|Vários|Não|-|Ideal|-
PET071|Dudu (CARAMELO)|Chihuahua|Júlia Minchillo|11 98091-2535|Segunda, Quarta, Sexta|Não|Devagar, Deixa|Não|Ração|No olho|100g|Premier|Interno Pequeno|As vezes|Petiscos, Frutas|Recompensa|Bastante|-|-|-|Não|-|Não|-|Ideal|-
PET072|Flora|SRD|Mateus Kleinsorgen|11 94306-8313|Segunda, Terça, Sexta|Um pouco|Devagar, Seletiva|Sachê/Comida|Ração|Copo medidor|200g|Royal Canin|Médio Adulto|As vezes|Frutas, Legumes|Recompensa|Bastante|-|-|-|Não|-|Não|-|Ideal|-
PET073|FRED|Dachshund|Carlos Esteves|16 99796-8006|Terça, Quarta, Quinta|Muito|Muito rápido|Umidecer ração|Mista|No olho|180g|Fórmula Natural|Médio Adulto|Não|-|-|-|Pouca|Específica|Fonte|Sim|Não|-|Não|-|Ideal|-
PET074|Guibor|Pastor Shetland|Miriam|11 99498-1230|Segunda, Quarta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET075|Hans|SRD|Regina Felix|11 99567-8404|Segunda, Quarta, Sexta|Um pouco|Comedouro lento|Não|Ração|Copo medidor|280g|Premier Hipo|Hipo Médio/Grande|Sim|Keldog, Frutas|Brincadeiras|Bastante|-|-|-|Sim|Frango|Não|-|Ideal|Diarreia emocional
PET076|Luna|SRD|Aron Koffler|11 99685-2067|Segunda, Terça, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET077|Malbec|Boston|Juliana Pigozzi|11 98313-2526|Segunda, Quarta, Sexta|Um pouco|Normal/Rápido|Não|Mista|Peso exato|145g|Fórmula Natural|Sensitive Adulto|Sim|Petiscos naturais|Recompensa|Moderada|Fácil|Trocar água|Sim|Sim|Frango|Não|-|Ideal|-
PET078|Mel|SRD|Miriam|11 99498-1230|Segunda, Quarta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET079|Mingau|SRD|Karina Xavier|11 98936-5746|Segunda, Quarta, Sexta|Muito|Mastiga bem|Emagrecer|Ração|Copo medidor|Vários (3x)|N&D Tropical|Sem Frango|Sim|Petiscos, Frutas|Não padrão|Moderada|Fácil|Trocar água|Não|Sim|Frango/Bifinho|Não|-|Acima do peso|-
PET080|Mona Lisa|SRD|Karen Chohfi|11 99973-1832|Segunda, Quarta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET081|Moti|Maltês|Ha Lim Kim|11 95558-3232|Segunda, Quarta, Sexta|Não|Muito rápido|Não|Ração|Copo medidor|1.5 colher|Premier Hipo|Pequeno Hipo|Sim|Petiscos, Frutas|Quando pede|Moderada|Fácil|-|Nunca|Não|Não|-|Não|-|Um pouco acima|-
PET082|Nala|Golden|Yuri Marroquim|11 94839-5145|Segunda, Quarta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET083|Odara|SRD|Carolina Munemasa|11 96870-0785|Terça, Quarta, Quinta|Muito|Muito rápido|Não|Mista|Peso exato|475g|Bionatural|Médio Adulto|Sim|Petiscos, Frutas|Recompensa|Pouca|Específica|-|Nunca|Não|Não|-|Não|-|Ideal|-
PET084|Pamonha|SRD|Priscila Santos|21 97231-5684|Segunda, Terça, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET085|Pastelina|SRD|Otto Sporteman|51 99462-3805|Segunda, Quarta, Sexta|Um pouco|Devagar, Deixa|Não|Ração|Copo medidor|1 medidor|Quatree|Filhote|Sim|Petiscos, Frutas|Brincadeiras|Moderada|Fácil|Trocar água|Nunca|Não|Não|-|Não|-|Ideal|-
PET086|Spike|SRD|Jin Yano|11 98729-3859|Quarta, Sexta, Sabado|Muito|Muito rápido|Não|Ração|Peso exato|270g|Formula Natural|Filhote médio|As vezes|Frutas, Legumes|Brincadeiras|Moderada|Fácil|-|Nunca|Não|Não|-|Não|-|Ideal|Vômito emocional
PET087|Théo (YORK)|Yorkshire|Cecília Novaes|11 96721-9534|Segunda, Quarta, Quinta|Um pouco|Muito rápido, Seletivo|Não|Ração|Copo medidor|1 copo|Fórmula Natural|Obesidade|As vezes|Sachê, Frutas|Recompensa|Moderada|Fácil|Trocar água|Sim|Sim|Frango/Carne|Sim|Renal Crônico|Ideal|-
PET088|Tobias AMIGO|Golden|Mauricio Scheinman|11 93080-1818|Segunda, Quarta, Sexta|Um pouco|Devagar|Separar matilha|Ração|Copo medidor|2 copos|Fórmula Natural|Filhote Grande|As vezes|Petiscos, Frutas|Não padrão|Bastante|-|-|-|Não|-|Sim|Displasia|Um pouco acima|-
PET089|TOBIAS (STAFF)|Staffordshire|Gustavo Fernandes|11 99983-3058|Terça, Quarta, Sexta|Um pouco|Só tranquilo|Não|Ração|Copo medidor|215g|Premiere|Médio Adulto|Sim|Petiscos, Frutas|Recompensa|Moderada|Fácil|Trocar água|Nunca|Sim|Não|-|Não|-|Ideal|-
PET090|Tyson Carbajal|SRD|Wellington Muniz|11 99965-4900|Segunda, Quarta, Sexta|Muito|Muito rápido|Não|Ração|Copo medidor|4 medidores|N&D Ancestral|Médio Carne|Não|-|-|-|Bastante|-|-|-|Sim|Variados|Sim|Convulsão|Ideal|Diarreia fácil
PET091|Granola|Golden|Carla Bergamini|11 99489-9526|Segunda, Quarta, Sexta|Muito|No ritmo dela|Não come fora|Ração|Copo medidor|300g|Royal Canin|Gastrointestinal|Sim|Frutas, Legumes|Não padrão|Moderada|Fácil|Trocar água|Sim|Não|-|Não|-|Ideal|Alergia perfume
PET092|Tobias (CARAMELO)|SRD|Rafaella Bellotti|19 99790-1841|Segunda, Terça, Quarta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET093|Carminha|Terrier|Ana Paula Freitas|11 96853-8880|Segunda, Terça, Quarta, Quinta|Muito|Muito rápido|Labirinto|Natural|No olho|450g|N/A|N/A|As vezes|Frutas, Legumes|Quando pede|Moderada|Fácil|Trocar água|Nunca|Sim|Frango|Não|-|Ideal|-
PET094|CORA CORALINA|SRD|Laila Motizuk|11 97448-6929|Segunda, Terça, Quinta, Sexta|Um pouco|Devagar, Seletiva|Banana/Topping|Mista|No olho|100g|Golden Seleção|Adulto|Sim|Sachê, Frutas|Brincadeiras|Moderada|Fácil|Trocar água|Sim|Não|-|Não|-|Ideal|-
PET095|Clara Emília|Lhasa|Janete Cantanhêde|21 96587-1212|Terça, Quarta, Quinta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET096|Lilah Crazy Maya|SRD|Janete Cantanhêde|21 96587-1212|Terça, Quarta, Quinta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET097|Dmitri|Pastor Australiano|Camila Pires|11 98590-2003|Segunda, Terça, Quinta, Sexta, Sabado|Um pouco|Muito rápido|Não come fora|Ração|Peso exato|400g|Fórmula Natural|Hipoalergênica|Não|-|-|-|Moderada|Fácil|Trocar água|Não|Sim|Investigando|Não|-|Acima do peso|-
PET098|Apolo (BRANCO)|SRD|Melanie|11 98819-5234|Segunda, Terça, Quarta, Quinta, Sexta|Muito|Rápido, Seletivo|Natural/Companhia|Mista|Peso exato|120g|Premier Gastro|Pequeno Gastro|As vezes|Frutas, Legumes|Não padrão|Moderada|Fácil|Trocar água|Nunca|Sim|Frango|Sim|Gastrite|Ideal|-
PET099|Churros|Pastor Shetland|Marcia Erlichman|11 98119-2727|Segunda, Terça, Quarta, Quinta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET100|Jade|Amstaff|Fernando Lippelt|11 9481-00025|Segunda, Terça, Quarta, Quinta, Sexta|Um pouco|Devagar|Não|Ração|No olho|3x 300ml|Premier Hipo|Amstaff Médio|Sim|Frutas|Recompensa|Bastante|-|-|-|Sim|Vários|Não|-|Ideal|-
PET101|Joaquim|SRD|Kahlil Sepulveda|71 99966-3361|Segunda, Terça, Quarta, Quinta, Sexta|Muito|Muito rápido|Fonte/Estímulo|Mista|Copo medidor|360g|Premier Seleção|Médio Adulto|Sim|Sachê, Frutas|Recompensa|Pouca|Específica|Fonte|Não|Não|-|Não|-|Um pouco magro|-
PET102|MAX|Pastor Shetland|Guilherme Augusto|11 99391-4968|Segunda, Terça, Quarta, Quinta, Sexta|-|Muito rápido|Não|Ração|Copo medidor|2 copos|ND|Médio|As vezes|Petiscos, Frutas|Brincadeiras|Bastante|-|-|-|Sim|Petiscos|Não|-|Ideal|Diarreia forte
PET103|Mel (PATINHAS)|SRD|Gisele|11 95580-4732|Segunda, Terça, Quarta, Quinta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET104|Pilantra|SRD|Luiza Amorim|21 97276-3031|Segunda, Terça, Quarta, Quinta, Sexta|Um pouco|Devagar|Não|Ração|Peso exato|600g|Formula Natural|Médio Adulto|Sim|Petiscos, Legumes|Brincadeiras|Bastante|-|-|-|Não|-|Não|-|Ideal|Castrado
PET105|Pisco|SRD|Rebeca Andreosi|11 99788-2800|Segunda, Terça, Quarta, Quinta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET106|Whisky|Jack|Ilana Pelosof|11 99693-6688|Segunda, Terça, Quarta, Quinta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET107|Lola|Cattle Dog|Olívia Andrade|11 98928-3189|Segunda, Terça, Quarta, Quinta, Sexta, Sabado|Um pouco|Seletivo|Sachê|Ração|No olho|1 copo|Premier LIGHT|Médio LIGHT|Sim|Sachê, Frutas|Estímulo|Moderada|Fácil|Trocar água|Nunca|Não|Não|-|Sim|Epilepsia|Um pouco acima|Remédios 8/8h
PET108|Theo (BABY)|SRD|Débora Fernandes|19 99131-9312|Segunda, Terça, Quarta, Quinta, Sexta, Sabado|Muito|Devagar|Não come fora|Ração|Peso exato|500g|fórmula natural|Filhote Médio|Não|-|-|-|Bastante|-|-|-|Não|-|Não|-|Ideal|-
PET109|Moqueca|SRD|Luna Harari|11 99407-2039|-|Um pouco|Só tranquilo, Deixa|Misturar sachê|Ração|Peso exato|180g|Guabi|Médio Cordeiro|Sim|Proteína, Orelha|Recompensa|Pouca|Estímulo|Fonte|Sim|Não|-|Não|-|Um pouco acima|-
PET110|GUSTAVO|SRD|Leonardo Bersi|11 96479-2220|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET111|Lena|Pastor Shetland|Ana Paula Freitas|11 96853-8880|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET112|Tomate|SRD|Diego Dossa|11 97342-9472|-|Não|Seletivo, Companhia|Companhia|Mista|Copo/Grams|Vários|Premier Hipo|Cordeiro Adulto|Sim|Sachê, AN|Estímulo|Moderada|Fácil|Trocar água|Não|Sim|Frango|Sim|Inflamação Intestinal|Ideal|-
PET113|Ravel|Schnauzer|Juliana Correia|11 99481-2126|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET114|Aquiles|SRD|Debora Lima|11 98319-3339|-|Não|Normal, Deixa|Misturar sachê|Ração|Copo medidor|2/3 xícara|Guabi Natural|Pequeno Adulto|Sim|Sachê, Desidratado|Recompensa|Moderada|Fácil|-|Nunca|Sim|Não|-|Sim|Ortopédico|Ideal|-
PET115|Valkiria|SRD|Debora Lima|11 98319-3339|-|Um pouco|Normal, Topping|Misturar sachê|Ração|Copo medidor|2/3 xícara|Guabi Natural|Pequeno Adulto|Sim|Sachê, Petiscos|Recompensa|Moderada|Fácil|-|Nunca|Sim|Não|-|Não|-|Ideal|-
PET116|Zima|SRD|Renata Leite|11 98217-6816|-|Não|Normal|Não|Mista|Copo medidor|1 colher+AN|Premier|Cão adulto|As vezes|Petiscos, Frutas|Recompensa|Moderada|Específica|-|Nunca|Sim|Não|-|Não|-|Um pouco acima|-
PET117|Jack|SRD|Ana Carolina Pontes|11 98116-5434|Quarta, Segunda|Não|Devagar|-|Ração|Copo medidor|300g (3x)|Guabi|Médio Adulto|Sim|Frutas, Legumes|Não padrão|Pouca|Específica|-|Nunca|Sim|Não|-|Não|-|Acima do peso|-
PET118|Zoe Maria|Maltês|Ana Carolina Raulino|11 98804-0919|Quarta|Muito|Tranquilo/Companhia|Companhia|Natural|Peso exato|N/A|N/A|N/A|Sim|Petiscos, Sachê|Recompensa|Moderada|Estímulo|Trocar água|Frequente|Sim|Sim|Brócolis|Sim|Pancreatite|Acima do peso|-
PET119|Alecrim|SRD|Dâmaris Oliveira|11 98892-4229|Quarta, Terça, Quinta|Um pouco|Seletivo, Companhia|Patinho moído|Ração|Copo medidor|1/2 copo|Farmina N&D|Médio Carne|Sim|Petiscos, Caldo|Recompensa|Pouca|Estímulo|Fonte|Sim|Não|-|Sim|Histórico Múltiplo|Ideal|Tratando cisto
PET120|Romeu|SRD|SANDRA|11 99980-9659|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET121|Pandora|SRD|VIVIANE LUCAS|11 95307-3727|Quarta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET122|Monalisa|SRD|VIVIANE LUCAS|12 95307-3727|Quarta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET123|Rony|SRD|Isabela Gonçalves|11 98202-3231|Quarta|Um pouco|Normal, Deixa|Companhia|Ração|Copo medidor|200-250g|Gran Plus|Adulto Mini|As vezes|Sachê, Frutas|Não padrão|Moderada|Fácil|Trocar água|Frequente|Não|Não|-|Não|-|Ideal|-
PET124|Glória|SRD|Isabel Gomes|1199652-1359|Quarta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET125|Antonio|SRD|Vitoria Batan|11 98889-3172|-|Não|Normal|Hora que quer|Ração|Copo medidor|400g|Premier Hipo|Médio Adulto|Sim|Petiscos, Sachê|Não padrão|Moderada|Fácil|-|Nunca|Sim|Não|-|Sim|Discopatia|Ideal|-
PET126|Boo|Schnauzer|Leandro Petreca|11 94752-2668|Terça, Quinta|Não|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET127|Dona Canô|Chihuahua|Fabio|11 97521-1803|Quinta|Um pouco|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET128|Gal|SRD|Alicia Lerner|11 98629-5496|Quinta|Não|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET129|Godofredo|Border|Isabella Rangel|19 98117-7878|Segunda, Terça, Quarta, Quinta, Sexta|Não|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET130|Ijexá (Xaxá)|Pinscher|Fabio|11 97521-1803|Quinta|Muito|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET131|Jubiabá (Juba)|Pinscher|Fabio|12 97521-1803|Quinta|Um pouco|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET132|Lemmy|SRD|Isis Antonucci|11 99506-2643|Terça, Quinta|-|Muito rápido|Não precisa|Ração|Copo medidor|Vários (3x)|Gran Plus|Ovelha Grande|Sim|Petiscos, Frutas|Recompensa|Pouca|-|Pote específico|Nunca|Sim|Não|-|Não|-|Acima do peso|-
PET133|Kibe|SRD|Taynnã Santos|11 99788-8887|Quinta|-|Só tranquilo|Não|Ração|No olho|100g|Premier Nattu|Pequeno Adulto|As vezes|Petiscos, Frutas|Estímulo|Moderada|-|-|Nunca|Sim|Não|-|Não|-|Ideal|-
PET134|lion|Sheep Dog|Samanta Perroni|11 99314-4498|Segunda, Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET135|Magnolia|SRD|Gabriela Soares|11 97312-6373|Terça, Quinta|Um pouco|Não observada, Deixa|Não|Ração|Copo medidor|1/2 copo (2x)|Premier|Pequeno Salmão|Não|-|-|-|Moderada|-|-|Nunca|Não|Não|-|Não|-|Ideal|-
PET136|Meia|SRD|Thiago Negreiros|11 98164-9374|Quinta|-|Só tranquilo|Na boca|Ração|Copo medidor|200g (3x)|Premier Hipo|Adulto Hipo|As vezes|Frutas, Legumes|Não padrão|Bastante|-|-|Nunca|Não|Sim|Frango|Não|-|Ideal|-
PET137|Paco|SRD|Leandro Petreca|11 94752-2668|Quinta|Um pouco|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET138|Pastel|SRD|Taynnã Santos|11 99788-8887|Quinta|-|Deixa pote|Não|Ração|No olho|100g|Premier Nattu|Pequeno|As vezes|Petiscos, Frutas|Estímulo|Moderada|-|-|Nunca|-|-|Não|-|Não|-|Um pouco magro|-
PET139|Ronaldinho|SRD|Elisabete Lima|11 98212-3799|Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET140|Tito|Boston|Jean Rocha|11 96191-2370|Quinta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET141|Jaqueline|SRD|Isabella Bisordi|11 99916-7858|Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET142|Oliver|SRD|Isabela Liberman|11 99972-2383|Terça, Sexta|-|Muito rápido|Separar matilha|Ração|Copo medidor|1 copo|Fórmula Natural|Filhote Médio|As vezes|Petiscos, Frutas|Recompensa|Bastante|-|-|Nunca|Não|Não|-|Não|-|Ideal|-
PET143|Simba|Golden|Ana Paula Monteiro|11 99696-4483|Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET144|Tom|Border|Anna Alencar|11 99554-9919|Sexta|Um pouco|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET145|Zeca|Border|Anna Alencar|12 99554-9919|Sexta|Muito|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET146|brisa|Maltês|camila palma|11 98318-2020|Terça|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET147|Hela|SRD|Rodrigo Peres|11 98712-1648|Terça|Muito|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET148|Tomilho|Shetland|Livia Albuquerque|11 97141-8238|Terça|Não|Muito rápido|Não|Ração|Copo medidor|1/2 copo|Guabi Natural|Mini|As vezes|Frutas|Não padrão|Bastante|-|-|Nunca|Não|Não|-|Não|-|Um pouco acima|-
PET149|Gergilim|Shetland|Livia Albuquerque|11 97141-8238|Terça|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET150|Amorinha|SRD|Jéssica Nunes|11 94870-5003|Quinta|Não|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET151|Pudim|Chihuahua|Fernanda Silva|11 98182-5253|-|-|Muito rápido|Não come bem|Natural|Peso exato|230g|N/A|N/A|Sim|Petiscos, Frutas|Recompensa|Bastante|-|-|Nunca|Não|Não|-|Não|-|Ideal|-
PET152|Iggy|SRD|Priscila Perassi|11 99133-0802|Quarta|-|Muito rápido|Não|Ração|Peso exato|300-400g|Royal Canin|Hypo Moderate|Não|-|-|-|Bastante|-|-|Nunca|Não|Sim|Frango|Sim|Epilepsia|Um pouco acima|-
PET153|misso|Lhasa|Gabriella Passaro|17 98822-8820|Quarta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET154|Clarice|Maltês|Cláudia Campos|11 99421-4599|Quarta|Muito|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET155|Loop|SRD|Fernanda Silva|11 98182-5253|-|-|Seletivo|Comer tarde|Natural|Peso exato|130g|N/A|N/A|Não|-|-|-|Pouca|-|-|Nunca|Não|Não|-|Não|-|Ideal|-
PET156|Pipoca|SRD|Helen|N/A|Quinta|-|Empolgada|Não precisa|Ração|Peso exato|200g|Fórmula natural|Pequeno Adulto|Não|-|-|-|Moderada|-|-|Frequente|Não|Não|-|Não|-|Ideal|-
PET157|Tuin|Shih tzu|Laisa Rocha|41 99798-8229|Terça|-|Normal|Companhia/Sachê|Mista|Grams|Vários|Premier|Gastro Pequeno|Não|-|-|-|Moderada|-|-|Nunca|Não|Não|-|Não|-|Ideal|-
PET158|Napoleão|SRD|N/A|N/A|-|Muito|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET159|Max|SRD|N/A|N/A|-|Um pouco|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET160|Malu (Nova)|SRD|N/A|N/A|Quarta, Quinta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
PET161|Bento|SRD|N/A|N/A|Quarta, Quinta, Sexta|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-`;

export const fetchPets = async (): Promise<Pet[]> => {
  const lines = MASTER_RAW.split('\n');
  return lines.map(line => {
    const [
      id, pet_nome, raca, tutor_nome, telefone, dia_semana,
      ansioso, comportamento, estimulo, tipo_alimentacao,
      quantidade_oferecida, quantidade_aproximada, marca_racao,
      especificacao_racao, oferece_extras_sn, oferece_extras_lista,
      extras_momento, ingestao_agua, interesse_agua_sn, interesse_agua_tipo,
      ajuda_beber_agua, sede_pos_creche, possui_alergia, alimentos_proibidos,
      possui_doenca, doenca_qual, escore_corporal, obs_extra
    ] = line.split('|');

    return {
      id: id || '',
      pet_nome: pet_nome || '',
      raca: raca || 'SRD',
      tutor_nome: tutor_nome || '-',
      telefone: telefone || '-',
      dia_semana: (dia_semana || '-').trim(),
      peso_pet: '0', // Valor inicial, atualizável via ficha mestre
      comportamento_alimentar: comportamento || '-',
      precisa_estimulo: estimulo || '-',
      tipo_alimentacao: tipo_alimentacao || '-',
      quantidade_oferecida: quantidade_oferecida || '-',
      quantidade_aproximada: quantidade_aproximada || '-',
      marca_racao: marca_racao || '-',
      especificacao_racao: especificacao_racao || '-',
      oferece_extras: oferece_extras_lista || '-',
      ingestao_agua: ingestao_agua || '-',
      interesse_agua: interesse_agua_tipo || '-',
      ajuda_beber_agua: ajuda_beber_agua || '-',
      sede_pos_creche: sede_pos_creche || '-',
      possui_alergia: possui_alergia || 'Não',
      alimentos_proibidos: alimentos_proibidos || '-',
      possui_doenca: possui_doenca || 'Não',
      doenca_qual: doenca_qual || '-',
      escore_corporal: escore_corporal || 'Ideal',
      observacoes: `${ansioso ? 'Ansioso: ' + ansioso : ''}. ${obs_extra || ''}. Momento extras: ${extras_momento || '-'}`
    };
  });
};
