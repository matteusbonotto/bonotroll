// Componente genérico de gráfico de rosca por categoria. Chart.js só é baixado
// quando este componente realmente renderiza (uso em Home e na Lista de Compras).
export function categoryChart() {
  return {
    chart: null,

    async render(data) {
      const mod = await import('https://esm.sh/chart.js@4/auto');
      const Chart = mod.Chart || mod.default;
      if (!this.$refs.canvas) return;

      // Destruir e recriar (em vez de mutar + chart.update()) evita um bug do
      // plugin de legenda do Chart.js que corrompe o layout em updates
      // incrementais de gráficos de rosca — recriar é barato aqui e sempre estável.
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }

      this.chart = new Chart(this.$refs.canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: data.map((d) => d.nome),
          datasets: [{ data: data.map((d) => d.total), backgroundColor: data.map((d) => d.cor), borderWidth: 0 }],
        },
        options: {
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } } },
        },
      });
    },
  };
}
