// Documentos FICTÍCIOS para os testes do IRPF — nunca dados reais.
// Formato: o que pdf.js/OCR devolvem por página ([{ pagina, texto }]).
// CNPJs/CPF abaixo são números de teste com dígito verificador válido, sem
// relação com empresas ou pessoas reais. Usados pelos testes unitários e
// pelo gerador de PDFs (scripts/gerar-docs-sinteticos.mjs) dos testes e2e.

export const CNPJ_EMPREGADOR = '11.222.333/0001-81';
export const CNPJ_BANCO = '11.444.777/0001-61';
export const CNPJ_CLINICA = '12.345.678/0001-95';

export function informeEmpregador({ ano = 2025, rendimento = '48.000,00' } = {}) {
  return [{
    pagina: 1,
    texto: [
      'MINISTÉRIO DA FAZENDA',
      'Comprovante de Rendimentos Pagos e de Imposto sobre a Renda Retido na Fonte',
      `Ano-calendário: ${ano}`,
      '1. Fonte Pagadora Pessoa Jurídica',
      `Nome empresarial: Empresa Fictícia de Testes Ltda CNPJ: ${CNPJ_EMPREGADOR}`,
      '2. Pessoa Física Beneficiária dos Rendimentos',
      'CPF: 529.982.247-25 Nome completo: Pessoa de Teste',
      '3. Rendimentos Tributáveis, Deduções e Imposto sobre a Renda Retido na Fonte',
      `Total dos rendimentos (inclusive férias) ${rendimento}`,
      'Contribuição previdenciária oficial 5.280,00',
      'Imposto sobre a renda retido na fonte 1.800,00',
      '5. Rendimentos sujeitos à Tributação Exclusiva (rendimento líquido)',
      '13º (décimo terceiro) salário 4.000,00',
      'Imposto sobre a renda retido na fonte sobre 13º salário 300,00',
    ].join('\n'),
  }];
}

export function informeBanco({ ano = 2025 } = {}) {
  return [{
    pagina: 1,
    texto: [
      `Informe de Rendimentos Financeiros - Ano-calendário ${ano}`,
      `Instituição: Banco Fictício de Testes S.A. CNPJ: ${CNPJ_BANCO}`,
      'Conta corrente',
      `Saldo em 31/12/${ano} 1.250,00`,
      'Poupança',
      `Saldo em 31/12/${ano} 3.000,00`,
      'Rendimentos da caderneta de poupança 85,00',
      'Aplicações financeiras - CDB',
      `Saldo em 31/12/${ano} 10.000,00`,
      'Rendimentos de aplicações financeiras 320,00',
    ].join('\n'),
  }];
}

export function reciboMedico(valor = '350,00', { ano = 2025 } = {}) {
  return [{
    pagina: 1,
    texto: [
      'RECIBO',
      `Prestador: Clínica Fictícia de Testes CNPJ: ${CNPJ_CLINICA}`,
      'Recebi de Pessoa de Teste, CPF 529.982.247-25, referente a consulta médica.',
      `Ano-calendário: ${ano}`,
      `Valor: R$ ${valor}`,
    ].join('\n'),
  }];
}

export function extratoMensal() {
  return [{
    pagina: 1,
    texto: [
      'Extrato de conta corrente - janeiro/2025',
      'Saldo anterior 1.000,00',
      '05/01 PIX recebido 2.000,00',
      '10/01 Pagamento de boleto -300,00',
    ].join('\n'),
  }];
}
