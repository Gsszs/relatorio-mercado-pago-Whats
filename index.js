const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const axios = require('axios');
const cron = require('node-cron');
const config = require('./config.json')
const TOKEN_MP = config.acess_token
const NUMERO = config.numero
const API_URL = config.apiUrl

const client = new Client({
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
})

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
    configurarRelatorios();
    setTimeout(() => {
        notificarVenda({ valor: (Math.random() * 100).toFixed(2) });
        notificarVenda({ item: 'BloxFruits', valor: (Math.random() * 100).toFixed(2) });
    }, 10000);
});

client.initialize();

function configurarRelatorios() {
    cron.schedule('0 22 * * *', () => enviarRelatorio('diario'));
    cron.schedule('0 22 * * 6', () => enviarRelatorio('semanal'));
    cron.schedule('0 22 1 * *', () => enviarRelatorio('mensal'));
}

async function buscarDadosMercadoPago(periodo) {
    const filtros = {
        range: 'date_created',
        begin_date: periodo === 'diario' ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() : 
                     periodo === 'semanal' ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() : 
                     new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        end_date: new Date().toISOString(),
        status: 'approved'
    };

    try {
        const response = await axios.get(API_URL, {
            headers: { Authorization: `Bearer ${TOKEN_MP}` },
            params: filtros,
        });
        return response.data.results;
    } catch (error) {
        console.error('Erro ao buscar dados do Mercado Pago:', error.response?.data || error.message);
        return null;
    }
}

async function enviarRelatorio(tipo) {
    const agora = new Date();
    let arquivo;

    switch (tipo) {
        case 'diario':
            arquivo = 'relatorio_diario.txt';
            break;
        case 'semanal':
            arquivo = 'relatorio_semanal.txt';
            break;
        case 'mensal':
            arquivo = 'relatorio_mensal.txt';
            break;
        default:
            return;
    }

    const dados = await buscarDadosMercadoPago(tipo);

    if (!dados || dados.length === 0) {
        console.error('Nenhuma venda encontrada para o período.');
        return;
    }

    const totalVendas = dados.length;
    const receitaTotal = dados.reduce((total, venda) => total + venda.transaction_details.total_paid_amount, 0).toFixed(2);

    const relatorio = `Relatório ${tipo.toUpperCase()} (${agora.toLocaleDateString()}):\n` +
                      `Total de vendas: ${totalVendas}\n` +
                      `Receita total: R$ ${receitaTotal}\n` +
                      `Quantidade de transações: ${totalVendas}\n`;

    fs.writeFileSync(arquivo, relatorio, { flag: 'a' });

    await client.sendMessage(NUMERO, relatorio);

    const mensagemArquivo = `Segue o relatório ${tipo.toUpperCase()} completo.`;
    const media = MessageMedia.fromFilePath(arquivo);
    await client.sendMessage(NUMERO, media, { caption: mensagemArquivo });
}

async function notificarVenda(venda) {
    const agora = new Date();
    const logVenda = `Venda realizada em ${agora.toLocaleString()}:\n` +
                     (venda.item ? `Item: ${venda.item}\n` : '') +
                     `Valor: R$ ${venda.valor}\n`;

    fs.appendFileSync('log_vendas.txt', logVenda);

    await client.sendMessage(NUMERO, logVenda);
}

setInterval(() => {
    const vendaSimulada = { item: 'BloxFruits', valor: (Math.random() * 100).toFixed(2) };
    notificarVenda(vendaSimulada);
}, 60000);