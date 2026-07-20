# Configuração de Política de TTL no Firestore (Rate Limiting)

Esta documentação descreve o procedimento de infraestrutura para configurar o Time-To-Live (TTL) no Google Cloud Firestore para a coleção de controle de Rate Limiting (`rate_limits`).

## Detalhes da Configuração

- **Coleção**: `rate_limits`
- **Campo de Expiração**: `resetAt`
- **Retenção Esperada**: Conforme o ciclo de expiração definido na aplicação (ex: 15 minutos para controle de requisições). O TTL do Firestore removerá fisicamente os documentos expirados após o tempo registrado em `resetAt`.
- **Exclusão não instantânea**: A exclusão física de documentos expirados pelo sistema TTL do Firestore ocorre em segundo plano e pode levar até 72 horas para ser processada. Por esse motivo, a aplicação **não** depende do TTL para decisões imediatas de autorização; a própria lógica do backend (`rateLimiter.ts`) compara a data atual com o campo `resetAt` para validar o rate limit.

## Procedimento de Implantação de Infraestrutura

Para ativar a política de TTL no Firestore usando a CLI `gcloud`, execute o comando a seguir:

```bash
gcloud firestore fields ttl update resetAt \
    --collection-group=rate_limits \
    --enable-ttl \
    --project=demo-domo-security-test
```

### Notas Importantes

1. **Apenas Trabalho Local/Testes Autorizados**: Este procedimento está documentado para referência e revisão de infraestrutura. **NÃO** execute comandos de alteração de TTL diretamente no projeto de produção.
2. **Requisitos de Permissão**: A execução deste comando requer a role `datastore.owner` ou `owner` no projeto do Google Cloud.
