var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');

var userDataSchema = mongoose.Schema({
  id: Object,
  data: Object
}, {
  collection: "userdata"
});

var userData = mongoose.model("userData", userDataSchema);


/* GET home page. */
router.get('/', function (req, res, next) {
  userData
    .find({
      "data.pedidos": { $ne: null }
    })
    .then(doc => {
      res.format({
        html: function () {
          console.log(doc)
          res.render('index', {
            title: 'Pedidos - ChatFood',
            itens: doc
          })
        },
        json: function () {
          mapDoc = doc.map(item => {
            return {
              nome: item.data.first_name,
              mesa: item.data.mesa.numero,
              pedidos: item.data.pedidos
            }
          })

          res.json(mapDoc)
        }
      })
    })
    .catch(err => {
      console.log(err);
    });
});

module.exports = router;