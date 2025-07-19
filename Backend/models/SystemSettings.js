const mongoose = require('mongoose');

const SystemSettingsSchema = new mongoose.Schema({
    maxFileSize: {
        type: Number,
        required: true,
        default: 10 // 10MB
    },
    allowedFileTypes: {
        type: [String],
        required: true,
        default: ['.xlsx', '.xls', '.csv']
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

SystemSettingsSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('SystemSettings', SystemSettingsSchema);