const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    originalname: {           
        type: String,
        required: true
    },
    sheets: [String],
    size: Number,
    processedData: Object,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("File", fileSchema);