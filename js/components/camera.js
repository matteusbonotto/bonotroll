// Câmera dentro do app (bug real, 2026-10-04: no Galaxy S21 a foto pelo
// `capture="environment"` dava "erro de memória"). Dois motivos somados:
// 1) o input com `capture` abre o app de câmera do Android e o sistema pode
//    matar a aba do navegador enquanto ele está aberto — a foto se perde;
// 2) a foto volta em 12 a 64 MP, e decodificar isso no canvas estoura a RAM.
// Aqui a pré-visualização roda DENTRO do BNTT (getUserMedia) e a captura sai
// já em ~1920 px, o tamanho que o OCR precisa. Se a câmera não puder ser
// aberta (permissão negada, navegador sem suporte), cai para a escolha de
// arquivo, como antes.
const LARGURA_MAXIMA = 1920;

export function cameraStore() {
  return {
    aberta: false,
    erro: '',
    carregando: false,
    titulo: 'Tirar foto',
    _stream: null,
    _resolver: null,

    // Abre a câmera e devolve um File JPEG (ou null se a pessoa cancelar).
    capturar(titulo = 'Tirar foto') {
      this.titulo = titulo;
      this.erro = '';
      this.aberta = true;
      this.carregando = true;
      const promessa = new Promise((resolve) => { this._resolver = resolve; });
      this._iniciar();
      return promessa;
    },

    async _iniciar() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('sem-suporte');
        this._stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: LARGURA_MAXIMA }, height: { ideal: 1080 } },
          audio: false,
        });
        const video = document.getElementById('cg-camera-video');
        if (video) {
          video.srcObject = this._stream;
          await video.play().catch(() => {});
        }
      } catch (e) {
        this.erro = e?.name === 'NotAllowedError'
          ? 'Sem permissão para usar a câmera. Libere nas configurações do navegador ou escolha uma foto da galeria.'
          : 'Não foi possível abrir a câmera. Escolha uma foto da galeria.';
      } finally {
        this.carregando = false;
      }
    },

    async tirarFoto() {
      const video = document.getElementById('cg-camera-video');
      if (!video?.videoWidth) return;
      const escala = Math.min(1, LARGURA_MAXIMA / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * escala);
      canvas.height = Math.round(video.videoHeight * escala);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      this._concluir(blob ? new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }) : null);
    },

    // Fallback/atalho: foto da galeria (mesmo input de antes, sem `capture`).
    escolherArquivo(event) {
      this._concluir(event.target.files?.[0] || null);
      event.target.value = '';
    },

    cancelar() {
      this._concluir(null);
    },

    _concluir(arquivo) {
      this._stream?.getTracks().forEach((t) => t.stop());
      this._stream = null;
      const video = document.getElementById('cg-camera-video');
      if (video) video.srcObject = null;
      this.aberta = false;
      const resolver = this._resolver;
      this._resolver = null;
      resolver?.(arquivo);
    },
  };
}

// Os handlers de foto já existentes recebem um evento de <input type=file>;
// este embrulho deixa reaproveitá-los sem mudar nada neles.
export function eventoDeArquivo(arquivo) {
  return { target: { files: arquivo ? [arquivo] : [], value: '' } };
}
