const mongoose = require('mongoose');


var estabelecimentoSchema = mongoose.Schema({
    nome: String
}, {
    collection: 'estabelecimento'
});


module.exports = mongoose.model("Estabelecimento", estabelecimentoSchema);