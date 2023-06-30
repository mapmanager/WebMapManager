const express = require("express");
const app = express();

app.get("/api/data/*", function (req, res, next) {
  if (req.url.endsWith(".br")) res.set("Content-Encoding", "br");
  next();
});

app.use("/api/data", express.static("./data"));
app.listen(3002);
