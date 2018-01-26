const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  id : String,
  uId : String,
  parentUId : String,
  event: String,
  date: { type: Date, default: Date.now },
  name : String,
  exec : Object,
  args : Object,
  depends_process : Object,
  retries : Number,
  retry_delay : String,
  timeout : Object,
  end_on_fail : Boolean,
  chain_action_on_fail : Object,
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
  output_size : Number,
  notificate_only_last_fail : Boolean,
  fail_on_child_fail : Boolean
});





module.exports = mongoose.model("Process", schema);