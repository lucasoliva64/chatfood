require('dotenv-extended').load();
//nodemon app
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
            .text(`Olá, Bem-Vindo ao **${estabelecimento.nome}** Em que posso te ajudar?`)
            .suggestedActions(
                builder.SuggestedActions.create(
                    session, [
                        builder.CardAction.imBack(session, "Chamar Garçom", "Chamar Garçom"),
                        builder.CardAction.imBack(session, "Mostrar Cardapio", "Mostrar Cardapio"),
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

        session.beginDialog("confirmaProduto", session.userData.comprar)

        itens = new Array();
        if (session.userData.pedidos) {
            session.userData.pedidos.forEach(produto => {
                console.log(produto)
                itens.push(` \n`
                + `* Nome: ${produto.Nome}\n` 
                + `* Preço: ${produto.Preco}\n`)
            })
            session.send(`Dados do pedido:\n`
            + itens)
        }

        builder.Prompt.text(session, 'Qual sua mesa?')
    },
    (session, results, next) => {
        session.send(`os seus dados são nome: ${results.response.nome}, ${session.message.value.sobrenome}, ${session.message.value.telefone} `);
    }
]).triggerAction({
    matches: 'Pedido'
})

bot.dialog('confirmaProduto', [
    (session, args) => {
        Produto.findOne({
                nome: new RegExp(args, 'i')
            })
            .then(pedido => {
                if (args && session.userData.pedidos) {
                    session.send("novo")
                    session.userData.pedidos.push({
                        Nome: pedido.nome,
                        Preco: pedido.preco
                    })
            
                } else {
                    // New order
                    // Using the conversationData to store the orders
                    session.userData.pedidos = new Array();
                    session.userData.pedidos.push({
                        Nome: pedido.nome,
                        Preco: pedido.preco
                    })
                }

                var msg = `Seu pedido é: ${pedido.nome} em um total R$${pedido.preco}. está certo?`;
            
                builder.Prompts.confirm(session, msg)
            })
            .catch()
    },
    (session, results) => {
        console.log(results)
        if (results.response == true) {
            console.log(session.userData.pedidos)
            session.send('obrigado')
        } else {
            session.send('não tem problema')
            console.log(session.userData.pedidos)
            session.userData.pedidos.pop();
            console.log(session.userData.pedidos)
        }
    },
])

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
                //.subtitle('Offload the heavy lifting of data center management') //adicionar descrição
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

const buscaProduto = (produto, res) => {

    Produto.findOne({
            nome: new RegExp(produto, 'i')
        })
        .then(pedido => {
            this.res = {
                nome: produto.nome,
                preco: produto.preco,
                descricao: produto.descricao
            }
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
                    var msg = (`R$${parseFloat(produto.preco).toFixed(2).replace(".",",")}`);

                    cards.push(
                        new builder.HeroCard(session)
                        .title(produto.nome)
                        .subtitle(produto.descricao)
                        .text(msg.bold().big())
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