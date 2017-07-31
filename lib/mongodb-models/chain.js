const mongoose = require("mongoose");

var schema = new mongoose.Schema({
  id : String,
  uId : String,
  parentUId : String,
  event: String,
  date: { type: Date, default: Date.now },
  name : String,
  iterable : String,
  input : Object,
  custom_values : Object,
  start_date : {type : Date},
  end_date : {type : Date},
  duration_seconds : Number,
  schedule_interval : String,
  depends_chains : Array
});

module.exports = mongoose.model("Chain", schema);