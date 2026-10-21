# Sistema de Permissões e Controle de Acesso

## 🔐 Visão Geral

O sistema implementa um controle de acesso baseado em **isolamento de usuários** com um **usuário especial ADMIN**.

---

## 👤 Tipos de Usuário

### 1. **Usuário Normal**
- Vê **APENAS** suas próprias evidências
- Gerencia **APENAS** suas próprias câmeras
- **NÃO** vê eventos de outros usuários

### 2. **Usuário ADMIN (FBI)**
- Email: `FBI@gmail.com`
- Senha: `FBI123`
- **VÊ TUDO** de todos os usuários
- Acesso completo a todas as evidências
- Pode revisar eventos de qualquer câmera

---

## 🔒 Regras de Acesso

### Eventos (`GET /events`)
```
Usuário Normal:
  → Recebe apenas eventos onde user_id = SEU_ID

Usuário ADMIN:
  → Recebe TODOS os eventos (sem filtro de user_id)
```

### Frame de Evento (`GET /events/{id}/frame`)
```
Permissão concedida se:
  ✓ Email é FBI@gmail.com (ADMIN)
  ✓ user_id do evento == user_id do solicitante
  ✓ evento não tem user_id (legacy/teste)
  
Caso contrário:
  ✗ HTTP 403 Forbidden
```

### Vídeo de Evento (`GET /events/{id}/video`)
```
Mesma lógica do frame:
  ✓ Email é FBI@gmail.com (ADMIN)
  ✓ user_id do evento == user_id do solicitante
  ✓ evento não tem user_id (legacy/teste)
  
Caso contrário:
  ✗ HTTP 403 Forbidden
```

### Detalhes de Evento (`GET /events/{id}`)
```
Mesma lógica:
  ✓ ADMIN vê tudo
  ✓ Dono vê o seu
  ✗ Outros: 403 Forbidden
```

---

## 🎯 Fluxo de Dados

### Usuário Normal (ex: joao@email.com)
```
1. Login → Recebe user.id = 1, user.email = "joao@email.com"
2. Eventos detectados → Salvos com user_id = 1
3. Lista eventos → Vê apenas user_id = 1
4. Tenta acessar evento user_id = 2 → 403 Forbidden
```

### Usuário ADMIN (FBI@gmail.com)
```
1. Login → Recebe user.id = 999, user.email = "FBI@gmail.com"
2. Lista eventos → Vê TODOS (user_id ignorado)
3. Acessa qualquer evento → ✓ Permitido
4. Pode revisar eventos de qualquer usuário
```

---

## 📊 Exemplos de Requisição

### Listar Eventos (Usuário Normal)
```http
GET /events?user_id=1&requesting_user_email=joao@email.com&limit=50
```
**Retorna**: Apenas eventos onde `user_id = 1`

### Listar Eventos (ADMIN)
```http
GET /events?requesting_user_email=FBI@gmail.com&limit=50
```
**Retorna**: **TODOS** os eventos de todos os usuários

### Acessar Frame (Usuário Normal)
```http
GET /events/0001/frame?user_id=1&requesting_user_email=joao@email.com
```
**Se evento.user_id = 1**: ✓ Retorna frame  
**Se evento.user_id = 2**: ✗ 403 Forbidden

### Acessar Frame (ADMIN)
```http
GET /events/0001/frame?requesting_user_email=FBI@gmail.com
```
**Qualquer evento**: ✓ Retorna frame (sem verificação de user_id)

---

## 🛡️ Segurança

### Validações Implementadas:
- ✅ Email case-insensitive (`fbi@gmail.com` == `FBI@gmail.com`)
- ✅ Verificação em **TODOS** os endpoints de mídia
- ✅ Verificação em **lista de eventos**
- ✅ Verificação em **detalhes de evento**
- ✅ Usuário sem ID não acessa nada (exceto ADMIN)

### Proteções:
```python
# Backend valida ANTES de retornar dados
is_admin = requesting_user_email and requesting_user_email.lower() == "fbi@gmail.com"
is_owner = user_id and ev.get("user_id") == user_id

if not (is_admin or is_owner or ev.get("user_id") is None):
    raise HTTPException(status_code=403, detail="Sem permissão")
```

---

## 🎭 Casos de Uso

### Caso 1: Empresa com Múltiplas Filiais
- **Filial A**: usuario_a@empresa.com → Vê apenas suas câmeras
- **Filial B**: usuario_b@empresa.com → Vê apenas suas câmeras
- **Matriz**: FBI@gmail.com → Vê TUDO de todas as filiais

### Caso 2: Condomínio
- **Morador 101**: morador101@condominio.com → Vê apenas sua unidade
- **Morador 102**: morador102@condominio.com → Vê apenas sua unidade
- **Síndico**: FBI@gmail.com → Monitora todo o condomínio

### Caso 3: Multi-Tenant SaaS
- **Cliente A**: clienteA@empresa.com → Isolado
- **Cliente B**: clienteB@empresa.com → Isolado
- **Suporte**: FBI@gmail.com → Acesso para debug/suporte

---

## 🔧 Como Criar o Usuário ADMIN

### 1. Via API
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "FBI",
    "email": "FBI@gmail.com",
    "password": "FBI123"
  }'
```

### 2. Via Frontend
1. Acesse a página de registro
2. Preencha:
   - **Username**: FBI
   - **Email**: FBI@gmail.com
   - **Password**: FBI123
3. Clique em "Cadastrar"

### 3. Login ADMIN
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username_or_email": "FBI@gmail.com",
    "password": "FBI123"
  }'
```

---

## 🚨 ANOMALY_CLEARED Removido

### Problema Identificado:
- Evento `ANOMALY_CLEARED` estava gerando **falsos positivos**
- Sistema salvava tanto início quanto fim de anomalia
- Duplicava eventos desnecessariamente

### Solução Implementada:
```python
# Antes (ERRADO):
elif not confirmado and self._in_anomaly:
    event = Event(kind=EventKind.ANOMALY_CLEARED, ...)
    self._dispatch(event)  # ❌ Gerava evento extra

# Agora (CORRETO):
elif not confirmado and self._in_anomaly:
    self._in_anomaly = False
    event = None  # ✅ Apenas limpa flag, sem evento
```

### Resultado:
- ✅ Apenas eventos **CONFIRMADOS** são salvos
- ✅ Sem eventos duplicados
- ✅ Menos falsos positivos
- ✅ Banco mais limpo

---

## 📋 Checklist de Segurança

- [x] Isolamento por user_id
- [x] Usuário ADMIN com acesso total
- [x] Validação em todos os endpoints de mídia
- [x] Validação em listagem de eventos
- [x] Email case-insensitive
- [x] Proteção contra acesso não autorizado (403)
- [x] Eventos sem user_id acessíveis (legacy)
- [x] ANOMALY_CLEARED removido
- [x] Apenas eventos confirmados salvos

---

## 🎯 Resumo

| Recurso | Usuário Normal | ADMIN (FBI@gmail.com) |
|---------|---------------|----------------------|
| Ver próprios eventos | ✅ | ✅ |
| Ver eventos de outros | ❌ | ✅ |
| Acessar próprio frame/vídeo | ✅ | ✅ |
| Acessar frame/vídeo de outros | ❌ | ✅ |
| Revisar próprios eventos | ✅ | ✅ |
| Revisar eventos de outros | ❌ | ✅ |
| Gerenciar próprias câmeras | ✅ | ✅ |
| Ver câmeras de outros | ❌ | ✅ |

**Regra de Ouro**: Se `email.lower() == "fbi@gmail.com"` → **ACESSO TOTAL** ✅
