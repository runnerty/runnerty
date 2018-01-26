const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  id : String,
  uId : String,
  execId: String,
  date: { type: Date, default: Date.now },
  parentUId : String,
  event: String,
  name : String,
  iterable : String,
  input : Object,
  custom_values : Object,
  duration_seconds : Number,
  depends_chains : Array,
  queue: String,
  priority: Number,
  started_at: Date,
  ended_at: Date,
});

module.exports = mongoose.model("Chain", schema);