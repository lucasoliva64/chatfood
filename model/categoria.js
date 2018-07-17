const mongoose = require('mongoose');

var categoriasSchema = mongoose.Schema({
    nome: String,
    imagem: String,
    sinonimos: Array
}, {
    collection: 'categorias'
});

module.exports = mongoose.model("Categorias", categoriasSchema);