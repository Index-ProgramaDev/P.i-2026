import os
import time
import yaml
import logging
import threading
import cv2

logger = logging.getLogger("camsecurity.capture")


class CameraCapture:
    """Captura frames de câmera USB, arquivo local ou stream de rede (RTSP/HTTP).

    Possui mecanismo avançado de auto-reconexão com Exponential Backoff
    para lidar com quedas de sinal de câmeras IP e reconexões resilientes.
    """

    def __init__(self, config_path="config.yaml", shared_state=None, video_buffer=None):
        self.width, self.height, self.fps = 640, 480, 30
        self.camera_id, self.video_path = 0, ""
        self.config_path = config_path
        self.cap = None
        self.source = None
        self.is_video = False
        self.is_network_stream = False
        self.running = False
        self.frame = None
        self.frame_seq = 0
        self.frame_captured_at = 0.0
        self.lock = threading.Lock()
        self.thread = None
        self.shared_state = shared_state
        self.video_buffer = video_buffer

        # Parâmetros de reconexão exponencial (Backoff)
        self.reconnect_base_delay = 2.0     # 2 segundos inicial (aumentado)
        self.reconnect_max_delay = 30.0     # teto de 30 segundos
        self.reconnect_factor = 1.5         # aumenta 50% a cada tentativa (reduzido)
        self.consecutive_failures = 0
        self.max_frame_timeout_sec = 10.0    # timeout sem frames para considerar queda (aumentado)

        self._load_config()

    def _load_config(self):
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, encoding="utf-8") as f:
                    cfg = yaml.safe_load(f) or {}
                for key in ("camera_id", "video_path", "width", "height", "fps"):
                    if key in cfg:
                        setattr(self, key, cfg[key])
        except Exception as e:
            logger.error("Erro ao carregar config: %s", e)

    def _determine_source(self):
        if self.video_path and (os.path.exists(self.video_path) or self._is_url(self.video_path)):
            return self.video_path
        return self.camera_id

    @staticmethod
    def _is_url(path: any) -> bool:
        if isinstance(path, str):
            lower = path.lower()
            return lower.startswith(("rtsp://", "http://", "https://", "rtmp://", "rtsps://"))
        return False

    def _open_capture(self) -> bool:
        """Tenta abrir a fonte de captura."""
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None

        self.source = self._determine_source()
        self.is_network_stream = self._is_url(self.source)
        self.is_video = bool(
            not self.is_network_stream
            and (
                (self.video_path and os.path.exists(self.video_path))
                or (isinstance(self.source, str) and os.path.exists(self.source))
            )
        )

        # Configurações especiais para streams HTTP (IP Webcam)
        if self.is_network_stream:
            if isinstance(self.source, str) and self.source.lower().startswith("http"):
                try:
                    # Para IP Webcam, tenta endpoints alternativos
                    sources_to_try = [self.source]
                    
                    # Se termina em /video, tenta também /videofeed e outras variantes
                    if self.source.endswith("/video"):
                        base = self.source.rsplit("/", 1)[0]
                        sources_to_try.extend([
                            f"{base}/videofeed",
                            f"{base}/video?dummy=param.mjpg",
                        ])
                    
                    connected = False
                    for src in sources_to_try:
                        try:
                            logger.info("Tentando conectar: %s", src)
                            self.cap = cv2.VideoCapture(src)
                            if self.cap and self.cap.isOpened():
                                # Testa leitura de um frame
                                ret, test_frame = self.cap.read()
                                if ret and test_frame is not None:
                                    logger.info("Conectado: %s", src)
                                    self.source = src  # Atualiza para a URL que funcionou
                                    connected = True
                                    break
                                else:
                                    self.cap.release()
                        except Exception as e:
                            logger.debug("Falha em %s: %s", src, e)
                            continue
                    
                    if not connected:
                        logger.error("Nenhuma variante de URL funcionou")
                        return False
                        
                except Exception as e:
                    logger.error("Erro ao conectar stream HTTP: %s", e)
                    return False
            else:
                # RTSP, RTMP, etc
                try:
                    self.cap = cv2.VideoCapture(self.source)
                    if self.cap.isOpened():
                        logger.info("Conectado: %s", self.source)
                except Exception as e:
                    logger.error("Erro ao abrir VideoCapture: %s", e)
                    return False
        else:
            # Arquivo local ou câmera USB
            try:
                self.cap = cv2.VideoCapture(self.source)
                if self.cap.isOpened():
                    logger.info("Conectado: %s", self.source)
            except Exception as e:
                logger.error("Erro ao abrir VideoCapture: %s", e)
                return False

        # Fallback para câmeras locais USB se configurado ID numérico que falhou
        if not self.cap.isOpened() and not isinstance(self.source, str):
            for cid in range(4):
                if cid == self.camera_id:
                    continue
                self.cap.release()
                self.cap = cv2.VideoCapture(cid)
                if self.cap.isOpened():
                    self.camera_id = self.source = cid
                    logger.info("Conectado na câmera alternativa ID: %d", cid)
                    break

        if not self.cap or not self.cap.isOpened():
            logger.warning("Falha ao abrir VideoCapture para fonte: %s", self.source)
            return False

        # Configurações específicas para streams de rede
        if self.is_network_stream:
            # Buffer size 1 para reduzir latência
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            # Timeout para leitura de frames (em ms)
            self.cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
            self.cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)

        if self.is_video:
            real_fps = self.cap.get(cv2.CAP_PROP_FPS)
            if 1 <= real_fps <= 120:
                self.fps = real_fps
        else:
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)

        self.frame_interval = 1 / max(self.fps, 1)
        return True

    def start(self):
        if self.running:
            return

        success = self._open_capture()
        if not success:
            if not self.is_network_stream and not self.is_video:
                raise RuntimeError(f"Não foi possível abrir a fonte: {self.source}")
            logger.warning("Fonte inicial indisponível. Iniciando thread com auto-reconexão...")

        self.running = True
        self.thread = threading.Thread(target=self._loop, daemon=True, name="cam-capture")
        self.thread.start()
        logger.info("Captura iniciada")

    @property
    def real_fps(self) -> float:
        return self.fps

    def _loop(self):
        next_frame = time.perf_counter()
        last_successful_frame_time = time.perf_counter()

        while self.running:
            # Caso a captura esteja fechada, aciona reconexão com Exponential Backoff
            if not self.cap or not self.cap.isOpened():
                self._handle_reconnect()
                last_successful_frame_time = time.perf_counter()
                continue

            if self.is_video:
                delay = next_frame - time.perf_counter()
                if delay > 0:
                    time.sleep(delay)

            ret, frame = False, None
            try:
                ret, frame = self.cap.read()
            except Exception as e:
                logger.warning("Exceção ao ler frame: %s", e)
                ret, frame = False, None

            now = time.perf_counter()

            if not ret or frame is None:
                if self.is_video:
                    # Reinicia o vídeo ao chegar no fim
                    try:
                        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    except Exception:
                        pass
                    next_frame = time.perf_counter()
                    continue

                # Câmera física ou RTSP: verifica se excedeu timeout sem frames
                if now - last_successful_frame_time > self.max_frame_timeout_sec:
                    logger.warning("Timeout %.1fs sem frames. Reconectando...",
                                   self.max_frame_timeout_sec)
                    # Libera captura antes de reconectar
                    if self.cap:
                        try:
                            self.cap.release()
                        except Exception:
                            pass
                        self.cap = None
                    self._handle_reconnect()
                    last_successful_frame_time = time.perf_counter()
                else:
                    time.sleep(0.01)
                continue

            # Frame lido com sucesso: reseta contador de falhas
            last_successful_frame_time = now
            if self.consecutive_failures > 0:
                logger.info("Stream restabelecida!")
                self.consecutive_failures = 0

            try:
                if frame.shape[1] != self.width or frame.shape[0] != self.height:
                    frame = cv2.resize(frame, (self.width, self.height))
            except Exception as e:
                logger.error("Erro ao redimensionar frame: %s", e)
                continue

            with self.lock:
                self.frame = frame
                self.frame_seq += 1
                self.frame_captured_at = now

            if self.shared_state:
                self.shared_state.update_frame(frame, self.frame_seq, now)
            if self.video_buffer:
                self.video_buffer.push_frame(frame, self.frame_seq, now)

            if self.is_video:
                next_frame += self.frame_interval
                if next_frame < time.perf_counter():
                    next_frame = time.perf_counter()

    def _handle_reconnect(self):
        """Executa reconexão com Exponential Backoff."""
        self.consecutive_failures += 1
        # delay = min(base * (factor ** (failures - 1)), max_delay)
        delay = min(
            self.reconnect_base_delay * (self.reconnect_factor ** (self.consecutive_failures - 1)),
            self.reconnect_max_delay,
        )

        logger.warning("Conexão perdida. Reconectando em %.1fs (tentativa #%d)...",
                       delay, self.consecutive_failures)

        # Espera com checagem de self.running para não bloquear shutdown
        start_wait = time.perf_counter()
        while self.running and (time.perf_counter() - start_wait < delay):
            time.sleep(0.1)

        if not self.running:
            return

        ok = self._open_capture()
        if ok:
            logger.info("Reconexão bem-sucedida!")
            self.consecutive_failures = 0

    def get_frame(self, return_meta=False):
        with self.lock:
            frame = self.frame.copy() if self.frame is not None else None
            seq, ts = self.frame_seq, self.frame_captured_at
        return (frame, seq, ts) if return_meta else frame

    def switch_source(self, new_source: any) -> bool:
        """Altera a fonte de vídeo dinamicamente (webcam 0, RTSP ou arquivo)."""
        logger.info("Alternando fonte para: %s", new_source)
        with self.lock:
            # Converte string de número para int (ex: "0" -> 0)
            if isinstance(new_source, str) and new_source.isdigit():
                new_source = int(new_source)

            if isinstance(new_source, int):
                self.camera_id = new_source
                self.video_path = ""
            else:
                self.video_path = str(new_source).strip() if new_source else ""

            self.consecutive_failures = 0
            return self._open_capture()

    def get_status(self) -> dict:
        return {
            "source": self.source,
            "is_video": self.is_video,
            "is_network": self.is_network_stream,
            "running": self.running,
            "fps": self.fps,
            "width": self.width,
            "height": self.height,
        }

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2)
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        logger.info("Câmera encerrada.")