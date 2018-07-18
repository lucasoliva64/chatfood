const mongoose = require('mongoose');

var mesasSchema = mongoose.Schema({
    key: String,
    status: Number,
    nome: String
}, {
    collection: 'mesas'
});

module.exports = mongoose.model("Mesas", mesasSchema);