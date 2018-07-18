const mongoose = require('mongoose');

var produtoSchema = mongoose.Schema({
    nome: String,
    descricao: String,
    imagem: String,
    sinonimos: Array,
    categoria: {nome: String, sinonimos: Array}
}, {
    collection: 'produtos'
});


module.exports = mongoose.model("Produtos", produtoSchema);