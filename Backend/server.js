const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const User = require("./models/User");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect("mongodb://127.0.0.1:27017/Excel")
    .then(() => console.log("mongodb connected"))
    .catch((err) => console.log("Error : ", err));


const userRoutes = require("./routes/User");
app.use("/api/users", userRoutes);  

const fileRoutes = require("./routes/File");
app.use("/api", fileRoutes);

const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
    res.json({ message: "Hello from server." });
});

const port = 8003;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});