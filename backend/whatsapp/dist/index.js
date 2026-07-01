"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = exports.updateWhatsAppConfig = exports.getWhatsAppConfig = void 0;
exports.createWhatsAppRouters = createWhatsAppRouters;
const adminRouter_1 = require("./adminRouter");
const webhookRouter_1 = require("./webhookRouter");
const scheduler_1 = require("./scheduler");
let schedulerStarted = false;
function createWhatsAppRouters(deps) {
    const config = (0, config_1.getWhatsAppConfig)(deps);
    if (!schedulerStarted && config.enabled && config.baseUrl && config.apiKey && config.instanceName) {
        schedulerStarted = true;
        (0, scheduler_1.startWhatsAppScheduler)(deps);
    }
    else if (!config.enabled) {
        console.log('[whatsapp] loaded (scheduler idle — WhatsApp disabled in admin)');
    }
    return {
        adminRouter: (0, adminRouter_1.createAdminRouter)(deps),
        webhookRouter: (0, webhookRouter_1.createWebhookRouter)(deps),
    };
}
var config_1 = require("./config");
Object.defineProperty(exports, "getWhatsAppConfig", { enumerable: true, get: function () { return config_1.getWhatsAppConfig; } });
Object.defineProperty(exports, "updateWhatsAppConfig", { enumerable: true, get: function () { return config_1.updateWhatsAppConfig; } });
var phone_1 = require("./phone");
Object.defineProperty(exports, "normalizePhone", { enumerable: true, get: function () { return phone_1.normalizePhone; } });
