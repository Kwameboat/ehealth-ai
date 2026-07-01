/** Instant NHIS / diet replies — avoid Gemini on common questions (Passenger stability). */

const GENERIC_NHIS_FALLBACK =
  'NHIS coverage depends on your active membership and accredited facility. Outpatient visits, maternity, child welfare, and selected medicines are often covered, but some items need co-payment or are excluded. Confirm at your registered NHIS facility with your card.';

const GENERIC_DIET_FALLBACK =
  'For everyday health in Ghana, favour balanced plates: half vegetables (kontomire, okro, garden egg stew), a modest portion of staple (yam, plantain, rice, or banku), and protein (fish, chicken, beans, eggs). Limit sugary drinks and salty processed foods. For a personal plan — especially with diabetes, hypertension, pregnancy, or weight goals — confirm with your clinic or dietitian.';

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
  if (/vomit|vommit|nausea|throw(ing)?\s*up|can't keep food|cannot keep food|morning sickness/.test(q)) {
    return (
      'When you are vomiting, start with small sips of water or ORS. Then try plain gentle foods in tiny amounts: rice water, plain kenkey without heavy pepper, dry bread, or boiled yam. ' +
      'Avoid oily, spicy, or heavy stews until you feel better. If vomiting lasts more than 24 hours, you see blood, or you cannot keep fluids down — see a clinic urgently (especially in pregnancy).'
    );
  }
  if (/gain\s*wa(it|eight)|put on weight|underweight|bulk up|too thin|lose weight|weight loss|slim down/.test(q)) {
    if (/gain\s*wa(it|eight)|put on weight|underweight|bulk up|too thin/.test(q)) {
      return (
        'To gain weight in a healthy way over a few months: eat 3 regular meals plus 1–2 snacks daily. Include protein (eggs, fish, beans, groundnut soup), healthy carbs (yam, plantain, rice, banku in normal portions), and groundnuts or fruits as snacks. ' +
        'Add light strength exercise. If you are losing weight without trying, see a clinic first to check for illness before following any plan.'
      );
    }
    return (
      'For gradual weight loss, reduce portion sizes of staples (fufu, banku, rice), cut sugary drinks and fried snacks, and add more vegetables and grilled fish. ' +
      'Walk 15–20 minutes after meals when you can. Do not skip meals entirely — confirm a safe plan with your clinic if you have diabetes or take blood-pressure medicines.'
    );
  }
  if (/diabetes|diabetic|blood sugar|sugar level|type 2/.test(q)) {
    return (
      'With diabetes, focus on smaller portions of high-carb staples (fufu, banku, rice), more vegetables, and protein at each meal. Boiled plantain or yam beats fried options. ' +
      'Avoid sugary drinks and large late-night meals. Check your sugar as advised and follow your clinic plan for medicines.'
    );
  }
  if (/hypertension|high blood pressure|\bbp\b|salt|sodium/.test(q)) {
    return (
      'For hypertension, reduce salt, shito, salted fish, and processed seasonings. Favour kontomire, okro, light soup with fish, and modest banku or rice portions. ' +
      'Limit alcohol and salty snacks. Keep taking prescribed medicines and log BP weekly.'
    );
  }
  if (/pregnan|pregnant|breastfeed|lactat/.test(q)) {
    return (
      'During pregnancy and breastfeeding, eat regular balanced meals: protein (fish, eggs, beans), iron-rich foods (kontomire, garden eggs), fruits, and plenty of fluids. ' +
      'Avoid unpasteurized foods and alcohol. If nausea is severe or you cannot eat, see your antenatal clinic — NHIS often covers ANC visits.'
    );
  }
  if (/kontomire|vegetable|salad|okro|garden egg/.test(q)) {
    return (
      'Kontomire, okro, garden egg stew, and light soups are excellent choices — high in fibre and nutrients with less salt than heavy processed stews. ' +
      'Pair with a small portion of staple and grilled fish for a balanced Ghanaian plate.'
    );
  }
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
  GENERIC_DIET_FALLBACK,
  nhisKeywordFallback,
  dietKeywordFallback,
};
