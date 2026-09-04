"use strict";

const { createScheduledRefreshHandler } = require("../lib/graph-cron-handler");

module.exports = createScheduledRefreshHandler("monthly");
