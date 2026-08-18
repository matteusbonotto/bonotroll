// Componente genérico de gráfico (rosca ou barra) por categoria/empresa/fluxo/
// período. Chart.js só é baixado quando este componente realmente renderiza
// (uso em Home e na Lista de Compras). `tipo` é passado a cada render() (não
// fixado no x-data) de propósito: x-data só roda UMA VEZ quando o Alpine
// monta o componente, então um valor capturado ali (ex.: vindo de um
// $store/getter que muda depois) nunca mais atualizaria — passar em render()
// garante que trocar a quebra (categoria/empresa/fluxo/dia/mês/ano) também
// troca rosca <-> barra, não só os dados.
export function categoryChart() {
  return {
    chart: null,
    renderToken: 0,

    async render(data, tipo = 'doughnut') {
      // Token de corrida: se outro render() começar antes deste import()
      // resolver (troca rápida de quebra, ex.: categoria -> dia -> mês em
      // menos de um segundo), esta chamada agora está desatualizada e não
      // deve mais mexer no chart — sem isso, a resposta mais lenta podia
      // "vencer" e sobrescrever o gráfico com dados/tipo já trocados de novo.
      const token = ++this.renderToken;
      const mod = await import('https://esm.sh/chart.js@4/auto');
      const Chart = mod.Chart || mod.default;
      if (token !== this.renderToken || !this.$refs.canvas) return;

      // Destruir e recriar (em vez de mutar + chart.update()) evita um bug do
      // plugin de legenda do Chart.js que corrompe o layout em updates
      // incrementais — recriar é barato aqui e sempre estável.
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }

      const isBar = tipo === 'bar';
      this.chart = new Chart(this.$refs.canvas.getContext('2d'), {
        type: isBar ? 'bar' : 'doughnut',
        data: {
          labels: data.map((d) => d.nome),
          datasets: [{ data: data.map((d) => d.total), backgroundColor: data.map((d) => d.cor), borderWidth: 0, borderRadius: isBar ? 6 : 0 }],
        },
        options: {
          maintainAspectRatio: false,
          cutout: isBar ? undefined : '62%',
          // Sem animação de propósito: além de deixar a troca de quebra mais
          // instantânea, elimina uma corrida real do Chart.js onde o frame
          // de animação de um chart recém-destruído ainda tentava desenhar
          // no contexto do canvas já reaproveitado pelo próximo chart
          // ("Cannot read properties of null (reading 'save')").
          animation: false,
          scales: isBar ? { y: { beginAtZero: true } } : undefined,
          plugins: {
            legend: isBar ? { display: false } : { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } },
          },
        },
      });
    },
  };
}
