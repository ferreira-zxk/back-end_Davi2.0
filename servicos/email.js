// SIMULAÇÃO: em vez de mandar o e-mail, mostra o conteúdo no terminal do servidor.
// Para enviar de verdade, troque o corpo desta função por um serviço de e-mail
// (Nodemailer com SMTP, Resend, SendGrid...).
function enviarEmail(para, assunto, texto) {
  console.log('\n===== E-MAIL SIMULADO =====');
  console.log(`Para: ${para}`);
  console.log(`Assunto: ${assunto}\n`);
  console.log(texto);
  console.log('===========================\n');
}

module.exports = { enviarEmail };