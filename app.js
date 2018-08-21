require('dotenv-extended').load();

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var mongoose = require('mongoose');
const Produto = require('./model/produto');
const Categoria = require('./model/categoria');
const Estabelecimento = require('./model/estabelecimento')
const Mesas = require('./model/mesas');


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

// Criação e teste da conexão com banco de dados
var db = mongoose.connection;
db.on('error', console.error.bind(console, `connection error:`));
db.once('open', function () {});

mongoose.connect(process.env.mongo_db);




// Listen for messages from users 
server.post('/api/messages', connector.listen());


// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't

// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(connector, function (session, args) {
    session.send('Não entendi o que quis dizer com \'%s\'. \n Tente alguma dessas coisas:\nPedir atendimento\nVer Cardapio\nSaber mais sobre o estabelecimento\nRealizar pedido ', session.message.text);
});


// LINK com o luis
const LuisModelUrl = process.env.LUIS_MODEL_URL;
console.log(`luis string de conexao: ${process.env.LUIS_MODEL_URL}`)
// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

bot.set('storage', new builder.MemoryBotStorage())

// Add a dialog for each intent that the LUIS app recognizes.
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 
bot.dialog('CumprimentoDialog',
    (session) => {
        var lepingue = 'lepingue'
        console.log(new RegExp(lepingue, 'i'));

        Estabelecimento.findOne({
            nome: new RegExp(lepingue, 'i')
        }, 'nome', (function (err, estabelecimento) {
            if (err) return console.error(err);
            session.send('Olá, Bem-Vindo a %s.', estabelecimento.nome);
            session.send(`Em que posso te ajudar, ${session.userData.nome} 
            Eu Posso fazer essas coisas:
                * Te mostrar o Cardapio 
                * Chamar um Garçom`);
                 
            //somente pra testar pedidio dialog
            session.beginDialog("PedidoDialog")
        }));
    }
).triggerAction({
    matches: 'Cumprimento'
})


bot.dialog('PedidoDialog', [
    (session, args, next) => {
        if (session.message && session.message.value) {
            // A Card's Submit Action obj was received
            session.userData.nome == session.message.value.nome;
            session.userData.sobrenome == session.message.value.sobrenome;
            next({
                response: session.message.value
            });

            
            return;
        }
        var card = {
            'contentType': 'application/vnd.microsoft.card.adaptive',
            'content': {
                "type": "AdaptiveCard",
                "body": [{
                        "type": "TextBlock",
                        "text": "Precisamos de alguns dados antes de prosseguir",
                        "weight": "bolder"
                    },
                    {
                        "type": "Input.Text",
                        "id": "nome",
                        "placeholder": "Qual o seu Primeiro Nome?"
                    },
                    {
                        "type": "Input.Text",
                        "id": "sobrenome",
                        "placeholder": "Qual seu Sobrenome?"
                    },
                    {
                        "type": "Input.Text",
                        "id": "telefone",
                        "placeholder": "Telefone para contato?"
                    }
                ],
                "actions": [{
                    "type": "Action.Submit",
                    "title": "Enviar",
                    "data": {
                        "x": 13
                    }
                }]
            }
        };

        var msg = new builder.Message(session)
            .addAttachment(card);
        session.send(msg);

    },
    (session, results, next) => {
        session.send(`os seus dados são nome: ${results.response.nome}, ${session.message.value.sobrenome}, ${session.message.value.telefone} `);

        if (session.userData.mesa == null) {
            builder.Prompts.text(session, 'Poderia me informar qual a sua mesa?');
        } else {
            next();
        }
    },

    (session, results, next) => {
        if (session.userData.mesa == null) {
            session.userData.mesa = results.response;
        }
        console.log(session.userData.mesa);
        /// Busca o codigo da mesa e checa o status se for = 0 cadastra o cliente na mesa com o nome sobrenome(intenção ser temporario)
        Mesas.findOne({
            key: session.userData.mesa
        }).then(mesa => {
            console.log(mesa)
            if (mesa.status == 0 || mesa.nome == session.userData.nome) {
                //realizar update na mesa
                buscaCategoria(session);
                next({
                    response: session.userData.mesa
                });
            } else {
                //como retornar um passo?
                session.send(`Entre com uma mesa valida e dísponivel`);
            }
        }).catch();


    },
    (session, results) => {
        buscaCategoria(session);
        builder.Prompts.text(session, 'Escolha a categoria');

        
    },
    (session, results) => {

        card = {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.0",
            "body": [
                {
                    "type": "TextBlock",
                    "text": "Adaptive Card design session",
                    "size": "large",
                    "weight": "bolder"
                },
                {
                    "type": "TextBlock",
                    "text": "Conf Room 112/3377 (10)",
                    "isSubtle": true
                },
                {
                    "type": "ColumnSet",
                    "columns": [
                        {
                            "type": "Column",
                            "width": "20",
                            "items": [
                                {
                                    "type": "Image",
                                    "size": "auto",
                                    "url": "http://messagecardplayground.azurewebsites.net/assets/Mostly%20Cloudy-Square.png"
                                }
                            ],
                            "selectAction": {
                                "type": "Action.OpenUrl",
                                "title": "View Friday",
                                "url": "http://www.microsoft.com"
                            }
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.ShowCard",
                    "title": "Steak",
                    "card": {
                        "type": "AdaptiveCard",
                        "body": [
                            {
                                "type": "TextBlock",
                                "text": "How would you like your steak prepared?",
                                "size": "medium",
                                "wrap": true
                            },
                            {
                                "type": "Input.ChoiceSet",
                                "id": "SteakTemp",
                                "style": "expanded",
                                "choices": [
                                    {
                                        "title": "Rare",
                                        "value": "rare"
                                    },
                                    {
                                        "title": "Medium-Rare",
                                        "value": "medium-rare"
                                    },
                                    {
                                        "title": "Well-done",
                                        "value": "well-done"
                                    }
                                ]
                            },
                            {
                                "type": "Input.Text",
                                "id": "SteakOther",
                                "isMultiline": true,
                                "placeholder": "Any other preparation requestes?"
                            }
                        ],
                        "actions": [
                            {
                                "type": "Action.Submit",
                                "title": "OK",
                                "data": {
                                    "FoodChoice": "Steak"
                                }
                            }
                        ]
                    }
                }
            ]
        }

        var reply = new builder.Message(session)
            .attachments(card);
        session.send(reply);

        

    }

]).triggerAction({
    matches: 'Pedido'
})

bot.dialog('CardapioDialog',
    (session, args, next) => {
        buscaCategoria(session)
    }
).triggerAction({
    matches: 'Cardapio'
})

bot.dialog('ProdutoDialog',
    (session, args) => {
        var produtoEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'produto');
        if (produtoEntity) {
            buscaProdutos(session, produtoEntity.entity);
        } else {
            buscaCategoria(session)
        }
    }
).triggerAction({
    matches: "Produto"
})

bot.dialog('AtendimentoDialog',
    (session, args) => {
        var atendimentoEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'tipoAtendimento');
        console.log(atendimentoEntity.entity)
        switch (atendimentoEntity.entity) {
            case "garçom":
            case "garcom":
            case "atentente":
                session.send(`Intenção pedir garçom`)
                break
            case "conta":
            case "finalizar":
                session.send(`intenção pedir a conta`)
                break
            case "pedido":
                session.send(`intenção realizar pedido`)
                break
            default:
                session.send(`Opção`)
                break
        }
        session.endDialog();
    }
).triggerAction({
    matches: 'Atendimento'
})


const buscaCategoria = (session) => {
    Categoria.find({}).then(categorias => {
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
                    builder.CardAction.imBack(session, `Produtos da categoria ${categoria.nome}`, 'Veja os Produtos')
                ])
            );
        });
        var reply = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(cards);
        session.send(reply);

    }).catch(err => (console.log(err)));
}


const buscaProdutos = (session, text) => {
    Produto.find({})
        .or([{
            nome: new RegExp(text, 'i')
        }, {
            "categoria.sinonimos": new RegExp(text, 'i')
        }, {
            "categoria.nome": new RegExp(text, 'i')
        }, {
            sinonimos: new RegExp(text, 'i')
        }])
        .then(produtos => {
            var cards = [];

            if (produtos.length > 0) {
                produtos.forEach(produto => {
                    console.log("produto.imagem" + produto.imagem)
                    console.log("produto." + produto.descricao)
                    console.log("produto." + produto.categoria)
                    cards.push(
                        new builder.HeroCard(session)
                        .title(produto.nome)
                        .subtitle(produto.descricao)
                        .images([
                            builder.CardImage.create(session, produto.imagem)
                        ])
                    );
                });
                var reply = new builder.Message(session)
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);
                session.send(reply);
            } else {
                session.send(`Não encontramos nenhum produto com ${text}, tente navegar nas 'Categorias'`)
            }
        }).catch(err => (console.log("console Lucas err" + err)));
}