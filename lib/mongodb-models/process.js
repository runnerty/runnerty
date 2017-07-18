const mongoose = require("mongoose");

var schema = new mongoose.Schema({
  id : String,
  uId : String,
  parentUId : String,
  event: String,
  date: { type: Date, default: Date.now },
  name : String,
  exec : Object,
  args : Object,
  depends_process : Array,
  depends_process_alt : Array,
  retries : Number,
  retry_delay : Number,
  limited_time_end : Number,
  end_on_fail : Boolean,
  end_chain_on_fail : Boolean,
  command_executed : String,
  args_executed : String,
  retries_count : Number,
  output : Object,
  output_iterable : Object,
  custom_values : Object,
  output_share : Object,
  msg_output : String,
  err_output : String,
  data_output : Object,
  extra_output : Object,
  started_at : Date,
  ended_at : Date,
  duration_seconds : Number,
  output_size : Number
});





module.exports = mongoose.model("Process", schema);