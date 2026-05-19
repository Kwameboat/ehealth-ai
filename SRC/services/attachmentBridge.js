/**
 * Pass a picked file from Home → Chat without serializing File in navigation params.
 */
let pending = null;

export function stashAttachment(attachment) {
  pending = attachment;
}

export function takeStashedAttachment() {
  const value = pending;
  pending = null;
  return value;
}
