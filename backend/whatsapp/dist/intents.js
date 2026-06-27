"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENU_TEXT = void 0;
exports.detectIntent = detectIntent;
function detectIntent(text) {
    const t = text.toLowerCase().trim();
    if (/^(menu|help|features|options)$/.test(t))
        return 'menu';
    if (/\bnhis\b|national health insurance|nhis cover|insurance cover/.test(t))
        return 'nhis';
    if (/\b(diabetes|hypertension|blood pressure|bp|sugar|type 2|fufu|banku|kontomire|waakye|plantain|diet|eat)\b/.test(t)) {
        return 'diet';
    }
    if (/\b(pharmacy|lab|laboratory|clinic|hospital|nearest|find doctor|where.*(pharmacy|clinic|hospital))\b/.test(t)) {
        return 'facility';
    }
    if (/\bfamily\b|grandma|grandpa|dependent|profile:|add profile|my profiles/.test(t))
        return 'family';
    if (/\bbp[:\s]+\d|blood pressure[:\s]+\d|log bp|log blood pressure/.test(t))
        return 'bp_log';
    return 'general';
}
exports.MENU_TEXT = `🏥 *Agyenim Health Menu*

1️⃣ Snap a prescription or medicine photo — I'll set reminders
2️⃣ Ask about *NHIS* coverage
3️⃣ *Diet* advice for Ghanaian meals (diabetes/hypertension)
4️⃣ Share your *location* 📍 to find pharmacy, lab, or clinic
5️⃣ *Family profiles* — manage care for loved ones
6️⃣ Log blood pressure: "BP: 120/80"

Reply with a question or send a photo anytime.`;
