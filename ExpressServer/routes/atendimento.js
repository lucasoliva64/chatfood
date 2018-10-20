var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');

var atendimentoSchema = mongoose.Schema({
  mesa: { type: Number, required: true },
  nome: String,
  tipoAtendimento: { type: String, required: true },
}, {
  collection: "atendimento"
});

var atendimento = mongoose.model('atendimento', atendimentoSchema);

/* GET users listing. */
router.get('/', function(req, res, next) {
  atendimento.find({}).then(docs => {
    if(docs.length == 0){
      res.status(202).send({msg: 'Não há itens há solicitaçoes de atendimento'})
    }else{
      res.json(docs)
    }
    
  }).catch(err => console.log(err))
});

router.post('/', function (req, res, next) {
  console.log(req.body.tipoAtendimento)

  var item = {
    tipoAtendimento: req.body.tipoAtendimento,
    nome: req.body.nome,
    mesa: req.body.mesa
  };
  
  var data = new atendimento(item);
  data.save().then((doc) => {
    res.status(200).send(doc)
  })
    .catch(err => res.status(400).send(err))
})

module.exports = router;
