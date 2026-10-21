# Configuração do IP Webcam

## Como usar câmeras do celular via IP Webcam

### 1. Instale o IP Webcam no Android
- Baixe o app "IP Webcam" da Play Store
- Link: https://play.google.com/store/apps/details?id=com.pas.webcam

### 2. Configure o IP Webcam
1. Abra o app IP Webcam
2. Role até o final e clique em "Iniciar servidor"
3. O app mostrará um endereço IP, por exemplo: `http://10.0.0.105:8080`

### 3. Configurações Recomendadas no App

**⚠️ IMPORTANTE: Configure ANTES de iniciar o servidor**

#### Qualidade de Vídeo
- **Resolução de vídeo**: 640x480 (VGA) ou 800x600
- **Qualidade JPEG**: 60-70%
- **FPS limite**: 20-30 fps
- **Orientação**: Paisagem (horizontal)

#### Conexão
- **Servidor de vídeo**: Motion JPEG (MJPEG)
- **Porta**: 8080 (padrão)
- **Login/Senha**: Desabilitado (ou anote as credenciais)

#### Economia de Bateria
- **Desativar**: Sleep/Screen timeout
- **Desativar**: Detecção de movimento (não precisa)
- **Desativar**: Gravação local
- **Manter**: Celular plugado na tomada

### 4. Formatos de URL suportados

O sistema tentará automaticamente estas variantes:

#### Para vídeo stream (MJPEG) - RECOMENDADO:
```
http://SEU_IP:8080/video
```
Exemplo: `http://10.0.0.105:8080/video`

#### Alternativas testadas automaticamente:
```
http://SEU_IP:8080/videofeed
http://SEU_IP:8080/video?dummy=param.mjpg
```

### 5. Como adicionar no sistema

1. Acesse a página de Câmeras
2. Preencha o formulário:
   - **UID**: Um identificador único (ex: `cam_celular_sala`)
   - **Nome**: Nome descritivo (ex: `Câmera do Celular`)
   - **Fonte**: `http://10.0.0.105:8080/video`
3. Clique em "Acoplar Câmera"
4. Clique no botão "Conectar" no card da câmera

### 6. Troubleshooting

#### ❌ Erro: "Stream ends prematurely"
**Causa**: Stream HTTP está terminando antes do esperado

**Soluções**:
1. **No app IP Webcam**:
   - Vá em Configurações → Servidor de vídeo → **Motion JPEG**
   - Reduza FPS para 15-20
   - Reduza resolução para 640x480
   - Reduza qualidade para 50-60%

2. **No sistema**:
   - O sistema tenta reconectar automaticamente
   - Aguarde as tentativas de reconexão (2s, 3s, 4.5s, 6.7s...)
   - Se persistir, reinicie o app IP Webcam

3. **Rede WiFi**:
   - Use WiFi 5GHz se disponível (menos interferência)
   - Aproxime o celular do roteador
   - Desconecte outros dispositivos pesados da rede

#### ❌ Erro: Não conecta
- Verifique se o celular e o computador estão na **mesma rede WiFi**
- Teste a URL no navegador: `http://10.0.0.105:8080`
- Verifique se o firewall não está bloqueando

#### ❌ Erro: Vídeo muito lento / travando
1. Reduza resolução para 640x480 ou menos
2. Reduza qualidade para 50%
3. Limite FPS para 15-20
4. Desative preview no celular (Settings → Performance → Disable preview)

#### ❌ Erro: Conexão cai frequentemente
1. Desative economia de bateria do celular
2. Mantenha celular plugado na energia
3. Desative Sleep/Screen timeout no app
4. Use cabo de rede se possível (via adaptador USB-Ethernet)

### 7. URLs alternativas do IP Webcam

| Endpoint | Descrição | Quando usar |
|----------|-----------|-------------|
| `/video` | Stream MJPEG (recomendado) | Uso padrão |
| `/videofeed` | Feed alternativo JavaScript | Se `/video` não funcionar |
| `/video?dummy=param.mjpg` | Com parâmetro forçando MJPEG | Fallback automático |
| `/shot.jpg` | Captura única | Não é stream (não use) |

### 8. Configurações Avançadas

#### Para melhorar estabilidade:
```yaml
# No IP Webcam app:
- Video preferences:
  - Resolution: 640x480
  - Quality: 60%
  - FPS limit: 20
  - Video encoder: Motion JPEG

- Connection:
  - Port: 8080
  - Use HTTPS: OFF (desligado)
  
- Performance:
  - Disable preview: ON
  - Background mode: ON
```

#### Configurações do Sistema:
O sistema já está configurado para:
- ✅ Tentar múltiplas variantes de URL automaticamente
- ✅ Reconexão automática com backoff exponencial
- ✅ Buffer de 1 frame para menor latência
- ✅ Timeout de 10 segundos sem frames antes de reconectar
- ✅ Liberar recursos antes de reconectar

### 9. Exemplo de configuração completa

```yaml
# No formulário do sistema:
UID: cam_portaria_celular
Nome: Câmera Portaria (Celular)
Fonte: http://10.0.0.105:8080/video

# No app IP Webcam:
Resolução: 640x480
Qualidade: 60%
FPS: 20
Servidor: Motion JPEG
Porta: 8080
```

### 10. Teste a conexão

No PowerShell, você pode testar se a URL está acessível:
```powershell
Invoke-WebRequest -Uri "http://10.0.0.105:8080/video" -Method Head -TimeoutSec 5
```

Se retornar código 200, a conexão está OK.

### 11. Múltiplas câmeras IP Webcam

Você pode adicionar múltiplos celulares, cada um terá um IP diferente:
- Celular 1: `http://10.0.0.105:8080/video`
- Celular 2: `http://10.0.0.106:8080/video`
- Celular 3: `http://10.0.0.107:8080/video`

### 12. Logs do Sistema

Se ainda tiver problemas, verifique os logs:
```
INFO: Tentando conectar: http://10.0.0.105:8080/video
INFO: Conectado: http://10.0.0.105:8080/video
```

Ou em caso de erro:
```
WARNING: Timeout 10.0s sem frames. Reconectando...
WARNING: Conexão perdida. Reconectando em 2.0s (tentativa #1)...
```

### 13. Dicas Finais

✅ **Faça**:
- Mantenha celular plugado
- Use resolução baixa (640x480)
- Desative preview no app
- Use WiFi 5GHz
- Aproxime do roteador

❌ **Evite**:
- Resolução muito alta (>1080p)
- Qualidade máxima (>80%)
- FPS muito alto (>30)
- Economia de bateria ativa
- Rede WiFi congestionada
