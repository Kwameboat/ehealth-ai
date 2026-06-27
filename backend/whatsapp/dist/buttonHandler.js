"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleButtonOrListReply = handleButtonOrListReply;
exports.sendReminderPrompt = sendReminderPrompt;
const evolution_1 = require("./evolution");
const interactive_1 = require("./interactive");
const sessionStore_1 = require("./sessionStore");
const medication_1 = require("./features/medication");
const healthFeatures_1 = require("./features/healthFeatures");
const facilities_1 = require("./features/facilities");
async function handleButtonOrListReply(deps, config, phone, userId, buttonId, apiKey) {
    const [action, id] = buttonId.includes(':') ? buttonId.split(':') : [buttonId, ''];
    if (action === 'reminder_taken' && id) {
        if ((0, medication_1.markReminderTaken)(deps, id, userId)) {
            await (0, evolution_1.sendTextMessage)(config, phone, '✅ Great job! Marked as taken.');
        }
        return true;
    }
    if (action === 'reminder_snooze' && id) {
        if ((0, medication_1.snoozeReminder)(deps, id, userId, 30)) {
            await (0, evolution_1.sendTextMessage)(config, phone, '⏳ Snoozed 30 minutes.');
        }
        return true;
    }
    if (action === 'reminder_setup_yes' && id) {
        const reminderId = (0, medication_1.activateReminderFromSession)(deps, id, userId);
        await (0, evolution_1.sendTextMessage)(config, phone, reminderId ? '✅ Reminders on! You\'ll get Taken/Snooze buttons.' : 'Could not activate reminder.');
        return true;
    }
    if (action === 'reminder_setup_no' && id) {
        (0, sessionStore_1.deleteSession)(deps, id);
        await (0, evolution_1.sendTextMessage)(config, phone, 'OK — say "remind me" anytime.');
        return true;
    }
    if (action === 'delivery_yes' && id) {
        const msg = await (0, healthFeatures_1.createDeliveryPayment)(deps, config, phone, userId, id);
        await (0, evolution_1.sendTextMessage)(config, phone, msg);
        return true;
    }
    if (action === 'delivery_no' && id) {
        (0, sessionStore_1.deleteSession)(deps, id);
        await (0, evolution_1.sendTextMessage)(config, phone, 'OK. Share location to find a pharmacy.');
        return true;
    }
    if (action === 'lab_explain' && id) {
        const session = (0, sessionStore_1.getSession)(deps, id);
        const reply = await (0, healthFeatures_1.handleLabExplain)(apiKey, String(session?.payload?.summary || ''));
        await (0, evolution_1.sendTextMessage)(config, phone, reply);
        return true;
    }
    if (action === 'lab_find_doctor' && id) {
        (0, sessionStore_1.deleteSession)(deps, id);
        await (0, evolution_1.sendTextMessage)(config, phone, 'Share your location 📍 to find nearby clinics.');
        return true;
    }
    const facilityType = (0, facilities_1.parseFacilityRowId)(action);
    if (facilityType) {
        await (0, facilities_1.savePendingFacilityType)(deps, config, userId, phone, facilityType);
        return true;
    }
    return false;
}
async function sendReminderPrompt(config, phone, reminderId, medicationName, dosage) {
    await (0, interactive_1.sendButtonsMessage)(config, phone, {
        title: `💊 ${medicationName}`,
        description: `Time for your dose:\n${dosage}`,
        buttons: [
            { id: `reminder_taken:${reminderId}`, displayText: 'Taken ✅' },
            { id: `reminder_snooze:${reminderId}`, displayText: 'Snooze ⏳' },
        ],
    });
}
