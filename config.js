var builder = require('botbuilder')
module.exports = {
  fakeConfirm: [
    {
      value: 'Sim',
      synonyms: ['yes', 'sim', 'si', 'yep', 'Yes', 'SIM', 'SIm', 'sIm']
    }, {
      value: 'Não',
      synonyms: ['no', 'nop', 'nao', 'Nao', 'não', 'No']
    }
  ],

  confirmPrompt: {
    retryPrompt: 'Não entendi. Por favor responda com sim ou não',
    listStyle: builder.ListStyle.button
  },

  connector: new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
  }),

  mongoOptions: {
    ip: 'admin:NodeMongo123@ds018538.mlab.com',
    port: '18538',
    database: 'chatfood',
    collection: 'userdata',
    username: 'admin',
    password: 'NodeMongo123',
    queryString: 'chatfood'
  },

  recognizer: new builder.LuisRecognizer(process.env.LUIS_MODEL_URL)
}
