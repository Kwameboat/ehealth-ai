import type { WhatsAppConfig } from './config';
import type { WhatsAppDeps } from './deps';
import { sendTextMessage } from './evolution';
import { sendButtonsMessage } from './interactive';
import { deleteSession, getSession } from './sessionStore';
import {
  activateReminderFromSession,
  markReminderTaken,
  snoozeReminder,
} from './features/medication';
import { createDeliveryPayment, handleLabExplain } from './features/healthFeatures';
import { parseFacilityRowId, savePendingFacilityType } from './features/facilities';

export async function handleButtonOrListReply(
  deps: WhatsAppDeps,
  config: WhatsAppConfig,
  phone: string,
  userId: string,
  buttonId: string,
  apiKey: string
): Promise<boolean> {
  const [action, id] = buttonId.includes(':') ? buttonId.split(':') : [buttonId, ''];

  if (action === 'reminder_taken' && id) {
    if (markReminderTaken(deps, id, userId)) {
      await sendTextMessage(config, phone, '✅ Great job! Marked as taken.');
    }
    return true;
  }

  if (action === 'reminder_snooze' && id) {
    if (snoozeReminder(deps, id, userId, 30)) {
      await sendTextMessage(config, phone, '⏳ Snoozed 30 minutes.');
    }
    return true;
  }

  if (action === 'reminder_setup_yes' && id) {
    const reminderId = activateReminderFromSession(deps, id, userId);
    await sendTextMessage(
      config,
      phone,
      reminderId ? '✅ Reminders on! You\'ll get Taken/Snooze buttons.' : 'Could not activate reminder.'
    );
    return true;
  }

  if (action === 'reminder_setup_no' && id) {
    deleteSession(deps, id);
    await sendTextMessage(config, phone, 'OK — say "remind me" anytime.');
    return true;
  }

  if (action === 'delivery_yes' && id) {
    const msg = await createDeliveryPayment(deps, config, phone, userId, id);
    await sendTextMessage(config, phone, msg);
    return true;
  }

  if (action === 'delivery_no' && id) {
    deleteSession(deps, id);
    await sendTextMessage(config, phone, 'OK. Share location to find a pharmacy.');
    return true;
  }

  if (action === 'lab_explain' && id) {
    const session = getSession(deps, id);
    const reply = await handleLabExplain(apiKey, String(session?.payload?.summary || ''));
    await sendTextMessage(config, phone, reply);
    return true;
  }

  if (action === 'lab_find_doctor' && id) {
    deleteSession(deps, id);
    await sendTextMessage(config, phone, 'Share your location 📍 to find nearby clinics.');
    return true;
  }

  const facilityType = parseFacilityRowId(action);
  if (facilityType) {
    await savePendingFacilityType(deps, config, userId, phone, facilityType);
    return true;
  }

  return false;
}

export async function sendReminderPrompt(
  config: WhatsAppConfig,
  phone: string,
  reminderId: string,
  medicationName: string,
  dosage: string
): Promise<void> {
  await sendButtonsMessage(config, phone, {
    title: `💊 ${medicationName}`,
    description: `Time for your dose:\n${dosage}`,
    buttons: [
      { id: `reminder_taken:${reminderId}`, displayText: 'Taken ✅' },
      { id: `reminder_snooze:${reminderId}`, displayText: 'Snooze ⏳' },
    ],
  });
}
