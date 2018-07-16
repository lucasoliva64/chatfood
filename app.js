require('dotenv-extended').load();

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var mongoose = require('mongoose');


// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());
mongoose.connect(process.env.mongo_db);


// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(connector, function (session, args) {
    session.send('You reached the default message handler. You said \'%s\'.', session.message.text);
});


var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {

});
var Schema = mongoose.Schema;
var estabelecimentoSchema = new Schema({
    nome: String
}, {
    collection: 'estabelecimento'
});

var categoriasSchema = new Schema({
    nome: String,
    imagem: String,
    sinonimos: Array
}, {
    collection: 'categorias'
});
var produtoSchema = new Schema({
    nome: String,
    sinonimos: Array,
    categorias: Array
}, {
    collection: 'produtos'
});


const LuisModelUrl = process.env.LUIS_MODEL_URL;

// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

bot.set('storage', new builder.MemoryBotStorage())

// Add a dialog for each intent that the LUIS app recognizes.
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 
bot.dialog('CumprimentoDialog', [
    (session) => {
        var lepingue = 'lepingue'
        console.log(new RegExp(lepingue,'i'));
        var estabelecimentoModel = mongoose.model('Estabelecimento', estabelecimentoSchema);
        estabelecimentoModel.findOne({
            nome: new RegExp(lepingue,'i')
        }, 'nome', (function (err, estabelecimento) {
            if (err) return console.error(err);
            session.send('Olá, Bem-Vindo a %s.', estabelecimento.nome);
            builder.Prompts.text(session, 'Qual o seu Nome?')
        }));
    },
    (session, results) => {
        session.userData.nome = results.response;
        session.send('Em que posso te ajudar %s.', session.userData.nome +
            '\nEu Posso fazer essas coisas: \n' +
            'Te mostrar o Cardapio \n' +
            'Chamar um Garçom'
        );

    }
]).triggerAction({
    matches: 'Cumprimento'
})

bot.dialog('CardapioDialog',[
    (session) => {
        var categoriasModel = mongoose.model('Categorias', categoriasSchema);
        categoriasModel.find({}, (function (err, categorias) {
            if (err) return console.error(err);
            var cards = [];
            categorias.forEach(categoria => {
                cards.push(
                    new builder.HeroCard(session)
                    .title(categoria.nome)
                    .subtitle('Offload the heavy lifting of data center management')
                    .images([
                        builder.CardImage.create(session, categoria.imagem)
                    ])
                    .buttons([
                        builder.CardAction.imBack(session, categoria.nome, 'Saiba Mais')
                    ])
                );
            });
            var reply = new builder.Message(session)
                .attachmentLayout(builder.AttachmentLayout.carousel)
                .attachments(cards);
            session.send(reply);
            builder.Prompts.text(session, 'Escolha uma categoria');
            
        }));
    },
    (session, results) =>{
        console.log(results.response);
        var produtoModel = mongoose.model('Produto', produtoSchema);
        produtoModel.find({
            categorias: new RegExp(results.response, 'i')
        }, 'nome', (function (err, produtos) {
            produtos.forEach(produto =>{
                console.log(produto.nome);
                session.send('temos %s no cardapio', produto.nome);
            })

        }));
    }

]
).triggerAction({
    matches: 'Cardapio'
})

bot.dialog('ProdutoDialog',
    (session, args) => {;
        var entityProduto = args.intent.entities[0].entity;


        var produtoModel = mongoose.model('Produto', produtoSchema);
        produtoModel.find({
            nome: new RegExp(entityProduto, 'i')
        }, 'nome', (function (err, produtos) {
            produtos.forEach(produto =>{
                console.log(produto.nome);
                session.send('temos %s no cardapio', produto.nome);
            })

        }));


    }
).triggerAction({
    matches: 'Produto'
})

bot.dialog('AtendimentoDialog',
    (session) => {
        session.send('You reached the Atendimento intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Atendimento'
})


function cardsCategorias(categorias) {

    return cards
}