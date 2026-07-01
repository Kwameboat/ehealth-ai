/** Instant NHIS / diet replies — avoid Gemini on common questions (Passenger stability). */

const GENERIC_NHIS_FALLBACK =
  'NHIS coverage depends on your active membership and accredited facility. Outpatient visits, maternity, child welfare, and selected medicines are often covered, but some items need co-payment or are excluded. Confirm at your registered NHIS facility with your card.';

function nhisKeywordFallback(question) {
  const q = String(question || '').toLowerCase();
  if (/pregnan|antenatal|maternity|delivery|caesarean|c-?section|postnatal|childbirth|\banc\b/.test(q)) {
    return (
      'Yes — active NHIS members in Ghana usually receive maternity benefits at accredited facilities. ' +
      'This commonly includes antenatal (ANC) visits, normal delivery, and postnatal care. ' +
      'Some tests, specialist care, or non-formulary medicines may need co-payment or referral. ' +
      'Confirm with your registered NHIS clinic or hospital and bring your NHIS card.'
    );
  }
  if (/diabetes|hypertension|chronic|bp\b|blood pressure/.test(q)) {
    return (
      'NHIS often covers outpatient visits and selected medicines for chronic conditions like diabetes and hypertension at accredited facilities. ' +
      'Not every brand is covered — some require co-payment. Ask your NHIS facility for the medicines list for your condition.'
    );
  }
  if (/child|children|immuniz|vaccin|welfare/.test(q)) {
    return (
      'NHIS child welfare benefits typically include immunizations and child health services at accredited facilities for enrolled dependents. ' +
      'Confirm which services apply at your registered NHIS facility.'
    );
  }
  if (/medicine|drug|pharmacy|prescription/.test(q)) {
    return (
      'NHIS covers a formulary of medicines at accredited facilities — not every drug is included. ' +
      'You may need to pay a co-payment for some brands or items outside the list. Your pharmacist or NHIS facility can check coverage.'
    );
  }
  if (/surgery|operation|procedure/.test(q)) {
    return (
      'Some surgical and specialist procedures are covered under NHIS when done at accredited facilities and properly referred. ' +
      'Coverage varies — ask your facility for pre-authorization and any co-payment before the procedure.'
    );
  }
  if (/register|enrol|enroll|renew|card/.test(q)) {
    return (
      'To use NHIS, register or renew at an NHIS district office or accredited facility with a valid Ghana Card. ' +
      'Keep premiums up to date and carry your NHIS card when seeking care.'
    );
  }
  return null;
}

function dietKeywordFallback(question) {
  const q = String(question || '').toLowerCase();
  if (/\bbanku\b/.test(q)) {
    return (
      'Banku is high in carbs — if you have diabetes or hypertension, keep portions modest (e.g. one fist-sized ball) and pair with kontomire, okro, or grilled fish instead of salty oily stew. ' +
      'Avoid eating late at night; a short walk after meals helps.'
    );
  }
  if (/\bfufu\b/.test(q)) {
    return (
      'Fufu raises blood sugar quickly. For diabetes, try smaller portions, more soup with vegetables, and limit frequency to occasional. ' +
      'Choose light soup with fish or lean meat; go easy on salted meats and oily palm nut soup if you have hypertension.'
    );
  }
  if (/plantain|kelewele|fried/.test(q)) {
    return (
      'Boiled or grilled plantain is better than fried (kelewele) for blood sugar and heart health. ' +
      'If you enjoy fried foods, keep them occasional and balance with vegetables and water instead of sugary drinks.'
    );
  }
  if (/waakye|rice|jollof/.test(q)) {
    return (
      'Watch portion size with rice-based meals like waakye or jollof — half a plate of rice with extra beans, salad, or vegetables is a good swap. ' +
      'Limit shito and salty processed meats if you have high blood pressure.'
    );
  }
  return null;
}

module.exports = {
  GENERIC_NHIS_FALLBACK,
  nhisKeywordFallback,
  dietKeywordFallback,
};
