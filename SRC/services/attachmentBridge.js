/**
 * Pass picked files from Home → Chat without serializing File in navigation params.
 */
let pendingList = [];

export function stashAttachments(attachments) {
  pendingList = Array.isArray(attachments) ? attachments : attachments ? [attachments] : [];
}

/** @deprecated Prefer stashAttachments */
export function stashAttachment(attachment) {
  stashAttachments(attachment ? [attachment] : []);
}

export function takeStashedAttachments() {
  const value = pendingList;
  pendingList = [];
  return value;
}

/** @deprecated Prefer takeStashedAttachments */
export function takeStashedAttachment() {
  const list = takeStashedAttachments();
  return list[0] || null;
}
