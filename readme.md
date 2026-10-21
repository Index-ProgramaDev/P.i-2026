# CAM-SECURITY — Sistema de Segurança com IA

Sistema completo de vigilância com detecção de anomalias usando YOLO + UCF Crime Detection.

## ✨ Novidades Recentes

### Funcionalidades Implementadas
- ✅ **Múltiplas Câmeras**: Suporte para adicionar e gerenciar múltiplas câmeras
- ✅ **Deletar Câmeras**: Remover câmeras do sistema com confirmação
- ✅ **IP Webcam Support**: Compatibilidade com câmeras de celular via IP Webcam
- ✅ **Mosaico Melhorado**: Grid responsivo que se adapta ao número de câmeras
- ✅ **Conexão HTTP/HTTPS**: Suporte aprimorado para streams HTTP (IP Webcam)

## 🚀 Como usar IP Webcam (Celular como Câmera)

### 1. Configuração rápida
1. Instale o app "IP Webcam" no Android
2. Abra o app e clique em "Iniciar servidor"
3. Anote o IP mostrado (ex: `http://10.0.0.105:8080`)

### 2. Adicionar no sistema
1. Acesse a página de **Câmeras**
2. Preencha:
   - **UID**: `cam_celular_01`
   - **Nome**: `Câmera Celular Sala`
   - **Fonte**: `http://10.0.0.105:8080/video`
3. Clique em **Conectar**

📖 [Guia completo de configuração do IP Webcam](Cam-security%20BACK/IP_WEBCAM_SETUP.md)

---

## 📋 Estrutura do Projeto

```
Cam-security BACK/
├── capture.py          # Captura de vídeo (USB, RTSP, HTTP)
├── ai.py              # YOLO + UCF Anomaly Detection
├── events.py          # Gerenciamento de eventos
├── storage.py         # Armazenamento de evidências
├── video_buffer.py    # Buffer de vídeo pré-evento
├── server.py          # API REST + WebSocket
├── database.py        # PostgreSQL (Neon)
├── main.py            # Ponto de entrada
└── config.yaml        # Configuração

Cam-security FRONT/
├── src/
│   ├── pages/
│   │   ├── DashboardPage.jsx
│   │   ├── CamerasPage.jsx    # 🆕 Gerenciamento de câmeras
│   │   └── EventsPage.jsx
│   ├── api.js
│   └── App.jsx
└── package.json
```

---

## 🎯 Fluxo Completo

```
CAPTURE → YOLO (Detecção) → TRACKING → UCF (Anomalia) → EVENTO → ALERTA → EVIDÊNCIAS
```

### 1. Captura
- Suporte: Webcam USB, RTSP, RTMP, HTTP (IP Webcam)
- Auto-reconexão com exponential backoff
- Buffer de vídeo pré-evento (5 segundos)

### 2. Detecção & Tracking
- YOLO11n para detecção de pessoas
- BoT-SORT para rastreamento
- Track ID persistente

### 3. Análise de Anomalias
- ResNet50 + LSTM (UCF Crime Dataset)
- Threshold configurável
- Janela de confirmação

### 4. Eventos & Alertas
- WebSocket em tempo real
- Tipos: `ANOMALY_DETECTED`, `ANOMALY_CONFIRMED`, `PERSON_DETECTED`
- Cooldown configurável

### 5. Evidências
- Frame do momento do evento
- Vídeo: 5s antes + 15s depois
- Metadados completos

---

## 🛠️ Instalação

### Backend (Python)
```powershell
cd "Cam-security BACK"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Frontend (React)
```powershell
cd "Cam-security FRONT"
npm install
```

### Banco de Dados (Neon PostgreSQL)
Crie um arquivo `.env` em `Cam-security BACK/`:
```env
Neon_KEY=postgresql://user:password@host/database?sslmode=require
```

---

## ▶️ Executar

### Backend
```powershell
cd "Cam-security BACK"
python main.py --display
```

Parâmetros:
- `--display`: Abre janela OpenCV (desenvolvimento)
- `--no-server`: Desativa servidor web
- `--port 8000`: Porta do servidor
- `--host 0.0.0.0`: Host do servidor

### Frontend
```powershell
cd "Cam-security FRONT"
npm run dev
```

Acesse: `http://localhost:5173`

---

## 📹 Gerenciamento de Câmeras

### Adicionar Câmera
1. Vá em **Câmeras** no menu
2. Preencha o formulário:
   - **UID**: Identificador único
   - **Nome**: Nome descritivo
   - **Fonte**: `0` (USB) ou URL do stream
3. Clique em **Acoplar Câmera**

### Conectar Câmera
- Clique no botão **Conectar** no card da câmera
- O sistema alterna automaticamente para a fonte selecionada

### Remover Câmera
- Clique no ícone 🗑️ no card da câmera
- Confirme a remoção

### Mosaico
- Visualização simultânea de múltiplas câmeras
- Grid responsivo automático
- Modo tela cheia por câmera

---

## 🔧 Configuração

### config.yaml
```yaml
# Fonte de vídeo
video_path: ""
camera_id: 0
width: 640
height: 480
fps: 30

# YOLO
ai:
  yolo_model_path: "models/yolo11n.pt"
  yolo_conf: 0.25
  yolo_classes: [0]  # 0 = pessoa
  device: "cpu"
  enable_tracking: true

# UCF Anomaly Detection
ucf:
  checkpoint: "ucf_anomaly_test/checkpoints/best_model.pt"
  threshold: 0.5
  clip_length: 16
  clip_stride: 3
  enabled: true

# Eventos
events:
  alert_cooldown_sec: 5
  confirm_window: 3
  confirm_min_hits: 2

# Vídeo
video:
  pre_event_seconds: 5
  post_event_seconds: 15
  fps: 30
```

---

## 🌐 API REST

### Endpoints

#### Saúde
- `GET /health` - Status do sistema
- `GET /status` - Status detalhado

#### Autenticação
- `POST /auth/register` - Cadastrar usuário
- `POST /auth/login` - Login

#### Câmeras
- `GET /cameras?user_id={id}` - Listar câmeras
- `POST /cameras` - Adicionar câmera
- `DELETE /cameras/{camera_uid}?user_id={id}` - 🆕 Remover câmera
- `GET /camera/status` - Status da câmera ativa
- `POST /camera/switch` - Alternar fonte

#### Eventos
- `GET /events` - Listar eventos
- `GET /events/{id}` - Detalhes do evento
- `POST /events/{id}/review` - Revisar evento
- `GET /events/{id}/frame` - Frame do evento
- `GET /events/{id}/video` - Vídeo do evento

#### Streaming
- `GET /stream?overlays=true` - Stream MJPEG
- `WS /ws/events` - WebSocket de alertas
- `GET /events/sse` - Server-Sent Events

---

## 🐛 Troubleshooting

### Câmera não conecta
1. Verifique se a URL está correta
2. Teste no navegador: `http://10.0.0.105:8080/video`
3. Confirme que está na mesma rede WiFi
4. Desative firewall temporariamente

### IP Webcam lento
1. Reduza resolução para 640x480
2. Ajuste qualidade para 50-70%
3. Use FPS de 15-20

### Stream cai frequentemente
1. Desative economia de bateria
2. Mantenha celular plugado
3. Use WiFi 5GHz se disponível

### Banco não conecta
1. Verifique `Neon_KEY` no `.env`
2. Teste conexão: `psql $Neon_KEY`
3. Verifique SSL mode

---

## 📊 Tarefas Futuras

### Em Desenvolvimento
- [ ] RE-ID por TrackID melhorado
- [ ] Reconhecimento facial
- [ ] Bounding box vermelha para suspeitos
- [ ] Dashboard de analytics
- [ ] Notificações push

### Backlog
- [ ] Suporte a ONVIF
- [ ] Gravação contínua
- [ ] Zones personalizadas
- [ ] Multi-tenant completo
- [ ] App mobile

---

## 📝 Licença

MIT License

## 🤝 Contribuindo

Pull requests são bem-vindos! Para mudanças grandes, abra uma issue primeiro.

---

**Desenvolvido com ❤️ usando Python, FastAPI, React e OpenCV**

