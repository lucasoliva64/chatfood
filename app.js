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

    var msg = new builder.Message(session)
        .text(`Não entendi o que quis dizer com \'%s\'. \n Tente alguma dessas coisas: `, session.message.text)
        .suggestedActions(
            builder.SuggestedActions.create(
                session, [
                    builder.CardAction.imBack(session, "Chamar Garçom", "Chamar Garçom"),
                    builder.CardAction.imBack(session, "Mostrar Cardápio", "Mostrar Cardápio"),
                    builder.CardAction.imBack(session, "Realizar Pedido", "Realizar Pedido"),
                    builder.CardAction.imBack(session, "Informações da Loja", "Informações da Loja"),
                ]
            ));
    session.send(msg);

});





// LINK com o luis

const LuisModelUrl = process.env.LUIS_MODEL_URL;

console.log(`luis string de conexao: ${process.env.LUIS_MODEL_URL}`)

// Create a recognizer that gets intents from LUIS, and add it to the bot

var recognizer = new builder.LuisRecognizer(LuisModelUrl);

bot.recognizer(recognizer);



bot.set('storage', new builder.MemoryBotStorage())

bot.dialog('CumprimentoDialog', (session) => {
    var lepingue = 'lepingue'
    console.log(new RegExp(lepingue, 'i'));

    Estabelecimento.findOne({
        nome: new RegExp(lepingue, 'i')
    }, 'nome', (function (err, estabelecimento) {
        if (err) return console.error(err);

        var msg = new builder.Message(session)
            .text(`Olá, Bem-Vindo ao **Le Pingue** Em que posso te ajudar?`)
            .suggestedActions(
                builder.SuggestedActions.create(
                    session, [
                        builder.CardAction.imBack(session, "Chamar Garçom", "Chamar Garçom"),
                        builder.CardAction.imBack(session, "Mostrar Cardápio", "Mostrar Cardápio"),
                        builder.CardAction.imBack(session, "Realizar Pedido", "Realizar Pedido"),
                        builder.CardAction.imBack(session, "Informações da Loja", "Informações da Loja"),
                    ]
                ));
        session.send(msg);

    }))
}).triggerAction({
    matches: 'Cumprimento'
})


bot.dialog('PedidoDialog', [
    (session, args, next) => {

        if (session.message && session.message.value) {
            console.log(session.message)
            session.userData.pedido =  session.message.value.FoodChoice
            session.userData.detalhePedido =  session.message.value.observacoes
            next({
                response: session.userData.pedido
            });

            return;
        }

        montaCardPedido(session, session.userData.comprar)
    },
    (session, args, next) => {

        session.send(`
            Dados do pedido: \n
                item: ${session.userData.pedido},
                observação: ${session.userData.detalhePedido}
        `)

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
        spt = session.message.text.split(" ");
        if (spt[0] == "Comprar") {
            var produtoCompostoEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'Produto');
            var produtoEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'produto');
            if (produtoCompostoEntity) {
                session.userData.comprar = produtoCompostoEntity.entity;
            } else {
                session.userData.comprar = produtoEntity.entity;
            }

            console.log(session.userData.comprar)
            session.beginDialog("PedidoDialog");
            
        } else {
            
            var produtoEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'produto');
            console.log("produtoEntity " + produtoEntity.entity)
            if (produtoEntity.entity) {
                console.log("produtoEntity if" + produtoEntity.entity)
                buscaProdutos(session, produtoEntity.entity);
            } else {
                console.log("produtoEntity else" + produtoEntity.entity)
                buscaCategoria(session)
            }
        }
    }



).triggerAction({
    matches: "Produto"
})

bot.dialog('AtendimentoDialog',
    (session, args) => {
        console.log(args)
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

const montaCardPedido = (session, produto) => {

    Produto.findOne({
            nome: new RegExp(produto, 'i')
        })
        .then(pedido => {
            card = {
                'contentType': 'application/vnd.microsoft.card.adaptive',
                'content': {
                    'type': 'AdaptiveCard',
                    "body": [{
                            "type": "TextBlock",
                            "text": pedido.nome,
                            "size": "large",
                            "weight": "bolder"
                        },
                        {
                            "type": "ColumnSet",
                            "columns": [{
                                "type": "Column",
                                "width": "20",
                                "items": [{
                                    "type": "Image",
                                    "size": "auto",
                                    "url": pedido.imagem
                                }],
                                "selectAction": {
                                    "type": "Action.OpenUrl",
                                    "title": "View Friday",
                                    "url": "http://www.microsoft.com"
                                }
                            }]
                        }
                    ],
                    "actions": [{
                        "type": "Action.ShowCard",
                        "title": "Detalhes do pedido",
                        "card": {
                            "type": "AdaptiveCard",
                            "body": [{
                                    "type": "TextBlock",
                                    "text": "Alguma obsevação sobre o pedido?",
                                    "size": "medium",
                                    "wrap": true
                                },
                                {
                                    "type": "Input.Text",
                                    "id": "observacoes",
                                    "isMultiline": true,
                                    "placeholder": "observações"
                                }
                            ],
                            "actions": [{
                                "type": "Action.Submit",
                                "title": "OK",
                                "data": {
                                    "FoodChoice": pedido.nome
                                }
                            }]
                        }
                    }]
                }
            }

            var msg = new builder.Message(session)
                .addAttachment(card);
            session.send(msg);


        })
        .catch()
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
                    cards.push(
                        new builder.HeroCard(session)
                        .title(produto.nome)
                        .subtitle(produto.descricao)
                        .images([
                            builder.CardImage.create(session, produto.imagem)
                        ])
                        .buttons([
                            builder.CardAction.imBack(session, `Comprar ${produto.nome}`, 'Comprar')
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