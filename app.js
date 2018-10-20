require('dotenv-extended').load()
const restify = require('restify')
const builder = require('botbuilder')
const mongoose = require('mongoose')
const botbuilder_mongo = require('botbuilder-mongodb')
const fb = require('botbuilder-facebookextension')
const Produto = require('./model/produto')
const Categoria = require('./model/categoria')
const Estabelecimento = require('./model/estabelecimento')
const config = require('./config')
const request = require('request')

// Setup Restify Server
const server = restify.createServer()

server.listen(process.env.port || process.env.PORT || 3978, () => {
  console.log('%s listening to %s', server.name, server.url)
})

mongoose.connect(process.env.mongo_db)

const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', () => {})

// Listen for messages from users

server.post('/api/messages', config.connector.listen())

// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(config.connector, function (session, args) {
  var msg = new builder.Message(session)
    .text(`Não entendi o que quis dizer com ${session.message.text}. 😕 \n Tente alguma dessas coisas: `)
    .suggestedActions(
      builder.SuggestedActions.create(
        session, [
          builder.CardAction.imBack(session, 'Mostrar Cardápio', 'Mostrar Cardápio'),
          builder.CardAction.imBack(session, 'Pedir a Conta', 'Pedir a Conta'),
          builder.CardAction.imBack(session, 'Chamar Garçom', 'Chamar Garçom'),
          builder.CardAction.imBack(session, 'Realizar Pedido', 'Realizar Pedido'),
          builder.CardAction.imBack(session, 'Informações da Loja', 'Informações da Loja')
        ]
      ))
  session.send(msg)
})

bot.dialog('firstRun', function (session) {
  session.userData.firstRun = true
  session.preferredLocale('pt-BR')
  session.send(`Olá, Bem-Vindo(a) ao lepingue Hambúrgueria.
                Sou um bot e estou aqui para te atender
                  Posso fazer essas coisas:
                  * Mostrar o cardápio
                  * Registrar seu pedido 
                  * Solicitar algum tipo de atendimento
                  * Te mostrar informações sobre o estabelecimento
                Em que posso te ajudar?`)
  session.endDialog()
}).triggerAction({
  onFindAction: function (context, callback) {
    // Only trigger if we've never seen user before
    if (!context.userData.firstRun) {
      // Return a score of 1.1 to ensure the first run dialog wins
      callback(null, 1.1)
    } else {
      callback(null, 0.0)
    }
  }
})
// const inMemoryStorage = new builder.MemoryBotStorage();
const mongoStorage = botbuilder_mongo.GetMongoDBLayer(config.mongoOptions)
bot.set('storage', mongoStorage)

bot.recognizer(config.recognizer
  .onEnabled(function (context, callback) {
    var enabled = context.dialogStack().length <= 1
    callback(null, enabled)
  })
)
bot.set({
  localizerSettings: {
    defaultLocale: 'pt-BR'
  }
})

// Do not persist conversationData
bot.set('persistConversationData', false)

bot.use(builder.Middleware.dialogVersion({
  version: 3.0,
  resetCommand: /^resetuserdata/i
}))

bot.use(builder.Middleware.sendTyping())

bot.use(
  fb.RetrieveUserProfile({
    accessToken: process.env.FacebookAccessToken,
    fields: ['first_name']
  })
)

bot.dialog('CumprimentoDialog', session => {
  const lepingue = 'lepingue'

  Estabelecimento.findOne({
    nome: new RegExp(lepingue, 'i')
  }, 'nome')
    .then((estabelecimento) => {
      let texto = session.userData.first_name ? `Olá ${session.userData.first_name}, seja Bem-Vindo(a) novamente ao ${estabelecimento.nome} Em que posso te ajudar?`
        : `Olá, Bem-Vindo(a) ao ${estabelecimento.nome} Em que posso te ajudar?`

      const msg = new builder.Message(session)
        .text(texto)
        .suggestedActions(
          builder.SuggestedActions.create(
            session, [
              builder.CardAction.imBack(session, 'Mostrar Cardapio', 'Mostrar Cardapio'),
              builder.CardAction.imBack(session, 'Chamar Garçom', 'Chamar Garçom'),
              builder.CardAction.imBack(session, 'Realizar Pedido', 'Realizar Pedido'),
              builder.CardAction.imBack(session, 'Informações da Loja', 'Informações da Loja')
            ]
          )
        )
      session.send(msg)
    }).catch(err => console.log(err))

  session.endDialog()
}).triggerAction({
  matches: 'Cumprimento'
})

bot.dialog('AgradescimentoDialog', session => {
  Estabelecimento.findOne({
    nome: new RegExp(/^lepingue/i)
  }, 'nome').then((estabelecimento) => {
    const msg = new builder.Message(session)
      .text(`Foi um prazer ajudá-lo(a), a ${estabelecimento.nome} estará sempre a sua disposição! 😄`)
      .suggestedActions(
        builder.SuggestedActions.create(
          session, [
            builder.CardAction.imBack(session, 'Mostrar Cardapio', 'Mostrar Cardapio'),
            builder.CardAction.imBack(session, 'Chamar Garçom', 'Chamar Garçom'),
            builder.CardAction.imBack(session, 'Realizar Pedido', 'Realizar Pedido'),
            builder.CardAction.imBack(session, 'Informações da Loja', 'Informações da Loja')
          ]
        )
      )
    session.send(msg)
  }).catch(err => console.log(err))

  session.endDialog()
}).triggerAction({
  matches: 'Agradecimento'
})

bot.dialog('PedidoDialog', [
  (session, results, next) => {
    if (session.userData.first_name) {
      next()
    } else {
      builder.Prompts.text(session, 'Qual a seu primeiro nome?')
    }
  },
  (session, results) => {
    if (!session.userData.first_name) {
      session.userData.first_name = results.response
    }
    session.beginDialog('confirmaProduto', session.userData.comprar)
  },
  (session, results) => {
    if (results.response === 'Não') {
      session.endDialog()
    } else {
      session.beginDialog('ChecaMesa')
    }
  },
  session => {
    session.send(`Enviaremos o item para a mesa: ${session.userData.mesa.numero} \n`)

    const msg = new builder.Message(session)
      .text('Tente alguma dessas coisas: ', session.message.text)
      .suggestedActions(
        builder.SuggestedActions.create(
          session, [
            builder.CardAction.imBack(session, 'Produtos da categoria Bebidas', 'Pedir Bebida'),
            builder.CardAction.imBack(session, 'Produtos da categoria Porções', 'Pedir acompanhamentos'),
            builder.CardAction.imBack(session, 'Mostrar Cardápio', 'Mostrar Cardápio'),
            builder.CardAction.imBack(session, 'Pedir a conta', 'Pedir a conta'),
            builder.CardAction.imBack(session, 'Informações da Loja', 'Informações da Loja')
          ]
        )
      )
    session.send(msg)
    session.endDialog()
  }

]).triggerAction({
  matches: 'Pedido'
}).cancelAction('Cancelar', 'Pedido Cancelado.', {
  matches: /^(cancel|esqueça|deixa|esquece)/i,
  confirmPrompt: 'Seu pedido será cancelado. Você tem certeza?'
})

bot.dialog('confirmaProduto', [
  (session, args) => {
    Produto.findOne({
      nome: new RegExp(args, 'i')
    })
      .then((pedido) => {
        session.userData.pedido = {
          Nome: pedido.nome,
          Preco: pedido.preco //parseFloat(pedido.preco).toFixed(2).replace('.', ',')
        }
        const msg = `Seu pedido é: ${pedido.nome} em um total R$${parseFloat(pedido.preco).toFixed(2).replace('.', ',')}. Está correto? Responda com sim ou não`
        builder.Prompts.choice(session, msg, config.fakeConfirm, config.confirmPrompt)
      })
      .catch()
  },
  (session, results) => {
    if (results.response.entity === 'Sim') {
      session.userData.comprar = {}
      builder.Prompts.text(session, `Digite sua observação sobre o pedido. \nSe não houver digite: Não tem`)
    } else {
      session.send('Não tem problema')
      session.endDialogWithResult({
        response: 'Não'
      })
    }
  },
  (session, results) => {
    session.send(` Detalhes do pedido
        * Nome: ${session.userData.pedido.Nome},
        * Preço: R$${parseFloat(session.userData.pedido.Preco).toFixed(2).replace('.', ',')},
        * Obsevação: ${results.response}`)
    if (session.userData.pedidos) {
      session.userData.pedidos.push({
        Nome: session.userData.pedido.Nome,
        Preco: parseFloat(session.userData.pedido.Preco).toFixed(2).replace('.', ','),
        Observacao: results.response
      })
      session.userData.pedidos[0] = {
        Nome: 'total',
        Preco: session.userData.pedidos[0].Preco + session.userData.pedido.Preco,
        Observacao: 'Valor total da conta'
      }
    } else {
      session.userData.pedidos = []
      session.userData.pedidos.push({
        Nome: 'total',
        Preco: session.userData.pedido.Preco,
        Observacao: 'Valor total da conta'
      })
      session.userData.pedidos.push({
        Nome: session.userData.pedido.Nome,
        Preco: session.userData.pedido.Preco,
        Observacao: results.response
      })
    }
    session.userData.pedido = {}
    session.endDialogWithResult()
  }
])

bot.dialog('ChecaMesa', [
  session => {
    let msg = session.userData.first_name ? `${session.userData.first_name}, qual é a sua mesa?`
      : 'Qual é a sua mesa?'

    const data = new Date()

    if (session.userData.mesa &&
      (session.userData.mesa.dia === data.getDate() &&
        session.userData.mesa.mes === data.getMonth() &&
        session.userData.mesa.ano === data.getYear())) {
      session.endDialogWithResult({
        results: true
      })
    } else {
      builder.Prompts.number(session, msg)
    }
  },
  (session, results) => {
    session.userData.confirmMesa = results.response
    const msg = `Sua mesa é: ${results.response}, todos os pedidos serão levados para essa mesa. Está correto? Responda com sim ou não`
    builder.Prompts.choice(session, msg, config.fakeConfirm, config.confirmPrompt)
  }, (session, results) => {
    if (results.response.entity === 'Sim') {
      const data = new Date()
      session.userData.mesa = {
        numero: session.userData.confirmMesa,
        dia: data.getDate(),
        mes: data.getMonth(),
        ano: data.getYear()
      }
      session.endDialog()
    } else {
      session.replaceDialog('ChecaMesa')
    }
  }

])

bot.dialog('CardapioDialog',
  session => {
    buscaCategoria(session)
    session.endDialog()
  }).triggerAction({
  matches: 'Cardapio'
})

bot.dialog('noneDialog',
  session => {
    const msg = new builder.Message(session)
      .text(`Não entendi o que quis dizer com '${session.message.text}'. 😞 \n Tente alguma dessas coisas: `)
      .suggestedActions(
        builder.SuggestedActions.create(
          session, [
            builder.CardAction.imBack(session, 'Mostrar Cardápio', 'Mostrar Cardápio'),
            builder.CardAction.imBack(session, 'Pedir a Conta', 'Pedir a Conta'),
            builder.CardAction.imBack(session, 'Chamar Garçom', 'Chamar Garçom'),
            builder.CardAction.imBack(session, 'Realizar Pedido', 'Realizar Pedido'),
            builder.CardAction.imBack(session, 'Informações da Loja', 'Informações da Loja')
          ]
        )
      )
    session.send(msg)
    session.endDialog()
  }).triggerAction({
  matches: 'None'
})

bot.dialog('ProdutoDialog',
  (session, args) => {
    if (args) {
      const spt = session.message.text.split(' ')
      if (spt[0] === 'Comprar') {
        const produtoCompostoEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'Produto')
        const produtoEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'produto') // realizar map para retirar "children": [ ] do produto composto caso ainda houver algo no produtinho enviar com o produto composto
        if (produtoCompostoEntity || produtoEntity) {
          if (produtoCompostoEntity) {
            session.userData.comprar = produtoCompostoEntity.entity
            session.beginDialog('PedidoDialog')
          } else {
            session.userData.comprar = produtoEntity.entity
            session.beginDialog('PedidoDialog')
          }
        } else {
          session.send('Sinto muito, não consegui identificar seu produto, chamaremos um garçom')
        }
      } else {
        const produtoEntity = builder.EntityRecognizer.findAllEntities(args.intent.entities, 'produto')
        const produtoCompostoEntity = builder.EntityRecognizer.findAllEntities(args.intent.entities, 'Produto')
        const produtoCompostoEntityChilden = []
        if (produtoCompostoEntity.length > 0) {
          args.intent.compositeEntities.forEach((compEntity) => {
            if (compEntity.children) {
              compEntity.children.forEach((item) => {
                produtoCompostoEntityChilden.push(item.value)
              })
            }
          })
        }
        const entidades = mapEntity(produtoCompostoEntity,
          produtoEntity, produtoCompostoEntityChilden)

        if (produtoEntity.length > 0 || produtoCompostoEntity.length > 0) {
          buscaProdutos(session, entidades)
        } else {
          session.send('Não encontramos nenhum produto em sua mensagem, veja o cardapio.')
          session.beginDialog('CardapioDialog')
        }
      }
    } else {
      session.beginDialog('noneDialog')
    }
  }).triggerAction({
  matches: 'Produto'
})

bot.dialog('AtendimentoDialog', [
  (session, args, next) => {
    const atendimentoEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'tipoAtendimento')
    if (atendimentoEntity) {
      switch (atendimentoEntity.entity) {
        case 'garçom':
        case 'garcom':
        case 'atentente':
          next({ response: 'Garçom' })
          break
        case 'conta':
        case 'finalizar':
          if (session.userData.pedidos && session.userData.pedidos.length > 0) {
            createReceiptCard(session)
            session.beginDialog('finalizarDialog')
          } else {
            session.send('Não há pedidos realizados')
            session.endDialog()
          }
          break
        case 'pedido':
          session.beginDialog('CardapioDialog')
          break
        case 'problema':
        case 'errado':
        case 'incorreto':
          session.send('Desculpe o inconveniente! estamos enviando um garçom para que seu probelma seja resolvido')
          next({ response: 'Problema' })
          break
        default:
        {
          const msg = new builder.Message(session)
            .text('Não entendi o que quis dizer 😕, tente alguma dessas coisas: ', session.message.text)
            .suggestedActions(
              builder.SuggestedActions.create(
                session, [
                  builder.CardAction.imBack(session, 'Chamar Garçom', 'Chamar Garçom'),
                  builder.CardAction.imBack(session, 'Pedir a conta', 'Pedir a conta'),
                  builder.CardAction.imBack(session, 'Chamar Gerente', 'Chamar Gerente'),
                  builder.CardAction.imBack(session, 'Produtos da categoria Bebidas', 'Pedir Bebida'),
                  builder.CardAction.imBack(session, 'Mostrar Cardápio', 'Mostrar Cardápio'),
                  builder.CardAction.imBack(session, 'Informações da Loja', 'Informações da Loja')
                ]
              )
            )
          session.send(msg)
        }
      }
    } else {
      const msg = new builder.Message(session)
        .text('Não entendi o que quis dizer 😞. Tente alguma dessas coisas: ', session.message.text)
        .suggestedActions(
          builder.SuggestedActions.create(
            session, [
              builder.CardAction.imBack(session, 'Produtos da categoria Bebidas', 'Pedir Bebida'),
              builder.CardAction.imBack(session, 'Mostrar Cardápio', 'Mostrar Cardápio'),
              builder.CardAction.imBack(session, 'Pedir a conta', 'Pedir a conta'),
              builder.CardAction.imBack(session, 'Chamar Garçom', 'Chamar Garçom'),
              builder.CardAction.imBack(session, 'Informações da Loja', 'Informações da Loja')
            ]
          )
        )
      session.send(msg)
    }
  },
  (session, results) => {
    if (results && (results.response === 'Garçom' || results.response === 'Problema')) {
      session.beginDialog('ChecaMesa')
    } else {
      session.endDialog()
    }
  },
  (session, results) => {
    const jsonAtendimento = {
      tipoAtendimento: 'Garçom',
      nome: session.userData.first_name,
      mesa: session.userData.mesa.numero
    }
    request.post({
      url: 'http://web-chatfood.herokuapp.com/atendimento/',
      body: jsonAtendimento,
      json: true
    },
    (error, response, body) => {
      if (error) console.error(error)
    })
    session.send(`Enviaremos um garçom para a mesa ${session.userData.mesa.numero}`)
    session.endDialog()
  }
]).triggerAction({
  matches: 'Atendimento'
})

bot.dialog('SobreDialog',
  session => {
    Estabelecimento.findOne({}, ['local', 'descricao', 'horario']).then((estabelecimento) => {
      const msg = new builder.Message(session)
        .text(`${estabelecimento.descricao}

        
        * Local: 
          ${estabelecimento.local},
        
        * Horário de funcionamento: 
           ${estabelecimento.horario}`)

      session.send(msg)
    }).catch(err => console.error(err))
    session.endDialog()
  }).triggerAction({
  matches: 'Sobre'
})

bot.dialog('finalizarDialog', [
  session => {
    const msg = 'Podemos chamar um garçom com a conta?'
    builder.Prompts.choice(session, msg, config.fakeConfirm, config.confirmPrompt)
  },
  (session, results) => {
    if (results.response.entity === 'Sim') {
      session.beginDialog('ChecaMesa')
    } else {
      const msg = new builder.Message(session)
        .text('Ok, você pode continuar pedindo. \n Tente alguma dessas coisas: ', session.message.text)
        .suggestedActions(
          builder.SuggestedActions.create(
            session, [
              builder.CardAction.imBack(session, 'Mostrar Cardápio', 'Mostrar Cardápio'),
              builder.CardAction.imBack(session, 'Pedir a Conta', 'Pedir a Conta'),
              builder.CardAction.imBack(session, 'Realizar Pedido', 'Realizar Pedido'),
              builder.CardAction.imBack(session, 'Informações da Loja', 'Informações da Loja')
            ]
          )
        )
      session.send(msg)
      session.endDialog()
    }
  },
  (session, results) => {
    const jsonAtendimento = {
      tipoAtendimento: 'Conta',
      nome: session.userData.first_name,
      mesa: session.userData.mesa.numero
    }

    request.post({
      url: 'http://web-chatfood.herokuapp.com/atendimento/',
      body: jsonAtendimento,
      json: true
    },
    (error, response, body) => {
      if (error) console.error(error)
    })
    session.send(`Enviaremos um garçom para a mesa ${session.userData.mesa.numero}`)
    session.userData.pedidos = undefined
    session.endDialog()
  }
])

const buscaCategoria = session => {
  Categoria.find({}).then((categorias) => {
    const cards = []
    categorias.forEach((categoria) => {
      cards.push(
        new builder.HeroCard(session)
          .title(categoria.nome)
        // .subtitle('Offload the heavy lifting of data center management') //adicionar descrição
          .images([
            builder.CardImage.create(session, categoria.imagem)
          ])
          .buttons([
            builder.CardAction.imBack(session, `Produtos da categoria ${categoria.nome}`, 'Veja os Produtos')
          ])
      )
    })
    const reply = new builder.Message(session)
      .attachmentLayout(builder.AttachmentLayout.carousel)
      .attachments(cards)
    session.send(reply)
  }).catch(err => (console.log(err)))
}

const buscaProdutos = (session, prods) => {
  if (prods) {
    prods.forEach((prod) => {
      Produto.find()
        .or([{
          nome: new RegExp(prod, 'i')
        }, {
          'categoria.sinonimos': new RegExp(prod, 'i')
        }, {
          'categoria.nome': new RegExp(prod, 'i')
        }, {
          sinonimos: new RegExp(prod, 'i')
        }])
        .then((produtos) => {
          const cards = []
          const cards2 = []
          const cards3 = []

          if (produtos.length > 0) {
            produtos.forEach((produto, index) => {
              const msg = (`R$${parseFloat(produto.preco).toFixed(2).replace('.', ',')} \n `)
              const descricao = produto.descricao //doTruncarStr(produto.descricao, 60)
              if (index < 7) {
                cards.push(
                  new builder.HeroCard(session)
                    .title(produto.nome)
                    .subtitle(msg)
                    //.text(descricao)
                    .images([
                      builder.CardImage.create(session, produto.imagem)
                    ])
                    .buttons([
                      builder.CardAction.imBack(session, `Comprar ${produto.nome}`, 'Comprar')
                    ])
                )
              } else if (index < 14) {
                cards2.push(
                  new builder.HeroCard(session)
                    .title(produto.nome)
                    .subtitle(msg)
                    .text(descricao)
                    .images([
                      builder.CardImage.create(session, produto.imagem)
                    ])
                    .buttons([
                      builder.CardAction.imBack(session, `Comprar ${produto.nome}`, 'Comprar')
                    ])
                )
              } else {
                cards3.push(
                  new builder.HeroCard(session)
                    .title(produto.nome)
                    .subtitle(msg)
                    .text(descricao)
                    .images([
                      builder.CardImage.create(session, produto.imagem)
                    ])
                    .buttons([
                      builder.CardAction.imBack(session, `Comprar ${produto.nome}`, 'Comprar')
                    ])
                )
              }
            })
            const reply = new builder.Message(session)
              .text(`Esses são os resultados para "${prod}"`)
              .attachmentLayout(builder.AttachmentLayout.carousel)
              .attachments(cards)
            session.send(reply)
            if (cards2.length > 0) {
              const reply2 = new builder.Message(session)
                .text(`Esses são os resultados para "${prod}"`)
                .attachmentLayout(builder.AttachmentLayout.carousel)
                .attachments(cards2)
              session.send(reply2)
            }
            if (cards3.length > 0) {
              const reply3 = new builder.Message(session)
                .text(`Esses são os resultados para "${prod}"`)
                .attachmentLayout(builder.AttachmentLayout.carousel)
                .attachments(cards3)
              session.send(reply3)
            }
          } else {
            session.send(`Não encontramos nenhum produto com "${prod}", tente navegar nas 'Categorias'`)
          }
        }).catch(err => (console.log(err)))
    })
  } else {
    session.send('Não consegui identificar nenhum produto em sua mensagem, tente navegar nas \'Categorias\'')
  }
}

function doTruncarStr (str, size) {
  if (str === undefined || str === 'undefined' || str === '' || size === undefined || size === 'undefined' || size === '') {
    return str
  }

  let shortText = str
  if (str.length >= size + 3) {
    shortText = str.substring(0, size).concat('...')
  }
  return shortText
}

const mapEntity = (comp, simp, chil) => {
  const total = []

  const mapSimples = simp.map(prod => prod.entity)

  if (comp.length === 0) {
    return mapSimples
  }

  const mapComp = comp.map(prod => prod.entity)

  chil.forEach((child) => {
    mapSimples.forEach((item) => {
      if (child !== item) {
        total.push(item)
      }
    })
  })

  mapComp.forEach(item => total.push(item))

  return total
}

function createReceiptCard (session) {
  const itens = []

  session.userData.pedidos.forEach((produto, index) => {
    if (index !== 0) {
      itens.push(
        new builder.ReceiptItem.create(session, produto.Preco, produto.Nome)
      )
    }
  })

  const reply = new builder.ReceiptCard(session)
    .title(session.userData.first_name)
    .facts([
      builder.Fact.create(session, session.userData.mesa.numero, 'Mesa')
    ])
    .items(itens)
    .total(session.userData.pedidos[0].Preco)

  const msg = new builder.Message(session)
    .addAttachment(reply)

  session.send(msg)
}
