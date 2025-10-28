import express from "express";
const app = express();

app.get("/", (req, res) => {
  res.send("✅ Test Server Working!");
});

app.listen(3000, () => console.log("Server on http://localhost:3000"));
