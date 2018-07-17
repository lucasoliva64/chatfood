const mongoose = require('mongoose');

var produtoSchema = mongoose.Schema({
    nome: String,
    sinonimos: Array,
    categoria: JSON
}, {
    collection: 'produtos'
});

module.exports = mongoose.model("Produtos", produtoSchema);