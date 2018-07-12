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

mongoose.connect('mongodb://admin:NodeMongo123@ds018538.mlab.com:18538/chatfood');

/*----------------------------------------------------------------------------------------
 * Bot Storage: This is a great spot to register the private state storage for your bot. 
 * We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
 * For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
 * ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var storageName = "chatfoodfatec"; // Obtain from Azure Portal
var storageKey = "NtqbjIc0wjvIrKpUffNbYajFTz8/Pemyzg4MftY2zQhIdDk7JVZw7D7wVpmpZ1HdpTVJf6DGDWyBC8SG3Fm7VQ=="; // Obtain from Azure Portal
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, storageName, storageKey);
var tableStorage = new botbuilder_azure.AzureBotStorage({
    gzipData: false
}, azureTableClient);


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


// Make sure you add code to validate these fields
var luisAppId = 'bd08769c-a58d-43d9-9d3a-79c9465eab84';
var luisAPIKey = '4174532c4d014347a6d7c14ca1c1f8cb';
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

bot.set('storage', new builder.MemoryBotStorage())

// Add a dialog for each intent that the LUIS app recognizes.
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 
bot.dialog('CumprimentoDialog',
    (session) => {
        var estabelecimentoModel = mongoose.model('Estabelecimento', estabelecimentoSchema);
        estabelecimentoModel.findOne({
            nome: /lepingue/
        }, 'nome', (function (err, estabelecimento) {
            if (err) return console.error(err);
            session.send('Olá, Bem-Vindo ao \'%s\'.', estabelecimento.nome);
            console.log();
            session.endDialog();
        }));
    }
).triggerAction({
    matches: 'Cumprimento'
})

bot.dialog('CardapioDialog',
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
                    ]
                    )
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://azure.microsoft.com/en-us/services/documentdb/', 'Learn More')
                    ])
                );
            });
            var reply = new builder.Message(session)
                .attachmentLayout(builder.AttachmentLayout.carousel)
                .attachments(cards);
            session.send(reply);
        }));

    }
).triggerAction({
    matches: 'Cardapio'
})

bot.dialog('ProdutoDialog',
    (session) => {
        session.send('You reached the Produto intent. You said \'%s\'.', session.message.text);
        var cards = getCardsAttachments();
        var reply = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(cards);

        session.send(reply);

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