// Limita tentativas em memória. Se o servidor reiniciar, a contagem zera.
function criarLimitador({ maximo, janelaMs }) {
  const registros = new Map();

  function recentes(chave, agora) {
    const lista = (registros.get(chave) ?? []).filter(momento => agora - momento < janelaMs);
    if (lista.length > 0) registros.set(chave, lista);
    else registros.delete(chave);
    return lista;
  }

  return {
    // Quantos milissegundos faltam para liberar. 0 = pode tentar.
    bloqueadoPor(chave) {
      const agora = Date.now();
      const lista = recentes(chave, agora);
      return lista.length >= maximo ? lista[0] + janelaMs - agora : 0;
    },
    registrar(chave) {
      const agora = Date.now();
      const lista = recentes(chave, agora);
      lista.push(agora);
      registros.set(chave, lista);
    },
    limpar(chave) {
      registros.delete(chave);
    },
    varrer() {
      const agora = Date.now();
      for (const chave of [...registros.keys()]) recentes(chave, agora);
    }
  };
}

const MINUTO = 60 * 1000;

const limites = {
  login: criarLimitador({ maximo: 5, janelaMs: 15 * MINUTO }),
  trocarSenha: criarLimitador({ maximo: 5, janelaMs: 15 * MINUTO }),
  esqueci: criarLimitador({ maximo: 5, janelaMs: 60 * MINUTO })
};

// Limpa de vez em quando as chaves antigas, para a memória não crescer.
setInterval(() => Object.values(limites).forEach(l => l.varrer()), 10 * MINUTO).unref();

function textoEspera(ms) {
  const minutos = Math.ceil(ms / MINUTO);
  return `Muitas tentativas. Tente de novo em ${minutos} minuto${minutos > 1 ? 's' : ''}.`;
}

module.exports = { ...limites, textoEspera };