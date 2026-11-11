function soDigitos(valor) {
    return String(valor ?? '').replace(/\D/g, '');
  }
  
  // Confere os dois dígitos verificadores do CPF.
  function cpfValido(valor) {
    const cpf = soDigitos(valor);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  
    const digito = tamanho => {
      let soma = 0;
      for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };
  
    return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
  }
  
  function texto(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
  }
  
  // Valida e padroniza os dados do cliente. Devolve { erro } ou { dados }.
  function validarCliente(corpo) {
    const dados = {
      nome_completo: texto(corpo.nome_completo),
      cpf: soDigitos(corpo.cpf),
      telefone: soDigitos(corpo.telefone),
      cep: soDigitos(corpo.cep),
      endereco: texto(corpo.endereco),
      numero: texto(corpo.numero),
      bairro: texto(corpo.bairro),
      cidade: texto(corpo.cidade),
      estado: texto(corpo.estado).toUpperCase()
    };
  
    if (dados.nome_completo.length < 5 || !dados.nome_completo.includes(' ')) {
      return { erro: 'Informe o nome completo' };
    }
    if (!cpfValido(dados.cpf)) return { erro: 'CPF inválido' };
    if (dados.telefone.length < 10 || dados.telefone.length > 11) {
      return { erro: 'Telefone inválido. Informe o DDD e o número' };
    }
    if (dados.cep.length !== 8) return { erro: 'CEP inválido' };
    if (!dados.endereco) return { erro: 'Informe o endereço' };
    if (!dados.numero) return { erro: 'Informe o número (ou "s/n")' };
    if (!dados.bairro) return { erro: 'Informe o bairro' };
    if (!dados.cidade) return { erro: 'Informe a cidade' };
    if (!/^[A-Z]{2}$/.test(dados.estado)) return { erro: 'Informe o estado com 2 letras (ex.: MT)' };
  
    return { dados };
  }
  
  module.exports = { soDigitos, cpfValido, validarCliente };